"use client";

import { filterSectionsFooterLinksByAvailableRoutes } from "@open-mtlms/shared";
import type { SectionConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { getDefaultTenantLayout, getThemePreset } from "@open-mtlms/ui-config";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { certificateTemplatesApi } from "@/lib/api/certificate-templates";
import { getLayoutWithHomepageLogo } from "@/lib/api/layout";
import { pageAIApi } from "@/lib/api/page-ai";
import { pagesApi } from "@/lib/api/pages";
import { tenantOrgApi } from "@/lib/api/tenant-org";
import { getTemplateById } from "@/lib/data/page-templates";
import { useAvailableRoutesQuery, availableRoutesKeys } from "@/lib/hooks/use-available-routes";
import { pageKeys } from "@/lib/hooks/use-pages";
import { SECTION_AI_CONFIGS } from "@/lib/section-ai-configs";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { embedLayoutInSections } from "@/lib/types/page";

import {
  defaultBusinessInfo,
  type BusinessInfo,
  type LaunchPhase,
  type PageCreationStatus,
  type PageProgress,
  type WizardPageDefinition,
  type WizardStep,
} from "./types";

// ---------------------------------------------------------------------------
// Pages the wizard always creates
// ---------------------------------------------------------------------------
function getWizardPages(homepageTemplateId: string): WizardPageDefinition[] {
  return [
    { slug: "home", title: "Home", templateId: homepageTemplateId, category: "home" },
    { slug: "about", title: "About Us", templateId: "about-us", category: "about" },
    { slug: "contact", title: "Contact Us", templateId: "contact-us", category: "contact" },
    { slug: "faq", title: "FAQ", templateId: "faq-us", category: "faq" },
    { slug: "privacy", title: "Privacy Policy", templateId: "privacy-us", category: "privacy" },
    { slug: "terms", title: "Terms of Service", templateId: "terms-us", category: "terms" },
    { slug: "login", title: "Login", templateId: "login-minimal", category: "login", skipAI: true },
    { slug: "profile", title: "Profile", templateId: "profile-minimal", category: "profile", skipAI: true },
  ];
}

// ---------------------------------------------------------------------------
// Build business context string for AI
// ---------------------------------------------------------------------------
function buildWizardBusinessContext(info: BusinessInfo): string {
  const parts: string[] = [];
  if (info.name) parts.push(`Organization: ${info.name}`);
  if (info.tagline) parts.push(`Tagline: ${info.tagline}`);
  if (info.description) parts.push(`About: ${info.description}`);
  if (info.contactEmail) parts.push(`Contact Email: ${info.contactEmail}`);
  const phone = info.phoneNumbers.filter(Boolean)[0];
  if (phone) parts.push(`Phone: ${phone}`);
  const addr = info.address;
  const addrStr = [addr.line1, addr.city, addr.state, addr.country].filter(Boolean).join(", ");
  if (addrStr) parts.push(`Address: ${addrStr}`);
  if (info.industry) parts.push(`Industry: ${info.industry}`);
  if (info.founderName) parts.push(`Founder: ${info.founderName}`);
  if (info.socialLinks.website) parts.push(`Website: ${info.socialLinks.website}`);
  return parts.join(". ");
}

// ---------------------------------------------------------------------------
// Simple semaphore for concurrency control
// ---------------------------------------------------------------------------
async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useOnboardingWizard(tenantId: string) {
  const queryClient = useQueryClient();
  const { selectedTenant } = useTenantStore();
  const { data: availableRoutes } = useAvailableRoutesQuery(tenantId);

  // Step state
  const [currentStep, setCurrentStep] = useState<WizardStep>("template");
  const [selectedHomepageTemplateId, setSelectedHomepageTemplateId] = useState<string | null>(null);
  const [selectedThemePresetId, setSelectedThemePresetId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    ...defaultBusinessInfo,
    name: selectedTenant?.tenant_name || "",
  });
  const [useAI, setUseAI] = useState(true);

  // Launch state
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("idle");
  const [pageProgresses, setPageProgresses] = useState<PageProgress[]>([]);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Pre-populate business name from tenant when it loads
  useEffect(() => {
    if (selectedTenant?.tenant_name && !businessInfo.name) {
      setBusinessInfo((prev) => ({ ...prev, name: selectedTenant.tenant_name }));
    }
  }, [selectedTenant?.tenant_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn on browser navigation during launch
  useEffect(() => {
    if (launchPhase === "idle" || launchPhase === "done" || launchPhase === "error") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [launchPhase]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------
  const canGoNext = useCallback((): boolean => {
    switch (currentStep) {
      case "template":
        return !!selectedHomepageTemplateId;
      case "theme":
        return !!selectedThemePresetId;
      case "business-info":
        return !!(
          businessInfo.name &&
          businessInfo.tagline &&
          businessInfo.description &&
          businessInfo.contactEmail &&
          businessInfo.supportEmail &&
          businessInfo.address.line1 &&
          businessInfo.address.city &&
          businessInfo.address.state &&
          businessInfo.address.country &&
          businessInfo.address.postalCode &&
          businessInfo.founderName &&
          businessInfo.founderTitle &&
          businessInfo.founderBio &&
          businessInfo.socialLinks.website &&
          businessInfo.legalEntityName &&
          businessInfo.yearEstablished &&
          businessInfo.industry
        );
      default:
        return false;
    }
  }, [currentStep, selectedHomepageTemplateId, selectedThemePresetId, businessInfo]);

  const goNext = useCallback(() => {
    if (currentStep === "template") setCurrentStep("theme");
    else if (currentStep === "theme") setCurrentStep("business-info");
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep === "theme") setCurrentStep("template");
    else if (currentStep === "business-info") setCurrentStep("theme");
  }, [currentStep]);

  // ---------------------------------------------------------------------------
  // Update a single page's progress
  // ---------------------------------------------------------------------------
  const updateProgress = useCallback((slug: string, patch: Partial<PageProgress>) => {
    setPageProgresses((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, ...patch } : p)),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Phase 1: Create pages sequentially
  // ---------------------------------------------------------------------------
  const createPages = useCallback(
    async (
      wizardPages: WizardPageDefinition[],
      theme: ThemeConfig,
      layout: TenantLayout,
    ): Promise<{ slug: string; pageId: string; sections: SectionConfig[]; skipAI?: boolean }[]> => {
      const created: { slug: string; pageId: string; sections: SectionConfig[]; skipAI?: boolean }[] = [];

      for (const wp of wizardPages) {
        if (abortRef.current) break;
        updateProgress(wp.slug, { status: "creating" });

        const template = getTemplateById(wp.templateId);
        if (!template) {
          updateProgress(wp.slug, { status: "error", error: `Template "${wp.templateId}" not found` });
          continue;
        }

        const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
          template.sections,
          availableRoutes,
        );

        // Embed layout (header/footer/sidebar) into sections so pages render with full chrome
        const sectionsWithLayout = embedLayoutInSections(filteredSections, layout);

        try {
          const page = await pagesApi.createPage({
            tenantId,
            slug: wp.slug,
            title: wp.title,
            sections: sectionsWithLayout,
            theme,
            seo: { ...template.seo, title: wp.title },
          });
          updateProgress(wp.slug, { status: "created", pageId: page.id });
          created.push({ slug: wp.slug, pageId: page.id, sections: page.sections, skipAI: wp.skipAI });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const isConflict = errMsg.includes("409") || errMsg.includes("already exists") || errMsg.includes("duplicate");

          if (isConflict) {
            // Page still exists despite cleanup, try deleting and recreating
            try {
              const existing = await pagesApi.getPages(tenantId, 1, 200);
              const match = existing.pages.find((p) => p.slug === wp.slug);
              if (match) {
                await pagesApi.deletePage(match.id);
                const page = await pagesApi.createPage({
                  tenantId,
                  slug: wp.slug,
                  title: wp.title,
                  sections: sectionsWithLayout,
                  theme,
                  seo: { ...template.seo, title: wp.title },
                });
                updateProgress(wp.slug, { status: "created", pageId: page.id });
                created.push({ slug: wp.slug, pageId: page.id, sections: page.sections, skipAI: wp.skipAI });
              } else {
                updateProgress(wp.slug, { status: "error", error: "Slug conflict, page not found to replace" });
              }
            } catch {
              updateProgress(wp.slug, { status: "error", error: "Failed to resolve page conflict" });
            }
          } else {
            updateProgress(wp.slug, { status: "error", error: errMsg });
          }
        }
      }

      return created;
    },
    [tenantId, availableRoutes, updateProgress],
  );

  // ---------------------------------------------------------------------------
  // Phase 2: AI generate content for a single page
  // ---------------------------------------------------------------------------
  const aiGeneratePage = useCallback(
    async (pageId: string, slug: string, sections: SectionConfig[]) => {
      updateProgress(slug, { status: "ai-generating" });

      const businessContext = buildWizardBusinessContext(businessInfo);
      const pageLayout = sections
        .filter((s) => s.visible !== false)
        .map((s, i) => ({ type: s.type, order: s.order ?? i }));

      const generatableSections = sections.filter((s) => s.type in SECTION_AI_CONFIGS);
      if (generatableSections.length === 0) {
        updateProgress(slug, { status: "ai-done" });
        return;
      }

      const updatedSections = [...sections];
      let anyFailed = false;

      const sectionResults = await Promise.allSettled(
        generatableSections.map(async (section) => {
          const config = SECTION_AI_CONFIGS[section.type];
          if (!config) return;

          const result = await pageAIApi.generateSection({
            sectionType: section.type,
            prompt: businessInfo.description,
            businessContext,
            pageLayout,
            generateImages: true,
            ...(config && {
              clientSchema: config.jsonSchema,
              clientInstructions: config.instructions,
            }),
          });

          const content = config
            ? config.transform(result.content, result.orgLogos)
            : result.content;

          // Merge AI content with existing template content, preserves images/media from template
          const idx = updatedSections.findIndex((s) => s.id === section.id);
          if (idx !== -1) {
            const existingContent = (updatedSections[idx].content ?? {}) as Record<string, unknown>;
            updatedSections[idx] = {
              ...updatedSections[idx],
              content: { ...existingContent, ...(content as Record<string, unknown>) },
            };
          }
        }),
      );

      anyFailed = sectionResults.some((r) => r.status === "rejected");

      // Batch update the page with all generated content
      try {
        await pagesApi.updatePage(pageId, { sections: updatedSections });
        updateProgress(slug, { status: anyFailed ? "ai-failed" : "ai-done" });
      } catch {
        updateProgress(slug, { status: "ai-failed" });
      }
    },
    [businessInfo, updateProgress],
  );

  // ---------------------------------------------------------------------------
  // Phase 3: Publish all pages
  // ---------------------------------------------------------------------------
  const publishPages = useCallback(
    async (created: { slug: string; pageId: string }[]) => {
      await Promise.allSettled(
        created.map(async ({ slug, pageId }) => {
          updateProgress(slug, { status: "publishing" });
          try {
            await pagesApi.togglePublish(pageId, true);
            updateProgress(slug, { status: "published" });
          } catch {
            updateProgress(slug, { status: "error", error: "Failed to publish" });
          }
        }),
      );
    },
    [updateProgress],
  );

  // ---------------------------------------------------------------------------
  // Main launch function
  // ---------------------------------------------------------------------------
  const launch = useCallback(async () => {
    if (!selectedHomepageTemplateId || !selectedThemePresetId) return;

    abortRef.current = false;
    setLaunchError(null);

    const themePreset = getThemePreset(selectedThemePresetId);
    if (!themePreset) {
      setLaunchError("Selected theme not found");
      return;
    }

    const wizardPages = getWizardPages(selectedHomepageTemplateId);
    const theme = themePreset.config;

    // Initialize progress tracking
    setPageProgresses(
      wizardPages.map((wp) => ({ slug: wp.slug, title: wp.title, status: "pending" as PageCreationStatus })),
    );

    // Fetch tenant layout (header/footer/sidebar) to embed in all pages
    let layout: TenantLayout;
    try {
      layout = await getLayoutWithHomepageLogo(tenantId);
    } catch {
      layout = getDefaultTenantLayout(tenantId) as TenantLayout;
    }

    // Phase 0: Delete any existing pages with conflicting slugs
    setLaunchPhase("creating");
    try {
      const existingPages = await pagesApi.getPages(tenantId, 1, 200);
      const slugsToCreate = new Set(wizardPages.map((wp) => wp.slug));
      const conflicting = existingPages.pages.filter((p) => slugsToCreate.has(p.slug));
      for (const page of conflicting) {
        await pagesApi.deletePage(page.id);
      }
    } catch {
      // If we can't fetch/delete, proceed anyway, createPage will handle conflicts
    }

    // Phase 1: Create pages
    const created = await createPages(wizardPages, theme, layout);

    if (created.length === 0) {
      setLaunchPhase("error");
      setLaunchError("No pages could be created. Please try again.");
      return;
    }

    // Phase 2: AI generation (if enabled), skip system pages like login/profile
    if (useAI) {
      setLaunchPhase("ai-generating");
      const aiEligible = created.filter((p) => !p.skipAI);
      // Mark skipped pages as done immediately
      for (const p of created) {
        if (p.skipAI) updateProgress(p.slug, { status: "ai-done" });
      }
      const aiTasks = aiEligible.map(
        ({ pageId, slug, sections }) =>
          () =>
            aiGeneratePage(pageId, slug, sections),
      );
      await withConcurrency(aiTasks, 3);
    }

    // Phase 3: Publish all
    setLaunchPhase("publishing");
    await publishPages(created);

    // Phase 4: Setup certificate template (pick random + publish)
    try {
      const { templates } = await certificateTemplatesApi.getTemplates();
      const available = templates.filter((t) => t.available);
      if (available.length > 0) {
        const random = available[Math.floor(Math.random() * available.length)];
        await certificateTemplatesApi.selectTemplate(random.id);
        await certificateTemplatesApi.togglePublish(true);
      }
    } catch {
      // Non-critical, certificate setup failure shouldn't block onboarding
    }

    // Phase 5: Finalize
    queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
    queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });

    // Save all org details to organisation settings
    try {
      const addr = businessInfo.address;
      const social = businessInfo.socialLinks;
      await tenantOrgApi.updateOrgDetails({
        tagline: businessInfo.tagline || null,
        description: businessInfo.description || null,
        contact_email: businessInfo.contactEmail || null,
        support_email: businessInfo.supportEmail || null,
        phone_numbers: businessInfo.phoneNumbers.filter(Boolean).length ? businessInfo.phoneNumbers.filter(Boolean) : null,
        whatsapp_numbers: businessInfo.whatsappNumbers.filter(Boolean).length ? businessInfo.whatsappNumbers.filter(Boolean) : null,
        address: addr.line1 ? {
          line1: addr.line1 || undefined,
          line2: addr.line2 || undefined,
          city: addr.city || undefined,
          state: addr.state || undefined,
          country: addr.country || undefined,
          postalCode: addr.postalCode || undefined,
        } : null,
        founder_name: businessInfo.founderName || null,
        founder_title: businessInfo.founderTitle || null,
        founder_bio: businessInfo.founderBio || null,
        social_links: social.website ? {
          website: social.website || undefined,
          linkedin: social.linkedin || undefined,
          twitter: social.twitter || undefined,
          facebook: social.facebook || undefined,
          instagram: social.instagram || undefined,
          youtube: social.youtube || undefined,
        } : null,
        legal_entity_name: businessInfo.legalEntityName || null,
        registration_number: businessInfo.registrationNumber || null,
        year_established: businessInfo.yearEstablished ? parseInt(businessInfo.yearEstablished, 10) : null,
        industry: businessInfo.industry || null,
      });
      queryClient.invalidateQueries({ queryKey: ["tenant-org"] });
    } catch {
      // Non-critical, pages are already created, don't fail the wizard
    }

    setLaunchPhase("done");
  }, [
    selectedHomepageTemplateId,
    selectedThemePresetId,
    useAI,
    businessInfo,
    tenantId,
    createPages,
    aiGeneratePage,
    publishPages,
    queryClient,
  ]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const reset = useCallback(() => {
    setCurrentStep("template");
    setSelectedHomepageTemplateId(null);
    setSelectedThemePresetId(null);
    setBusinessInfo({
      ...defaultBusinessInfo,
      name: selectedTenant?.tenant_name || "",
    });
    setUseAI(true);
    setLaunchPhase("idle");
    setPageProgresses([]);
    setLaunchError(null);
  }, [selectedTenant?.tenant_name]);

  return {
    // Step state
    currentStep,
    setCurrentStep,
    selectedHomepageTemplateId,
    setSelectedHomepageTemplateId,
    selectedThemePresetId,
    setSelectedThemePresetId,
    businessInfo,
    setBusinessInfo,
    useAI,
    setUseAI,

    // Navigation
    canGoNext,
    goNext,
    goBack,

    // Launch
    launchPhase,
    pageProgresses,
    launchError,
    launch,
    reset,
  };
}

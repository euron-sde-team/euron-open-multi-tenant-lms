"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import type { SectionConfig, SectionType } from "@open-mtlms/shared";
import { createSectionConfig } from "@open-mtlms/shared";
import { sectionRegistry } from "@open-mtlms/ui-config";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { pageAIApi } from "@/lib/api/page-ai";
import { useGenerateSection } from "@/lib/hooks/use-page-ai";
import { useOrgDetails } from "@/lib/hooks/use-tenant-org";
import { SECTION_AI_CONFIGS } from "@/lib/section-ai-configs";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { cn } from "@/lib/utils";

/** Section types where AI generates button text + route mapping */
const BUTTON_SECTIONS = new Set(["hero", "hero-code-tech", "cta-banner", "cta-split"]);

/**
 * Curated set of GENERIC, theme-neutral landing-page sections the AI page
 * planner chooses from. We intentionally exclude the dozens of template-specific
 * variants (photography / mindfulness / astrology / exam-prep / code-tech /
 * about-us-* / blog-saas-* / *-page, etc.): sending all ~80 confuses the model
 * (structured output fails to parse) and mixing themed sections produces
 * incoherent pages. These generic blocks compose well for ANY business.
 */
const PAGE_PLAN_ALLOWLIST: string[] = [
  "hero",
  "stats-counter",
  "logo-cloud",
  "features-grid",
  "features-list",
  "features-tabs",
  "features-accordion",
  "about",
  "team",
  "timeline",
  "gallery",
  "pricing-table",
  "testimonials-carousel",
  "testimonials-grid",
  "faq-accordion",
  "cta-banner",
  "cta-split",
  "contact-form",
];

interface PageCatalogEntry {
  type: string;
  label: string;
  description: string;
  defaultVariant: string;
}

type RegistryEntryLite = {
  name?: string;
  description?: string;
  variants?: { id: string }[];
  defaultContent: unknown;
};

/**
 * The catalog the AI page-planner chooses from: section types that are BOTH
 * AI-fillable (have a config) AND creatable (exist in the section registry).
 */
function buildPageCatalog(): PageCatalogEntry[] {
  const registry = sectionRegistry as unknown as Record<string, RegistryEntryLite>;
  const out: PageCatalogEntry[] = [];
  for (const type of PAGE_PLAN_ALLOWLIST) {
    // Only include sections that are both AI-fillable and registry-creatable.
    if (!(type in SECTION_AI_CONFIGS)) continue;
    const reg = registry[type];
    if (!reg) continue;
    out.push({
      type,
      label: reg.name ?? SECTION_AI_CONFIGS[type]?.label ?? type,
      description: reg.description ?? "",
      defaultVariant: reg.variants?.[0]?.id ?? "default",
    });
  }
  return out;
}

interface AiGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "section" | "page";
  sectionId?: string;
  sectionType?: SectionType;
}

function getSectionLabel(type: string): string {
  return SECTION_AI_CONFIGS[type]?.label ?? type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Visual sections that get a real AI-generated, on-brand image (replacing the
 * generic stock placeholder), and the content field + aspect ratio for each.
 */
const SECTION_IMAGE_CONFIG: Record<
  string,
  { field: string; aspect: string; scene: string }
> = {
  hero: {
    field: "image",
    aspect: "16:9",
    scene:
      "the brand's real audience actively engaged in its core experience, authentic, aspirational editorial photography",
  },
  about: {
    field: "image",
    aspect: "4:3",
    scene: "an authentic team or workspace environment, candid and human",
  },
  "cta-banner": {
    field: "image",
    aspect: "16:9",
    scene: "an inviting, aspirational lifestyle scene related to the offering",
  },
  "cta-split": {
    field: "image",
    aspect: "4:3",
    scene: "an inviting, aspirational lifestyle scene related to the offering",
  },
};

type SingleImageConfig = { field: string; aspect: string; scene: string };

/**
 * Role-based fallbacks for THEMED sections (hero-mindfulness, hero-code-tech,
 * about-photography, cta-*, …) that carry a single `image` field but aren't in
 * SECTION_IMAGE_CONFIG above. Only single design images, arrays (galleries,
 * program/recipe cards) are intentionally left alone, and catalog listings
 * (courses/books/bundles) never match because their images come from fetched
 * data, not stored section content.
 */
const IMAGE_ROLE_FALLBACKS: {
  match: (type: string) => boolean;
  aspect: string;
  scene: string;
}[] = [
  { match: (t) => t.startsWith("hero"), aspect: "16:9", scene: SECTION_IMAGE_CONFIG.hero.scene },
  { match: (t) => t.startsWith("about"), aspect: "4:3", scene: SECTION_IMAGE_CONFIG.about.scene },
  { match: (t) => t.startsWith("cta"), aspect: "16:9", scene: SECTION_IMAGE_CONFIG["cta-banner"].scene },
];

/**
 * Resolve the single-image config for a section: the curated entry if present,
 * else a role-based fallback IFF the section stores a string `image` field.
 * Returns null for sections without a stored design image (e.g. content
 * listings), so their fetched course/book imagery is never touched.
 */
function resolveSingleImageConfig(
  sectionType: string,
  sectionContent: unknown
): SingleImageConfig | null {
  const explicit = SECTION_IMAGE_CONFIG[sectionType];
  if (explicit) return explicit;
  const content = (sectionContent ?? {}) as Record<string, unknown>;
  if (typeof content.image !== "string") return null;
  const role = IMAGE_ROLE_FALLBACKS.find((r) => r.match(sectionType));
  return {
    field: "image",
    aspect: role?.aspect ?? "16:9",
    scene: role?.scene ?? SECTION_IMAGE_CONFIG.hero.scene,
  };
}

/** Poll an image job to completion; resolves to the URL or null (best-effort). */
async function pollImageJob(jobId: string): Promise<string | null> {
  for (let i = 0; i < 48; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const st = await pageAIApi.getImageGenerationStatus(jobId);
      if (st.status === "completed") return st.progress?.result?.url ?? null;
      if (st.status === "failed") return null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Sections whose content is an ARRAY of items each needing its own image
 * (gallery tiles, team/faculty portraits). Capped to bound time + cost.
 */
const SECTION_ARRAY_IMAGE_CONFIG: Record<
  string,
  { arrayField: string; imageField: string; aspect: string; max: number; portrait?: boolean }
> = {
  gallery: { arrayField: "items", imageField: "image", aspect: "4:3", max: 6 },
  team: { arrayField: "members", imageField: "avatar", aspect: "3:4", max: 6, portrait: true },
};

/**
 * Generate one image per item for array sections (gallery/team) and return a
 * patch updating that array. Best-effort + parallel; items without a generated
 * image keep their existing value. Never throws.
 */
async function generateArrayImages(
  sectionType: string,
  content: Record<string, unknown>,
  summary: string
): Promise<Record<string, unknown> | null> {
  const cfg = SECTION_ARRAY_IMAGE_CONFIG[sectionType];
  if (!cfg) return null;
  const arr = Array.isArray(content[cfg.arrayField])
    ? (content[cfg.arrayField] as Record<string, unknown>[])
    : [];
  if (arr.length === 0) return null;

  const urls = await Promise.all(
    arr.slice(0, cfg.max).map(async (item) => {
      const role = typeof item.role === "string" ? item.role : "";
      const caption =
        typeof item.caption === "string"
          ? item.caption
          : typeof item.alt === "string"
            ? item.alt
            : "";
      const topic = summary.split(/[.\n]/)[0]?.slice(0, 140) ?? "";
      const desc = cfg.portrait
        ? `Professional studio portrait headshot of ${role || "a faculty member"}, friendly and confident, neutral background. No text or logos.`
        : `Editorial, photorealistic photograph. Scene: ${caption || `an authentic scene representing ${topic}`}. Premium, modern, authentic, not generic stock. No text, words, or logos.`;
      try {
        const { jobId } = await pageAIApi.submitImageGeneration({
          prompt: desc.slice(0, 700),
          aspectRatio: cfg.aspect,
          sectionContext: { sectionType },
        });
        return await pollImageJob(jobId);
      } catch {
        return null;
      }
    })
  );

  const newArr = arr.map((item, i) =>
    i < urls.length && urls[i] ? { ...item, [cfg.imageField]: urls[i] } : item
  );
  return { [cfg.arrayField]: newArr };
}

/**
 * Generate a premium, on-brand image for a visual section. Image models want a
 * concrete VISUAL SCENE, not a factual brief, so we describe a scene tied to
 * the section's headline (the grounded facts already shaped that copy). Never
 * throws.
 */
async function generateSectionImage(
  cfg: SingleImageConfig,
  sectionType: string,
  content: Record<string, unknown>,
  summary: string
): Promise<string | null> {
  const headline = typeof content.headline === "string" ? content.headline : "";
  const description =
    typeof content.subheadline === "string"
      ? content.subheadline
      : typeof content.description === "string"
        ? content.description
        : "";
  // Short topical hint (first sentence of the summary), keeps the image
  // on-topic without dumping the whole factual brief into an image prompt.
  const topic = summary.split(/[.\n]/)[0]?.slice(0, 160) ?? "";
  try {
    const { jobId } = await pageAIApi.submitImageGeneration({
      prompt:
        `Editorial, photorealistic photograph. Scene: ${cfg.scene}. It should visually represent: "${headline || topic}". Context: ${topic}. Premium, modern, natural lighting, authentic: NOT generic stock. No text, words, numbers, charts, or logos in the image.`.slice(
          0,
          800
        ),
      aspectRatio: cfg.aspect,
      sectionContext: { sectionType, headline, description },
    });
    return await pollImageJob(jobId);
  } catch {
    return null;
  }
}

type SectionGenStatus = "pending" | "generating" | "done" | "error";

type OrgCompleteness = "incomplete" | "partial" | "complete";

interface OrgContextFields {
  description?: string | null;
  tagline?: string | null;
  industry?: string | null;
  contactEmail?: string | null;
}

function buildBusinessContext(
  orgData: OrgContextFields | undefined,
  tenantName: string | undefined
): string {
  const parts: string[] = [];
  if (tenantName) parts.push(`Organization: ${tenantName}`);
  if (orgData?.tagline) parts.push(`Tagline: ${orgData.tagline}`);
  if (orgData?.industry) parts.push(`Industry: ${orgData.industry}`);
  if (orgData?.description) parts.push(`About: ${orgData.description}`);
  return parts.join(". ");
}

function getOrgCompleteness(orgData: OrgContextFields | undefined): OrgCompleteness {
  if (!orgData) return "incomplete";
  const hasBasics = !!(orgData.description || orgData.tagline);
  if (!hasBasics) return "incomplete";
  const hasExtended = !!(orgData.industry && orgData.contactEmail);
  if (!hasExtended) return "partial";
  return "complete";
}

export function AiGenerateDialog({
  open,
  onOpenChange,
  scope,
  sectionId,
  sectionType,
}: AiGenerateDialogProps) {
  const [prompt, setPrompt] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const {
    updateSectionContent,
    updateSectionContentSilent,
    saveToHistory,
    pageConfig,
    setPageConfig,
  } = useEditorStore();

  // Catalog of section types the AI page-planner can choose from.
  const pageCatalog = useMemo(() => buildPageCatalog(), []);

  // The blueprint the AI designed for the current page run (page scope).
  const [plannedSections, setPlannedSections] = useState<
    { id: string; type: string }[]
  >([]);
  const [planning, setPlanning] = useState(false);

  // Page-scope mode: "fill" writes AI content into the CURRENT template's
  // sections (keeps its design/layout, the default); "redesign" replans the
  // whole page from generic blocks (the original replace-everything behaviour).
  const [pageMode, setPageMode] = useState<"fill" | "redesign">("fill");

  const generateSectionMutation = useGenerateSection();

  // Org context
  const { data: orgData } = useOrgDetails();
  const selectedTenant = useTenantStore((s) => s.selectedTenant);
  const tenantName = selectedTenant?.tenant_name;

  // Per-section generation status (page mode)
  const [sectionStatuses, setSectionStatuses] = useState<
    Record<string, SectionGenStatus>
  >({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-populate prompt on first open
  const hasAutoPopulated = useRef(false);
  useEffect(() => {
    if (open && !hasAutoPopulated.current && !prompt && orgData?.description) {
      setPrompt(orgData.description);
      hasAutoPopulated.current = true;
    }
    if (!open) {
      hasAutoPopulated.current = false;
    }
  }, [open, prompt, orgData?.description]);

  // Reset statuses when dialog closes
  useEffect(() => {
    if (!open) {
      setSectionStatuses({});
      setIsGenerating(false);
      setPlannedSections([]);
      setPlanning(false);
      setPageMode("fill");
    }
  }, [open]);

  const isLoading = generateSectionMutation.isPending || isGenerating || planning;

  // For page mode, find which sections have an AI config in the registry
  const orgCompleteness = getOrgCompleteness(orgData);
  const businessContext = buildBusinessContext(orgData, tenantName);

  // Build page layout from visible sections for layout-aware generation
  const pageLayout = pageConfig.sections
    .filter((s) => s.visible !== false)
    .map((s) => ({ type: s.type, order: s.order }));

  const handleNavigateToSettings = useCallback(() => {
    onOpenChange(false);
    router.push("/dashboard/settings/organisation");
  }, [onOpenChange, router]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      if (scope === "section" && sectionId && sectionType) {
        // Single section mode
        const config = SECTION_AI_CONFIGS[sectionType];
        const result = await generateSectionMutation.mutateAsync({
          sectionType,
          prompt: prompt.trim(),
          businessContext: businessContext || undefined,
          pageLayout,
          generateImages: !config, // only backend generates images for legacy sections
          ...(config && { clientSchema: config.jsonSchema, clientInstructions: config.instructions }),
        });

        // If frontend registry has a transform, apply it; otherwise use raw backend content
        const content = config ? config.transform(result.content, result.orgLogos) : result.content;
        updateSectionContent(sectionId, content);

        // For configured (themed/generic) sections, also refresh the section's
        // single design image on-brand, matching the page-fill behaviour. When
        // there's no config the backend already handled images (generateImages),
        // so we skip. Catalog listings have no stored `image`, so they're untouched.
        if (config) {
          const section = pageConfig.sections.find((s) => s.id === sectionId);
          const imgCfg = resolveSingleImageConfig(sectionType, section?.content);
          if (imgCfg) {
            const url = await generateSectionImage(
              imgCfg,
              sectionType,
              content,
              prompt.trim()
            );
            if (url) {
              updateSectionContent(sectionId, { [imgCfg.field]: url });
            }
          }
        }

        toast({
          title: "Content generated",
          description: `${getSectionLabel(sectionType)} content has been updated.`,
        });

        onOpenChange(false);
        setPrompt("");
      } else {
        // Page mode. Two paths: fill the CURRENT template's sections (default,
        // preserves its design/layout) or redesign the whole page from scratch.
        saveToHistory();
        setPlannedSections([]);
        setSectionStatuses({});

        // Shared: fill a set of target sections with AI content + on-brand
        // imagery, updating per-section status. Used by both page paths.
        const fillSections = async (
          targets: { section: SectionConfig; brief?: string }[],
          enhanced: string,
          layout: { type: string; order: number }[]
        ): Promise<{ successCount: number; failCount: number }> => {
          let successCount = 0;
          let failCount = 0;

          const promises = targets.map(async ({ section, brief }) => {
            const config = SECTION_AI_CONFIGS[section.type];
            try {
              const result = await pageAIApi.generateSection({
                sectionType: section.type,
                prompt: enhanced,
                businessContext: businessContext || undefined,
                pageLayout: layout,
                generateImages: !config,
                ...(config && {
                  clientSchema: config.jsonSchema,
                  clientInstructions: brief
                    ? `${config.instructions}\n\nFor THIS section specifically: ${brief}`
                    : config.instructions,
                }),
              });

              let content: Record<string, unknown>;
              try {
                content = config ? config.transform(result.content, result.orgLogos) : result.content;
              } catch {
                // Transform mismatch, fall back to raw AI output rather than dropping the section.
                content = result.content;
              }
              updateSectionContentSilent(section.id, content);
              successCount++;

              // Generate a real, on-brand single image (hero/about/cta and their
              // themed variants, resolved from the section's own `image` field).
              // Catalog listings (courses/books/bundles) have no stored image so
              // they're never touched. Array item images (galleries, program/
              // recipe cards) are only generated for the curated generic types.
              // Best-effort and parallel; failures keep the existing content.
              const imgCfg = resolveSingleImageConfig(section.type, section.content);
              if (imgCfg) {
                const url = await generateSectionImage(
                  imgCfg,
                  section.type,
                  content,
                  enhanced
                );
                if (url) {
                  updateSectionContentSilent(section.id, { [imgCfg.field]: url });
                }
              } else if (SECTION_ARRAY_IMAGE_CONFIG[section.type]) {
                const patch = await generateArrayImages(section.type, content, enhanced);
                if (patch) updateSectionContentSilent(section.id, patch);
              }

              setSectionStatuses((prev) => ({ ...prev, [section.id]: "done" }));
            } catch {
              failCount++;
              setSectionStatuses((prev) => ({ ...prev, [section.id]: "error" }));
            }
          });

          await Promise.allSettled(promises);
          return { successCount, failCount };
        };

        if (pageMode === "fill") {
          // Fill the current template's sections, keep its design and layout.
          const targets = pageConfig.sections
            .filter(
              (s) => s.visible !== false && !s.deleted && s.type in SECTION_AI_CONFIGS
            )
            .map((s) => ({ section: s }));

          if (targets.length === 0) {
            toast({
              title: "Nothing to fill",
              description:
                "This template has no AI-fillable sections. Switch to “Redesign from scratch” to have AI build the page.",
              variant: "destructive",
            });
            return;
          }

          setIsGenerating(true);
          setPlannedSections(
            targets.map((t) => ({ id: t.section.id, type: t.section.type }))
          );
          const initialStatuses: Record<string, SectionGenStatus> = {};
          for (const t of targets) initialStatuses[t.section.id] = "generating";
          setSectionStatuses(initialStatuses);

          const layout = targets.map((t, i) => ({ type: t.section.type, order: i }));
          const { successCount, failCount } = await fillSections(
            targets,
            prompt.trim(),
            layout
          );
          setIsGenerating(false);

          toast({
            title: "Content generated",
            description: `Wrote AI content for ${successCount} section(s)${failCount > 0 ? ` (${failCount} kept existing content)` : ""}.`,
          });

          setTimeout(() => {
            onOpenChange(false);
            setPrompt("");
          }, 1200);
          return;
        }

        // Redesign from scratch: AI plans a fresh page from generic blocks.
        if (pageCatalog.length === 0) return;

        // 1. Plan: AI chooses an ordered section blueprint + an enriched summary.
        setPlanning(true);
        let plan;
        try {
          // Planning runs as a background job (grounded research + a large
          // generation) and we poll for the result, a single synchronous
          // request was too slow and tripped the gateway's 504 timeout.
          plan = await pageAIApi.planPageAndWait({
            prompt: prompt.trim(),
            businessContext: businessContext || undefined,
            availableSections: pageCatalog.map((c) => ({
              type: c.type,
              label: c.label,
              description: c.description,
            })),
          });
        } finally {
          setPlanning(false);
        }

        const catalogByType = new Map(pageCatalog.map((c) => [c.type, c]));
        const planned = (plan?.sections ?? [])
          .filter((p) => catalogByType.has(p.type))
          .map((p, i) => {
            const entry = catalogByType.get(p.type)!;
            const reg = sectionRegistry as unknown as Record<string, RegistryEntryLite>;
            const section = createSectionConfig(
              p.type as SectionType,
              entry.defaultVariant,
              reg[p.type].defaultContent,
              i
            );
            return { section, brief: p.brief, type: p.type };
          });

        if (planned.length === 0) {
          toast({
            title: "Could not design the page",
            description: "Try describing your business or page with a bit more detail.",
            variant: "destructive",
          });
          return;
        }

        // 2. Replace the page's sections with the freshly-designed blueprint.
        setPageConfig({
          ...pageConfig,
          sections: planned.map((p) => p.section),
          updatedAt: new Date().toISOString(),
        });
        setPlannedSections(planned.map((p) => ({ id: p.section.id, type: p.type })));

        // 3. Fill each new section with AI content (in parallel).
        setIsGenerating(true);
        const enhanced = plan.enhancedSummary?.trim() || prompt.trim();
        const newLayout = planned.map((p, i) => ({ type: p.type, order: i }));
        const initialStatuses: Record<string, SectionGenStatus> = {};
        for (const p of planned) initialStatuses[p.section.id] = "generating";
        setSectionStatuses(initialStatuses);

        const { successCount, failCount } = await fillSections(
          planned.map((p) => ({ section: p.section, brief: p.brief })),
          enhanced,
          newLayout
        );
        setIsGenerating(false);

        toast({
          title: "Page generated",
          description: `Designed a ${planned.length}-section page, wrote ${successCount} section(s) and generated images${failCount > 0 ? ` (${failCount} kept default content)` : ""}.`,
        });

        setTimeout(() => {
          onOpenChange(false);
          setPrompt("");
        }, 1200);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate content. Please try again.";
      toast({
        title: "Generation failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const getSectionStatusIcon = (status: SectionGenStatus) => {
    switch (status) {
      case "generating":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "done":
        return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
      case "error":
        return <XCircle className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent
        hideCloseButton
        className="max-w-md gap-0 overflow-hidden p-0 shadow-2xl"
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault();
        }}
      >
        <DialogHeader className="border-b bg-muted/30 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  AI Generate
                </DialogTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {scope === "section"
                    ? `Generate content for this ${sectionType ? getSectionLabel(sectionType) : ""} section`
                    : "Generate content for the entire page"}
                </p>
              </div>
            </div>
            <button
              onClick={() => !isLoading && onOpenChange(false)}
              className={cn(
                "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isLoading && "pointer-events-none opacity-50"
              )}
              aria-label="Close"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* Org completeness banner */}
          {orgCompleteness === "incomplete" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-medium">Add org details for better results</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                  Add your description and tagline in{" "}
                  <button
                    onClick={handleNavigateToSettings}
                    className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                  >
                    organisation settings
                  </button>{" "}
                  so AI can generate branded, industry-specific content.
                </p>
              </div>
            </div>
          )}

          {orgCompleteness === "partial" && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                <p>
                  Using {tenantName || "org"} context.{" "}
                  <button
                    onClick={handleNavigateToSettings}
                    className="font-medium underline underline-offset-2 hover:text-foreground"
                  >
                    Add more details
                  </button>{" "}
                  (industry, contact info) for even better results.
                </p>
              </div>
            </div>
          )}

          {orgCompleteness === "complete" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Using {tenantName} context
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Describe your business or page
            </Label>
            <Textarea
              placeholder={
                scope === "section"
                  ? "e.g. Online coding bootcamp teaching Python, React, and AWS to career changers..."
                  : "e.g. We are an online education platform helping beginners learn programming through hands-on projects..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isLoading}
            />
          </div>

          {scope === "page" && plannedSections.length === 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setPageMode("fill")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
                    pageMode === "fill"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Fill this template
                </button>
                <button
                  type="button"
                  onClick={() => setPageMode("redesign")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
                    pageMode === "redesign"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Redesign from scratch
                </button>
              </div>
              <p className="flex items-start gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                {pageMode === "fill"
                  ? "AI writes fresh, on-brand content and imagery for your current template's sections, keeping its design and layout."
                  : "AI designs the entire page from your description, choosing, ordering, and writing every section. This replaces the current layout (undo with Ctrl+Z)."}
              </p>
            </div>
          )}

          {scope === "page" && plannedSections.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                {planning
                  ? "Designing your page…"
                  : pageMode === "fill"
                    ? "Filling template sections:"
                    : "AI-designed page sections:"}
              </Label>
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {plannedSections.map((s) => {
                  const status = sectionStatuses[s.id];
                  return (
                    <Badge
                      key={s.id}
                      variant="secondary"
                      className={cn(
                        "gap-1 text-xs",
                        status === "done" &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400",
                        status === "error" &&
                          "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {getSectionStatusIcon(status)}
                      {getSectionLabel(s.type)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Button auto-link indicator */}
          {((scope === "section" && sectionType && BUTTON_SECTIONS.has(sectionType)) ||
            (scope === "page" && pageCatalog.some((c) => BUTTON_SECTIONS.has(c.type)))) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Buttons will be automatically linked to the most relevant pages.
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isLoading}
            className={cn("w-full gap-2")}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Content
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

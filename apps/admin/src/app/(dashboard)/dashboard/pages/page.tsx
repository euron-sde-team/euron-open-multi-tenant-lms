"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { filterSectionsFooterLinksByAvailableRoutes } from "@open-mtlms/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Award,
  Code2,
  Edit,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  AllTemplatesModal,
  CertificateByTypeButton,
  CertificateTemplateModal,
  OnboardingWizard,
  PageCategoryCard,
  RedesignWebsiteDialog,
  SystemPageCard,
  TemplateCarousel,
} from "@/components/pages";
import { pagesApi } from "@/lib/api/pages";
import {
  PAGE_CATEGORIES_FOR_GRID,
  canUseCustomCode,
  getCategoryBySlug,
  type PageCategory,
} from "@/lib/data/page-categories";
import {
  getTemplatesByPageCategory,
  getTemplateById,
  type PageTemplate,
} from "@/lib/data/page-templates";
import { SYSTEM_PAGES } from "@/lib/data/system-pages";
import { availableRoutesKeys, useAvailableRoutesQuery } from "@/lib/hooks/use-available-routes";
import {
  useSelectedCertificateTemplate,
  useToggleCertificatePublish,
} from "@/lib/hooks/use-certificate-templates";
import {
  pageKeys,
  useCreatePage,
  useDeletePage,
  usePages,
  useSavePage,
  useTogglePublish,
} from "@/lib/hooks/use-pages";
import { useTenantWebUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useFeatureAccessStore } from "@/lib/stores/feature-access-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { Page } from "@/lib/types/page";
import { decodeHtml } from "@/lib/utils";
import { isCourseSlug } from "@/lib/utils/slug";

// Component for displaying pages that don't match any category
interface OtherPageCardProps {
  page: Page;
  onDeleteClick: (pageId: string) => void;
  onTogglePublish: (pageId: string, currentStatus: boolean) => void;
  isTogglingPublish?: boolean;
}

function OtherPageCard({
  page,
  onDeleteClick,
  onTogglePublish,
  isTogglingPublish,
}: OtherPageCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
              <FileText className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{decodeHtml(page.title)}</CardTitle>
              <CardDescription className="font-mono text-xs">{page.slug}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={page.isPublished ? "default" : "secondary"}>
              {page.isPublished ? "Published" : "Draft"}
            </Badge>
            {page.renderMode === "CUSTOM_CODE" && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"
                title="This page is served as custom code, not the template"
              >
                <Code2 className="h-3 w-3" /> Custom code
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-muted-foreground text-xs">Updated {formatDate(page.updatedAt)}</div>
          <div className="flex items-center gap-2">
            {!page.isPublished ? (
              <Button
                variant="default"
                size="sm"
                className="flex-1 gap-1"
                disabled={isTogglingPublish}
                onClick={() => onTogglePublish(page.id, page.isPublished)}
              >
                {isTogglingPublish ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Publish
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1"
                disabled={isTogglingPublish}
                onClick={() => onTogglePublish(page.id, page.isPublished)}
              >
                {isTogglingPublish ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                Unpublish
              </Button>
            )}

            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/dashboard/pages/${page.id}/editor`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button>

            {canUseCustomCode(page.slug) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Custom code page (HTML/CSS/JS)"
                asChild
              >
                <Link href={`/dashboard/pages/${page.id}/custom-code`}>
                  <Code2 className="h-4 w-4" />
                </Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="text-destructive h-8 w-8"
              onClick={() => onDeleteClick(page.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PagesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedTenantId, selectedTenant } = useTenantStore();
  const viewUrl = useTenantWebUrl("");
  const { data: availableRoutes } = useAvailableRoutesQuery(selectedTenantId ?? undefined);
  const isAnyFeatureActive = useFeatureAccessStore((s) => s.isAnyFeatureActive);

  const [isAllTemplatesOpen, setIsAllTemplatesOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
  const [togglingPublishPageId, setTogglingPublishPageId] = useState<string | null>(null);
  const [isTogglingCertPublish, setIsTogglingCertPublish] = useState(false);

  // Per-category create dialog state (for individual category card "+ Create Page")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PageCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [isRedesignDialogOpen, setIsRedesignDialogOpen] = useState(false);
  const [isRedesigning, setIsRedesigning] = useState(false);
  const [redesignDeletedCount, setRedesignDeletedCount] = useState(0);

  // Fetch pages for selected tenant
  // Fetch ALL pages (high limit) so category matching works for every page
  const { data: pagesData, isLoading, error } = usePages(selectedTenantId || undefined, 1, 200);

  const createPage = useCreatePage();
  const savePage = useSavePage();
  const deletePage = useDeletePage();
  const togglePublish = useTogglePublish();

  const { data: selectedCert } = useSelectedCertificateTemplate(!!selectedTenantId);
  const toggleCertPublish = useToggleCertificatePublish();

  const handleToggleCertificatePublish = () => {
    if (!selectedCert?.templateId) return;
    const newPublished = !selectedCert.isPublished;
    setIsTogglingCertPublish(true);
    toggleCertPublish.mutate(newPublished, {
      onSuccess: () => {
        setIsTogglingCertPublish(false);
        toast({
          title: "Success",
          description: newPublished
            ? "Certificate template published."
            : "Certificate template unpublished.",
        });
      },
      onError: () => {
        setIsTogglingCertPublish(false);
        toast({
          title: "Error",
          description: "Failed to update certificate status.",
          variant: "destructive",
        });
      },
    });
  };

  // Create a map of category ID -> page for quick lookup
  const { pagesByCategoryId, unmatchedPages } = useMemo(() => {
    if (!pagesData?.pages) {
      return { pagesByCategoryId: new Map<string, Page>(), unmatchedPages: [] as Page[] };
    }

    const categoryMap = new Map<string, Page>();
    const unmatched: Page[] = [];

    for (const page of pagesData.pages) {
      if (isCourseSlug(page.slug)) continue;

      const category = getCategoryBySlug(page.slug);
      if (category) {
        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, page);
        }
      } else if (page.slug !== "signup" && page.slug !== "signin" && page.slug !== "sign-in") {
        unmatched.push(page);
      }
    }

    return { pagesByCategoryId: categoryMap, unmatchedPages: unmatched };
  }, [pagesData?.pages]);

  // Detect if tenant has zero website pages (triggers onboarding wizard)
  const hasNoPages = useMemo(() => {
    if (!pagesData?.pages) return false; // still loading, don't show wizard yet
    const websitePages = pagesData.pages.filter(
      (p) => !isCourseSlug(p.slug) && !p.slug.startsWith("books/"),
    );
    return websitePages.length === 0;
  }, [pagesData?.pages]);

  // Pages eligible for deletion during redesign (excludes course/book pages)
  const websitePages = useMemo(() => {
    if (!pagesData?.pages) return [];
    return pagesData.pages.filter(
      (p) => !isCourseSlug(p.slug) && !p.slug.startsWith("books/"),
    );
  }, [pagesData?.pages]);

  const handleRedesignWebsite = async () => {
    setIsRedesigning(true);
    setRedesignDeletedCount(0);
    try {
      for (const page of websitePages) {
        await pagesApi.deletePage(page.id);
        setRedesignDeletedCount((prev) => prev + 1);
      }
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      toast({ title: "Success", description: "All website pages deleted. Starting fresh." });
    } catch (err) {
      console.error("Failed to delete pages:", err);
      toast({
        title: "Error",
        description: "Failed to delete some pages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRedesigning(false);
      setIsRedesignDialogOpen(false);
      setRedesignDeletedCount(0);
    }
  };

  // Find existing home page for the All Templates modal
  const existingHomePage = useMemo(() => {
    if (!pagesData?.pages) return undefined;
    return pagesData.pages.find((p) => p.slug === "home");
  }, [pagesData?.pages]);

  // Get templates for selected category (per-category dialog)
  const categoryTemplates = useMemo(() => {
    if (!selectedCategory) return [];
    return getTemplatesByPageCategory(selectedCategory.id);
  }, [selectedCategory]);

  // Check if page already exists for the selected category (per-category dialog)
  const existingPageForCategory = useMemo(() => {
    if (!selectedCategory || !pagesData?.pages) return undefined;
    return pagesData.pages.find((p) => p.slug === selectedCategory.slug);
  }, [selectedCategory, pagesData?.pages]);

  // --- Per-category dialog handlers ---

  const handleCreateClick = (category: PageCategory) => {
    if (category.id === "login") {
      handleDirectCreateLoginPage();
      return;
    }
    if (category.id === "profile") {
      handleDirectCreateProfilePage();
      return;
    }
    setSelectedCategory(category);
    setSelectedTemplate(null);
    setNewPageTitle(category.name);
    setIsCreateDialogOpen(true);
  };

  const handleDirectCreateLoginPage = async () => {
    if (!selectedTenantId) return;

    const loginTemplate = getTemplateById("login-minimal");
    if (!loginTemplate) return;

    const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
      loginTemplate.sections,
      availableRoutes
    );

    try {
      await pagesApi.createPage({
        tenantId: selectedTenantId,
        title: "Login",
        slug: "login",
        sections: filteredSections,
        theme: loginTemplate.theme,
        seo: { ...loginTemplate.seo, title: "Login" },
      });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      toast({ title: "Success", description: "Login page created successfully." });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isConflict = errMsg.includes("409") || errMsg.includes("already exists");
      if (isConflict) {
        // Page exists but wasn't in our list, refetch
        queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
        toast({ title: "Info", description: "Login page already exists." });
      } else {
        toast({
          title: "Error",
          description: "Failed to create login page. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDirectCreateProfilePage = async () => {
    if (!selectedTenantId) return;

    const profileTemplate = getTemplateById("profile-minimal");
    if (!profileTemplate) return;

    const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
      profileTemplate.sections,
      availableRoutes
    );

    try {
      await pagesApi.createPage({
        tenantId: selectedTenantId,
        title: "Profile",
        slug: "profile",
        sections: filteredSections,
        theme: profileTemplate.theme,
        seo: { ...profileTemplate.seo, title: "Profile" },
        isPublished: true,
      });
      queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
      queryClient.invalidateQueries({ queryKey: availableRoutesKeys.all });
      toast({ title: "Success", description: "Profile page created and published." });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isConflict = errMsg.includes("409") || errMsg.includes("already exists");
      if (isConflict) {
        queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
        toast({ title: "Info", description: "Profile page already exists." });
      } else {
        toast({
          title: "Error",
          description: "Failed to create profile page. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSelectTemplate = (template: PageTemplate) => {
    setSelectedTemplate(template);
    setNewPageTitle(template.name);
  };

  const handleCreatePage = () => {
    if (!selectedTenantId || !selectedCategory || !selectedTemplate || !newPageTitle.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // If the page already exists for this slug, update it instead of creating
    if (existingPageForCategory) {
      handleReplaceExistingPage();
      return;
    }

    const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
      selectedTemplate.sections,
      availableRoutes
    );

    createPage.mutate(
      {
        tenantId: selectedTenantId,
        title: newPageTitle,
        slug: selectedCategory.slug,
        sections: filteredSections,
        theme: selectedTemplate.theme,
        seo: { ...selectedTemplate.seo, title: newPageTitle },
        isPublished: selectedCategory.id === "profile",
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setSelectedCategory(null);
          setSelectedTemplate(null);
          setNewPageTitle("");
          toast({ title: "Success", description: "Page created successfully." });
        },
        onError: (error: unknown) => {
          console.error("Failed to create page:", error);
          const errMsg = error instanceof Error ? error.message : String(error);
          const isConflict = errMsg.includes("409") || errMsg.includes("already exists");
          toast({
            title: isConflict ? "Page Already Exists" : "Error",
            description: isConflict
              ? `A "${selectedCategory.slug}" page already exists. Use "Replace with Template" to update it.`
              : "Failed to create page. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleReplaceExistingPage = () => {
    if (!existingPageForCategory || !selectedTemplate || !newPageTitle.trim()) return;

    const filteredSections = filterSectionsFooterLinksByAvailableRoutes(
      selectedTemplate.sections,
      availableRoutes
    );

    savePage.mutate(
      {
        pageId: existingPageForCategory.id,
        data: {
          title: newPageTitle,
          sections: filteredSections,
          theme: selectedTemplate.theme,
          seo: { ...selectedTemplate.seo, title: newPageTitle },
        },
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setSelectedCategory(null);
          setSelectedTemplate(null);
          setNewPageTitle("");
          toast({ title: "Success", description: "Page updated with the new template." });
          router.push(`/dashboard/pages/${existingPageForCategory.id}/editor`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update page. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleEditExistingPage = () => {
    if (!existingPageForCategory) return;
    setIsCreateDialogOpen(false);
    setSelectedCategory(null);
    setSelectedTemplate(null);
    setNewPageTitle("");
    router.push(`/dashboard/pages/${existingPageForCategory.id}/editor`);
  };

  // --- All Templates modal handler (home page only) ---
  const handleTemplateApplied = (pageId: string) => {
    router.push(`/dashboard/pages/${pageId}/editor`);
  };

  // --- Delete & publish handlers ---

  const handleDeletePage = () => {
    if (!deletePageId) return;
    deletePage.mutate(deletePageId, {
      onSuccess: () => {
        setDeletePageId(null);
        toast({ title: "Success", description: "Page deleted successfully." });
      },
      onError: (error) => {
        console.error("Failed to delete page:", error);
        toast({
          title: "Error",
          description: "Failed to delete page. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleTogglePublish = (pageId: string, currentStatus: boolean) => {
    setTogglingPublishPageId(pageId);
    togglePublish.mutate(
      { pageId, isPublished: !currentStatus },
      {
        onSuccess: () => {
          setTogglingPublishPageId(null);
          toast({
            title: "Success",
            description: currentStatus ? "Page unpublished." : "Page published successfully.",
          });
        },
        onError: (error) => {
          setTogglingPublishPageId(null);
          console.error("Failed to toggle publish:", error);
          toast({
            title: "Error",
            description: "Failed to update page status.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Pages</h1>
          <p className="text-muted-foreground text-sm">
            Manage website pages for {selectedTenant?.tenant_name || "your tenant"}
          </p>
        </div>
        {selectedTenantId && !isLoading && !hasNoPages && (
          <Button variant="outline" onClick={() => setIsRedesignDialogOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Redesign Website
          </Button>
        )}
      </div>

      {/* No Tenant Selected */}
      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage pages.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedTenantId && (
        <div className="space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive">Failed to load pages</p>
                <p className="text-muted-foreground text-sm">Please try refreshing the page.</p>
              </CardContent>
            </Card>
          )}

          {/* Onboarding Wizard, shown when tenant has zero website pages */}
          {!isLoading && !error && hasNoPages && (
            <OnboardingWizard
              tenantId={selectedTenantId}
              tenantName={selectedTenant?.tenant_name || ""}
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: pageKeys.lists() });
              }}
            />
          )}

          {/* Page Categories Grid, shown when pages exist */}
          {!isLoading && !error && !hasNoPages && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {PAGE_CATEGORIES_FOR_GRID.map((category) => {
                  const page = pagesByCategoryId.get(category.id);
                  return (
                    <PageCategoryCard
                      key={category.id}
                      category={category}
                      page={
                        page
                          ? {
                              id: page.id,
                              title: page.title,
                              slug: page.slug,
                              isPublished: page.isPublished,
                              updatedAt: page.updatedAt,
                              renderMode: page.renderMode,
                            }
                          : undefined
                      }
                      onCreateClick={
                        category.id === "home"
                          ? () => setIsAllTemplatesOpen(true)
                          : handleCreateClick
                      }
                      onChooseTemplateClick={category.id === "home" ? undefined : handleCreateClick}
                      onAllTemplatesClick={
                        category.id === "home" ? () => setIsAllTemplatesOpen(true) : undefined
                      }
                      onDeleteClick={setDeletePageId}
                      onTogglePublish={handleTogglePublish}
                      isTogglingPublish={togglingPublishPageId === page?.id}
                    />
                  );
                })}

                {/* Certificate, inline in the main grid */}
                <Card
                  className={`group relative overflow-hidden transition-all ${
                    selectedCert?.templateId
                      ? "border-border"
                      : "border-muted-foreground/30 hover:border-primary/50 border-dashed"
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            selectedCert?.templateId ? "bg-primary/10" : "bg-muted"
                          }`}
                        >
                          <Award
                            className={`h-5 w-5 ${selectedCert?.templateId ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-base">Certificate</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            /certificate
                          </CardDescription>
                        </div>
                      </div>
                      {selectedCert?.templateId ? (
                        <Badge variant={selectedCert.isPublished ? "default" : "secondary"}>
                          {selectedCert.isPublished ? "Published" : "Draft"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Selected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4 line-clamp-2 text-xs">
                      {selectedCert?.template
                        ? selectedCert.template.name
                        : "Award certificates to students upon course completion"}
                    </p>

                    {!selectedCert?.templateId ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setIsCertificateModalOpen(true)}
                      >
                        <Award className="mr-2 h-4 w-4" />
                        Select Certificate
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {!selectedCert.isPublished ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 gap-1"
                              disabled={isTogglingCertPublish}
                              onClick={handleToggleCertificatePublish}
                            >
                              {isTogglingCertPublish ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              Publish
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-1"
                              disabled={isTogglingCertPublish}
                              onClick={handleToggleCertificatePublish}
                            >
                              {isTogglingCertPublish ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                              Unpublish
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsCertificateModalOpen(true)}
                            title="Change Template"
                          >
                            <Award className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {/* Design a custom certificate + configure per-type (Course /
                        Test Series) assignment, side by side. */}
                    <div className="mt-3 flex items-center gap-2">
                      <Link
                        href="/dashboard/settings/certificates/designer"
                        className="border-input bg-background hover:bg-muted inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                        Design
                      </Link>
                      <CertificateByTypeButton className="h-9 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* System Pages Section */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">System Pages</h2>
                  <p className="text-muted-foreground text-sm">
                    Built-in platform routes.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {SYSTEM_PAGES.filter(
                    (sysPage) => !sysPage.featureKey || isAnyFeatureActive([sysPage.featureKey])
                  ).map((sysPage) => (
                    <SystemPageCard key={sysPage.id} page={sysPage} viewUrl={viewUrl} />
                  ))}
                </div>
              </div>

              {/* Other Pages Section */}
              {unmatchedPages.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Other Pages</h2>
                    <p className="text-muted-foreground text-sm">
                      Pages with custom routes that don&apos;t match standard categories
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {unmatchedPages.map((page) => (
                      <OtherPageCard
                        key={page.id}
                        page={page}
                        onDeleteClick={setDeletePageId}
                        onTogglePublish={handleTogglePublish}
                        isTogglingPublish={togglingPublishPageId === page.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Empty Search Results */}
        </div>
      )}

      {/* Per-category Create/Replace Dialog (for individual category card buttons) */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {existingPageForCategory
                ? `Replace ${selectedCategory?.name} Page`
                : `Create ${selectedCategory?.name} Page`}
            </DialogTitle>
            <DialogDescription>
              {existingPageForCategory ? (
                <>
                  A page already exists at{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-sm">
                    {selectedCategory?.route}
                  </code>
                  . You can replace it with a new template or edit the existing page.
                </>
              ) : (
                <>
                  Choose a template for your {selectedCategory?.name.toLowerCase()} page. The page
                  will be available at{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-sm">
                    {selectedCategory?.route}
                  </code>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {existingPageForCategory && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-50 p-4 dark:bg-amber-950/20">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Page already exists
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    <strong>{existingPageForCategory.title}</strong> (/
                    {existingPageForCategory.slug}), {" "}
                    {existingPageForCategory.isPublished ? "Published" : "Draft"}
                    {" \u00b7 "}
                    Updated{" "}
                    {new Date(existingPageForCategory.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-amber-700 underline dark:text-amber-400"
                    onClick={handleEditExistingPage}
                  >
                    Open in editor instead
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="mb-3 block text-sm font-medium">
                {existingPageForCategory ? "Select a New Template" : "Select Template"}
              </Label>
              <TemplateCarousel
                templates={categoryTemplates}
                selectedTemplateId={selectedTemplate?.id || null}
                onSelectTemplate={handleSelectTemplate}
              />
            </div>

            {selectedTemplate && (
              <div className="space-y-2">
                <Label htmlFor="page-title">Page Title</Label>
                <Input
                  id="page-title"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder={`e.g., ${selectedCategory?.name}`}
                />
                <p className="text-muted-foreground text-xs">
                  This title will be used for SEO and display purposes.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setSelectedCategory(null);
                setSelectedTemplate(null);
              }}
            >
              Cancel
            </Button>
            {existingPageForCategory ? (
              <Button
                variant="default"
                onClick={handleCreatePage}
                disabled={savePage.isPending || !selectedTemplate || !newPageTitle.trim()}
              >
                {savePage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <RefreshCw className="mr-2 h-4 w-4" />
                Replace with Template
              </Button>
            ) : (
              <Button
                onClick={handleCreatePage}
                disabled={createPage.isPending || !selectedTemplate || !newPageTitle.trim()}
              >
                {createPage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Page
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePageId} onOpenChange={(open) => !open && setDeletePageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this page? This action cannot be undone. You will be
              able to create a new page for this route after deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* All Templates Modal, for home page only */}
      <AllTemplatesModal
        open={isAllTemplatesOpen}
        onOpenChange={setIsAllTemplatesOpen}
        tenantId={selectedTenantId}
        existingHomePage={existingHomePage}
        onComplete={handleTemplateApplied}
      />

      {/* Certificate Template Selection Modal */}
      <CertificateTemplateModal
        open={isCertificateModalOpen}
        onOpenChange={setIsCertificateModalOpen}
      />

      {/* Redesign Website Dialog */}
      <RedesignWebsiteDialog
        open={isRedesignDialogOpen}
        onOpenChange={setIsRedesignDialogOpen}
        pageCount={websitePages.length}
        onConfirm={handleRedesignWebsite}
        isDeleting={isRedesigning}
        deletedCount={redesignDeletedCount}
      />
    </div>
  );
}

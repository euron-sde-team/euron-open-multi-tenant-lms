"use client";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { getCourseThumbnailUrl } from "@/lib/api";
import type { CategoryListItem } from "@/lib/api/categories";
import { fetchCategories } from "@/lib/api/categories";
import { emptyLayout } from "@/lib/default-layout";
import { AvailableRoutesProvider } from "@open-mtlms/core";
import type { AvailableRoutesResponse, PageConfig, TenantLayout, ThemeConfig } from "@open-mtlms/shared";
import { defaultThemeConfig } from "@open-mtlms/ui-config";
import { useQuery } from "@tanstack/react-query";
import { FolderTree, Loader2, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface CategoriesListingClientProps {
  layout: TenantLayout | null;
  pageConfig: PageConfig | null;
  availableRoutes?: AvailableRoutesResponse | null;
  initialCategories: CategoryListItem[];
}

function getIconUrl(iconUrl: string | null): string | null {
  return getCourseThumbnailUrl(iconUrl);
}

function CategoriesListingContent({
  layout,
  pageConfig,
  initialCategories,
}: Omit<CategoriesListingClientProps, "availableRoutes">) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const theme: ThemeConfig = pageConfig?.theme ?? defaultThemeConfig;
  const effectiveLayout = layout ?? emptyLayout;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories(typeof window !== "undefined" ? window.location.host : ""),
    initialData: { categories: initialCategories },
    staleTime: 60 * 1000,
  });

  // Build hierarchy: top-level (no parent) and their subcategories
  const { topLevelCategories, categoriesByParent } = useMemo(() => {
    const categories = data?.categories ?? [];
    const byParent = new Map<string | null, CategoryListItem[]>();
    for (const c of categories) {
      const key = c.parent_id ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    // Sort each group by sort_order then name
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    }
    const topLevel = byParent.get(null) ?? [];
    return {
      topLevelCategories: topLevel,
      categoriesByParent: byParent,
    };
  }, [data?.categories]);

  const filteredTopLevel = useMemo(() => {
    if (!searchQuery.trim()) return topLevelCategories;
    const q = searchQuery.toLowerCase();
    return topLevelCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false)
    );
  }, [topLevelCategories, searchQuery]);

  const handleCategoryClick = (slug: string) => {
    router.push(`/categories/${slug}`);
  };

  return (
    <LayoutWrapper layout={effectiveLayout} theme={theme}>
      <div className="container-custom section-padding scroll-smooth">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Categories</h1>
        <p className="text-muted-foreground mb-6 text-sm sm:mb-8 sm:text-base">
          Browse our content by category
        </p>

        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring h-10 w-full rounded-md border px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2"
            />
          </div>
        </div>

        {isError && (
          <div className="border-destructive/50 bg-destructive/10 mb-8 flex flex-col items-center justify-center rounded-lg border py-12">
            <p className="text-destructive text-center text-sm sm:text-base">
              {error instanceof Error
                ? error.message
                : "Failed to load categories. Please try again."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="hover:bg-muted mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        )}

        {!isLoading && !isError && filteredTopLevel.length > 0 && (
          <div className="space-y-8">
            {filteredTopLevel.map((parent) => {
              const subcategories = categoriesByParent.get(parent.id) ?? [];
              const iconUrl = getIconUrl(parent.icon_url);
              return (
                <section key={parent.id} className="bg-card rounded-xl border p-6">
                  <button
                    type="button"
                    onClick={() => handleCategoryClick(parent.slug)}
                    className="group flex w-full flex-col items-start gap-4 sm:flex-row sm:items-center"
                  >
                    <div className="bg-muted flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full">
                      {iconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={iconUrl}
                          alt={parent.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FolderTree className="text-muted-foreground h-8 w-8" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h2 className="text-foreground group-hover:text-primary text-lg font-semibold">
                        {parent.name}
                      </h2>
                      {parent.description && (
                        <p className="text-muted-foreground mt-1 text-sm">{parent.description}</p>
                      )}
                    </div>
                  </button>
                  {subcategories.length > 0 && (
                    <div className="mt-6 border-t pt-6">
                      <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
                        Subcategories
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {subcategories.map((sub) => {
                          const subIconUrl = getIconUrl(sub.icon_url);
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleCategoryClick(sub.slug)}
                              className="bg-muted/30 hover:border-primary/50 hover:bg-muted/50 group flex items-center gap-3 rounded-lg border p-4 text-left transition-colors"
                            >
                              <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                                {subIconUrl ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img
                                    src={subIconUrl}
                                    alt={sub.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <FolderTree className="text-muted-foreground h-5 w-5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-foreground group-hover:text-primary block truncate font-medium">
                                  {sub.name}
                                </span>
                                {sub.description && (
                                  <span className="text-muted-foreground line-clamp-1 block text-xs">
                                    {sub.description}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {!isLoading && !isError && filteredTopLevel.length === 0 && (
          <div className="bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 sm:py-16">
            <FolderTree className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground px-4 text-center text-sm sm:text-base">
              {searchQuery ? "No categories match your search." : "No categories available yet."}
            </p>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}

export function CategoriesListingClient(props: CategoriesListingClientProps) {
  const { availableRoutes, ...rest } = props;
  return (
    <AvailableRoutesProvider initialRoutes={availableRoutes ?? undefined}>
      <CategoriesListingContent {...rest} />
    </AvailableRoutesProvider>
  );
}

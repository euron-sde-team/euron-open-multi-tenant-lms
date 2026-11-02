/**
 * Hook that syncs search filter state with URL search params.
 * URL is the single source of truth, no Zustand store needed.
 */

"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SearchFilters } from "@/lib/api/search";

export function useSearchParamsState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo<SearchFilters>(() => {
    const q = searchParams.get("q") || undefined;
    const type = searchParams.get("type") || undefined;
    const mode = searchParams.get("mode") || undefined;
    const purchaseMode = searchParams.get("purchaseMode") || undefined;
    const difficulty = searchParams.get("difficulty") || undefined;

    const language = searchParams.get("language");
    const categories = searchParams.get("categories");
    const instructors = searchParams.get("instructors");

    return {
      q,
      type,
      mode,
      purchaseMode,
      difficulty,
      language: language ? language.split(",").filter(Boolean) : undefined,
      categories: categories ? categories.split(",").filter(Boolean) : undefined,
      instructors: instructors ? instructors.split(",").filter(Boolean) : undefined,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (updates: Partial<SearchFilters>) => {
      const merged = { ...filters, ...updates };
      const params = new URLSearchParams();

      if (merged.q) params.set("q", merged.q);
      if (merged.type) params.set("type", merged.type);
      if (merged.mode) params.set("mode", merged.mode);
      if (merged.purchaseMode) params.set("purchaseMode", merged.purchaseMode);
      if (merged.difficulty) params.set("difficulty", merged.difficulty);
      if (merged.language && merged.language.length > 0) {
        params.set("language", merged.language.join(","));
      }
      if (merged.categories && merged.categories.length > 0) {
        params.set("categories", merged.categories.join(","));
      }
      if (merged.instructors && merged.instructors.length > 0) {
        params.set("instructors", merged.instructors.join(","));
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [filters, pathname, router]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [filters.q, pathname, router]);

  const hasActiveFilters = !!(
    filters.type ||
    filters.mode ||
    filters.purchaseMode ||
    filters.difficulty ||
    (filters.language && filters.language.length > 0) ||
    (filters.categories && filters.categories.length > 0) ||
    (filters.instructors && filters.instructors.length > 0)
  );

  const setQuery = useCallback(
    (q: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set("q", q);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  return { filters, setFilters, clearFilters, hasActiveFilters, setQuery };
}

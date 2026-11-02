"use client";

import {
  DEFAULT_CONTENT_TERMS,
  navLabelByHref,
  resolveContentTerms,
  type ContentTerm,
  type ContentTermKey,
  type ContentTerms,
} from "@open-mtlms/shared";
import { useMemo } from "react";

import { useTenantLayout } from "@/components/providers/tenant-layout-provider";

/**
 * Terminology for every content type, derived from the tenant's sidebar nav
 * labels (what they rename in Settings → Navigation). While the sidebar config
 * is still loading we return the built-in defaults so labels never flash empty.
 */
export function useContentTerms(): ContentTerms {
  const { sidebarNavItems, isLoading } = useTenantLayout();
  return useMemo(() => {
    if (isLoading || sidebarNavItems.length === 0) {
      return DEFAULT_CONTENT_TERMS;
    }
    return resolveContentTerms(sidebarNavItems);
  }, [sidebarNavItems, isLoading]);
}

/** Terminology for a single content type. */
export function useContentTerm(key: ContentTermKey): ContentTerm {
  return useContentTerms()[key];
}

/**
 * The tenant's label for the sidebar nav item pointing at `href`, or `fallback`
 * while loading / when there's no match. Use for a page heading that should
 * follow whatever the tenant renamed that nav item to (e.g. /live → "Live
 * Batches" once renamed from "Live Courses").
 */
export function useNavLabel(href: string, fallback: string): string {
  const { sidebarNavItems, isLoading } = useTenantLayout();
  return useMemo(() => {
    if (isLoading || sidebarNavItems.length === 0) return fallback;
    return navLabelByHref(sidebarNavItems, href, fallback);
  }, [sidebarNavItems, isLoading, href, fallback]);
}

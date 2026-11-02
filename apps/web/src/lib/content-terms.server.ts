import {
  DEFAULT_CONTENT_TERMS,
  navLabelByHref,
  resolveContentTerms,
  type ContentTerms,
  type SidebarNavItem,
} from "@open-mtlms/shared";

import { getTenantHost } from "./template.server";

/**
 * Server-side terminology resolver, the counterpart to the client
 * `useContentTerms()` hook. Server components (page `metadata`, breadcrumbs,
 * server-passed heading props) can't call React hooks, so they fetch the
 * tenant's sidebar nav items here and resolve the same terms.
 *
 * Falls back to the built-in defaults on any failure so a page never renders
 * without labels.
 */
function getSidebarApiUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) return `${apiUrl.replace(/\/$/, "")}/sidebar`;
  if (process.env.USER_SERVER_URL) {
    return `${process.env.USER_SERVER_URL.replace(/\/$/, "")}/api/v1/sidebar`;
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1/sidebar`;
}

/** Fetch the tenant's sidebar nav items server-side (empty array on failure). */
async function fetchSidebarItems(): Promise<SidebarNavItem[]> {
  try {
    const tenantHost = await getTenantHost();
    const response = await fetch(getSidebarApiUrl(), {
      headers: { "X-Tenant-Host": tenantHost },
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      data?: { items?: SidebarNavItem[] };
      items?: SidebarNavItem[];
    };
    return json.data?.items ?? json.items ?? [];
  } catch (error) {
    console.error("[content-terms.server] Failed to fetch sidebar:", error);
    return [];
  }
}

export async function getContentTerms(): Promise<ContentTerms> {
  const items = await fetchSidebarItems();
  if (items.length === 0) return DEFAULT_CONTENT_TERMS;
  return resolveContentTerms(items);
}

/**
 * Server-side counterpart to the `useNavLabel` hook: resolve a page's heading
 * from the sidebar nav item pointing at `href` (what the tenant renamed it to),
 * falling back to `fallback` when there's no match.
 */
export async function getNavLabel(
  href: string,
  fallback: string,
): Promise<string> {
  const items = await fetchSidebarItems();
  return navLabelByHref(items, href, fallback);
}

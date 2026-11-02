import type { SidebarNavItem } from "@open-mtlms/shared";
import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/api-client";

interface SidebarConfigResponse {
  items: SidebarNavItem[];
}

export const sidebarNavKeys = {
  all: ["sidebar-nav"] as const,
  config: () => [...sidebarNavKeys.all, "config"] as const,
};

export function useSidebarNav() {
  return useQuery<SidebarConfigResponse>({
    queryKey: sidebarNavKeys.config(),
    queryFn: () => apiGet<SidebarConfigResponse>("/sidebar"),
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
}

/** Flatten nav items (including children) to a set of hrefs. */
function collectHrefs(items: SidebarNavItem[] | undefined, acc: Set<string>): void {
  if (!items) return;
  for (const item of items) {
    if (item.href) acc.add(item.href);
    if (item.children) collectHrefs(item.children, acc);
  }
}

/**
 * Whether a nav destination (by href) is enabled in the tenant's sidebar config.
 * Use to gate links that live OUTSIDE the sidebar (e.g. the account dropdown) so
 * features the admin hid don't leak through a second entry point.
 *
 * Returns `true` while the config is still loading so links aren't hidden then
 * flash in; only hides once we have a config that omits the href.
 */
export function useIsNavItemVisible(href: string): boolean {
  const { data, isLoading } = useSidebarNav();
  if (isLoading || !data) return true;
  const hrefs = new Set<string>();
  collectHrefs(data.items, hrefs);
  return hrefs.has(href);
}

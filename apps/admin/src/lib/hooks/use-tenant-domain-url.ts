import { useQuery } from "@tanstack/react-query";

import { domainsApi } from "../api/domains";
import { getTenantWebHost, getTenantWebUrl } from "../constants";
import { useTenantStore } from "../stores/tenant-store";

const DOMAINS_QUERY_KEY = ["tenant-domains"] as const;

/**
 * Fetches tenant domains and returns the primary/active domain base URL.
 * Use this instead of env-based constants when tenant domain is available from the API.
 */
export function useTenantDomains() {
  const tenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...DOMAINS_QUERY_KEY, tenantId ?? ""],
    queryFn: () => domainsApi.list(),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get the tenant's web base URL from domains (primary or first ACTIVE).
 * Returns empty string if no suitable domain.
 */
function getBaseUrlFromDomains(domains: { fullUrl: string; isPrimary: boolean; status: string }[]): string {
  const primary = domains.find((d) => d.isPrimary && d.status === "ACTIVE");
  if (primary?.fullUrl) return primary.fullUrl.replace(/\/$/, "");
  const active = domains.find((d) => d.status === "ACTIVE");
  if (active?.fullUrl) return active.fullUrl.replace(/\/$/, "");
  return "";
}

/**
 * Hook that returns the tenant's web app base URL.
 * Uses tenant domains from API when available; falls back to env-based getTenantWebUrl.
 */
export function useTenantWebBaseUrl(): string {
  const tenantSlug = useTenantStore((s) => s.selectedTenant?.tenant_slug);
  const { data: domains } = useTenantDomains();
  const fromDomains = domains?.length ? getBaseUrlFromDomains(domains) : "";
  if (fromDomains) return fromDomains;
  return getTenantWebUrl(tenantSlug ?? undefined, "");
}

/**
 * Hook that returns the tenant's web app URL with optional path.
 * Uses tenant domains from API when available; falls back to env-based getTenantWebUrl.
 */
export function useTenantWebUrl(path = ""): string {
  const base = useTenantWebBaseUrl();
  if (!base) return "";
  const pathPart = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base}${pathPart}`;
}

/**
 * Hook that returns the tenant's web app host (e.g. "pk-enterprize.example.com").
 * Uses tenant domains from API when available; falls back to env-based getTenantWebHost.
 */
export function useTenantWebHost(): string {
  const tenantSlug = useTenantStore((s) => s.selectedTenant?.tenant_slug);
  const { data: domains } = useTenantDomains();
  const fromDomains = domains?.length ? getBaseUrlFromDomains(domains) : "";
  if (fromDomains) {
    try {
      return new URL(fromDomains).host;
    } catch {
      return "";
    }
  }
  return getTenantWebHost(tenantSlug ?? undefined);
}

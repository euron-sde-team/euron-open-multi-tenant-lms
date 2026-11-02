/**
 * API client for fetching the published test-series catalog from the learner API.
 * Used by the content listing sections in the admin page editor preview so the
 * builder shows the same data as the live web page (WYSIWYG parity).
 *
 * The learner API serves the public catalog; tenant is resolved via X-Tenant-Host.
 * Mirrors apps/web's fetchTestSeriesCatalog / getTestSeriesCoverUrl.
 */

import { LEARNER_API_BASE_URL, THUMBNAILS_BASE_URL } from "@/lib/config/env";

function getApiBaseUrl(): string {
  return LEARNER_API_BASE_URL;
}

/**
 * Resolve a test-series cover image key to a full public URL using
 * NEXT_PUBLIC_THUMBNAILS_BASE_URL. Already-absolute values pass through untouched.
 */
export function getTestSeriesCoverUrl(
  coverImageKey: string | null | undefined,
): string | null {
  if (!coverImageKey?.trim()) return null;
  const key = coverImageKey.trim();
  if (
    key.startsWith("http://") ||
    key.startsWith("https://") ||
    key.startsWith("data:")
  ) {
    return key;
  }
  const path = key.startsWith("/") ? key.slice(1) : key;
  return `${THUMBNAILS_BASE_URL}/${path}`;
}

export interface CatalogSeries {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageKey: string | null;
  category: string | null;
  pricingType: "FREE" | "PAID";
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  currency: string | null;
  validityDays: number | null;
  visibility: string;
  accessMode: "SEQUENTIAL" | "OPEN";
  totalTests: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/**
 * Fetch the published test-series catalog for a tenant.
 * Requires tenantHost (e.g. "northwind.lvh.me:3620") to resolve the tenant.
 */
export async function fetchPublishedTestSeries(
  tenantHost: string,
): Promise<CatalogSeries[]> {
  const url = `${getApiBaseUrl()}/test-series`;
  const headers: Record<string, string> = {};
  if (tenantHost) headers["X-Tenant-Host"] = tenantHost;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch test-series: ${response.status}`);
  }
  const json: ApiResponse<CatalogSeries[]> = await response.json();
  if (!json.success || !json.data) {
    throw new Error("Invalid response from server");
  }
  return json.data;
}

/**
 * Server-compatible testimonials list fetch using raw fetch (no Axios).
 * Uses the X-Tenant-Host header.
 */

import type { TestimonialsListResponse } from "./testimonials";

function getApiBaseUrl(): string {
  const apiUrl = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (apiUrl) {
    return apiUrl.replace(/\/$/, "");
  }
  if (process.env.USER_SERVER_URL) {
    return process.env.USER_SERVER_URL.replace(/\/$/, "");
  }
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT || "5096";
  return `http://localhost:${port}/api/v1`;
}

export async function fetchTestimonialsList(
  options: {
    page?: number;
    limit?: number;
  },
  tenantHost: string
): Promise<TestimonialsListResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.page != null) params.set("page", String(options.page));
  if (options.limit != null) params.set("limit", String(options.limit));
  const url = `${base}/testimonials${params.toString() ? `?${params.toString()}` : ""}`;

  const headers: Record<string, string> = { "X-Tenant-Host": tenantHost };

  const response = await fetch(url, {
    headers,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Testimonials list failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    success: boolean;
    data: TestimonialsListResponse;
  };

  return json.data;
}

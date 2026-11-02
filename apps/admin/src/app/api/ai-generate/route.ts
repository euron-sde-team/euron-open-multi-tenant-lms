import { type NextRequest, NextResponse } from "next/server";

import { API_BASE_URL as API_URL } from "@/lib/config/env";

/**
 * Custom proxy route for AI course content generation.
 *
 * The default Next.js rewrite proxy (/api/proxy/*) has an internal timeout
 * that's too short for AI generation (text ~20s + thumbnails ~50s).
 * This route handler bypasses the rewrite proxy and uses fetch() with
 * an explicit 3-minute timeout.
 */


// Allow up to 3 minutes for AI generation (Vercel/serverless environments)
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const body = await request.json();

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  // Forward auth + tenant headers
  const auth = request.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  const tenantId = request.headers.get("x-tenant-id");
  if (tenantId) headers["x-tenant-id"] = tenantId;

  const backendResponse = await fetch(
    `${API_URL}/tenant/courses/ai/generate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    }
  );

  const data = await backendResponse.json();
  return NextResponse.json(data, { status: backendResponse.status });
}

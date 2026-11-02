/**
 * Server-side proxy for the unsubscribe form submission.
 *
 * The client-side form on /unsubscribe/[token]/unsubscribe-form.tsx POSTs
 * here. We forward to learner-api's /email/unsubscribe/confirm with the same
 * payload. This keeps the learner-api URL off the browser bundle and avoids
 * CORS preflight overhead.
 */

import { type NextRequest, NextResponse } from "next/server";

function getUserServerBaseUrl(): string {
  const url = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) ?? process.env.USER_SERVER_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT ?? "5096";
  return `http://localhost:${port}/api/v1`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
    scope?: unknown;
  } | null;
  if (!body || typeof body.token !== "string" || typeof body.scope !== "string") {
    return NextResponse.json(
      { success: false, error: { message: "token and scope are required" } },
      { status: 400 },
    );
  }

  const apiBase = getUserServerBaseUrl();
  try {
    const upstream = await fetch(`${apiBase}/email/unsubscribe/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: body.token, scope: body.scope }),
    });
    const json = await upstream.json().catch(() => ({}));
    return NextResponse.json(json, { status: upstream.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: `Upstream unsubscribe service unreachable: ${(err as Error).message}`,
        },
      },
      { status: 502 },
    );
  }
}

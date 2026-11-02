/**
 * Phase 11, public unsubscribe endpoint emitted by the email engine.
 *
 * The List-Unsubscribe header in every NOTIFICATION + MARKETING email points
 * here: `<https://{tenant-host}/u/{token}>`. This route handles BOTH:
 *
 *   - GET (browser visit from email client): redirects to the rich themed
 *     confirmation page at `/unsubscribe/[token]` where the user can choose
 *     between "this category only", "all marketing", or "everything
 *     non-essential."
 *
 *   - POST (RFC 8058 one-click from Gmail / Apple Mail / etc.): calls the
 *     tenant-admin internal confirm endpoint with scope="category" and
 *     returns 200 OK. No UI; the user agent shows its own confirmation toast.
 *
 * The same URL handles both verbs so the List-Unsubscribe header value and
 * the List-Unsubscribe-Post=One-Click semantics line up exactly with what
 * the engine emits in `sender.ts`.
 */

import { type NextRequest, NextResponse } from "next/server";

function getUserServerBaseUrl(): string {
  const url = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) ?? process.env.USER_SERVER_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT ?? "5096";
  return `http://localhost:${port}/api/v1`;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.redirect(new URL("/", _req.url), 302);
  }
  // 302 to the rich UI. Browser arrives here from "Unsubscribe" link in email
  // body or the email client's chrome.
  return NextResponse.redirect(
    new URL(`/unsubscribe/${encodeURIComponent(token)}`, _req.url),
    302,
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await context.params;
  if (!token) {
    return new NextResponse("missing token", { status: 400 });
  }

  // RFC 8058 one-click: the request body contains
  // `List-Unsubscribe=One-Click` as application/x-www-form-urlencoded. We
  // don't actually need to parse it; the presence of a POST to this URL
  // with the matching token is the entire signal.
  try {
    const apiBase = getUserServerBaseUrl();
    const response = await fetch(`${apiBase}/email/unsubscribe/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, scope: "category" }),
    });
    if (!response.ok) {
      // Mailers retry 5xx; 4xx means the token is bad and the user agent
      // shouldn't keep trying. Pass the status through.
      return new NextResponse("unsubscribe failed", {
        status: response.status >= 500 ? 502 : response.status,
      });
    }
    // Gmail's one-click UI shows "Unsubscribed" on any 2xx.
    return new NextResponse("Unsubscribed.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    // Network / tenant-admin down. Return 502 so the mailer retries later.
    return new NextResponse("unsubscribe service unavailable", { status: 502 });
  }
}

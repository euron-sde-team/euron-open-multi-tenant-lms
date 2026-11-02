/**
 * Unsubscribe confirmation page: Phase 11.
 *
 * Server component that resolves the JWT via learner-api's verify endpoint,
 * then renders a client component with three scope choices:
 *   - Just this category (default, recommended)
 *   - All marketing emails
 *   - All emails except essential (TRANSACTIONAL still flows)
 *
 * The page is reached from `/u/[token]` (GET redirects here) so the URL the
 * email recipient actually clicks is short + obvious. The split also lets
 * `/u/[token]/route.ts` host the RFC 8058 one-click POST without colliding
 * with this page component.
 */

import UnsubscribeForm from "./unsubscribe-form";

interface VerifiedTokenResponse {
  success: boolean;
  data?: {
    tenantId: string;
    tenantName: string | null;
    email: string;
    messageId: string;
    category: "NOTIFICATION" | "MARKETING";
    alreadyUnsubscribedAtAll: boolean;
    alreadyUnsubscribedFromCategory: boolean;
  };
  error?: { message: string };
  message?: string;
}

function getUserServerBaseUrl(): string {
  const url = ((typeof window === "undefined" ? process.env.API_INTERNAL_BASE_URL : undefined) || process.env.NEXT_PUBLIC_API_BASE_URL) ?? process.env.USER_SERVER_URL;
  if (url) return url.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_USER_SERVER_PORT ?? "5096";
  return `http://localhost:${port}/api/v1`;
}

async function verifyToken(token: string): Promise<VerifiedTokenResponse> {
  try {
    const res = await fetch(`${getUserServerBaseUrl()}/email/unsubscribe/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    const body = (await res.json()) as VerifiedTokenResponse;
    return body;
  } catch (err) {
    return {
      success: false,
      error: { message: (err as Error).message },
    };
  }
}

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyToken(token);

  if (!result.success || !result.data) {
    return (
      <main
        style={{
          maxWidth: 520,
          margin: "80px auto",
          padding: "40px 32px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#18181b", margin: 0 }}>
          Link expired
        </h1>
        <p style={{ fontSize: 14, color: "#52525b", marginTop: 12 }}>
          This unsubscribe link is invalid or expired. If you no longer want to
          receive emails, reply to the message asking to be removed, or contact
          support.
        </p>
        <p style={{ fontSize: 12, color: "#a1a1aa", marginTop: 16 }}>
          {result.error?.message ?? result.message ?? ""}
        </p>
      </main>
    );
  }

  const { tenantName, email, category, alreadyUnsubscribedAtAll } = result.data;

  if (alreadyUnsubscribedAtAll) {
    return (
      <main
        style={{
          maxWidth: 520,
          margin: "80px auto",
          padding: "40px 32px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#18181b", margin: 0 }}>
          You&apos;re already unsubscribed
        </h1>
        <p style={{ fontSize: 14, color: "#52525b", marginTop: 12 }}>
          {email} is already opted out from {tenantName ?? "this sender"}.
          Essential messages like login codes and payment receipts will still
          arrive; everything else is blocked.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "80px auto",
        padding: "40px 32px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#ffffff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 600, color: "#18181b", margin: 0 }}>
        Unsubscribe from {tenantName ?? "emails"}
      </h1>
      <p style={{ fontSize: 14, color: "#52525b", marginTop: 12 }}>
        You&apos;re unsubscribing <strong>{email}</strong>. Pick what you want
        to stop:
      </p>
      <UnsubscribeForm
        token={token}
        category={category}
        tenantName={tenantName ?? "this sender"}
      />
      <p style={{ fontSize: 12, color: "#a1a1aa", marginTop: 24, lineHeight: 1.5 }}>
        Note: Even if you unsubscribe from everything non-essential, you&apos;ll
        still receive critical account messages like login codes, password
        reset emails, and payment receipts. Those can&apos;t be turned off
        because they&apos;re required for your account to work.
      </p>
    </main>
  );
}

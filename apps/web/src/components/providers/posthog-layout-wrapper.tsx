import { headers } from "next/headers";

import { PostHogProvider } from "./posthog-provider";

export async function PostHogLayoutWrapper({ children }: { children: React.ReactNode }) {
  const headersList = headers();
  const tenantId = headersList.get("x-tenant-id");
  const tenantSlug = headersList.get("x-tenant-slug");

  return (
    <PostHogProvider
      tenantId={tenantId}
      tenantSlug={tenantSlug}
      tenantName={tenantSlug ? `${tenantSlug} (tenant)` : null}
    >
      {children}
    </PostHogProvider>
  );
}

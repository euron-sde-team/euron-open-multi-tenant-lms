import type { Metadata } from "next";
import Script from "next/script";

import type { TenantSeoSettings } from "@open-mtlms/shared";

import { AuthSyncProvider } from "@/components/providers/auth-sync-provider";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { PostHogLayoutWrapper } from "@/components/providers/posthog-layout-wrapper";
import { QueryProvider } from "@/components/providers/query-provider";
import { TenantLayoutProvider } from "@/components/providers/tenant-layout-provider";
import { TenantStatusProvider } from "@/components/providers/tenant-status-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccountStatusToast } from "@/components/auth/account-status-toast";
import { Toaster } from "@/components/ui/toaster";
import { BookmarkProvider } from "@/lib/stores/bookmark-store";
import { EmailVerificationGuard } from "@/components/auth/email-verification-guard";
import { NameConfirmationGuard } from "@/components/auth/name-confirmation-guard";
import { CustomDataFormGuard } from "@/components/member-form/custom-data-form-guard";
import { Toaster as CoreToaster, TooltipProvider } from "@open-mtlms/core";
import { getTemplateForRequest } from "@/lib/template.server";
import { getTenantName } from "@/lib/seo";

import "./globals.css";

// Per-tenant SEO comes from the tenant `layout.seo` JSON. Values are tenant
// input, so we validate them with strict regexes before emitting (GA4 id is
// embedded in an inline script, this prevents any injection). Absent/invalid
// => nothing is emitted, so this can never break a tenant page. Only the
// tenant's own GA4 property is supported (no tag managers or ad pixels).
const GA4_RE = /^G-[A-Z0-9]{4,20}$/i;
const SITE_VERIFY_RE = /^[A-Za-z0-9_-]{20,128}$/;

function readTenantSeo(layout: unknown): {
  ga4?: string;
  verification?: string;
} {
  const seo = (layout as { seo?: TenantSeoSettings } | null)?.seo;
  if (!seo) return {};
  // Master switch gates the analytics tag. The id is embedded in an inline
  // script, so validate with a strict regex before emitting.
  const analyticsOn = seo.analyticsEnabled !== false;
  const ga4 =
    analyticsOn && seo.ga4MeasurementId && GA4_RE.test(seo.ga4MeasurementId)
      ? seo.ga4MeasurementId
      : undefined;
  const verification =
    seo.googleSiteVerificationToken &&
    SITE_VERIFY_RE.test(seo.googleSiteVerificationToken)
      ? seo.googleSiteVerificationToken
      : undefined;
  return { ga4, verification };
}

// Dynamic metadata based on tenant. The root layout sets the tab title template:
//   - Child pages that set `title: "Foo"`        -> rendered as "Foo | <TenantName>"
//   - Child pages with no `title` override        -> rendered as "<TenantName>"
//   - Pages that explicitly set `title: { absolute: "..." }` opt out of the template.
// This is multi-tenant safe: no hardcoded platform name leaks into a tenant's tab.
export async function generateMetadata(): Promise<Metadata> {
  const homeConfig = await getTemplateForRequest("home");
  const faviconUrl = homeConfig?.metadata?.faviconUrl as string | undefined;
  const tenantName = getTenantName(homeConfig?.layout ?? null, homeConfig);
  const { verification } = readTenantSeo(homeConfig?.layout ?? null);

  return {
    title: {
      default: tenantName,
      template: `%s | ${tenantName}`,
    },
    robots: {
      index: true,
      follow: true,
    },
    ...(verification ? { verification: { google: verification } } : {}),
    ...(faviconUrl
      ? {
          icons: {
            icon: faviconUrl,
            shortcut: faviconUrl,
          },
        }
      : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cached fetch (revalidate:5), deduped with generateMetadata's call.
  const homeConfig = await getTemplateForRequest("home");
  const { ga4 } = readTenantSeo(homeConfig?.layout ?? null);

  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body
        className="bg-background font-sans antialiased"
        suppressHydrationWarning
      >
        {ga4 && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`}
            </Script>
          </>
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <QueryProvider>
              <PostHogLayoutWrapper>
                <TenantStatusProvider>
                  <TenantLayoutProvider>
                    <CurrencyProvider>
                      <AuthSyncProvider>
                        <BookmarkProvider>
                          <EmailVerificationGuard />
                          <NameConfirmationGuard />
                          <CustomDataFormGuard>{children}</CustomDataFormGuard>
                          <Toaster />
                          <AccountStatusToast />
                          <CoreToaster />
                        </BookmarkProvider>
                      </AuthSyncProvider>
                    </CurrencyProvider>
                  </TenantLayoutProvider>
                </TenantStatusProvider>
              </PostHogLayoutWrapper>
            </QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

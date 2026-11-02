"use client";

import { AvailableRoutesProvider } from "@open-mtlms/core";
import {
  decodeHtmlEntities,
  type PageConfig,
  type SectionConfig,
  type TenantLayout,
  getAvailableRoutesResponse,
} from "@open-mtlms/shared";
import { useEffect, useMemo } from "react";

import { FloatingSocialWidget } from "@/components/layout/FloatingSocialWidget";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { SectionRenderer } from "@/components/sections/section-renderer";
import { BRAND_NAME, BRAND_URL, BRAND_URL_DISPLAY } from "@/lib/brand";
import { emptyLayout } from "@/lib/default-layout";

// Key used to embed layout in first section's settings
const LAYOUT_SETTINGS_KEY = "__tenantLayout__";

// Extract layout from first section's settings
function extractLayoutFromSections(sections: SectionConfig[]): TenantLayout | undefined {
  if (sections.length === 0) return undefined;

  const firstSection = sections[0];
  const settings = firstSection.settings as Record<string, unknown>;

  if (settings && settings[LAYOUT_SETTINGS_KEY]) {
    return settings[LAYOUT_SETTINGS_KEY] as TenantLayout;
  }
  return undefined;
}

interface HomePageClientProps {
  initialPageConfig: PageConfig | null;
  error?: string | null;
}

export function HomePageClient({ initialPageConfig, error: initialError }: HomePageClientProps) {
  const pageConfig = initialPageConfig;
  const error = initialError ?? null;

  // Apply SEO from page config
  useEffect(() => {
    if (!pageConfig?.seo) return;

    document.title = decodeHtmlEntities(pageConfig.seo.title || pageConfig.title) || "Home";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && pageConfig.seo.description) {
      metaDesc.setAttribute("content", decodeHtmlEntities(pageConfig.seo.description));
    }
  }, [pageConfig]);

  // Legacy fallback: extract layout from first section's settings (old format).
  // New pages get layout from the tenant-level API (pageConfig.layout set by server).
  const legacyLayout = useMemo(() => {
    if (pageConfig?.layout) return undefined; // Already have tenant-level layout
    if (!pageConfig?.sections) return undefined;
    return extractLayoutFromSections(pageConfig.sections);
  }, [pageConfig?.layout, pageConfig?.sections]);

  // Layout priority:
  // 1. pageConfig.layout, tenant-level layout from backend API (new, robust)
  // 2. legacyLayout, extracted from first section's __tenantLayout__ (backward compat)
  // 3. emptyLayout, nothing renders
  const layout = pageConfig?.layout || legacyLayout || emptyLayout;

  // All sections are regular sections (layout is in settings, not a separate section)
  const regularSections = pageConfig?.sections || [];

  // NOTE: this component used to render `null` until a mount effect fired, to
  // dodge a suspected lucide-react hydration mismatch. The cost was severe and
  // sitewide: HomePageClient renders EVERY tenant page (home and every
  // [...slug] page), so every page served ~2KB of empty DOM and painted
  // nothing until React hydrated, a blank screen, then the whole page popping
  // in at once, then each listing section swapping its skeletons for content.
  // Search engines saw an empty document.
  //
  // The stated cause does not hold: the workspace resolves a single
  // lucide-react (0.469.0) for both bundles, so server and client emit
  // identical SVG paths. Rendering on the server is therefore safe, and the
  // page now paints its real content on first byte.

  const NotFoundIllustration = () => (
    <>
      <style>{`
        @keyframes notfound-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes notfound-wave {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes notfound-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .notfound-svg { animation: notfound-fade-in 0.5s ease-out forwards; }
        .notfound-float { animation: notfound-float 2.5s ease-in-out infinite; }
        .notfound-wave { transform-origin: bottom center; animation: notfound-wave 2s ease-in-out infinite; }
      `}</style>
      <svg
        viewBox="0 0 200 220"
        className="notfound-svg text-muted-foreground/90 mx-auto h-52 w-48 max-w-full sm:h-60 sm:w-56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="notfound-avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.25)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.08)" />
          </linearGradient>
        </defs>
        <g className="notfound-float">
          {/* Head */}
          <circle
            cx="100"
            cy="65"
            r="42"
            fill="url(#notfound-avatar-grad)"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-90"
          />
          {/* Face - eyes */}
          <ellipse cx="85" cy="62" rx="4" ry="5" fill="currentColor" className="opacity-80" />
          <ellipse cx="115" cy="62" rx="4" ry="5" fill="currentColor" className="opacity-80" />
          {/* Smile */}
          <path
            d="M82 78 Q100 90 118 78"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            className="opacity-70"
          />
          {/* Body - rounded torso */}
          <path
            d="M65 115 Q60 180 100 200 Q140 180 135 115 Z"
            fill="url(#notfound-avatar-grad)"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            className="opacity-90"
          />
          {/* Arm waving - laptop/device */}
          <g className="notfound-wave">
            <path
              d="M135 125 L165 110 L175 130 L145 145 Z"
              fill="url(#notfound-avatar-grad)"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              className="opacity-80"
            />
            <rect
              x="148"
              y="118"
              width="18"
              height="12"
              rx="2"
              fill="currentColor"
              className="opacity-40"
            />
          </g>
          {/* Other arm */}
          <path
            d="M65 125 L45 150"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-60"
          />
        </g>
      </svg>
    </>
  );

  const NotFoundContent = () => (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-8">
      <NotFoundIllustration />
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground max-w-sm text-base sm:text-lg">
          Build your page now at {BRAND_NAME}: create courses, sell books and test series, and
          grow your audience.
        </p>
        <a
          href={BRAND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Get started at {BRAND_URL_DISPLAY}
        </a>
      </div>
    </div>
  );

  if (error || !pageConfig) {
    return <NotFoundContent />;
  }

  // Login page: no header, footer, sidebar, topBar
  const isAuthPage = pageConfig.slug === "login";
  const layoutOverrides = isAuthPage
    ? { hideHeader: true, hideFooter: true, hideTopBar: true, hideSidebar: true }
    : pageConfig.layoutOverrides;

  return (
    <TenantThemeProvider theme={pageConfig.theme}>
      <AvailableRoutesProvider
        initialRoutes={pageConfig.availableRoutes ?? getAvailableRoutesResponse()}
      >
        <LayoutWrapper layout={layout} layoutOverrides={layoutOverrides}>
          <SectionRenderer sections={regularSections} editMode={false} />
          {layout?.communityLinks && layout.communityLinks.length > 0 && (
            <FloatingSocialWidget links={layout.communityLinks} />
          )}
        </LayoutWrapper>
      </AvailableRoutesProvider>
    </TenantThemeProvider>
  );
}

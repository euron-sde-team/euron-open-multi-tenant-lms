"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js"; // eslint-disable-line import/no-named-as-default
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";

import { useAuth } from "@/lib/hooks/use-auth";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + "?" + searchParams.toString();
      }
      ph.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  // /preview/* routes are internal template-preview iframes (the template
  // picker mounts ~29 of them). Booting PostHog, session recording,
  // autocapture, heatmaps, in every iframe is pure overhead and noise.
  const isPreviewRoute = pathname?.startsWith("/preview") ?? false;

  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY || isPreviewRoute) return;

    if (!(posthog as { __loaded?: boolean }).__loaded) {
      posthog.init(POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        enable_heatmaps: true,
        session_recording: {
          maskAllInputs: true,
        },
      });
    }
  }, [isPreviewRoute]);

  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY || !(posthog as { __loaded?: boolean }).__loaded) return;

    if (user?.id) {
      posthog.identify(user.id);
      posthog.setPersonProperties({
        email: user.email,
        name: user.name,
        user_type: "admin",
      });
    }
  }, [user?.id, user?.email, user?.name]);

  if (!POSTHOG_KEY || isPreviewRoute) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js"; // eslint-disable-line import/no-named-as-default
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect, useRef } from "react";

import { useUserAuthStore } from "@/lib/stores/auth-store";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

interface PostHogProviderProps {
  children: React.ReactNode;
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName?: string | null;
}

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

function doIdentify(tenantId: string, member: { id: string; email?: string; name?: string }) {
  const distinctId = `${tenantId}:${member.id}`;
  posthog.identify(distinctId);
  posthog.setPersonProperties({
    email: member.email,
    name: member.name,
    user_type: "member",
    tenant_id: tenantId,
  });
}

export function PostHogProvider({ children, tenantId, tenantSlug, tenantName }: PostHogProviderProps) {
  const member = useUserAuthStore((s) => s.member);
  const initDone = useRef(false);
  const identifyDone = useRef(false);

  // Use tenantId from headers, or fallback to member.tenantId when logged in (e.g. plain localhost)
  const effectiveTenantId = tenantId ?? member?.tenantId ?? null;

  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY) return;

    if (!initDone.current && !(posthog as { __loaded?: boolean }).__loaded) {
      posthog.init(POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: "https://us.i.posthog.com",
        person_profiles: "always",
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        enable_heatmaps: true,
        session_recording: {
          maskAllInputs: true,
        },
      });

      if (effectiveTenantId) {
        posthog.group("tenant", effectiveTenantId, {
          slug: tenantSlug ?? undefined,
          name: tenantName ?? undefined,
        });
      }

      initDone.current = true;

      // Identify immediately if auth is already hydrated (e.g. from localStorage persist)
      const { member: hydratedMember } = useUserAuthStore.getState();
      const tid = effectiveTenantId ?? hydratedMember?.tenantId;
      if (tid && hydratedMember?.id) {
        identifyDone.current = true;
        doIdentify(tid, hydratedMember);
      }
    }
  }, [effectiveTenantId, tenantSlug, tenantName]);

  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY || !(posthog as { __loaded?: boolean }).__loaded) return;
    if (!initDone.current) return;

    if (effectiveTenantId) {
      posthog.group("tenant", effectiveTenantId, {
        slug: tenantSlug ?? undefined,
        name: tenantName ?? undefined,
      });
    }
  }, [effectiveTenantId, tenantSlug, tenantName]);

  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY || !(posthog as { __loaded?: boolean }).__loaded) return;

    const tid = effectiveTenantId ?? member?.tenantId;
    if (member?.id && tid) {
      doIdentify(tid, member);
      identifyDone.current = true;
    }
  }, [member?.id, member?.email, member?.name, member?.tenantId, effectiveTenantId]);

  // Identify as soon as auth persist rehydrates (before any events fire with anonymous ID)
  useEffect(() => {
    if (typeof window === "undefined" || !POSTHOG_KEY || identifyDone.current) return;

    const persist = useUserAuthStore.persist;
    const onHydrated = () => {
      const { member: m } = useUserAuthStore.getState();
      const tid = effectiveTenantId ?? m?.tenantId;
      if (tid && m?.id && !identifyDone.current) {
        identifyDone.current = true;
        posthog.group("tenant", tid, { slug: tenantSlug ?? undefined, name: tenantName ?? undefined });
        doIdentify(tid, m);
      }
    };
    if (persist?.onFinishHydration) {
      persist.onFinishHydration(onHydrated);
    }
    const t = setTimeout(onHydrated, 0);
    return () => clearTimeout(t);
  }, [effectiveTenantId]);

  if (!POSTHOG_KEY) {
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

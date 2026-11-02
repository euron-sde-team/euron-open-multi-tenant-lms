"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  captureUtmFromUrl,
  getSessionId,
  getUtmParams,
  isRefAlreadyTracked,
  markRefTracked,
} from "@/lib/utils/utm";

/**
 * Captures UTM/tracking params from the URL into localStorage on every
 * route change. Must be placed in the root layout so it runs before any
 * redirect (auth guard, phone modal, etc.) can strip the params.
 *
 * Also fires a partner click tracking call when a `ref` param is detected.
 */
export function UtmCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Always persist UTM params from URL → localStorage
    captureUtmFromUrl();

    // Track partner click when ref is present and not yet tracked this session
    const ref = searchParams?.get("ref");
    if (ref && !isRefAlreadyTracked(ref)) {
      const utm = getUtmParams();
      const sessionId = getSessionId();

      fetch("/api/proxy/tenant/auth/partner/track-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_code: ref,
          utm_source: utm.utm_source || undefined,
          utm_medium: utm.utm_medium || undefined,
          utm_campaign: utm.utm_campaign || undefined,
          utm_content: utm.utm_content || undefined,
          utm_term: utm.utm_term || undefined,
          utm_channel: utm.utm_channel || undefined,
          utm_adset: utm.utm_adset || undefined,
          utm_matchtype: utm.utm_matchtype || undefined,
          gclid: utm.gclid || undefined,
          fbclid: utm.fbclid || undefined,
          msclkid: utm.msclkid || undefined,
          li_fat_id: utm.li_fat_id || undefined,
          twclid: utm.twclid || undefined,
          ttclid: utm.ttclid || undefined,
          dclid: utm.dclid || undefined,
          landing_page: window.location.href,
          session_id: sessionId || undefined,
        }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const json = await res.json();
          const clickId = json?.data?.click_id;
          if (clickId) {
            // Merge click_id into UTM localStorage so it's available
            // for phone verification → lead creation
            try {
              const raw = localStorage.getItem("lms_admin_utm");
              const stored = raw ? JSON.parse(raw) : {};
              stored.click_id = clickId;
              localStorage.setItem("lms_admin_utm", JSON.stringify(stored));
            } catch {
              // localStorage unavailable
            }
          }
          markRefTracked(ref);
        })
        .catch(() => {
          // Fire-and-forget, silently ignore errors
        });
    }
  }, [pathname, searchParams]);

  return null;
}

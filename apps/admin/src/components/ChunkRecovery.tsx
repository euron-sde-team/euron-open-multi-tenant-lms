"use client";

import { useEffect } from "react";

/**
 * Auto-recovers from stale-deploy chunk errors. After a deploy, a browser
 * holding an old HTML/RSC payload requests JS chunk hashes that no longer
 * exist → "Loading chunk N failed" / "Failed to fetch dynamically imported
 * module", often surfacing as a hung page or React #423 during hydration.
 *
 * The route error boundary (global-error.tsx) only catches errors thrown
 * during render, chunk failures during streaming/hydration fire as window
 * `error` / `unhandledrejection` events instead. This listens for those and
 * does a single guarded hard reload (cache-busted) so the user lands on the
 * fresh build instead of a blank/hanging dashboard.
 */
const RELOAD_FLAG = "lms_admin_chunk_reload_at";

function isChunkError(message: string): boolean {
  return (
    /Loading chunk \S+ failed/i.test(message) ||
    /Loading CSS chunk \S+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

function reloadOnce() {
  if (typeof window === "undefined") return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (Date.now() - last < 20_000) return; // guard against reload storms
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // sessionStorage unavailable, reload anyway
  }
  // Cache-bust so the browser re-fetches index.html / the RSC payload.
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
}

export function ChunkRecovery() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = e?.message ?? (e?.error as Error | undefined)?.message ?? "";
      if (isChunkError(msg)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e?.reason as { name?: string; message?: string } | undefined;
      const msg = `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (isChunkError(msg)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

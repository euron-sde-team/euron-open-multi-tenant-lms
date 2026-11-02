"use client";

import { useEffect } from "react";

/**
 * Blocks accidental navigation while there are unsaved changes.
 *
 * - Tab close / refresh: native beforeunload prompt.
 * - In-app link click: document-level capture-phase listener walks up to the
 *   nearest <a> with an internal href and shows a confirm() if it would leave
 *   the current pathname.
 * - Browser back / forward: pushes a sentinel history entry while dirty and
 *   re-pushes it on popstate so back lands the user back here pending confirm.
 *
 * `beforeunload` alone misses every Next.js client-side navigation, which was
 * the data-loss path flagged in code review on the blog editor.
 */
export function useUnsavedChangesGuard(isDirty: boolean, message?: string): void {
  useEffect(() => {
    if (!isDirty) return;
    if (typeof window === "undefined") return;

    const prompt =
      message ??
      "You have unsaved changes. Are you sure you want to leave this page? Your edits will be lost.";

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      let node = e.target as HTMLElement | null;
      while (node && node !== document.body) {
        if (node instanceof HTMLAnchorElement && node.href) break;
        node = node.parentElement;
      }
      if (!(node instanceof HTMLAnchorElement)) return;

      const url = new URL(node.href, window.location.origin);
      if (url.origin !== window.location.origin) return; // external; let it leave.
      if (node.target && node.target !== "" && node.target !== "_self") return;
      if (node.hasAttribute("download")) return;

      const samePath =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;
      if (samePath) return;

      if (!window.confirm(prompt)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Sentinel history entry so the next back press fires popstate here.
    const sentinel = { __unsavedGuard: Date.now() };
    history.pushState(sentinel, "", window.location.href);

    const onPopState = () => {
      if (!window.confirm(prompt)) {
        history.pushState(sentinel, "", window.location.href);
        return;
      }
      // User confirmed leaving: detach this guard and let the back land.
      window.removeEventListener("popstate", onPopState);
      history.back();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, message]);
}

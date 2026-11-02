"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Returns `false` during SSR and the
 * initial client render, then updates after mount. This avoids the
 * hydration mismatch that comes from reading `window.matchMedia` during
 * render, server-rendered output and the first client paint always
 * match (mobile assumed false), and the value flips to the correct
 * viewport state immediately after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    // Safari < 14 only supports addListener/removeListener.
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, [query]);

  return matches;
}

/** True when the viewport is below Tailwind's `lg` breakpoint (1024px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023.98px)");
}

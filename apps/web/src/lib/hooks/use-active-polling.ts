import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref + an `isActive` flag that is true only when the document is
 * visible AND the referenced element is intersecting the viewport. Use it to
 * gate React Query `refetchInterval` so polling stops as soon as the user
 * tabs away or scrolls the panel out of view.
 */
export function useActivePolling<T extends HTMLElement = HTMLElement>(): {
  ref: React.RefObject<T>;
  isActive: boolean;
} {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [docVisible, setDocVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  );

  useEffect(() => {
    const onVis = () =>
      setDocVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isActive: inView && docVisible };
}

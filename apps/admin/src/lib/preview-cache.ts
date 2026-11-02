// Session-scoped fetch cache for the /preview/* iframe routes.
//
// The template picker renders up to ~29 same-origin iframes, each booting the
// full preview page and firing identical catalog requests (published courses,
// books, bundles, categories, testimonials, org details). Same-origin iframes
// in one tab share sessionStorage, so a short-TTL cache there collapses those
// duplicate requests to one per resource.
//
// Outside a /preview route this module is a transparent pass-through, regular
// dashboard/editor behavior is unchanged.

const TTL_MS = 60_000;
const PREFIX = "preview-cache:";

export function isPreviewContext(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/preview")
  );
}

export async function cachedInPreview<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!isPreviewContext()) return fetcher();

  const storageKey = PREFIX + key;
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const entry = JSON.parse(raw) as { t: number; v: T };
      if (Date.now() - entry.t < TTL_MS) return entry.v;
    }
  } catch {
    // Corrupted entry or storage unavailable, fall through to the network.
  }

  const value = await fetcher();
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // Quota exceeded / private mode, serve uncached.
  }
  return value;
}

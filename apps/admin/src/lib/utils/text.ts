/**
 * Decode common HTML entities so raw entities (e.g. &amp;) display correctly as characters (&).
 * Use when rendering user or backend content that may be stored with entities.
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Recursively decode HTML entities in all string values of an object/array.
 * Skips URLs (http:// / https://) to avoid corrupting query parameters.
 */
export function deepDecodeHtmlEntities<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    return decodeHtmlEntities(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(deepDecodeHtmlEntities) as unknown as T;
  }
  if (typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = deepDecodeHtmlEntities(v);
    }
    return result as T;
  }
  return value;
}

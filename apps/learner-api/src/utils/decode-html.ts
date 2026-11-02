/**
 * Reverse the HTML-entity encoding applied by our global `express-xss-sanitizer`
 * middleware. The sanitizer encodes request bodies (`&` -> `&amp;`, `<` -> `&lt;`,
 * etc.) before they reach controllers, so plain text typed by an admin or user is
 * stored already-encoded and then renders as a literal entity (e.g. "Q &amp; A").
 *
 * We render these values as plain text on the client (React auto-escapes on
 * output) and escape them ourselves when composing HTML emails, so storing the
 * raw, decoded text is both correct and safe. Apply this at the service boundary
 * for contact + member-form text: on write so storage/email are clean, and on
 * read so already-encoded historical rows repair themselves.
 *
 * IMPORTANT: `&amp;` must be decoded LAST, otherwise a legitimately-encoded
 * literal like `&amp;lt;` would wrongly collapse to `<`.
 */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2f;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&amp;/g, "&");
}

/** Decode a value that may be null/undefined, preserving the nullish input. */
export function decodeNullableText<T extends string | null | undefined>(
  value: T
): T {
  return (typeof value === "string" ? decodeHtmlEntities(value) : value) as T;
}

/**
 * Recursively decode every string contained in a value (objects, arrays, and
 * scalar strings). Useful for JSON blobs such as form `fields` definitions and
 * member response `data` where text lives at arbitrary depth.
 */
export function deepDecodeHtmlEntities<T>(value: T): T {
  if (typeof value === "string") {
    return decodeHtmlEntities(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepDecodeHtmlEntities(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepDecodeHtmlEntities(v);
    }
    return out as unknown as T;
  }
  return value;
}

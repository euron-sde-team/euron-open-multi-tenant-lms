/**
 * HTML-aware text cleanup for imported question content.
 *
 * Real-world GIFT files (especially Moodle exports) carry rich text as HTML in
 * both stems and answers, e.g. `<p dir="ltr" style="text-align: left;">Both
 * Severity &amp; Frequency</p>`. Our destinations store/display plain text, so
 * that markup must become readable text with entities decoded.
 *
 * The robust path is the browser's own parser: `DOMParser` + `textContent`
 * strips every tag and decodes every entity exactly as a browser would render
 * it. A pure regex + entity fallback covers non-DOM environments (SSR / tests).
 */

// Named entities for the non-DOM fallback only (production uses DOMParser, which
// decodes every entity natively). Codepoints use String.fromCharCode to keep the
// source ASCII; numeric entities (decimal + hex) are decoded programmatically.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: String.fromCharCode(0x00a9),
  reg: String.fromCharCode(0x00ae),
  trade: String.fromCharCode(0x2122),
  hellip: String.fromCharCode(0x2026),
  mdash: String.fromCharCode(0x2014),
  ndash: String.fromCharCode(0x2013),
  lsquo: String.fromCharCode(0x2018),
  rsquo: String.fromCharCode(0x2019),
  ldquo: String.fromCharCode(0x201c),
  rdquo: String.fromCharCode(0x201d),
  deg: String.fromCharCode(0x00b0),
  times: String.fromCharCode(0x00d7),
  divide: String.fromCharCode(0x00f7),
  plusmn: String.fromCharCode(0x00b1),
};

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      safeFromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name) => {
      const v = NAMED_ENTITIES[(name as string).toLowerCase()];
      return v ?? match;
    });
}

// \s in JS already matches space, tab, newline, and non-breaking space.
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * True when the string contains an HTML tag or a character entity, i.e. when it
 * needs HTML decoding. Plain text (including a stray `<` not forming a tag) is
 * left untouched so literal characters are preserved.
 */
export function looksLikeHtml(s: string): boolean {
  return (
    /<\/?[a-z][^>]*>/i.test(s) ||
    /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(s)
  );
}

/** Convert HTML to readable plain text. Tags removed, entities decoded. */
export function htmlToText(input: string): string {
  // Turn block-level boundaries into spaces so words do not merge ("A</p><p>B").
  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol|table|blockquote)\s*>/gi, "\n");

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(withBreaks, "text/html");
    return normalizeWhitespace(doc.body.textContent ?? "");
  }

  // Non-DOM fallback (SSR / tests): strip tags, then decode entities.
  return normalizeWhitespace(decodeEntities(withBreaks.replace(/<[^>]+>/g, "")));
}

/** Clean text that may or may not contain HTML; cheap no-op for plain text. */
export function cleanRichText(s: string): string {
  return looksLikeHtml(s) ? htmlToText(s) : normalizeWhitespace(s);
}

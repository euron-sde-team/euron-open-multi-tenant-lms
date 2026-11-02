/**
 * Small allowlist HTML sanitizer for rendering tenant-authored rich text
 * (e.g. TEXT lesson resources) via dangerouslySetInnerHTML.
 *
 * Deliberately dependency-free (no dompurify) and pure-string based so it
 * works identically during SSR and in the browser.
 *
 * Strategy:
 * 1. Remove comments and dangerous elements together with their content
 *    (script, style, iframe, ...).
 * 2. Walk every remaining tag: drop tags not in the allowlist (keeping their
 *    inner text), and rebuild allowed tags keeping only allowlisted
 *    attributes, event handlers (`on*`) and unsafe URL schemes are dropped.
 * 3. Anchors are forced to open in a new tab with `rel="noopener noreferrer"`.
 */

const ALLOWED_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

/** Elements whose entire content must be removed, not just the tags. */
const DROP_WITH_CONTENT =
  "script|style|iframe|object|embed|form|svg|math|link|meta|base|title|textarea|noscript|select|option|button|input";

const GLOBAL_ALLOWED_ATTRS = new Set(["class", "title"]);

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  img: new Set(["src", "alt", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

const URL_ATTRS = new Set(["href", "src"]);

/**
 * Allowlisted inline-style declarations. Deliberately tiny: only presentational
 * alignment, which TipTap's TextAlign extension emits as `text-align` on block
 * elements. Everything else (and any value that could smuggle a url()/script)
 * is dropped. Image sizing rides on the `width` attribute, not style.
 */
const SAFE_TEXT_ALIGN = new Set(["left", "center", "right", "justify"]);

function sanitizeStyle(value: string): string {
  const kept: string[] = [];
  for (const decl of value.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim().toLowerCase();
    if (prop !== "text-align") continue;
    // Reject anything that could smuggle a url()/expression/escape sequence.
    if (/[<>(){}\\]|url|expression|javascript:/.test(val)) continue;
    if (!SAFE_TEXT_ALIGN.has(val)) continue;
    kept.push(`text-align: ${val}`);
  }
  return kept.join("; ");
}

function isSafeUrl(value: string): boolean {
  // Remove whitespace/control chars that can be used to obfuscate schemes
  // (e.g. "java\tscript:").
  const normalized = value
    // Control characters are exactly what this strips (javascript:\x00 tricks).
    // eslint-disable-next-line no-control-regex
    .replace(/[\s\u0000-\u001f\u007f]+/g, "")
    .toLowerCase();
  if (normalized.startsWith("javascript:")) return false;
  if (normalized.startsWith("vbscript:")) return false;
  if (normalized.startsWith("data:") && !normalized.startsWith("data:image/")) {
    return false;
  }
  return true;
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const tagAttrs = TAG_ALLOWED_ATTRS[tag];
  const kept: string[] = [];
  const attrRegex =
    /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs))) {
    const name = match[1].toLowerCase();
    // Never allow event handlers.
    if (name.startsWith("on")) continue;
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    // `style` is allowed only after filtering to a safe declaration subset
    // (currently just text-align), never passed through verbatim.
    if (name === "style") {
      const safe = sanitizeStyle(value);
      if (safe) kept.push(`style="${safe}"`);
      continue;
    }
    if (!GLOBAL_ALLOWED_ATTRS.has(name) && !tagAttrs?.has(name)) continue;
    if (URL_ATTRS.has(name) && !isSafeUrl(value)) continue;
    kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag === "a" && kept.some((attr) => attr.startsWith("href="))) {
    kept.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  return kept.length > 0 ? ` ${kept.join(" ")}` : "";
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";

  let out = html;

  // HTML comments (including conditional comments).
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // Dangerous elements together with their content.
  out = out.replace(
    new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi"),
    ""
  );
  // Any leftover unmatched/self-closing dangerous tags.
  out = out.replace(
    new RegExp(`<\\/?(?:${DROP_WITH_CONTENT})\\b[^>]*>`, "gi"),
    ""
  );

  // Rebuild every remaining tag from the allowlist.
  out = out.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?\s*>/g,
    (_full, slash: string, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (slash) return `</${tag}>`;
      return `<${tag}${sanitizeAttributes(tag, rawAttrs)}>`;
    }
  );

  return out;
}

export default sanitizeHtml;

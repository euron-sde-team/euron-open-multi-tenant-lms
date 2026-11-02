/**
 * Tenant theme values end up inside a <style> element, so a tenant must not be
 * able to close the declaration, the rule or the element. Only plain values pass:
 * colors (hex, named, rgb()/hsl() or a bare "H S% L%" triplet), lengths, numbers
 * and font family lists. Anything else is dropped and the default applies.
 */
const SAFE_CHARS = /^[A-Za-z0-9#%.,+\-/\s()'"_]*$/;

export function safeCssValue(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const v = String(value).trim();
  if (!v || v.length > 200 || !SAFE_CHARS.test(v)) return null;
  if (/url\s*\(|expression\s*\(|\/\*|\*\//i.test(v)) return null;
  if ((v.match(/"/g)?.length ?? 0) % 2 || (v.match(/'/g)?.length ?? 0) % 2) return null;
  let depth = 0;
  for (const ch of v) {
    if (ch === "(") depth += 1;
    else if (ch === ")" && --depth < 0) return null;
  }
  return depth === 0 ? v : null;
}

/** `name: value` declarations for the values that pass, joined with `sep`. */
export function cssDeclarations(vars: Record<string, unknown>, sep: string): string {
  return Object.entries(vars)
    .map(([name, value]) => {
      const safe = /^--[a-z0-9-]+$/.test(name) ? safeCssValue(value) : null;
      return safe === null ? null : `${name}: ${safe}`;
    })
    .filter((d): d is string => d !== null)
    .join(sep);
}

/**
 * Request body parsing without dependencies.
 *
 * The Stripe SDK sends application/x-www-form-urlencoded with bracket notation
 * (line_items[0][price_data][unit_amount]=1000, metadata[order_id]=...). parseStripeForm
 * turns that back into nested objects and arrays; numeric-looking leaves stay strings,
 * as they are on the wire (callers convert what they need).
 */
export type FormValue = string | FormValue[] | { [key: string]: FormValue };

function keyPath(name: string): string[] {
  const head = name.split("[", 1)[0] ?? name;
  const rest = [...name.slice(head.length).matchAll(/\[([^\]]*)\]/g)].map((m) => m[1] ?? "");
  return [head, ...rest];
}

function assign(target: Record<string, FormValue>, path: string[], value: string): void {
  let node: Record<string, FormValue> = target;
  for (let i = 0; i < path.length; i += 1) {
    const key = path[i] === "" ? String(Object.keys(node).length) : (path[i] as string);
    if (i === path.length - 1) {
      node[key] = value;
      return;
    }
    const next = node[key];
    if (next === undefined || typeof next === "string" || Array.isArray(next)) node[key] = {};
    node = node[key] as Record<string, FormValue>;
  }
}

/** Objects whose keys are exactly 0..n-1 become arrays, recursively. */
function arrays(value: FormValue): FormValue {
  if (typeof value === "string" || Array.isArray(value)) return value;
  const keys = Object.keys(value);
  const converted: Record<string, FormValue> = {};
  for (const k of keys) converted[k] = arrays(value[k] as FormValue);
  if (keys.length > 0 && keys.every((k, i) => k === String(i))) return keys.map((k) => converted[k] as FormValue);
  return converted;
}

export function parseStripeForm(body: string): Record<string, FormValue> {
  const out: Record<string, FormValue> = {};
  for (const [name, value] of new URLSearchParams(body)) assign(out, keyPath(name), value);
  return arrays(out) as Record<string, FormValue>;
}

/** JSON or form body, by content type. Empty bodies parse to {}. */
export function parseBody(raw: string, contentType: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  if ((contentType ?? "").includes("application/x-www-form-urlencoded")) return parseStripeForm(raw);
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return parseStripeForm(raw);
  }
}

/**
 * Offline AI engine: deterministic output with no network, used when no AI
 * key is configured. Structured requests get data shaped by the JSON schema
 * the AI SDK sends; text requests get prose built from the prompt's topic.
 * The same prompt always yields the same output.
 */

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema | Schema[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  $ref?: string;
  $defs?: Record<string, Schema>;
  definitions?: Record<string, Schema>;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  format?: string;
  default?: unknown;
  description?: string;
};

const TOPIC_PATTERNS = [
  /(?:titled|named|called|book|course|batch|cohort|series|test|quiz|page)\s+["“]([^"”\n]{3,80})["”]/i,
  /(?:course|book|batch|cohort|test series|series|test|quiz|assignment|page|academy|lecture|product|business)?\s*(?:title|topic|name|subject)\s*[:=]\s*["']?([^\n"']{3,80})/i,
  /"(?:title|topic|name|subject)"\s*:\s*"([^"]{3,80})"/i,
  /\babout\s+["']?([A-Z][^\n.,"']{2,60})/,
];

/** Best-effort topic of a prompt, for filling titles and copy. */
export function topicOf(prompt: string): string {
  for (const re of TOPIC_PATTERNS) {
    const m = prompt.match(re);
    const value = m?.[1]?.trim();
    if (value) return value.replace(/\s+/g, " ").slice(0, 60);
  }
  return "Getting Started";
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function clampText(text: string, s: Schema): string {
  let out = text;
  if (typeof s.maxLength === "number" && out.length > s.maxLength) {
    out = out.slice(0, s.maxLength).trim();
  }
  if (typeof s.minLength === "number" && out.length < s.minLength) {
    out = out.padEnd(s.minLength, ".");
  }
  return out;
}

const SENTENCES = [
  "builds a clear foundation step by step",
  "turns key ideas into practical skills",
  "uses short lessons, examples and practice",
  "helps learners apply what they learn right away",
  "ends with a project that ties everything together",
];

function stringFor(key: string, s: Schema, topic: string, index: number): string {
  const k = key.toLowerCase();
  if (s.format === "uri" || s.format === "url" || /url$|href|link$/.test(k)) {
    return k.includes("href") ? "/courses" : "https://example.com/";
  }
  if (s.format === "email" || k.includes("email")) return "hello@example.com";
  if (s.format === "date-time" || s.format === "date") return "2026-01-01T00:00:00.000Z";
  if (/color|colour/.test(k)) return ["#2563eb", "#0f172a", "#f59e0b"][index % 3];
  if (/slug/.test(k)) return `${topic}-${index + 1}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (/icon/.test(k)) return ["book", "star", "check"][index % 3];
  if (/language|lang/.test(k)) return "English";
  if (/level|difficulty/.test(k)) return "Beginner";
  if (/(^|_)id$|Id$/.test(key)) return `item-${index + 1}`;
  const n = index + 1;
  if (/headline|title|name|heading|label|question|cta|text$/.test(k)) {
    if (k.includes("question")) return `Which statement best describes ${topic} (${n})?`;
    if (k.includes("cta") || k.endsWith("text")) return n === 1 ? "Get started" : "Learn more";
    return index === 0 ? topic : `${topic}: ${humanize(key)} ${n}`;
  }
  if (/option|choice/.test(k) || (k.includes("answer") && k.includes("correct"))) {
    return `${topic} option ${String.fromCharCode(65 + (index % 26))}`;
  }
  const sentence = SENTENCES[(hash(key + topic) + index) % SENTENCES.length];
  return `${topic} ${sentence}.`;
}

function numberFor(key: string, s: Schema, index: number, integer: boolean): number {
  const k = key.toLowerCase();
  let value = /price|amount|fee/.test(k)
    ? 0
    : /duration|minutes/.test(k)
      ? 30
      : /hours/.test(k)
        ? 4
        : /order|position|index|correct/.test(k)
          ? index
          : /rating/.test(k)
            ? 4.8
            : 1;
  const min = s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : undefined);
  const max = s.maximum ?? (s.exclusiveMaximum !== undefined ? s.exclusiveMaximum - 1 : undefined);
  if (min !== undefined && value < min) value = min;
  if (max !== undefined && value > max) value = max;
  return integer ? Math.round(value) : value;
}

interface Ctx {
  root: Schema;
  topic: string;
  depth: number;
}

function resolveRef(ref: string, root: Schema): Schema {
  const path = ref.replace(/^#\//, "").split("/");
  let node: unknown = root;
  for (const part of path) {
    if (node && typeof node === "object") node = (node as Record<string, unknown>)[part];
  }
  return (node as Schema) ?? {};
}

function valueFor(schema: Schema | undefined, key: string, index: number, ctx: Ctx): unknown {
  if (!schema || ctx.depth > 12) return null;
  let s = schema;
  if (s.$ref) s = resolveRef(s.$ref, ctx.root);
  if (s.const !== undefined) return s.const;
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[index % s.enum.length];
  if (s.allOf?.length) {
    return s.allOf.reduce<Record<string, unknown>>((acc, part) => {
      const v = valueFor(part, key, index, { ...ctx, depth: ctx.depth + 1 });
      return v && typeof v === "object" && !Array.isArray(v) ? { ...acc, ...(v as object) } : acc;
    }, {});
  }
  const variants = s.anyOf ?? s.oneOf;
  if (variants?.length) {
    const pick = variants.find((v) => v.type !== "null") ?? variants[0];
    return valueFor(pick, key, index, { ...ctx, depth: ctx.depth + 1 });
  }
  let type = s.type;
  if (Array.isArray(type)) type = type.find((t) => t !== "null") ?? type[0];
  if (!type) type = s.properties ? "object" : s.items ? "array" : "string";

  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [prop, sub] of Object.entries(s.properties ?? {})) {
        out[prop] = valueFor(sub, prop, index, { ...ctx, depth: ctx.depth + 1 });
      }
      return out;
    }
    case "array": {
      const itemSchema = Array.isArray(s.items) ? s.items[0] : s.items;
      const min = s.minItems ?? 0;
      const max = s.maxItems ?? Math.max(min, 3);
      const count = Math.min(max, Math.max(min, 3));
      return Array.from({ length: count }, (_, i) =>
        valueFor(itemSchema, singular(key), i, { ...ctx, depth: ctx.depth + 1 })
      );
    }
    case "string":
      return clampText(stringFor(key, s, ctx.topic, index), s);
    case "integer":
      return numberFor(key, s, index, true);
    case "number":
      return numberFor(key, s, index, false);
    case "boolean":
      // "exactly one correct option" style schemas: the first item is correct.
      return /correct|right|answer/i.test(key) ? index === 0 : index === 0 && /featured|preview|free/i.test(key);
    case "null":
      return null;
    default:
      return null;
  }
}

function singular(key: string): string {
  return key.endsWith("ies") ? `${key.slice(0, -3)}y` : key.endsWith("s") ? key.slice(0, -1) : key;
}

/** Deterministic JSON matching a JSON schema, themed on the prompt's topic. */
export function offlineJsonFromSchema(schema: unknown, prompt: string): unknown {
  const root = (schema ?? { type: "object" }) as Schema;
  return valueFor(root, "root", 0, { root, topic: topicOf(prompt), depth: 0 });
}

/** Deterministic prose for a plain text request. */
export function offlineText(prompt: string): string {
  const topic = topicOf(prompt);
  return [
    `${topic} is a practical, well structured learning experience.`,
    `It ${SENTENCES[0]}, ${SENTENCES[2]}, and ${SENTENCES[3]}.`,
    `By the end, learners can explain the core ideas of ${topic} and use them with confidence.`,
  ].join(" ");
}

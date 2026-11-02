/**
 * An OpenAI-compatible chat completions endpoint with deterministic output, for running
 * the AI authoring paths against `AI_PROVIDER=openai` without a key or a network.
 *
 *   GET  /v1/models
 *   POST /v1/chat/completions   { model, messages, response_format?, stream? }
 *
 * Output is a pure function of the request: with response_format json_schema the reply is
 * an object shaped by that schema; with json_object it is a small fixed object that
 * echoes the prompt; otherwise plain text. stream: true sends the same content as one
 * SSE chunk followed by [DONE].
 */
import { createHash } from "node:crypto";
import type { ServerResponse } from "node:http";

import { config } from "./config.ts";
import type { Req } from "./http.ts";
import { credentials, json, nowSeconds, str } from "./http.ts";

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  minItems?: number;
  minimum?: number;
  format?: string;
  $ref?: string;
  $defs?: Record<string, Schema>;
  definitions?: Record<string, Schema>;
};

function title(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Value";
}

/** A value that satisfies `schema` (the subset structured outputs use). */
export function sampleFromSchema(schema: Schema, key = "value", root: Schema = schema, depth = 0): unknown {
  if (depth > 8) return null;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? "";
    const target = root.$defs?.[name] ?? root.definitions?.[name];
    return target ? sampleFromSchema(target, key, root, depth + 1) : null;
  }
  if (schema.const !== undefined) return schema.const;
  if (schema.enum?.length) return schema.enum[0];
  const variant = schema.anyOf?.find((s) => s.type !== "null") ?? schema.oneOf?.[0];
  if (variant) return sampleFromSchema(variant, key, root, depth + 1);
  const type = Array.isArray(schema.type) ? (schema.type.find((t) => t !== "null") ?? "null") : (schema.type ?? (schema.properties ? "object" : "string"));
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, s] of Object.entries(schema.properties ?? {})) out[k] = sampleFromSchema(s, k, root, depth + 1);
      return out;
    }
    case "array": {
      const n = Math.max(schema.minItems ?? 0, 2);
      return Array.from({ length: n }, (_, i) => sampleFromSchema(schema.items ?? {}, `${key} ${i + 1}`, root, depth + 1));
    }
    case "integer":
    case "number":
      return Math.max(schema.minimum ?? 1, 1);
    case "boolean":
      return true;
    case "null":
      return null;
    default:
      if (schema.format === "uri") return "https://example.com/";
      if (schema.format === "date-time") return "2026-01-01T00:00:00.000Z";
      return `Sample ${title(key).toLowerCase()}`;
  }
}

function lastUserText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i] as { role?: string; content?: unknown };
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) return m.content.map((c: { text?: string }) => c?.text ?? "").join(" ");
  }
  return "";
}

export function completionContent(body: Record<string, unknown>): string {
  const format = (body.response_format ?? {}) as { type?: string; json_schema?: { schema?: Schema } };
  const prompt = lastUserText(body.messages).slice(0, 200);
  if (format.type === "json_schema" && format.json_schema?.schema) return JSON.stringify(sampleFromSchema(format.json_schema.schema));
  if (format.type === "json_object") {
    return JSON.stringify({ stub: true, title: "Sample title", summary: `Deterministic reply to: ${prompt}`, items: ["First point", "Second point", "Third point"] });
  }
  return `Deterministic stub reply. You said: ${prompt}`;
}

export const openaiRoutes = {
  models(_req: Req, res: ServerResponse): void {
    json(res, 200, { object: "list", data: [{ id: "stub-text", object: "model", created: 0, owned_by: "stubs" }] });
  },

  chat(req: Req, res: ServerResponse): void {
    if (config.aiApiKey) {
      const c = credentials(req.headers);
      if (c.scheme !== "bearer" || c.user !== config.aiApiKey) return json(res, 401, { error: { message: "Incorrect API key provided", type: "invalid_request_error" } });
    }
    if (!Array.isArray(req.body.messages)) return json(res, 400, { error: { message: "messages is required", type: "invalid_request_error" } });
    const content = completionContent(req.body);
    const model = str(req.body.model, "stub-text");
    const idHash = createHash("sha256").update(req.raw).digest("hex").slice(0, 24);
    const promptTokens = Math.ceil(req.raw.length / 4);
    const completionTokens = Math.ceil(content.length / 4);
    const usage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens };
    const created = nowSeconds();

    if (req.body.stream === true) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const chunk = (delta: Record<string, unknown>, finish: string | null) =>
        `data: ${JSON.stringify({ id: `chatcmpl-${idHash}`, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.write(chunk({ role: "assistant", content }, null));
      res.write(chunk({}, "stop"));
      res.end("data: [DONE]\n\n");
      return;
    }
    json(res, 200, {
      id: `chatcmpl-${idHash}`,
      object: "chat.completion",
      created,
      model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage,
    });
  },
};

/** Small HTTP helpers shared by the stub handlers. */
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface Req {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  raw: string;
  body: Record<string, unknown>;
}

export type Handler = (req: Req, res: ServerResponse, params: Record<string, string>) => Promise<void> | void;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A provider-style id: `<prefix>_<n random alphanumerics>`. */
export function id(prefix: string, length = 14): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

export function html(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Bearer token, or the user part of HTTP Basic auth (Stripe accepts both; Razorpay is Basic). */
export function credentials(headers: IncomingMessage["headers"]): { scheme: "bearer" | "basic" | "none"; user: string; secret: string } {
  const value = headers.authorization ?? "";
  if (value.startsWith("Bearer ")) return { scheme: "bearer", user: value.slice(7).trim(), secret: "" };
  if (value.startsWith("Basic ")) {
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    return { scheme: "basic", user: i < 0 ? decoded : decoded.slice(0, i), secret: i < 0 ? "" : decoded.slice(i + 1) };
  }
  return { scheme: "none", user: "", secret: "" };
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

export function int(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function record(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) out[k] = str(v);
  return out;
}

/** A plain page shell for the hosted checkout screens. */
export function page(title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;background:#f4f5f7;color:#111;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;padding:32px;max-width:420px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.12)}
h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:4px 0 16px}.amount{font-size:28px;font-weight:600;color:#111;margin:16px 0}
.note{font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px;margin-top:20px}
button{font:inherit;padding:10px 16px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;margin-right:8px}
button.primary{background:#111;color:#fff;border-color:#111}
</style></head><body><main>${content}<p class="note">Local payment simulator. No card is charged and no real gateway is contacted.</p></main></body></html>`;
}

export function formatAmount(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const zeroDecimal = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"]);
  const threeDecimal = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);
  const digits = zeroDecimal.has(code) ? 0 : threeDecimal.has(code) ? 3 : 2;
  return `${code} ${(minor / 10 ** digits).toFixed(digits)}`;
}

import { format } from "winston";

type LogInfo = Record<string | symbol, unknown>;
type Formatter = ReturnType<typeof format>;

const REDACTED = "[REDACTED]";

// Exact keys (case-insensitive) whose values must never appear in logs.
// Matches regardless of nesting depth. Intentionally broad: any sensitive credential in any subsystem benefits.
const SENSITIVE_KEYS = new Set<string>([
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "masterkey",
  "master_key",
  "dek",
  "encrypteddek",
  "encrypted_dek",
  "pin",
  "password",
  "secret",
  "secretkey",
  "secret_key",
  "apikey",
  "api_key",
  "authprovidertoken",
  "auth_provider_token",
  "x-hub-signature-256",
  "x-razorpay-signature",
]);

// Header keys are lower-cased by express but may be passed through as-is.
// We match case-insensitively on the last path segment only.
const isSensitiveKey = (key: string): boolean =>
  SENSITIVE_KEYS.has(key.toLowerCase());

const redactValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value === null || value === undefined) return value;

  if (Buffer.isBuffer(value)) return REDACTED;

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value.map((v) => redactValue(v, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redactValue(v, seen);
    }
    return out;
  }

  return value;
};

// Winston format: redact sensitive values before any serialization.
// Applied via combine() in logger/*.ts.
const redactFormat: Formatter = format((info) => {
  const seen = new WeakSet<object>();
  const target = info as unknown as LogInfo;
  for (const key of Object.keys(target)) {
    if (key === "level" || key === "message" || key === "timestamp") continue;
    if (isSensitiveKey(key)) {
      target[key] = REDACTED;
      continue;
    }
    target[key] = redactValue(target[key], seen);
  }
  return info;
});

export default redactFormat;

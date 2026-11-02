import winston, { format } from "winston";
import config from "../../config";
import redactFormat from "./redactor";
const { combine, timestamp, printf } = format;

// Safe JSON stringifier that survives circular refs + non-serializable
// values (Buffer, BigInt, Error, etc.) so the logger can never throw and
// kill a request.
function safeStringify(obj: unknown, indent?: number): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      obj,
      (_key, value) => {
        if (typeof value === "bigint") return value.toString();
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        if (value && typeof value === "object" && (value as Buffer).length !== undefined && typeof (value as Buffer).byteLength === "number") {
          // Buffer/Uint8Array, show length, not contents (often keys/binary)
          return `<Buffer len=${(value as Buffer).length}>`;
        }
        if (typeof value === "object" && value !== null) {
          if (seen.has(value as object)) return "[Circular]";
          seen.add(value as object);
        }
        return value;
      },
      indent,
    );
  } catch {
    return String(obj);
  }
}

// Flat primitives → key=value, wrapped in quotes only when the value
// contains whitespace. Keeps single-level metadata on one line for easy
// scanning while avoiding the noise of a full JSON blob.
function formatFlatValue(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") {
    if (v === "" || /[\s,"]/.test(v)) return JSON.stringify(v);
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return safeStringify(v);
}

function isFlatPrimitive(v: unknown): boolean {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

// Winston's default printf stringifies the info object's `message` field
// directly, which produces "[object Object]" when a service calls
// `logger.info({ event: "x", ... })`. This custom printf:
//   1. Always stringifies object messages via safeStringify.
//   2. Pulls `event` out as a bracketed tag prefix (convention across the
//      WA code: every structured log has `event: "wa.xxx"`).
//   3. Renders flat metadata as inline `key=value` pairs for one-line
//      scanability.
//   4. Renders nested/complex metadata as pretty-printed JSON on the next
//      line so error bodies stay readable instead of collapsing into one
//      500-char string.
const myFormat = printf((info) => {
  const rest = { ...(info as Record<string, unknown>) };
  const level = rest.level;
  const ts = rest.timestamp;
  const message = rest.message;
  delete rest.level;
  delete rest.timestamp;
  delete rest.message;

  // Drop winston-internal symbol-keyed leftovers.
  for (const k of Object.keys(rest)) {
    if (k.startsWith("Symbol(")) delete rest[k];
  }

  // Promote `message` content into `rest` when it's an object.
  let messageString = "";
  if (typeof message === "string") {
    messageString = message;
  } else if (message !== undefined && message !== null) {
    if (typeof message === "object") {
      for (const [k, v] of Object.entries(message as Record<string, unknown>)) {
        if (!(k in rest)) rest[k] = v;
      }
    } else {
      messageString = String(message);
    }
  }

  // Pull `event` out as a prominent tag prefix.
  let tag = "";
  if (typeof rest.event === "string") {
    tag = rest.event;
    delete rest.event;
  }

  // Decide rendering mode for metadata: inline `key=value` if every value
  // is a flat primitive AND the total length stays reasonable; otherwise
  // pretty JSON on a new line.
  const metaEntries = Object.entries(rest);
  let metaRendered = "";
  if (metaEntries.length > 0) {
    const allFlat = metaEntries.every(([, v]) => isFlatPrimitive(v));
    const inlineAttempt = metaEntries
      .map(([k, v]) => `${k}=${formatFlatValue(v)}`)
      .join(" ");
    if (allFlat && inlineAttempt.length <= 180) {
      metaRendered = ` ${inlineAttempt}`;
    } else {
      metaRendered = `\n${safeStringify(rest, 2)}`;
    }
  }

  const tagStr = tag ? ` [${tag}]` : "";
  const msgStr = messageString ? ` ${messageString}` : "";
  return `${level} ${ts}${tagStr}${msgStr}${metaRendered}`;
});

const developmentLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: combine(
    redactFormat(),
    format.colorize(),
    timestamp({ format: "HH:mm:ss" }),
    myFormat,
  ),
  transports: [
    new winston.transports.Console(),
    ...(config.LOG_FILE ? [new winston.transports.File({ filename: config.LOG_FILE })] : []),
  ],
});

export default developmentLogger;

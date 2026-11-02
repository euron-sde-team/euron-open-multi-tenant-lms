import ExcelJS from "exceljs";
import Papa from "papaparse";

import { BadRequestError } from "../errors/bad-request.error";
import {
  BULK_IMPORT_MAX_FILE_BYTES,
  BULK_IMPORT_MAX_ROWS,
  type RawParsedRow,
} from "../types/bulk-imports.type";
import logger from "../utils/logger";
import { BRAND } from "../lib/brand";

const ACCEPTED_HEADERS = new Set(["name", "email", "phone", "valid_till"]);

// Friendly header aliases → canonical column name, so operators can label the
// optional expiry column however they think of it.
const HEADER_ALIASES: Record<string, string> = {
  "valid till": "valid_till",
  "valid_till": "valid_till",
  validtill: "valid_till",
  validity: "valid_till",
  "valid until": "valid_till",
  expiry: "valid_till",
  "expiry date": "valid_till",
  expires: "valid_till",
  "expires on": "valid_till",
};

function normalizeHeader(header: string): string {
  const base = header.trim().toLowerCase();
  return HEADER_ALIASES[base] ?? base;
}

/**
 * Extract a text representation from an ExcelJS cell that survives every
 * variant the parser might encounter: plain text, numeric, hyperlink, rich
 * text, shared formula result, dates, booleans. We prefer the displayed text
 * (`cell.text`) when it's a non-empty string, falling back to `cell.value`
 * for safety.
 *
 * Why we care: Excel often stores phone numbers as numeric cells, which makes
 * `cell.value` return the underlying number (without any leading "+") and
 * `cell.text` return the formatted display string. The matcher then
 * auto-prepends "+" if needed.
 */
function extractCellText(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;

  const displayed = (cell as ExcelJS.Cell & { text?: unknown }).text;
  if (typeof displayed === "string" && displayed.trim().length > 0) {
    return displayed;
  }

  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && typeof (v as { text: unknown }).text === "string") {
      return (v as { text: string }).text;
    }
    if ("richText" in v && Array.isArray((v as { richText?: unknown }).richText)) {
      return ((v as { richText: Array<{ text: string }> }).richText)
        .map((r) => r.text)
        .join("");
    }
    if ("result" in v) {
      const r = (v as { result: unknown }).result;
      if (typeof r === "string") return r;
      if (typeof r === "number") return String(r);
    }
    if ("hyperlink" in v) {
      return String((v as { hyperlink: unknown }).hyperlink ?? "");
    }
  }
  return String(v);
}

function valueOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Strip the "mailto:" URI prefix (and any query suffix like "?subject=...")
 * that Excel hyperlink cells embed into email values. Applied at parse time
 * so the cleaned email flows through every downstream path, dry-run preview,
 * report CSV, matcher, and final import, instead of each one re-cleaning.
 *
 * Idempotent: returns input unchanged if no mailto prefix is present.
 */
function stripMailtoUri(raw: string | null): string | null {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!/^mailto:/i.test(trimmed)) return raw;
  let stripped = trimmed.slice("mailto:".length);
  const queryIdx = stripped.indexOf("?");
  if (queryIdx !== -1) stripped = stripped.slice(0, queryIdx);
  stripped = stripped.trim();
  return stripped.length === 0 ? null : stripped;
}

function assertHeaderShape(headers: string[]): void {
  const seen = new Set<string>();
  for (const raw of headers) {
    const h = normalizeHeader(raw);
    if (!ACCEPTED_HEADERS.has(h)) {
      throw new BadRequestError(
        `Unexpected column "${raw}". Allowed columns: name, email, phone (case-insensitive).`,
      );
    }
    if (seen.has(h)) {
      throw new BadRequestError(`Duplicate column "${h}" in file header.`);
    }
    seen.add(h);
  }
  if (!seen.has("email") && !seen.has("phone")) {
    throw new BadRequestError(
      "File must contain at least an `email` or `phone` column.",
    );
  }
}

function rowsToParsed(
  rows: Array<Record<string, unknown>>,
  startingRowNumber: number,
): RawParsedRow[] {
  const out: RawParsedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    // Skip comment rows used in the downloadable sample.
    const firstKey = Object.keys(r)[0];
    const firstValue = firstKey ? valueOrNull(r[firstKey]) : null;
    if (firstValue && firstValue.startsWith("#")) continue;

    const name = valueOrNull(r["name"] ?? r["Name"] ?? r["NAME"]);
    const email = stripMailtoUri(
      valueOrNull(r["email"] ?? r["Email"] ?? r["EMAIL"]),
    );
    const phone = valueOrNull(r["phone"] ?? r["Phone"] ?? r["PHONE"]);
    // Optional per-row expiry (raw value; parsed + validated in the service).
    const validTill = valueOrNull(r["valid_till"]);

    // Skip rows that are entirely blank.
    if (name === null && email === null && phone === null) continue;

    // Note: we do NOT silently filter duplicate-header rows here. The matcher
    // detects them via looksLikeHeaderRow() and emits a visible
    // SKIPPED_LOOKS_LIKE_HEADER_ROW outcome so the operator can audit them.

    out.push({
      rowNumber: startingRowNumber + i,
      name,
      email,
      phone,
      validTill,
    });
  }
  return out;
}

export async function parseCsv(buffer: Buffer): Promise<RawParsedRow[]> {
  if (buffer.byteLength > BULK_IMPORT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${BULK_IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`,
    );
  }
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  // FieldMismatch (too few / too many fields) is non-fatal: rows are read by
  // named header key, so comment lines (skipped in rowsToParsed) and short rows
  // (caught per-row by the matcher as missing contact) must not abort the file.
  const fatalErrors = parsed.errors.filter((e) => e.type !== "FieldMismatch");
  if (fatalErrors.length > 0) {
    const first = fatalErrors[0];
    throw new BadRequestError(
      `CSV parse error on row ${first?.row ?? "?"}: ${first?.message ?? "unknown"}`,
    );
  }
  const headers = (parsed.meta.fields ?? []).map(normalizeHeader);
  assertHeaderShape(headers);
  const rows = rowsToParsed(parsed.data, 2); // row 1 is the header
  if (rows.length > BULK_IMPORT_MAX_ROWS) {
    throw new BadRequestError(
      `File has ${rows.length} rows. Maximum is ${BULK_IMPORT_MAX_ROWS}; split the file and retry.`,
    );
  }
  return rows;
}

export async function parseXlsx(buffer: Buffer): Promise<RawParsedRow[]> {
  if (buffer.byteLength > BULK_IMPORT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${BULK_IMPORT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`,
    );
  }
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  if (workbook.worksheets.length > 1) {
    // Non-fatal: we only read sheet 0. Warn so an operator with data on
    // sheet 2+ can diagnose why their upload looks empty.
    logger.warn(
      `[bulk-imports-parser] XLSX has ${workbook.worksheets.length} sheets; only the first will be read.`,
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestError("XLSX file contains no sheets.");
  }

  const rawHeaders: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
    rawHeaders.push(String(cell.value ?? "").trim());
  });
  assertHeaderShape(rawHeaders);
  const headers = rawHeaders.map(normalizeHeader);

  const rows: Array<Record<string, unknown>> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowIdx) => {
    if (rowIdx === 1) return; // header
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      obj[h] = extractCellText(cell);
    });
    rows.push(obj);
  });

  const parsed = rowsToParsed(rows, 2);
  if (parsed.length > BULK_IMPORT_MAX_ROWS) {
    throw new BadRequestError(
      `File has ${parsed.length} rows. Maximum is ${BULK_IMPORT_MAX_ROWS}; split the file and retry.`,
    );
  }
  return parsed;
}

export async function parseFile(input: {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}): Promise<RawParsedRow[]> {
  const lower = input.filename.toLowerCase();
  const isCsv =
    lower.endsWith(".csv") || input.mimetype === "text/csv";
  const isXlsx =
    lower.endsWith(".xlsx") ||
    input.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (isCsv) return parseCsv(input.buffer);
  if (isXlsx) return parseXlsx(input.buffer);

  throw new BadRequestError(
    "Unsupported file type. Upload a .csv or .xlsx file.",
  );
}

/**
 * Generate the downloadable CSV sample (UTF-8, ~250 bytes).
 *
 * `withValidity` adds the optional `valid_till` column. It is only relevant for
 * grant flows (course/book/batch bulk-enroll); the plain member import does not
 * grant access, so it omits the column.
 */
export function generateCsvSample(withValidity = false): Buffer {
  const lines = withValidity
    ? [
        "name,email,phone,valid_till",
        "Alice Example,alice@example.com,+14155550101,2027-08-11",
        "Bob Phone Only,,+919876543210,lifetime",
        "Carol Email Only,carol@example.com,,2026-12-31",
        "Dave Default,dave@example.com,,",
        "# Phone must be E.164 (leading + and country code). Either email or phone is required.",
        "# valid_till is OPTIONAL. Values: a date YYYY-MM-DD (e.g. 2027-08-11), or \"lifetime\" for no expiry. Leave blank to use the batch 'Access valid till' above.",
      ]
    : [
        "name,email,phone",
        "Alice Example,alice@example.com,+14155550101",
        "Bob Phone Only,,+919876543210",
        "Carol Email Only,carol@example.com,",
        "# Phone must be E.164 (leading + and country code). Either email or phone is required.",
      ];
  return Buffer.from(lines.join("\n") + "\n", "utf-8");
}

/**
 * Generate the downloadable XLSX sample with header styling and a comment row.
 * See generateCsvSample for the meaning of `withValidity`.
 */
export async function generateXlsxSample(withValidity = false): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Members");
  const baseColumns = [
    { header: "name", key: "name", width: 28 },
    { header: "email", key: "email", width: 32 },
    { header: "phone", key: "phone", width: 22 },
  ];
  sheet.columns = withValidity
    ? [...baseColumns, { header: "valid_till", key: "valid_till", width: 16 }]
    : baseColumns;
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({
    name: "Alice Example",
    email: "alice@example.com",
    phone: "+14155550101",
    ...(withValidity ? { valid_till: "2027-08-11" } : {}),
  });
  sheet.addRow({
    name: "Bob Phone Only",
    email: "",
    phone: "+919876543210",
    ...(withValidity ? { valid_till: "lifetime" } : {}),
  });
  sheet.addRow({
    name: "Carol Email Only",
    email: "carol@example.com",
    phone: "",
    ...(withValidity ? { valid_till: "2026-12-31" } : {}),
  });
  const comment = sheet.addRow({
    name:
      "# Phone must be E.164 (leading + and country code). Either email or phone is required.",
    email: "",
    phone: "",
  });
  comment.font = { italic: true, color: { argb: "FF888888" } };
  if (withValidity) {
    const comment2 = sheet.addRow({
      name:
        "# valid_till is OPTIONAL. Values: date YYYY-MM-DD (e.g. 2027-08-11), or \"lifetime\" for no expiry. Blank = use the batch 'Access valid till'.",
      email: "",
      phone: "",
      valid_till: "",
    });
    comment2.font = { italic: true, color: { argb: "FF888888" } };
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

import ExcelJS from "exceljs";
import Papa from "papaparse";

import { BadRequestError } from "../errors/bad-request.error";
import logger from "../utils/logger";
import { BRAND } from "../lib/brand";

/** Maximum size accepted for an uploaded recipients sheet (5 MB). */
export const BULK_CERT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Maximum recipients accepted per batch. */
export const BULK_CERT_MAX_ROWS = 5_000;

const ACCEPTED_HEADERS = new Set(["name", "issue_date", "email"]);

/** Loose email shape check, recipients are still verified at send time. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RawCertRow {
  rowNumber: number;
  name: string;
  /** Optional recipient email, enables delivery + learner-account mapping. */
  email: string | null;
  /** Null when the sheet left issue_date blank, caller defaults to today. */
  issueDate: Date | null;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function valueOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/**
 * Extract a text representation from an ExcelJS cell across every variant the
 * parser might encounter: plain text, numeric, rich text, formula result,
 * dates, booleans. Prefers the displayed text, falling back to the raw value.
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
      return (v as { richText: Array<{ text: string }> }).richText
        .map((r) => r.text)
        .join("");
    }
    if ("result" in v) {
      const r = (v as { result: unknown }).result;
      if (typeof r === "string") return r;
      if (typeof r === "number") return String(r);
    }
  }
  return String(v);
}

/**
 * Day first numeric dates (15/01/2026, 15-01-2026, 15.01.2026), as the upload
 * screen describes. `new Date()` reads slashes month first, so it rejected
 * 15/01/2026 and turned 05/10/2026 into 10 May.
 */
const DAY_FIRST_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/** UTC midnight, like an ISO date; null for an impossible date such as 31/02. */
function dayFirstDate(day: number, month: number, year: number): Date | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d
    : null;
}

function parseIssueDate(raw: string | null, rowNumber: number): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const dayFirst = DAY_FIRST_DATE_RE.exec(trimmed);
  const d = dayFirst
    ? dayFirstDate(Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3]))
    : new Date(trimmed);
  if (!d || Number.isNaN(d.getTime())) {
    throw new BadRequestError(
      `Row ${rowNumber}: invalid issue date "${raw}". Use a date like 2026-06-09 or 09/06/2026.`,
    );
  }
  return d;
}

function assertHeaderShape(headers: string[]): void {
  const seen = new Set<string>();
  for (const raw of headers) {
    const h = normalizeHeader(raw);
    if (!ACCEPTED_HEADERS.has(h)) {
      throw new BadRequestError(
        `Unexpected column "${raw}". Allowed columns: name, issue_date, email (case-insensitive).`,
      );
    }
    if (seen.has(h)) {
      throw new BadRequestError(`Duplicate column "${h}" in file header.`);
    }
    seen.add(h);
  }
  if (!seen.has("name")) {
    throw new BadRequestError("File must contain a `name` column.");
  }
}

function rowsToParsed(
  rows: Array<Record<string, unknown>>,
  startingRowNumber: number,
): RawCertRow[] {
  const out: RawCertRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const rowNumber = startingRowNumber + i;

    // Skip comment rows used in the downloadable sample.
    const firstKey = Object.keys(r)[0];
    const firstValue = firstKey ? valueOrNull(r[firstKey]) : null;
    if (firstValue && firstValue.startsWith("#")) continue;

    const name = valueOrNull(r["name"] ?? r["Name"] ?? r["NAME"]);
    const issueRaw = valueOrNull(
      r["issue_date"] ?? r["Issue_Date"] ?? r["ISSUE_DATE"],
    );
    const emailRaw = valueOrNull(r["email"] ?? r["Email"] ?? r["EMAIL"]);

    // Skip rows that are entirely blank.
    if (name === null && issueRaw === null && emailRaw === null) continue;

    if (name === null) {
      throw new BadRequestError(`Row ${rowNumber}: name is required.`);
    }

    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email !== null && !EMAIL_RE.test(email)) {
      throw new BadRequestError(`Row ${rowNumber}: invalid email "${emailRaw}".`);
    }

    out.push({
      rowNumber,
      name,
      email,
      issueDate: parseIssueDate(issueRaw, rowNumber),
    });
  }
  return out;
}

export async function parseCsv(buffer: Buffer): Promise<RawCertRow[]> {
  if (buffer.byteLength > BULK_CERT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${BULK_CERT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`,
    );
  }
  const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new BadRequestError(
      `CSV parse error on row ${first?.row ?? "?"}: ${first?.message ?? "unknown"}`,
    );
  }
  const headers = (parsed.meta.fields ?? []).map(normalizeHeader);
  assertHeaderShape(headers);
  const rows = rowsToParsed(parsed.data, 2); // row 1 is the header
  if (rows.length > BULK_CERT_MAX_ROWS) {
    throw new BadRequestError(
      `File has ${rows.length} rows. Maximum is ${BULK_CERT_MAX_ROWS}; split the file and retry.`,
    );
  }
  return rows;
}

export async function parseXlsx(buffer: Buffer): Promise<RawCertRow[]> {
  if (buffer.byteLength > BULK_CERT_MAX_FILE_BYTES) {
    throw new BadRequestError(
      `File exceeds the ${BULK_CERT_MAX_FILE_BYTES / (1024 * 1024)} MB limit.`,
    );
  }
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
  await workbook.xlsx.load(arrayBuffer);
  if (workbook.worksheets.length > 1) {
    logger.warn(
      `[bulk-certificate-parser] XLSX has ${workbook.worksheets.length} sheets; only the first will be read.`,
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestError("XLSX file contains no sheets.");
  }

  // Map column number → header so data reads stay aligned even when the
  // header row contains blank cells (e.g. an empty column A). Reading headers
  // with includeEmpty:false while reading data positionally would shift every
  // data cell by one column.
  const headerByColumn = new Map<number, string>();
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = String(cell.value ?? "").trim();
    if (raw.length === 0) return; // ignore columns with a blank header
    headerByColumn.set(colNumber, raw);
  });
  assertHeaderShape([...headerByColumn.values()]);

  const rows: Array<Record<string, unknown>> = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowIdx) => {
    if (rowIdx === 1) return; // header
    const obj: Record<string, unknown> = {};
    for (const [colNumber, rawHeader] of headerByColumn) {
      obj[normalizeHeader(rawHeader)] = extractCellText(row.getCell(colNumber));
    }
    rows.push(obj);
  });

  const parsed = rowsToParsed(rows, 2);
  if (parsed.length > BULK_CERT_MAX_ROWS) {
    throw new BadRequestError(
      `File has ${parsed.length} rows. Maximum is ${BULK_CERT_MAX_ROWS}; split the file and retry.`,
    );
  }
  return parsed;
}

export async function parseFile(input: {
  buffer: Buffer;
  filename: string;
  mimetype?: string;
}): Promise<RawCertRow[]> {
  const lower = input.filename.toLowerCase();
  const isCsv = lower.endsWith(".csv") || input.mimetype === "text/csv";
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

/** Generate the downloadable CSV sample. */
export function generateCsvSample(): Buffer {
  const lines = [
    "name,issue_date,email",
    "Alice Sharma,2026-06-09,alice@example.com",
    "Rahul Verma,2026-06-09,rahul@example.com",
    "Priya Nair,,",
    "# issue_date and email are optional. Add email to send the certificate and link it to the learner's account.",
  ];
  return Buffer.from(lines.join("\n") + "\n", "utf-8");
}

/** Generate the downloadable XLSX sample with header styling and a comment row. */
export async function generateXlsxSample(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Recipients");
  sheet.columns = [
    { header: "name", key: "name", width: 30 },
    { header: "issue_date", key: "issue_date", width: 18 },
    { header: "email", key: "email", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  sheet.addRow({ name: "Alice Sharma", issue_date: "2026-06-09", email: "alice@example.com" });
  sheet.addRow({ name: "Rahul Verma", issue_date: "2026-06-09", email: "rahul@example.com" });
  sheet.addRow({ name: "Priya Nair", issue_date: "", email: "" });
  const comment = sheet.addRow({
    name: "# issue_date and email are optional. Add email to send the certificate and link it to the learner's account.",
    issue_date: "",
    email: "",
  });
  comment.font = { italic: true, color: { argb: "FF888888" } };

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

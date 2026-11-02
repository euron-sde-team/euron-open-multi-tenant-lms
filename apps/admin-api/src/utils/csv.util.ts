import { Response } from "express";

/**
 * Minimal CSV escaping. Wraps cells containing commas, quotes, or newlines
 * in double-quotes and doubles any embedded quotes.
 */
function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, "\"\"")}"`;
  }
  return s;
}

/**
 * Stream rows out as CSV without buffering the entire dataset in memory.
 * `rowIterator` is expected to be an async generator that yields rows of
 * matching columns. Sets Content-Disposition so the browser downloads.
 */
export async function sendCsv(
  res: Response,
  options: {
    filename: string;
    columns: string[];
  },
  rowIterator: AsyncIterable<Record<string, unknown>>
): Promise<void> {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${options.filename}"`
  );
  res.write(options.columns.map(escape).join(",") + "\n");
  for await (const row of rowIterator) {
    const line = options.columns.map((c) => escape(row[c])).join(",");
    res.write(line + "\n");
  }
  res.end();
}

/**
 * Convenience wrapper for the common "I already have an array" case. Use
 * `sendCsv` directly when you want true streaming from the DB cursor.
 */
export async function sendCsvFromArray(
  res: Response,
  options: { filename: string; columns: string[] },
  rows: Record<string, unknown>[]
): Promise<void> {
  async function* iter() {
    for (const r of rows) yield r;
  }
  await sendCsv(res, options, iter());
}

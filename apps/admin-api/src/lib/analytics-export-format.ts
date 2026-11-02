/**
 * Building the analytics export files.
 *
 * Kept OUT of the worker module on purpose. Importing the worker constructs a
 * BullMQ Worker as a side effect of loading the file, so nothing could import
 * it to check the output without starting a queue consumer, which is exactly
 * what happened when I first tried to verify the workbook. Pure functions here,
 * side effects there.
 */
import ExcelJS from "exceljs";

export const REPORT_COLUMNS: Record<string, Array<{ key: string; label: string }>> = {
  users: [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status" },
    { key: "joined_at", label: "Joined" },
    { key: "enrollments_count", label: "Enrollments" },
    { key: "book_access_count", label: "Books" },
    { key: "total_spent_inr", label: "Spent INR" },
    { key: "total_spent_usd", label: "Spent USD" },
    { key: "total_spent_combined_inr", label: "Spent Combined (INR)" },
    { key: "certificates_count", label: "Certificates" },
  ],
  courses: [
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "mode", label: "Mode" },
    { key: "enrollment_count", label: "Enrollments" },
    { key: "completed_count", label: "Completed" },
    { key: "avg_rating", label: "Avg Rating" },
    { key: "revenue_inr", label: "Revenue INR" },
    { key: "revenue_usd", label: "Revenue USD" },
    { key: "revenue_combined_inr", label: "Revenue Combined (INR)" },
  ],
  books: [
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "access_count", label: "Access Count" },
    { key: "revenue_inr", label: "Revenue INR" },
    { key: "revenue_usd", label: "Revenue USD" },
    { key: "revenue_combined_inr", label: "Revenue Combined (INR)" },
  ],
  payments: [
    { key: "order_number", label: "Order #" },
    { key: "member_name", label: "Member" },
    { key: "member_email", label: "Email" },
    { key: "total_amount", label: "Amount" },
    { key: "currency", label: "Currency" },
    { key: "status", label: "Status" },
    { key: "order_type", label: "Type" },
    { key: "created_at", label: "Date" },
  ],
  certificates: [
    { key: "member_name", label: "Member" },
    { key: "course_title", label: "Course" },
    { key: "status", label: "Status" },
    { key: "issued_at", label: "Issued" },
  ],
  // One row per learner PER COURSE. The keys below must exist on the rows
  // getEnrolmentRosterForExport returns, the previous set asked for
  // member_name / course_title / enrolled_at against rows that carry
  // name / email / phone, so every cell came out blank.
  enrollments: [
    { key: "course_title", label: "Course" },
    { key: "course_mode", label: "Course Type" },
    { key: "member_name", label: "Name" },
    { key: "member_email", label: "Email" },
    { key: "member_phone", label: "Phone" },
    { key: "enrollment_status", label: "Enrolment Status" },
    { key: "enrollment_source", label: "Source" },
    { key: "enrolled_at", label: "Enrolled On" },
    { key: "valid_till", label: "Access Valid Till" },
    { key: "completed_at", label: "Completed On" },
    { key: "member_status", label: "Learner Status" },
    { key: "joined_at", label: "Joined" },
  ],
};


export function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

export function generateCSV(
  rows: Record<string, unknown>[],
  columns: Array<{ key: string; label: string }>,
): string {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCSV(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}


/**
 * Make the roster readable in a spreadsheet.
 *
 * Two things a raw row gets wrong for a human reader:
 *
 *  - A NULL `valid_till` means access never expires. Left blank it reads as
 *    missing data, and an admin checking who is about to lose access cannot
 *    tell "no expiry" from "we failed to record one". It says Lifetime.
 *  - Timestamps arrive as full ISO strings with a time and a zone. The admin
 *    is reading dates, so they are trimmed to YYYY-MM-DD; a blank stays blank
 *    because "not completed yet" is genuinely empty.
 */
export const ROSTER_DATE_KEYS = ["enrolled_at", "valid_till", "completed_at", "joined_at"];

export function formatRosterRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const key of ROSTER_DATE_KEYS) {
      const value = out[key];
      if (value === null || value === undefined || value === "") {
        out[key] = key === "valid_till" ? "Lifetime" : "";
        continue;
      }
      const date = value instanceof Date ? value : new Date(String(value));
      out[key] = Number.isNaN(date.getTime())
        ? String(value)
        : date.toISOString().slice(0, 10);
    }
    return out;
  });
}

/**
 * The roster workbook: one file that answers all three questions an admin asks
 * at once, instead of making them export three times and join by hand.
 *
 *   Sheet 1  Course Summary   how many learners each course has, and how many
 *                             of those are active, expired or completed
 *   Sheet 2  Course Learners  every learner on every course, with their name,
 *                             email, phone and access validity
 *   Sheet 3  All Learners     the member roster, for anyone not on a course
 *
 * The summary is computed from the rows already fetched rather than by a
 * second trip to the database, so the sheets cannot disagree with each other.
 */
export async function buildRosterWorkbook(
  rosterRows: Record<string, unknown>[],
  userRows: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const addSheet = (
    name: string,
    columns: Array<{ key: string; label: string }>,
    rows: Record<string, unknown>[],
  ) => {
    const ws = wb.addWorksheet(name);
    ws.columns = columns.map((c) => ({
      header: c.label,
      key: c.key,
      // Wide enough to read without the admin resizing every column by hand.
      width: Math.min(Math.max(c.label.length + 4, 14), 42),
    }));
    for (const row of rows) ws.addRow(row);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    if (rows.length > 0) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };
    }
    return ws;
  };

  // Sheet 1, the headcount question, derived from the roster itself.
  const today = new Date().toISOString().slice(0, 10);
  const summary = new Map<
    string,
    { course_title: string; course_mode: string; learners: number; active: number; expired: number; cancelled: number; completed: number }
  >();
  for (const r of rosterRows) {
    const title = String(r.course_title ?? "");
    const entry =
      summary.get(title) ??
      {
        course_title: title,
        course_mode: String(r.course_mode ?? ""),
        learners: 0,
        active: 0,
        expired: 0,
        cancelled: 0,
        completed: 0,
      };
    entry.learners += 1;
    const validTill = String(r.valid_till ?? "");
    const status = String(r.enrollment_status ?? "");
    // Active, expired and cancelled are counted so the three ADD UP to the
    // total. Without the cancelled column a course whose only enrolment was
    // cancelled showed "1 learner, 0 active, 0 expired" and the admin has no
    // way to tell that from a counting bug.
    //
    // "Lifetime" never expires; anything else is a date already trimmed to
    // YYYY-MM-DD by formatRosterRows, so a string compare is a date compare.
    if (status === "CANCELLED") entry.cancelled += 1;
    else if (validTill && validTill !== "Lifetime" && validTill < today) entry.expired += 1;
    else if (status === "ACTIVE") entry.active += 1;
    if (String(r.completed_at ?? "").trim() !== "") entry.completed += 1;
    summary.set(title, entry);
  }
  addSheet(
    "Course Summary",
    [
      { key: "course_title", label: "Course" },
      { key: "course_mode", label: "Course Type" },
      { key: "learners", label: "Total Learners" },
      { key: "active", label: "Active" },
      { key: "expired", label: "Access Expired" },
      { key: "cancelled", label: "Cancelled" },
      { key: "completed", label: "Completed" },
    ],
    [...summary.values()].sort((a, b) => b.learners - a.learners) as unknown as Record<string, unknown>[],
  );

  addSheet("Course Learners", REPORT_COLUMNS.enrollments ?? [], rosterRows);
  // The member sheet's timestamps arrive as full ISO strings. Left alone they
  // render as 2026-08-27T17:31:10.526Z in the cell, which is not a date anyone
  // reads or sorts on, so they get the same trim the roster sheet gets.
  addSheet("All Learners", REPORT_COLUMNS.users ?? [], formatRosterRows(userRows));

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

/** Any other report as a single formatted sheet, so xlsx is never refused. */
export async function buildSingleSheetWorkbook(
  report: string,
  columns: Array<{ key: string; label: string }>,
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet(report.charAt(0).toUpperCase() + report.slice(1));
  ws.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.min(Math.max(c.label.length + 4, 14), 42),
  }));
  for (const row of rows) ws.addRow(row);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  if (rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}


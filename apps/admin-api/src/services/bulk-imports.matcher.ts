import type { member_status } from "../db/enums";
import type {
  MatchedMemberSnapshot,
  MemberAction,
  MemberLookup,
  NormalizedRow,
  PhaseOneOutcome,
  RawParsedRow,
  RowValidity,
} from "../types/bulk-imports.type";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

/**
 * Sentinel values operators commonly write to mean "no value". Treat them as
 * null instead of trying to validate them as real emails/phones.
 */
const NA_SENTINELS = new Set([
  "",
  "na",
  "n/a",
  "n.a",
  "n.a.",
  "none",
  "null",
  "nil",
  "-",
  "--",
  "-",
  "–",
  "0",
  "00",
]);

function isNaSentinel(s: string): boolean {
  return NA_SENTINELS.has(s.trim().toLowerCase());
}

export function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();
  if (trimmed.length === 0 || isNaSentinel(trimmed)) return null;
  // Strip a "mailto:" prefix (Excel hyperlink cells store the URL form).
  // Drop any query suffix like "?subject=..." that mailto links can carry.
  if (/^mailto:/i.test(trimmed)) {
    trimmed = trimmed.slice("mailto:".length);
    const queryIdx = trimmed.indexOf("?");
    if (queryIdx !== -1) trimmed = trimmed.slice(0, queryIdx);
    trimmed = trimmed.trim();
    if (trimmed.length === 0 || isNaSentinel(trimmed)) return null;
  }
  return trimmed.toLowerCase();
}

/**
 * Smart phone normalization. Returns null for blank/sentinel inputs and
 * otherwise returns the best E.164-shaped guess for the matcher to validate.
 *
 * Cleaning steps:
 *   - Drop surrounding whitespace.
 *   - Drop common formatting characters: spaces, tabs, dashes, parens, dots,
 *     slashes, non-breaking spaces.
 *   - Treat NA / N/A / "-" / None / null / nil / 0 as null.
 *   - If the cleaned value starts with "00", replace with "+" (international
 *     dialing prefix).
 *   - If the cleaned value is digits-only with 11-15 digits, prepend "+"
 *     (Excel commonly strips the leading "+" when storing as a number).
 *   - Leave already-"+"-prefixed values untouched.
 *
 * 10-digit numbers without a country code are intentionally NOT auto-prefixed
 * with "+91" because that assumption breaks multi-country tenants. The matcher
 * will reject them with a clear error so the operator fixes the source file.
 */
export function normalizePhone(raw: string | null): string | null {
  if (raw === null || raw === undefined) return null;
  // Strip every whitespace + common formatting char before evaluating.
  const stripped = String(raw)
    .replace(/[\s\u00a0\t]+/g, "")
    .replace(/[()./\\-]/g, "");
  if (stripped.length === 0) return null;
  if (isNaSentinel(stripped)) return null;

  let candidate = stripped;
  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  }
  if (!candidate.startsWith("+") && /^\d{11,15}$/.test(candidate)) {
    candidate = `+${candidate}`;
  }
  return candidate;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isValidPhone(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function deriveFallbackName(
  email: string | null,
  phone: string | null,
): string {
  if (email) {
    const local = email.split("@")[0];
    if (local && local.length > 0) return local;
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const tail = digits.slice(-4);
    if (tail.length > 0) return `User-${tail}`;
  }
  return "User";
}

/**
 * Heuristic: detect a row whose values are literally the column labels
 * ("name", "email", "phone"). This catches duplicate-header rows pasted
 * into the data section by accident, or repeating-header artifacts from
 * some export tools.
 *
 * We require AT LEAST TWO of the three fields to match their own label
 * before flagging, so we don't accidentally drop a row where a person
 * happens to be named "name" but the email and phone are real.
 */
export function looksLikeHeaderRow(
  name: string | null,
  email: string | null,
  phone: string | null,
): boolean {
  const matches = (v: string | null, label: string): boolean =>
    v !== null && v.trim().toLowerCase() === label;
  let hits = 0;
  if (matches(name, "name")) hits++;
  if (matches(email, "email")) hits++;
  if (matches(phone, "phone")) hits++;
  return hits >= 2;
}

/**
 * Normalize and validate a parsed row. Either returns the normalized row
 * (ready for matching) or an outcome describing why the row is rejected.
 *
 * Rejected rows are reported with action ERROR_*, SKIPPED_DUPLICATE_IN_FILE
 * (set by the deduplication pass, not here), or SKIPPED_LOOKS_LIKE_HEADER_ROW
 * (for a row that's clearly a stray header).
 */
export function normalizeRow(
  raw: RawParsedRow,
): { ok: true; row: NormalizedRow } | { ok: false; outcome: PhaseOneOutcome } {
  const name = raw.name?.trim() ?? null;
  const email = normalizeEmail(raw.email);
  const phone = normalizePhone(raw.phone);

  // Defensive: if the row's values are literally the column labels, this is
  // a stray duplicate header. Report it explicitly instead of letting it slip
  // through as ERROR_INVALID_EMAIL / _PHONE.
  if (looksLikeHeaderRow(raw.name, raw.email, raw.phone)) {
    return {
      ok: false,
      outcome: skippedOutcome(
        raw.rowNumber,
        "SKIPPED_LOOKS_LIKE_HEADER_ROW",
        `Row ${raw.rowNumber} looks like a duplicate header (values match column labels). Skipped.`,
      ),
    };
  }

  if (!email && !phone) {
    return {
      ok: false,
      outcome: errorOutcome(
        raw.rowNumber,
        "ERROR_MISSING_CONTACT",
        "Row must include either an email or a phone number.",
      ),
    };
  }
  if (email && !isValidEmail(email)) {
    return {
      ok: false,
      outcome: errorOutcome(
        raw.rowNumber,
        "ERROR_INVALID_EMAIL",
        `Invalid email format: "${email}".`,
      ),
    };
  }
  if (phone && !isValidPhone(phone)) {
    const reason = describePhoneRejection(phone, raw.phone);
    return {
      ok: false,
      outcome: errorOutcome(raw.rowNumber, "ERROR_INVALID_PHONE", reason),
    };
  }

  // Optional per-row expiry. Blank → null (falls back to the batch default);
  // "lifetime"/"never" → explicit lifetime; a date → that expiry.
  let validTill: RowValidity = null;
  if (raw.validTill && raw.validTill.trim().length > 0) {
    const parsed = parseValidTill(raw.validTill);
    if (parsed === "INVALID") {
      return {
        ok: false,
        outcome: errorOutcome(
          raw.rowNumber,
          "ERROR_INVALID_VALIDITY",
          `Invalid valid_till "${raw.validTill}". Use a date like YYYY-MM-DD (e.g. 2027-08-11), or "lifetime".`,
        ),
      };
    }
    validTill = parsed;
  }

  return {
    ok: true,
    row: {
      rowNumber: raw.rowNumber,
      name: name && name.length > 0 ? name : null,
      email,
      phone,
      validTill,
    },
  };
}

/**
 * Parse a per-row valid_till cell into an expiry:
 * - "lifetime"/"never"/"none"/"forever" → "LIFETIME" (stored as null valid_till)
 * - a bare YYYY-MM-DD → END of that day (UTC) so access lasts through the date
 * - any other parseable date string → that Date
 * - otherwise → "INVALID"
 */
const LIFETIME_KEYWORDS = new Set(["lifetime", "never", "none", "forever", "no expiry"]);
function parseValidTill(raw: string): Date | "LIFETIME" | "INVALID" {
  const s = raw.trim();
  if (LIFETIME_KEYWORDS.has(s.toLowerCase())) return "LIFETIME";
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    const d = new Date(
      Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 23, 59, 59, 999),
    );
    return isNaN(d.getTime()) ? "INVALID" : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "INVALID" : d;
}

/**
 * Mark in-file duplicates. The first occurrence of a given email or phone
 * wins; subsequent rows referring to the same contact are marked as
 * SKIPPED_DUPLICATE_IN_FILE so the executor will not process them.
 */
export function detectInFileDuplicates(
  rows: NormalizedRow[],
): Map<number, PhaseOneOutcome> {
  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const dupes = new Map<number, PhaseOneOutcome>();

  for (const row of rows) {
    let collision: string | null = null;
    if (row.email && seenEmail.has(row.email)) collision = row.email;
    else if (row.phone && seenPhone.has(row.phone)) collision = row.phone;

    if (collision) {
      dupes.set(row.rowNumber, {
        rowNumber: row.rowNumber,
        action: "SKIPPED_DUPLICATE_IN_FILE",
        memberIds: [],
        memberStatusAtGrant: [],
        errorMessage: `Duplicate of an earlier row (${collision}).`,
        intent: { kind: "NO_OP" },
      });
      continue;
    }
    if (row.email) seenEmail.add(row.email);
    if (row.phone) seenPhone.add(row.phone);
  }
  return dupes;
}

/**
 * Run the Phase 1 matcher (Cases A through G from Section 3 of the plan).
 *
 * This function never writes to the DB. It produces an outcome plus an intent
 * for each row; the executor (bulk-imports.service) is responsible for
 * applying the intent inside a per-row transaction.
 */
export async function runMatcher(
  rawRows: RawParsedRow[],
  lookup: MemberLookup,
): Promise<PhaseOneOutcome[]> {
  const outcomes: PhaseOneOutcome[] = [];
  const normalized: NormalizedRow[] = [];

  for (const raw of rawRows) {
    const result = normalizeRow(raw);
    if (!result.ok) {
      outcomes.push(result.outcome);
      continue;
    }
    normalized.push(result.row);
  }

  const dupes = detectInFileDuplicates(normalized);

  for (const row of normalized) {
    const dupe = dupes.get(row.rowNumber);
    if (dupe) {
      outcomes.push(dupe);
      continue;
    }

    const emailMember = row.email ? await lookup.byEmail(row.email) : null;
    const phoneMember = row.phone ? await lookup.byPhone(row.phone) : null;

    outcomes.push(decideOutcome(row, emailMember, phoneMember));
  }

  // Preserve original row order in the report.
  outcomes.sort((a, b) => a.rowNumber - b.rowNumber);
  return outcomes;
}

/**
 * Pure decision function for a single row. Exposed for unit testing
 * (every Case A-G can be exercised by passing constructed snapshots).
 */
export function decideOutcome(
  row: NormalizedRow,
  emailMember: MatchedMemberSnapshot | null,
  phoneMember: MatchedMemberSnapshot | null,
): PhaseOneOutcome {
  const base = (
    action: MemberAction,
    memberIds: string[],
    memberStatuses: member_status[],
    intent: PhaseOneOutcome["intent"],
    errorMessage?: string,
  ): PhaseOneOutcome => ({
    rowNumber: row.rowNumber,
    action,
    memberIds,
    memberStatusAtGrant: memberStatuses,
    intent,
    errorMessage,
    validTill: row.validTill,
  });

  // Case A: nothing exists -> CREATE.
  if (!emailMember && !phoneMember) {
    const name = row.name ?? deriveFallbackName(row.email, row.phone);
    return base("CREATED", [], [], {
      kind: "CREATE",
      name,
      email: row.email,
      phone: row.phone,
    });
  }

  // Case F: both columns resolve to the same existing member.
  if (
    emailMember &&
    phoneMember &&
    emailMember.id === phoneMember.id
  ) {
    return base(
      "SKIPPED_ALREADY_EXISTS",
      [emailMember.id],
      [emailMember.status],
      { kind: "NO_OP" },
    );
  }

  // Case G: cross-account collision (two distinct members).
  // For tenant scope this is reported as ambiguous; for course/book scope
  // the executor will still run Phase 2 against both ids.
  if (emailMember && phoneMember && emailMember.id !== phoneMember.id) {
    return base(
      "SKIPPED_AMBIGUOUS_MATCH",
      [emailMember.id, phoneMember.id],
      [emailMember.status, phoneMember.status],
      { kind: "NO_OP" },
      "Email and phone resolve to different existing members. Tenant-wide import does not merge; course/book scopes grant access to both.",
    );
  }

  // Case B / D: email matches, phone does not.
  if (emailMember && !phoneMember) {
    if (!row.phone) {
      // Case B: CSV row has no phone to add.
      return base(
        "SKIPPED_ALREADY_EXISTS",
        [emailMember.id],
        [emailMember.status],
        { kind: "NO_OP" },
      );
    }
    // Case D: CSV phone is unused in this tenant; merge into the email member.
    return base("MERGED_ADDED_PHONE", [emailMember.id], [emailMember.status], {
      kind: "MERGE_PHONE",
      memberId: emailMember.id,
      phone: row.phone,
    });
  }

  // Case C / E: phone matches, email does not.
  if (phoneMember && !emailMember) {
    if (!row.email) {
      // Case C: CSV row has no email to add.
      return base(
        "SKIPPED_ALREADY_EXISTS",
        [phoneMember.id],
        [phoneMember.status],
        { kind: "NO_OP" },
      );
    }
    // Case E: CSV email is unused in this tenant; merge into the phone member.
    return base("MERGED_ADDED_EMAIL", [phoneMember.id], [phoneMember.status], {
      kind: "MERGE_EMAIL",
      memberId: phoneMember.id,
      email: row.email,
    });
  }

  // Unreachable, but TypeScript needs the branch.
  return base(
    "SKIPPED_ALREADY_EXISTS",
    [],
    [],
    { kind: "NO_OP" },
    "Unreachable matcher branch reached. This is a bug.",
  );
}

function describePhoneRejection(normalized: string, raw: string | null): string {
  const digitsOnly = normalized.replace(/\D/g, "");
  if (digitsOnly.length === 10) {
    return `Phone "${raw ?? normalized}" looks like a 10-digit local number. Include the country code (e.g. +91${digitsOnly} for India, +1${digitsOnly} for US).`;
  }
  if (digitsOnly.length < 7) {
    return `Phone "${raw ?? normalized}" is too short. Expected an E.164 number with country code, e.g. +14155550101.`;
  }
  if (digitsOnly.length > 15) {
    return `Phone "${raw ?? normalized}" is too long for E.164 (max 15 digits including country code).`;
  }
  if (/[^\d+]/.test(normalized)) {
    return `Phone "${raw ?? normalized}" contains unexpected characters. Use digits and a leading "+" only, e.g. +14155550101.`;
  }
  return `Phone "${raw ?? normalized}" is not a valid E.164 number. Example: +14155550101.`;
}

function errorOutcome(
  rowNumber: number,
  action: Extract<
    MemberAction,
    | "ERROR_MISSING_CONTACT"
    | "ERROR_INVALID_EMAIL"
    | "ERROR_INVALID_PHONE"
    | "ERROR_INVALID_VALIDITY"
    | "ERROR_CHUNK_FAILED"
  >,
  message: string,
): PhaseOneOutcome {
  return {
    rowNumber,
    action,
    memberIds: [],
    memberStatusAtGrant: [],
    errorMessage: message,
    intent: { kind: "NO_OP" },
  };
}

function skippedOutcome(
  rowNumber: number,
  action: Extract<MemberAction, "SKIPPED_LOOKS_LIKE_HEADER_ROW">,
  message: string,
): PhaseOneOutcome {
  return {
    rowNumber,
    action,
    memberIds: [],
    memberStatusAtGrant: [],
    errorMessage: message,
    intent: { kind: "NO_OP" },
  };
}

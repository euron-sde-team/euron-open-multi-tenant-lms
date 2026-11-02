 
/**
 * Lightweight test runner for the bulk-imports matcher. Zero-dependency: uses
 * Node's built-in `assert` and a tiny it()/describe() shim so we don't add
 * Jest just for one file. Run with: pnpm test:matcher
 *
 * The matcher is pure (no DB), so this file exercises every case from
 * Section 6 of tasks/bulk-user-onboarding-plan.md against constructed
 * MemberLookup stubs.
 */
import assert from "node:assert/strict";

import {
  decideOutcome,
  deriveFallbackName,
  detectInFileDuplicates,
  isValidEmail,
  isValidPhone,
  looksLikeHeaderRow,
  normalizeEmail,
  normalizePhone,
  normalizeRow,
  runMatcher,
} from "../src/services/bulk-imports.matcher";
import type {
  MatchedMemberSnapshot,
  MemberLookup,
  NormalizedRow,
  RawParsedRow,
} from "../src/types/bulk-imports.type";

let testsPassed = 0;
let testsFailed = 0;
const failures: string[] = [];

function it(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      testsPassed++;
      console.log(`  ok  ${name}`);
    } catch (e) {
      testsFailed++;
      failures.push(`${name}: ${(e as Error).message}`);
      console.log(`  FAIL ${name}`);
      console.log(`       ${(e as Error).message}`);
    }
  })();
}

function describe(name: string, fn: () => void): void {
  console.log(`\n${name}`);
  fn();
}

function memberSnap(
  id: string,
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" = "ACTIVE",
  hadEmail = true,
  hadPhone = true,
): MatchedMemberSnapshot {
  return { id, status, hadEmail, hadPhone };
}

function row(
  rowNumber: number,
  email: string | null,
  phone: string | null,
  name: string | null = null,
): NormalizedRow {
  return { rowNumber, email, phone, name };
}

function makeLookup(
  byEmail: Record<string, MatchedMemberSnapshot>,
  byPhone: Record<string, MatchedMemberSnapshot>,
): MemberLookup {
  return {
    async byEmail(e: string) {
      return byEmail[e] ?? null;
    },
    async byPhone(p: string) {
      return byPhone[p] ?? null;
    },
  };
}

async function main(): Promise<void> {
  describe("normalization helpers", () => {
    void it("normalizeEmail lowercases and trims", () => {
      assert.equal(normalizeEmail("  Alice@Example.COM "), "alice@example.com");
      assert.equal(normalizeEmail(""), null);
      assert.equal(normalizeEmail(null), null);
    });
    void it("normalizePhone strips whitespace, dashes, parens, dots", () => {
      assert.equal(normalizePhone(" +91 9876 543210 "), "+919876543210");
      assert.equal(normalizePhone("+91-9876-543210"), "+919876543210");
      assert.equal(normalizePhone("+1 (415) 555-0101"), "+14155550101");
      assert.equal(normalizePhone("+1.415.555.0101"), "+14155550101");
      assert.equal(normalizePhone(""), null);
    });
    void it("normalizePhone auto-prepends + for 11-15 digit numbers", () => {
      assert.equal(normalizePhone("919986999903"), "+919986999903");
      assert.equal(normalizePhone("919876543210"), "+919876543210");
      assert.equal(normalizePhone("14155550101"), "+14155550101");
    });
    void it("normalizePhone translates 00 international prefix to +", () => {
      assert.equal(normalizePhone("00919986999903"), "+919986999903");
    });
    void it("normalizePhone returns null for NA / N/A / - / None / null sentinels", () => {
      for (const s of ["NA", "N/A", "n/a", "-", "-", "None", "null", "nil", " "]) {
        assert.equal(normalizePhone(s), null, `expected null for "${s}"`);
      }
    });
    void it("normalizePhone does NOT guess country code for bare 10-digit numbers", () => {
      // Stays 10 digits, no auto-prefix; isValidPhone will reject so the
      // operator gets a clear error pointing at the missing country code.
      assert.equal(normalizePhone("9986999903"), "9986999903");
    });
    void it("normalizePhone tolerates exceljs numeric cells", () => {
      // ExcelJS returns numbers when the cell is stored as numeric; the
      // parser stringifies them before passing through here.
      assert.equal(normalizePhone(String(919986999903)), "+919986999903");
    });
    void it("normalizeEmail handles NA sentinels too", () => {
      for (const s of ["NA", "N/A", "-", "None", "null"]) {
        assert.equal(normalizeEmail(s), null, `expected null for "${s}"`);
      }
    });
    void it("isValidEmail accepts standard and rejects malformed", () => {
      assert.equal(isValidEmail("a@example.org"), true);
      assert.equal(isValidEmail("a@b"), false);
      assert.equal(isValidEmail("no-at.example.com"), false);
    });
    void it("isValidPhone enforces E.164 (leading +, 7-15 digits)", () => {
      assert.equal(isValidPhone("+14155550101"), true);
      assert.equal(isValidPhone("+919876543210"), true);
      assert.equal(isValidPhone("9876543210"), false);
      assert.equal(isValidPhone("+0123456789"), false);
    });
    void it("deriveFallbackName uses email local-part, then phone tail", () => {
      assert.equal(deriveFallbackName("alice@example.com", null), "alice");
      assert.equal(deriveFallbackName(null, "+919876543210"), "User-3210");
      assert.equal(deriveFallbackName(null, null), "User");
    });
  });

  describe("parser: looksLikeHeaderRow defensive detection", () => {
    void it("flags a row where all three values match their column label", () => {
      assert.equal(
        looksLikeHeaderRow("name", "email", "phone"),
        true,
      );
    });
    void it("flags case-insensitive matches and trims whitespace", () => {
      assert.equal(
        looksLikeHeaderRow(" Name ", "Email", "PHONE"),
        true,
      );
    });
    void it("flags 2-of-3 matches as header (operator partial duplicate)", () => {
      assert.equal(looksLikeHeaderRow("name", "email", null), true);
      assert.equal(looksLikeHeaderRow("name", null, "phone"), true);
    });
    void it("does NOT flag a row with only one suspicious field", () => {
      // Someone literally named "name" but with a real email and no phone:
      // 1-of-3 hit only, keep the row so the operator's data isn't silently dropped.
      assert.equal(
        looksLikeHeaderRow("name", "alice@example.com", null),
        false,
      );
    });
    void it("does NOT flag normal data rows", () => {
      assert.equal(
        looksLikeHeaderRow("Alice", "alice@example.com", "+919999999999"),
        false,
      );
      assert.equal(looksLikeHeaderRow(null, null, null), false);
    });
  });

  describe("normalizeRow validation", () => {
    void it("row 10: missing both email and phone -> ERROR_MISSING_CONTACT", () => {
      const result = normalizeRow({ rowNumber: 10, name: "Bob", email: null, phone: null });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.outcome.action, "ERROR_MISSING_CONTACT");
    });
    void it("row 11: invalid email format -> ERROR_INVALID_EMAIL", () => {
      const result = normalizeRow({ rowNumber: 11, name: null, email: "not-an-email", phone: null });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.outcome.action, "ERROR_INVALID_EMAIL");
    });
    void it("row 12: phone without leading + -> ERROR_INVALID_PHONE", () => {
      const result = normalizeRow({ rowNumber: 12, name: null, email: null, phone: "9876543210" });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.outcome.action, "ERROR_INVALID_PHONE");
    });
    void it("valid email-only row passes normalization", () => {
      const result = normalizeRow({ rowNumber: 1, name: "Alice", email: "Alice@Example.com", phone: null });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.row.email, "alice@example.com");
        assert.equal(result.row.phone, null);
      }
    });
    void it("header-like row emits SKIPPED_LOOKS_LIKE_HEADER_ROW via normalizeRow", () => {
      const result = normalizeRow({ rowNumber: 14, name: "name", email: "email", phone: "phone" });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.outcome.action, "SKIPPED_LOOKS_LIKE_HEADER_ROW");
      }
    });
  });

  describe("intra-file duplicate detection (row 13)", () => {
    void it("second row sharing an email is marked SKIPPED_DUPLICATE_IN_FILE", () => {
      const rows: NormalizedRow[] = [
        row(2, "alice@example.com", null),
        row(3, "bob@example.com", "+14155550100"),
        row(4, "alice@example.com", "+14155550101"),
      ];
      const dupes = detectInFileDuplicates(rows);
      assert.equal(dupes.size, 1);
      assert.equal(dupes.get(4)?.action, "SKIPPED_DUPLICATE_IN_FILE");
    });
    void it("second row sharing a phone is marked SKIPPED_DUPLICATE_IN_FILE", () => {
      const rows: NormalizedRow[] = [
        row(2, "alice@example.com", "+14155550100"),
        row(3, "bob@example.com", "+14155550100"),
      ];
      const dupes = detectInFileDuplicates(rows);
      assert.equal(dupes.get(3)?.action, "SKIPPED_DUPLICATE_IN_FILE");
    });
  });

  describe("decideOutcome cases A through G", () => {
    void it("Case A (row 1/2/3): neither exists -> CREATED with CREATE intent", () => {
      const r = row(2, "alice@example.com", "+14155550101", "Alice");
      const out = decideOutcome(r, null, null);
      assert.equal(out.action, "CREATED");
      assert.equal(out.intent.kind, "CREATE");
      if (out.intent.kind === "CREATE") {
        assert.equal(out.intent.name, "Alice");
        assert.equal(out.intent.email, "alice@example.com");
        assert.equal(out.intent.phone, "+14155550101");
      }
    });
    void it("Case A with no name -> CREATE with fallback name", () => {
      const r = row(2, null, "+14155550101", null);
      const out = decideOutcome(r, null, null);
      assert.equal(out.action, "CREATED");
      if (out.intent.kind === "CREATE") {
        assert.equal(out.intent.name, "User-0101");
      }
    });
    void it("Case B (row 4 with email-only): email exists, no phone -> SKIPPED_ALREADY_EXISTS", () => {
      const r = row(2, "alice@example.com", null);
      const out = decideOutcome(r, memberSnap("m1"), null);
      assert.equal(out.action, "SKIPPED_ALREADY_EXISTS");
      assert.deepEqual(out.memberIds, ["m1"]);
      assert.equal(out.intent.kind, "NO_OP");
    });
    void it("Case C (mirror of B): phone exists, no email -> SKIPPED_ALREADY_EXISTS", () => {
      const r = row(2, null, "+14155550101");
      const out = decideOutcome(r, null, memberSnap("m2"));
      assert.equal(out.action, "SKIPPED_ALREADY_EXISTS");
      assert.deepEqual(out.memberIds, ["m2"]);
    });
    void it("Case D (row 5): email matches, phone slot free -> MERGED_ADDED_PHONE", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const out = decideOutcome(r, memberSnap("m1", "ACTIVE", true, false), null);
      assert.equal(out.action, "MERGED_ADDED_PHONE");
      assert.equal(out.intent.kind, "MERGE_PHONE");
      if (out.intent.kind === "MERGE_PHONE") {
        assert.equal(out.intent.memberId, "m1");
        assert.equal(out.intent.phone, "+14155550101");
      }
    });
    void it("Case E (row 6): phone matches, email slot free -> MERGED_ADDED_EMAIL", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const out = decideOutcome(r, null, memberSnap("m2", "ACTIVE", false, true));
      assert.equal(out.action, "MERGED_ADDED_EMAIL");
      assert.equal(out.intent.kind, "MERGE_EMAIL");
      if (out.intent.kind === "MERGE_EMAIL") {
        assert.equal(out.intent.memberId, "m2");
        assert.equal(out.intent.email, "alice@example.com");
      }
    });
    void it("Case F (row 4): both columns resolve to the same member -> SKIPPED_ALREADY_EXISTS", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const same = memberSnap("m1");
      const out = decideOutcome(r, same, same);
      assert.equal(out.action, "SKIPPED_ALREADY_EXISTS");
      assert.deepEqual(out.memberIds, ["m1"]);
    });
    void it("Case G (row 7): cross-account collision -> SKIPPED_AMBIGUOUS_MATCH with 2 member ids", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const m1 = memberSnap("m1");
      const m2 = memberSnap("m2");
      const out = decideOutcome(r, m1, m2);
      assert.equal(out.action, "SKIPPED_AMBIGUOUS_MATCH");
      assert.deepEqual(out.memberIds, ["m1", "m2"]);
      assert.equal(out.intent.kind, "NO_OP");
    });
  });

  describe("status-guard behavior (rows 8, 9): non-ACTIVE members are NOT skipped", () => {
    void it("SUSPENDED member: email match still merges phone", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const out = decideOutcome(r, memberSnap("m1", "SUSPENDED", true, false), null);
      assert.equal(out.action, "MERGED_ADDED_PHONE");
      assert.deepEqual(out.memberStatusAtGrant, ["SUSPENDED"]);
    });
    void it("DEACTIVATED member: phone match still merges email", () => {
      const r = row(2, "alice@example.com", "+14155550101");
      const out = decideOutcome(r, null, memberSnap("m2", "DEACTIVATED", false, true));
      assert.equal(out.action, "MERGED_ADDED_EMAIL");
      assert.deepEqual(out.memberStatusAtGrant, ["DEACTIVATED"]);
    });
  });

  describe("runMatcher end-to-end (cross-row dedup + lookups)", () => {
    void it("processes a mixed file and preserves row order", async () => {
      const raw: RawParsedRow[] = [
        { rowNumber: 2, name: "Alice", email: "alice@example.com", phone: "+14155550101" },
        { rowNumber: 3, name: "", email: "BAD", phone: null },
        { rowNumber: 4, name: null, email: null, phone: null },
        { rowNumber: 5, name: "Carol", email: "carol@example.com", phone: null },
        { rowNumber: 6, name: "Alice2", email: "alice@example.com", phone: "+14155550999" },
      ];
      const lookup = makeLookup(
        { "carol@example.com": memberSnap("m-carol") },
        {},
      );
      const outcomes = await runMatcher(raw, lookup);
      assert.equal(outcomes.length, 5);
      assert.deepEqual(
        outcomes.map((o) => [o.rowNumber, o.action]),
        [
          [2, "CREATED"],
          [3, "ERROR_INVALID_EMAIL"],
          [4, "ERROR_MISSING_CONTACT"],
          [5, "SKIPPED_ALREADY_EXISTS"],
          [6, "SKIPPED_DUPLICATE_IN_FILE"],
        ],
      );
    });
    void it("phone-only row with no name gets a fallback CREATE name", async () => {
      const raw: RawParsedRow[] = [
        { rowNumber: 2, name: null, email: null, phone: "+919876543210" },
      ];
      const outcomes = await runMatcher(raw, makeLookup({}, {}));
      assert.equal(outcomes[0]?.action, "CREATED");
      if (outcomes[0]?.intent.kind === "CREATE") {
        assert.equal(outcomes[0].intent.name, "User-3210");
      }
    });
  });

  // Allow microtasks from `it()` to settle before we summarize.
  await new Promise((r) => setImmediate(r));
  console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
  if (testsFailed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

void main();

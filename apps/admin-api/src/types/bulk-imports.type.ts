import type {
  member_status,
  tenant_bulk_import_scope_type,
  tenant_bulk_import_source,
  tenant_bulk_import_status,
} from "../db/enums";

export type BulkImportScopeType = tenant_bulk_import_scope_type;
export type BulkImportSource = tenant_bulk_import_source;
export type BulkImportStatus = tenant_bulk_import_status;

export interface RawParsedRow {
  rowNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Optional per-row access expiry (raw cell value, e.g. "2027-08-11"). */
  validTill: string | null;
}

/**
 * Per-row access expiry resolved from the file's valid_till cell:
 * - a Date  → that exact expiry
 * - "LIFETIME" → explicit lifetime access (stored as null valid_till)
 * - null → the cell was blank; fall back to the batch-level "Access valid till"
 */
export type RowValidity = Date | "LIFETIME" | null;

export interface NormalizedRow {
  rowNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  validTill: RowValidity;
}

export interface RowValidationError {
  rowNumber: number;
  code: RowErrorCode;
  message: string;
}

export type RowErrorCode =
  | "ERROR_MISSING_CONTACT"
  | "ERROR_INVALID_EMAIL"
  | "ERROR_INVALID_PHONE"
  | "ERROR_INVALID_VALIDITY";

export type MemberAction =
  | "CREATED"
  | "MERGED_ADDED_PHONE"
  | "MERGED_ADDED_EMAIL"
  | "SKIPPED_ALREADY_EXISTS"
  | "SKIPPED_AMBIGUOUS_MATCH"
  | "SKIPPED_DUPLICATE_IN_FILE"
  | "SKIPPED_RACE_CONFLICT"
  | "SKIPPED_LOOKS_LIKE_HEADER_ROW"
  | "ERROR_MISSING_CONTACT"
  | "ERROR_INVALID_EMAIL"
  | "ERROR_INVALID_PHONE"
  | "ERROR_INVALID_VALIDITY"
  | "ERROR_CHUNK_FAILED";

export type CourseAction =
  | "ENROLLMENT_CREATED"
  | "ENROLLMENT_REACTIVATED"
  | "ENROLLMENT_ALREADY_ACTIVE";

export type BatchAction =
  | "BATCH_ENROLLMENT_CREATED"
  | "BATCH_ENROLLMENT_REACTIVATED"
  | "BATCH_ENROLLMENT_ALREADY_ACTIVE"
  | "N/A";

export type BookAction =
  | "BOOK_ACCESS_CREATED"
  | "BOOK_ACCESS_REACTIVATED"
  | "BOOK_ACCESS_ALREADY_ACTIVE";

export interface MatchedMemberSnapshot {
  id: string;
  status: member_status;
  hadEmail: boolean;
  hadPhone: boolean;
}

export interface PhaseOneOutcome {
  rowNumber: number;
  action: MemberAction;
  memberIds: string[];
  memberStatusAtGrant: member_status[];
  errorMessage?: string;
  /** Per-row access expiry from the file (null = use the batch default). */
  validTill?: RowValidity;
  /** Set when the action requires writing a merge or insert downstream of the matcher. */
  intent:
    | { kind: "CREATE"; name: string; email: string | null; phone: string | null }
    | { kind: "MERGE_PHONE"; memberId: string; phone: string }
    | { kind: "MERGE_EMAIL"; memberId: string; email: string }
    | { kind: "NO_OP" };
}

/**
 * Grant outcome for the bulk-enroll targets beyond course/book (batch,
 * test series, bundle). One generic action enum keeps
 * PerRowReportEntry from growing a column per target type.
 */
export type TargetAction =
  | "ACCESS_GRANTED"
  | "ACCESS_REACTIVATED"
  | "ACCESS_ALREADY_ACTIVE";

export interface PerRowReportEntry {
  rowNumber: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  memberAction: MemberAction;
  memberIds: string[];
  memberStatusAtGrant: member_status[];
  courseAction: CourseAction | null;
  batchAction: BatchAction | null;
  bookAction: BookAction | null;
  /** Set for non course/book bulk-enroll targets; null on CSV-import flows. */
  targetAction?: TargetAction | null;
  /**
   * What the row's valid_till cell specified:
   * a "YYYY-MM-DD" date, "LIFETIME", or null when blank (uses the batch default).
   */
  rowValidTill: string | null;
  errorMessage: string | null;
}

export interface BulkImportCounters {
  createdCount: number;
  mergedCount: number;
  grantedCount: number;
  skippedCount: number;
  errorCount: number;
}

export interface ScopeContext {
  scopeType: BulkImportScopeType;
  scopeId: string | null;
  /** Optional batch chosen for course-scope imports. */
  batchId: string | null;
  /** Validity for newly-created / reactivated grants. Null = lifetime. */
  validTill: Date | null;
}

export interface MemberLookup {
  byEmail(email: string): Promise<MatchedMemberSnapshot | null>;
  byPhone(phone: string): Promise<MatchedMemberSnapshot | null>;
}

/**
 * Maximum file size accepted by the bulk import endpoints (5 MB).
 * Matches the cap documented in Section 2 of the plan.
 */
export const BULK_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Maximum rows accepted per job. Larger files must be split.
 */
export const BULK_IMPORT_MAX_ROWS = 10_000;

/**
 * Threshold below which the import is processed inline in the HTTP request.
 * Above this, the job is enqueued to BullMQ.
 */
export const BULK_IMPORT_SYNC_THRESHOLD = 200;

/**
 * Maximum outcomes processed per write transaction inside the async worker.
 * Chunking bounds (a) the lock duration on tenant_members / enrollments and
 * (b) the blast radius of an unexpected DB error: only this many rows are
 * rolled back at most, the rest commit.
 */
export const BULK_IMPORT_CHUNK_SIZE = 500;

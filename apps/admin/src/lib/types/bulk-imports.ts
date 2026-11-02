export type BulkImportScopeType = "TENANT" | "COURSE" | "BOOK";
export type BulkImportSource = "CSV" | "SELECT_EXISTING";
export type BulkImportStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type MemberStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

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

/** Grant outcome for the generic targets (batch/bundle/test series). */
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
  memberStatusAtGrant: MemberStatus[];
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

export interface SyncResult {
  counters: BulkImportCounters;
  totalRows: number;
  perRow: PerRowReportEntry[];
}

export interface ImportSummary {
  jobId: string | null;
  syncResult: SyncResult | null;
  asyncStatus: "QUEUED" | null;
}

export interface BulkImportJob {
  id: string;
  tenant_id: string;
  acting_user_id: string;
  scope_type: BulkImportScopeType;
  scope_id: string | null;
  source: BulkImportSource;
  status: BulkImportStatus;
  original_filename: string | null;
  total_rows: number;
  created_count: number;
  merged_count: number;
  granted_count: number;
  skipped_count: number;
  error_count: number;
  report_s3_key: string | null;
  failure_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BulkImportJobsListResult {
  jobs: BulkImportJob[];
  total: number;
  page: number;
  limit: number;
}

export type BulkImportScope =
  | { type: "TENANT" }
  | { type: "COURSE"; courseId: string; batchId?: string | null; validTill?: string | null }
  | { type: "BOOK"; bookId: string; validTill?: string | null };

/** Direct-grant targets handled by the generic access engine. */
export type BulkEnrollGenericTargetType =
  | "BATCH"
  | "BUNDLE"
  | "TEST_SERIES";

export interface BulkEnrollInput {
  target:
    | { type: "COURSE"; id: string; batchId?: string | null }
    | { type: "BOOK"; id: string }
    | { type: BulkEnrollGenericTargetType; id: string };
  memberIds?: string[];
  selectAllFilter?: { status?: MemberStatus; search?: string };
  validTill?: string | null;
}

export interface BulkEnrollResult {
  jobId: string;
  counters: BulkImportCounters;
  totalMembers: number;
  perRow: PerRowReportEntry[];
  /**
   * True when the operator's "All matching filter" selection was capped.
   * Members beyond the cap were NOT enrolled; the UI should surface a
   * warning so the operator can split into narrower filters.
   */
  truncated: boolean;
}

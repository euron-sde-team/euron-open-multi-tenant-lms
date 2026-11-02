// Batch (cohort) types shared across admin + web apps.

export type BatchStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type BatchItemType = "COURSE" | "BOOK";
export type BatchPurchaseMode = "FREE" | "PAID";
export type BatchSessionScheduleStatus = "ACTIVE" | "PAUSED" | "CANCELLED";

export interface BatchItem {
  id: string;
  tenantId: string;
  batchId: string;
  itemType: BatchItemType;
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  createdAt: string;
  /** Joined details, populated when listing items with details */
  courseTitle?: string | null;
  courseSlug?: string | null;
  courseThumbnailKey?: string | null;
  courseMode?: string | null;
  courseType?: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  bookThumbnailUrl?: string | null;
}

export interface Batch {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  previewUrl: string | null;
  startDate: string;
  endDate: string | null;
  enrollmentOpenDate: string | null;
  enrollmentCloseDate: string | null;
  durationDays: number | null;
  validityDays: number | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  status: BatchStatus;
  purchaseMode: BatchPurchaseMode;
  sortOrder: number;
  totalEnrollments: number;
  itemCount: number;
  pageId?: string | null;
  pageSlug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchDetail extends Batch {
  items: BatchItem[];
}

export interface PublishedBatchListItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string | null;
  enrollmentOpenDate: string | null;
  enrollmentCloseDate: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: BatchPurchaseMode;
  itemCount: number;
  totalEnrollments: number;
  sortOrder: number;
  createdAt: string;
}

export interface PublishedBatchItem {
  id: string;
  itemType: BatchItemType;
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  courseTitle: string | null;
  courseSlug: string | null;
  courseSubtitle: string | null;
  courseThumbnailKey: string | null;
  courseMode: string | null;
  courseType: string | null;
  bookTitle: string | null;
  bookSlug: string | null;
  bookAuthor: string | null;
  bookPages: number | null;
  bookThumbnailUrl: string | null;
}

export interface PublishedBatchDetail extends PublishedBatchListItem {
  previewUrl: string | null;
  durationDays: number | null;
  validityDays: number | null;
  updatedAt: string;
  items: PublishedBatchItem[];
  hasAccess?: boolean;
}

export interface BatchCalendarEvent {
  sessionId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  status: string;
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
  lectureId: string | null;
  meetingProviderId: string | null;
}

export interface BatchMissedSession {
  sessionId: string;
  title: string;
  startTime: string;
  endTime: string | null;
  courseId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
}

export interface BatchDashboardData {
  batch: PublishedBatchDetail;
  countdown: {
    startsAt: string;
    secondsUntilStart: number;
    inProgress: boolean;
    ended: boolean;
  };
  progress: {
    sessionsHeld: number;
    sessionsAttended: number;
    sessionsAttendedPct: number;
    lessonsCompleted: number;
    totalLessons: number;
    lessonCompletionPct: number;
    overallCompletionPct: number;
  };
  missedSessions: BatchMissedSession[];
}

export interface CreateBatchRequest {
  title: string;
  slug: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  cover_image_url?: string | null;
  preview_url?: string | null;
  start_date: string;
  end_date?: string | null;
  enrollment_open_date?: string | null;
  enrollment_close_date?: string | null;
  duration_days?: number | null;
  validity_days?: number | null;
  price_inr?: string | null;
  price_usd?: string | null;
  discount_inr?: string | null;
  discount_usd?: string | null;
  status?: BatchStatus;
  purchase_mode?: BatchPurchaseMode;
  sort_order?: number;
}

export type UpdateBatchRequest = Partial<CreateBatchRequest>;

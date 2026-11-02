/**
 * Batches API Client
 *
 * Batch records live in the `batches` table with items in `batch_items` and
 * member memberships in `batch_enrollments`. A batch is a fixed-start cohort
 * that bundles courses + books with a unified live-class calendar.
 *
 * Pairs with `tenant_pages` at slug `batches/{slug}` for the public landing page.
 */

import type { ContentPrice } from "@open-mtlms/shared";

import type { ApiResponse } from "../types/auth";
import { generateSlug } from "../utils/slug";

import { apiClient } from "./axios";

// ─────────────────────────────────────────────────────────────
// Types, re-exported from @open-mtlms/shared where possible.
// ─────────────────────────────────────────────────────────────

export type BatchStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type BatchItemType = "COURSE" | "BOOK";
export type BatchPurchaseMode = "FREE" | "PAID";

export interface BatchItem {
  id: string;
  tenantId: string;
  batchId: string;
  itemType: BatchItemType;
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  createdAt: string;
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
  /** Multi-currency price book (returned on detail GETs). */
  prices?: ContentPrice[];
  status: BatchStatus;
  purchaseMode: BatchPurchaseMode;
  sortOrder: number;
  totalEnrollments: number;
  itemCount: number;
  webThumbnailKey: string | null;
  mobileThumbnailKey: string | null;
  learningOutcomes: string[];
  pageId?: string | null;
  pageSlug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchDetail extends Batch {
  items: BatchItem[];
}

export interface BatchesListResponse {
  batches: Batch[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateBatchRequest {
  title: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  cover_image_url?: string | null;
  preview_url?: string | null;
  web_thumbnail_key?: string | null;
  mobile_thumbnail_key?: string | null;
  learning_outcomes?: string[];
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
  prices?: ContentPrice[];
  status?: BatchStatus;
  purchase_mode?: BatchPurchaseMode;
  sort_order?: number;
}

export type UpdateBatchRequest = Partial<CreateBatchRequest>;

export interface AddBatchItemRequest {
  item_type: BatchItemType;
  course_id?: string | null;
  book_id?: string | null;
}

// Recurring schedules

export type ScheduleStatus = "ACTIVE" | "PAUSED" | "CANCELLED";

export interface BatchSchedule {
  id: string;
  tenantId: string;
  batchId: string;
  courseId: string;
  lectureId: string | null;
  title: string;
  description: string | null;
  daysOfWeek: string[];
  timeOfDay: string;
  durationMinutes: number;
  timezone: string;
  recurrenceStartDate: string;
  recurrenceEndDate: string;
  instructorId: string | null;
  status: ScheduleStatus;
  totalGenerated: number;
  lastMaterializedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequest {
  course_id: string;
  lecture_id?: string | null;
  title: string;
  description?: string | null;
  days_of_week: string[];
  time_of_day: string;
  duration_minutes: number;
  timezone: string;
  recurrence_start_date: string;
  recurrence_end_date: string;
  instructor_id?: string | null;
}

export type UpdateScheduleRequest = Partial<CreateScheduleRequest>;

// ─────────────────────────────────────────────────────────────
// API Client
// ─────────────────────────────────────────────────────────────

export const batchesApi = {
  getBatches: async (
    page = 1,
    limit = 100,
    filters?: { status?: string; search?: string }
  ): Promise<BatchesListResponse> => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    const response = await apiClient.get<ApiResponse<BatchesListResponse>>(
      `/tenant/batches?${params.toString()}`
    );
    return response.data.data;
  },

  getBatch: async (batchId: string): Promise<BatchDetail> => {
    const response = await apiClient.get<ApiResponse<BatchDetail>>(
      `/tenant/batches/${batchId}`
    );
    return response.data.data;
  },

  getBatchBySlug: async (slug: string): Promise<BatchDetail> => {
    const response = await apiClient.get<ApiResponse<BatchDetail>>(
      `/tenant/batches/by-slug/${encodeURIComponent(slug)}`
    );
    return response.data.data;
  },

  createBatch: async (data: CreateBatchRequest): Promise<Batch> => {
    const slug = data.slug || generateSlug(data.title);
    if (!slug) throw new Error("Invalid batch title, cannot generate slug");
    const response = await apiClient.post<ApiResponse<Batch>>(
      "/tenant/batches",
      { ...data, slug }
    );
    return response.data.data;
  },

  updateBatch: async (
    batchId: string,
    data: UpdateBatchRequest
  ): Promise<BatchDetail> => {
    const response = await apiClient.put<ApiResponse<BatchDetail>>(
      `/tenant/batches/${batchId}`,
      data
    );
    return response.data.data;
  },

  deleteBatch: async (batchId: string): Promise<void> => {
    await apiClient.delete(`/tenant/batches/${batchId}`);
  },

  togglePublish: async (
    batchId: string,
    isPublished: boolean
  ): Promise<BatchDetail> => {
    const response = await apiClient.post<ApiResponse<BatchDetail>>(
      `/tenant/batches/${batchId}/toggle-publish`,
      { publish: isPublished }
    );
    return response.data.data;
  },

  // Items

  getBatchItems: async (batchId: string): Promise<BatchItem[]> => {
    const response = await apiClient.get<ApiResponse<BatchItem[]>>(
      `/tenant/batches/${batchId}/items`
    );
    return response.data.data;
  },

  addBatchItem: async (
    batchId: string,
    data: AddBatchItemRequest
  ): Promise<BatchItem> => {
    const response = await apiClient.post<ApiResponse<BatchItem>>(
      `/tenant/batches/${batchId}/items`,
      data
    );
    return response.data.data;
  },

  removeBatchItem: async (batchId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/tenant/batches/${batchId}/items/${itemId}`);
  },

  reorderBatchItems: async (
    batchId: string,
    itemIds: string[]
  ): Promise<BatchItem[]> => {
    const response = await apiClient.patch<ApiResponse<BatchItem[]>>(
      `/tenant/batches/${batchId}/items/reorder`,
      { item_ids: itemIds }
    );
    return response.data.data;
  },

  // Recurring schedules

  listSchedules: async (batchId: string): Promise<BatchSchedule[]> => {
    const response = await apiClient.get<ApiResponse<BatchSchedule[]>>(
      `/tenant/batches/${batchId}/schedules`
    );
    return response.data.data;
  },

  createSchedule: async (
    batchId: string,
    data: CreateScheduleRequest
  ): Promise<BatchSchedule & { generated: number }> => {
    const response = await apiClient.post<
      ApiResponse<BatchSchedule & { generated: number }>
    >(`/tenant/batches/${batchId}/schedules`, data);
    return response.data.data;
  },

  updateSchedule: async (
    batchId: string,
    scheduleId: string,
    data: UpdateScheduleRequest
  ): Promise<
    BatchSchedule & { regeneratedFuture: number; deletedFuture: number }
  > => {
    const response = await apiClient.put<
      ApiResponse<BatchSchedule & { regeneratedFuture: number; deletedFuture: number }>
    >(`/tenant/batches/${batchId}/schedules/${scheduleId}`, data);
    return response.data.data;
  },

  pauseSchedule: async (
    batchId: string,
    scheduleId: string
  ): Promise<BatchSchedule> => {
    const response = await apiClient.post<ApiResponse<BatchSchedule>>(
      `/tenant/batches/${batchId}/schedules/${scheduleId}/pause`
    );
    return response.data.data;
  },

  cancelSchedule: async (
    batchId: string,
    scheduleId: string
  ): Promise<BatchSchedule & { deletedFuture: number }> => {
    const response = await apiClient.post<
      ApiResponse<BatchSchedule & { deletedFuture: number }>
    >(`/tenant/batches/${batchId}/schedules/${scheduleId}/cancel`);
    return response.data.data;
  },

  deleteSchedule: async (
    batchId: string,
    scheduleId: string
  ): Promise<{ deletedFuture: number }> => {
    const response = await apiClient.delete<
      ApiResponse<{ deletedFuture: number }>
    >(`/tenant/batches/${batchId}/schedules/${scheduleId}`);
    return response.data.data;
  },
};

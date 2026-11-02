/**
 * Tenant Offerings, Sales & Revenue Types (read-only Core Admin views)
 */

import { PaginatedResponse, PaginationParams } from "./tenant.type";

// ============================================
// OFFERINGS SUMMARY
// ============================================

/** A { key -> count } breakdown (e.g. by status, type, mode) */
export type CountBreakdown = Record<string, number>;

export interface TenantOfferingsSummary {
  courses: {
    total: number;
    by_status: CountBreakdown;
    by_type: CountBreakdown;
    by_mode: CountBreakdown;
  };
  books: { total: number; by_status: CountBreakdown };
  bundles: { total: number; by_status: CountBreakdown };
  batches: { total: number; by_status: CountBreakdown };
  test_series: { total: number; by_status: CountBreakdown };
  access_grants: {
    enrollments: number;
    book_access: number;
    batch_enrollments: number;
    test_series_enrollments: number;
  };
}

// ============================================
// COURSES
// ============================================

export interface OfferingsCoursesQueryParams extends PaginationParams {
  status?: string;
  course_type?: string;
  mode?: string;
  search?: string;
}

export interface OfferingCourseListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  course_type: string;
  mode: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  created_at: Date;
  section_count: number;
  lesson_count: number;
  lecture_count: number;
  enrollment_count: number;
}

export interface OfferingCourseLecture {
  id: string;
  title: string;
  duration: string | null;
  processing_status: string;
  video_provider: string | null;
}

export interface OfferingCourseLesson {
  id: string;
  title: string;
  type: string;
  lectures: OfferingCourseLecture[];
}

export interface OfferingCourseSection {
  id: string;
  title: string;
  lessons: OfferingCourseLesson[];
}

export interface OfferingCourseDetail {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  status: string;
  course_type: string;
  mode: string;
  purchase_mode: string;
  difficulty: string;
  language: string[];
  duration: string | null;
  learning_outcomes: string[];
  prerequisites: string[];
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  enrollment_count: number;
  total_lectures: number;
  sections: OfferingCourseSection[];
}

// ============================================
// BOOKS
// ============================================

export interface OfferingsBooksQueryParams extends PaginationParams {
  status?: string;
  file_format?: string;
  search?: string;
}

export interface OfferingBookListItem {
  id: string;
  title: string;
  slug: string;
  author: string | null;
  status: string;
  purchase_mode: string;
  file_format: string;
  pages: number | null;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  sample_enabled: boolean;
  sample_pages: number | null;
  created_at: Date;
  book_access_count: number;
}

export interface OfferingBookConversion {
  id: string;
  source_type: string;
  source_filename: string;
  source_size_bytes: number;
  output_key: string | null;
  output_size_bytes: number | null;
  status: string;
  created_at: Date;
  completed_at: Date | null;
}

export interface OfferingBookDetail extends OfferingBookListItem {
  description: string | null;
  summary: string | null;
  url: string | null;
  page_images_count: number;
  conversions: OfferingBookConversion[];
}

// ============================================
// BUNDLES / BATCHES / TEST SERIES
// ============================================

export interface OfferingItemRef {
  item_type: string;
  id: string | null;
  title: string | null;
  slug: string | null;
}

export interface OfferingBundleListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number;
  created_at: Date;
  items: OfferingItemRef[];
}

export interface OfferingBatchListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  purchase_mode: string;
  price_inr: number | null;
  price_usd: number | null;
  start_date: Date;
  end_date: Date | null;
  enrollment_open_date: Date | null;
  enrollment_close_date: Date | null;
  duration_days: number | null;
  validity_days: number | null;
  total_enrollments: number;
  created_at: Date;
  items: OfferingItemRef[];
}

export interface OfferingTestSeriesListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  pricing_type: string;
  price_inr: number | null;
  price_usd: number | null;
  validity_days: number | null;
  visibility: string;
  access_mode: string;
  created_at: Date;
  test_count: number;
  enrollment_count: number;
}

// ============================================
// SALES & REVENUE
// ============================================

export interface SalesOrdersQueryParams extends PaginationParams {
  order_type?: string;
  status?: string;
  currency?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export interface SalesOrderListItem {
  id: string;
  order_number: string;
  order_type: string;
  item_id: string;
  item_title: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  currency: string;
  base_amount: number;
  discount_amount: number;
  net_amount: number;
  tax_amount: number;
  total_amount: number;
  platform_fee: number;
  tenant_payout_amount: number | null;
  gateway_provider_name: string;
  status: string;
  created_at: Date;
  paid_at: Date | null;
  refunded_at: Date | null;
}

export interface RevenueQueryParams {
  start_date?: string;
  end_date?: string;
}

export interface RevenueCurrencyBlock {
  currency: string;
  gross_total: number;
  discount_total: number;
  net_total: number;
  tax_total: number;
  platform_fee_total: number;
  tenant_payout_total: number;
  paid_order_count: number;
  refunded_order_count: number;
  refunded_amount: number;
}

export interface RevenueByOrderType {
  currency: string;
  order_type: string;
  net_total: number;
  total_amount: number;
  order_count: number;
}

export interface TenantRevenueSummary {
  by_currency: RevenueCurrencyBlock[];
  by_order_type: RevenueByOrderType[];
}

// ============================================
// LIST RESPONSE ALIASES
// ============================================

export type OfferingCoursesListResponse =
  PaginatedResponse<OfferingCourseListItem>;
export type OfferingBooksListResponse = PaginatedResponse<OfferingBookListItem>;
export type OfferingBundlesListResponse =
  PaginatedResponse<OfferingBundleListItem>;
export type OfferingBatchesListResponse =
  PaginatedResponse<OfferingBatchListItem>;
export type OfferingTestSeriesListResponse =
  PaginatedResponse<OfferingTestSeriesListItem>;
export type SalesOrdersListResponse = PaginatedResponse<SalesOrderListItem>;

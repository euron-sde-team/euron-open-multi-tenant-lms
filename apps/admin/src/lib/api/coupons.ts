import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

/**
 * The admin form only authors PERCENTAGE, but FIXED rows exist in the table
 * (legacy, plus the test-series coupons folded in by the unification migration),
 * so edit has to be able to round-trip them.
 */
export type CouponDiscountType = "PERCENTAGE" | "FIXED";

export type CouponItemType =
  | "COURSE"
  | "BOOK"
  | "BUNDLE"
  | "BATCH"
  | "TEST_SERIES";

export interface CouponApplicableItem {
  id: string;
  tenantId: string;
  couponId: string;
  itemType: CouponItemType;
  courseId: string | null;
  bookId: string | null;
  bundleId: string | null;
  batchId: string | null;
  testSeriesId: string | null;
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  /** Only meaningful for FIXED coupons; NULL is read as INR. */
  currency: string | null;
  validFrom: string;
  validTo: string | null;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  usedCount: number;
  isActive: boolean;
  /** false = redeemable by code only, never advertised on the storefront. */
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  applicableItems?: CouponApplicableItem[];
}

export interface CouponsListResponse {
  coupons: Coupon[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCouponApplicableItemRequest {
  item_type: CouponItemType;
  course_id?: string | null;
  book_id?: string | null;
  bundle_id?: string | null;
  batch_id?: string | null;
  test_series_id?: string | null;
}

export interface CreateCouponRequest {
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  valid_from: string;
  valid_to?: string | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  is_public?: boolean;
  applicable_to_all?: boolean;
  applicable_items?: CreateCouponApplicableItemRequest[];
}

export type UpdateCouponRequest = Partial<CreateCouponRequest>;

export interface CouponsListParams {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
}

export const listCoupons = async (params?: CouponsListParams): Promise<ApiResponse<CouponsListResponse>> => {
  return (await apiClient.get("/tenant/coupons", { params })).data;
};

export const getCoupon = async (id: string): Promise<ApiResponse<Coupon>> => {
  return (await apiClient.get(`/tenant/coupons/${id}`)).data;
};

export const createCoupon = async (data: CreateCouponRequest): Promise<ApiResponse<Coupon>> => {
  return (await apiClient.post("/tenant/coupons", data)).data;
};

export const updateCoupon = async (id: string, data: UpdateCouponRequest): Promise<ApiResponse<Coupon>> => {
  return (await apiClient.put(`/tenant/coupons/${id}`, data)).data;
};

export const toggleCoupon = async (id: string): Promise<ApiResponse<Coupon>> => {
  return (await apiClient.patch(`/tenant/coupons/${id}/toggle`)).data;
};

export const deleteCoupon = async (id: string): Promise<ApiResponse<null>> => {
  return (await apiClient.delete(`/tenant/coupons/${id}`)).data;
};

export const getCouponAnalytics = async (id: string) => {
  const response = await apiClient.get(`/tenant/coupons/${id}/analytics`);
  return response.data;
};

export const getCouponRedemptions = async (id: string, params?: { page?: number; limit?: number }) => {
  const response = await apiClient.get(`/tenant/coupons/${id}/redemptions`, { params });
  return response.data;
};

export interface CouponDetailedAnalytics {
  total_redemptions: number;
  unique_users: number;
  total_discount_by_currency: Array<{ currency: string; total: number }>;
  avg_discount_by_currency: Array<{ currency: string; avg: number }>;
  usage_rate: number | null;
  revenue_impact: Array<{
    currency: string;
    total_original_amount: number;
    total_discounted_amount: number;
    total_discount: number;
  }>;
  daily_redemptions: Array<{ date: string; count: number }>;
  item_breakdown: Array<{
    order_type: string;
    item_id: string;
    item_name: string;
    redemption_count: number;
    total_discount: number;
  }>;
  top_users: Array<{
    member_id: string;
    name: string;
    email: string;
    redemption_count: number;
    total_discount: number;
  }>;
  applicable_items: Array<{
    item_type: string;
    item_id: string;
    item_name: string;
  }>;
}

export const getCouponDetailedAnalytics = async (id: string): Promise<ApiResponse<CouponDetailedAnalytics>> => {
  return (await apiClient.get(`/tenant/coupons/${id}/detailed-analytics`)).data;
};

// ---------------------------------------------------------------------------
// API returns snake_case, map to camelCase Coupon interface
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapCoupon(raw: any): Coupon {
  return {
    id: raw.id,
    tenantId: raw.tenant_id ?? raw.tenantId,
    code: raw.code,
    discountType: raw.discount_type ?? raw.discountType,
    discountValue: Number(raw.discount_value ?? raw.discountValue ?? 0),
    currency: raw.currency ?? null,
    validFrom: raw.valid_from ?? raw.validFrom,
    validTo: raw.valid_to ?? raw.validTo ?? null,
    maxUses: raw.max_uses ?? raw.maxUses ?? null,
    maxUsesPerUser: raw.max_uses_per_user ?? raw.maxUsesPerUser ?? null,
    usedCount: Number(raw.used_count ?? raw.usedCount ?? 0),
    isActive: raw.is_active ?? raw.isActive ?? false,
    isPublic: raw.is_public ?? raw.isPublic ?? true,
    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
    applicableItems: raw.applicable_items?.map(mapApplicableItem) ?? raw.applicableItems?.map(mapApplicableItem),
  };
}

function mapApplicableItem(raw: any): CouponApplicableItem {
  return {
    id: raw.id,
    tenantId: raw.tenant_id ?? raw.tenantId,
    couponId: raw.coupon_id ?? raw.couponId,
    itemType: raw.item_type ?? raw.itemType,
    courseId: raw.course_id ?? raw.courseId ?? null,
    bookId: raw.book_id ?? raw.bookId ?? null,
    bundleId: raw.bundle_id ?? raw.bundleId ?? null,
    batchId: raw.batch_id ?? raw.batchId ?? null,
    testSeriesId: raw.test_series_id ?? raw.testSeriesId ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

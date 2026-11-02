import apiClient from './client';
import {
  ApiResponse,
  OfferingBatchesListResponse,
  OfferingBookDetail,
  OfferingBooksListResponse,
  OfferingBundlesListResponse,
  OfferingCourseDetail,
  OfferingCoursesListResponse,
  OfferingsBooksFilters,
  OfferingsCoursesFilters,
  OfferingTestSeriesListResponse,
  PaginationParams,
  SalesOrdersFilters,
  SalesOrdersListResponse,
  TenantOfferingsSummary,
  TenantRevenueSummary,
} from './types';

const base = (tenantId: string) => `/admin/tenants/${tenantId}`;

export const getTenantOfferingsSummary = async (
  tenantId: string,
): Promise<TenantOfferingsSummary> => {
  const res = await apiClient.get<ApiResponse<TenantOfferingsSummary>>(
    `${base(tenantId)}/offerings/summary`,
  );
  return res.data.data;
};

export const listTenantCourses = async (
  tenantId: string,
  filters?: OfferingsCoursesFilters,
): Promise<OfferingCoursesListResponse> => {
  const res = await apiClient.get<ApiResponse<OfferingCoursesListResponse>>(
    `${base(tenantId)}/offerings/courses`,
    { params: filters },
  );
  return res.data.data;
};

export const getTenantCourseDetail = async (
  tenantId: string,
  courseId: string,
): Promise<OfferingCourseDetail> => {
  const res = await apiClient.get<ApiResponse<OfferingCourseDetail>>(
    `${base(tenantId)}/offerings/courses/${courseId}`,
  );
  return res.data.data;
};

export const listTenantBooks = async (
  tenantId: string,
  filters?: OfferingsBooksFilters,
): Promise<OfferingBooksListResponse> => {
  const res = await apiClient.get<ApiResponse<OfferingBooksListResponse>>(
    `${base(tenantId)}/offerings/books`,
    { params: filters },
  );
  return res.data.data;
};

export const getTenantBookDetail = async (
  tenantId: string,
  bookId: string,
): Promise<OfferingBookDetail> => {
  const res = await apiClient.get<ApiResponse<OfferingBookDetail>>(
    `${base(tenantId)}/offerings/books/${bookId}`,
  );
  return res.data.data;
};

export const listTenantBundles = async (
  tenantId: string,
  filters?: PaginationParams,
): Promise<OfferingBundlesListResponse> => {
  const res = await apiClient.get<ApiResponse<OfferingBundlesListResponse>>(
    `${base(tenantId)}/offerings/bundles`,
    { params: filters },
  );
  return res.data.data;
};

export const listTenantBatches = async (
  tenantId: string,
  filters?: PaginationParams,
): Promise<OfferingBatchesListResponse> => {
  const res = await apiClient.get<ApiResponse<OfferingBatchesListResponse>>(
    `${base(tenantId)}/offerings/batches`,
    { params: filters },
  );
  return res.data.data;
};

export const listTenantTestSeries = async (
  tenantId: string,
  filters?: PaginationParams,
): Promise<OfferingTestSeriesListResponse> => {
  const res = await apiClient.get<ApiResponse<OfferingTestSeriesListResponse>>(
    `${base(tenantId)}/offerings/test-series`,
    { params: filters },
  );
  return res.data.data;
};

export const listTenantSalesOrders = async (
  tenantId: string,
  filters?: SalesOrdersFilters,
): Promise<SalesOrdersListResponse> => {
  const res = await apiClient.get<ApiResponse<SalesOrdersListResponse>>(
    `${base(tenantId)}/sales/orders`,
    { params: filters },
  );
  return res.data.data;
};

export const getTenantRevenueSummary = async (
  tenantId: string,
  filters?: { start_date?: string; end_date?: string },
): Promise<TenantRevenueSummary> => {
  const res = await apiClient.get<ApiResponse<TenantRevenueSummary>>(
    `${base(tenantId)}/revenue/summary`,
    { params: filters },
  );
  return res.data.data;
};

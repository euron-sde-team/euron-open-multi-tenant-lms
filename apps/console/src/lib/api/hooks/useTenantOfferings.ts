import { useQuery } from 'react-query';

import {
  getTenantBookDetail,
  getTenantCourseDetail,
  getTenantOfferingsSummary,
  getTenantRevenueSummary,
  listTenantBatches,
  listTenantBooks,
  listTenantBundles,
  listTenantCourses,
  listTenantSalesOrders,
  listTenantTestSeries,
} from '../tenantOfferings';
import {
  OfferingsBooksFilters,
  OfferingsCoursesFilters,
  PaginationParams,
  SalesOrdersFilters,
} from '../types';

const opts = {
  staleTime: 30000,
  refetchOnWindowFocus: false,
  keepPreviousData: true,
};

export const useGetTenantOfferingsSummary = (tenantId: string | undefined) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'summary'],
    queryFn: () => getTenantOfferingsSummary(tenantId as string),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantCourses = (
  tenantId: string | undefined,
  filters?: OfferingsCoursesFilters,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'courses', filters],
    queryFn: () => listTenantCourses(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantCourseDetail = (
  tenantId: string | undefined,
  courseId: string | undefined,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'course', courseId],
    queryFn: () =>
      getTenantCourseDetail(tenantId as string, courseId as string),
    enabled: !!tenantId && !!courseId,
    ...opts,
  });

export const useGetTenantBooks = (
  tenantId: string | undefined,
  filters?: OfferingsBooksFilters,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'books', filters],
    queryFn: () => listTenantBooks(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantBookDetail = (
  tenantId: string | undefined,
  bookId: string | undefined,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'book', bookId],
    queryFn: () => getTenantBookDetail(tenantId as string, bookId as string),
    enabled: !!tenantId && !!bookId,
    ...opts,
  });

export const useGetTenantBundles = (
  tenantId: string | undefined,
  filters?: PaginationParams,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'bundles', filters],
    queryFn: () => listTenantBundles(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantBatches = (
  tenantId: string | undefined,
  filters?: PaginationParams,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'batches', filters],
    queryFn: () => listTenantBatches(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantTestSeries = (
  tenantId: string | undefined,
  filters?: PaginationParams,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'test-series', filters],
    queryFn: () => listTenantTestSeries(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantSalesOrders = (
  tenantId: string | undefined,
  filters?: SalesOrdersFilters,
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'sales', filters],
    queryFn: () => listTenantSalesOrders(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

export const useGetTenantRevenueSummary = (
  tenantId: string | undefined,
  filters?: { start_date?: string; end_date?: string },
) =>
  useQuery({
    queryKey: ['tenant-offerings', tenantId, 'revenue', filters],
    queryFn: () => getTenantRevenueSummary(tenantId as string, filters),
    enabled: !!tenantId,
    ...opts,
  });

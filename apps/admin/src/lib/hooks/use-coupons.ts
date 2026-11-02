import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  toggleCoupon,
  deleteCoupon,
  getCouponAnalytics,
  getCouponDetailedAnalytics,
  getCouponRedemptions,
  mapCoupon,
  type CouponsListParams,
  type CreateCouponRequest,
  type UpdateCouponRequest,
} from "../api/coupons";

export const couponKeys = {
  all: ["coupons"] as const,
  list: (filters?: Record<string, unknown>) => [...couponKeys.all, "list", filters] as const,
  detail: (id: string) => [...couponKeys.all, "detail", id] as const,
};

export function useCoupons(filters?: CouponsListParams) {
  return useQuery({
    queryKey: couponKeys.list(filters as Record<string, unknown>),
    queryFn: () => listCoupons(filters),
    placeholderData: keepPreviousData,
    select: (data) => ({
      ...data.data,
      coupons: data.data.coupons.map(mapCoupon),
    }),
  });
}

export function useCoupon(id: string) {
  return useQuery({
    queryKey: couponKeys.detail(id),
    queryFn: () => getCoupon(id),
    enabled: !!id,
    select: (data) => mapCoupon(data.data),
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCouponRequest) => createCoupon(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponKeys.all }),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCouponRequest }) => updateCoupon(id, data),
    onSuccess: (_res, { id }) => {
      queryClient.invalidateQueries({ queryKey: couponKeys.all });
      queryClient.invalidateQueries({ queryKey: couponKeys.detail(id) });
    },
  });
}

export function useToggleCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => toggleCoupon(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponKeys.all }),
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCoupon(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponKeys.all }),
  });
}

export function useCouponDetailedAnalytics(id: string) {
  return useQuery({
    queryKey: [...couponKeys.detail(id), "detailed-analytics"],
    queryFn: () => getCouponDetailedAnalytics(id),
    enabled: !!id,
    select: (data) => data.data,
    staleTime: 60_000,
  });
}

export function useCouponAnalytics(id: string) {
  return useQuery({
    queryKey: [...couponKeys.detail(id), "analytics"],
    queryFn: () => getCouponAnalytics(id),
    enabled: !!id,
    select: (data) => data.data,
  });
}

export function useCouponRedemptions(id: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: [...couponKeys.detail(id), "redemptions", page, limit],
    queryFn: () => getCouponRedemptions(id, { page, limit }),
    enabled: !!id,
    placeholderData: keepPreviousData,
    select: (data) => data.data,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { tenantOrgApi, type TenantOrgDetails, type TenantBillingDetails, type UpdateTenantOrgRequest, type UpdateBillingDetailsRequest } from "@/lib/api/tenant-org";
import { cachedInPreview } from "@/lib/preview-cache";

// ─────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────

export const tenantOrgKeys = {
  all: ["tenant-org"] as const,
  details: () => [...tenantOrgKeys.all, "details"] as const,
  billing: () => [...tenantOrgKeys.all, "billing"] as const,
};

// ─────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────

export const useOrgDetails = () => {
  return useQuery({
    queryKey: tenantOrgKeys.details(),
    // cachedInPreview is a pass-through outside /preview/* iframe routes; inside
    // them it dedupes the identical org-details request across preview iframes.
    queryFn: () => cachedInPreview("org-details", tenantOrgApi.getOrgDetails),
  });
};

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

export const useUpdateOrgDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTenantOrgRequest) => tenantOrgApi.updateOrgDetails(data),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useUploadOrgLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slot, file }: { slot: "light" | "dark"; file: File }) =>
      tenantOrgApi.uploadLogo(slot, file),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useUploadFavicon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => tenantOrgApi.uploadFavicon(file),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useUploadFounderPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => tenantOrgApi.uploadFounderPhoto(file),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useDeleteOrgLogo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slot: "light" | "dark") => tenantOrgApi.deleteLogo(slot),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useDeleteOrgFavicon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tenantOrgApi.deleteFavicon(),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

export const useDeleteOrgFounderPhoto = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tenantOrgApi.deleteFounderPhoto(),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantOrgDetails>(tenantOrgKeys.details(), result);
    },
  });
};

// ─────────────────────────────────────────────────────────────
// Billing
// ─────────────────────────────────────────────────────────────

export const useBillingDetails = () => {
  return useQuery({
    queryKey: tenantOrgKeys.billing(),
    queryFn: tenantOrgApi.getBillingDetails,
  });
};

export const useUpdateBillingDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateBillingDetailsRequest) => tenantOrgApi.updateBillingDetails(data),
    onSuccess: (result) => {
      queryClient.setQueryData<TenantBillingDetails>(tenantOrgKeys.billing(), result);
    },
  });
};

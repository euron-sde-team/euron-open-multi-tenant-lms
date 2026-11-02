import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  bulkCertificatesApi,
  type CreateBatchInput,
  type CreateFromSourceInput,
  type RecipientSource,
} from "../api/bulk-certificates";

export const bulkCertificateKeys = {
  all: ["bulk-certificates"] as const,
  batches: () => [...bulkCertificateKeys.all, "batches"] as const,
  batch: (id: string) => [...bulkCertificateKeys.all, "batch", id] as const,
};

export function useBulkCertBatches() {
  return useQuery({
    queryKey: bulkCertificateKeys.batches(),
    queryFn: () => bulkCertificatesApi.listBatches(),
  });
}

export function useBulkCertBatchDetail(batchId: string | null) {
  return useQuery({
    queryKey: bulkCertificateKeys.batch(batchId ?? ""),
    enabled: !!batchId,
    queryFn: () => bulkCertificatesApi.getBatchDetail(batchId as string),
  });
}

export function useCreateBulkCertBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => bulkCertificatesApi.createBatch(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkCertificateKeys.batches() });
    },
  });
}

export function useDeleteBulkCertBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => bulkCertificatesApi.deleteBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkCertificateKeys.batches() });
    },
  });
}

export function useCreateBulkCertFromSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFromSourceInput) =>
      bulkCertificatesApi.createFromSource(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bulkCertificateKeys.batches() });
    },
  });
}

export function useResolveCertRecipients() {
  return useMutation({
    mutationFn: (source: RecipientSource) =>
      bulkCertificatesApi.resolveRecipients(source),
  });
}

export function useSendBulkCertBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => bulkCertificatesApi.sendBatch(batchId),
    onSuccess: (_data, batchId) => {
      queryClient.invalidateQueries({
        queryKey: bulkCertificateKeys.batch(batchId),
      });
      queryClient.invalidateQueries({ queryKey: bulkCertificateKeys.batches() });
    },
  });
}

export function useDownloadCertSample() {
  return useMutation({
    mutationFn: async (format: "csv" | "xlsx") => {
      const blob = await bulkCertificatesApi.downloadSample(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "csv"
          ? "certificate-recipients-sample.csv"
          : "certificate-recipients-sample.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  certificateDesignerApi,
  type SaveTemplatePayload,
} from "../api/certificate-designer";

export const certificateDesignerKeys = {
  all: ["certificate-designer"] as const,
  list: () => [...certificateDesignerKeys.all, "list"] as const,
  detail: (id: string) => [...certificateDesignerKeys.all, "detail", id] as const,
};

export const useCertificateDesigns = () =>
  useQuery({
    queryKey: certificateDesignerKeys.list(),
    queryFn: () => certificateDesignerApi.list(),
  });

export const useCertificateDesign = (id: string | null) =>
  useQuery({
    queryKey: certificateDesignerKeys.detail(id ?? ""),
    queryFn: () => certificateDesignerApi.get(id as string),
    enabled: !!id,
  });

export const useCreateCertificateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveTemplatePayload) =>
      certificateDesignerApi.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: certificateDesignerKeys.list() }),
  });
};

export const useUpdateCertificateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<SaveTemplatePayload>;
    }) => certificateDesignerApi.update(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: certificateDesignerKeys.list() });
      qc.invalidateQueries({ queryKey: certificateDesignerKeys.detail(id) });
    },
  });
};

export const useDeleteCertificateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => certificateDesignerApi.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: certificateDesignerKeys.list() }),
  });
};

export const useSetDefaultCertificateDesign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => certificateDesignerApi.setDefault(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: certificateDesignerKeys.list() }),
  });
};

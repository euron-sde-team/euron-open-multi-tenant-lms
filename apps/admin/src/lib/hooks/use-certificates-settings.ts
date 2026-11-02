import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  certificatesSettingsApi,
  type UpdateCertificatesSettingsInput,
} from "../api/certificates-settings";
import { useTenantStore } from "../stores/tenant-store";

export const certificatesSettingsKeys = {
  all: ["certificates-settings"] as const,
};

export const useCertificatesSettings = () => {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...certificatesSettingsKeys.all, selectedTenantId],
    queryFn: () => certificatesSettingsApi.get(),
    enabled: !!selectedTenantId,
  });
};

export const useUpdateCertificatesSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCertificatesSettingsInput) => certificatesSettingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: certificatesSettingsKeys.all });
    },
  });
};

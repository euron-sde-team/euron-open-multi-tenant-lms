import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  storefrontSettingsApi,
  type UpdateStorefrontSettingsInput,
} from "../api/storefront-settings";
import { useTenantStore } from "../stores/tenant-store";

export const storefrontSettingsKeys = {
  all: ["storefront-settings"] as const,
};

export const useStorefrontSettings = () => {
  const selectedTenantId = useTenantStore((s) => s.selectedTenantId);
  return useQuery({
    queryKey: [...storefrontSettingsKeys.all, selectedTenantId],
    queryFn: () => storefrontSettingsApi.get(),
    enabled: !!selectedTenantId,
  });
};

export const useUpdateStorefrontSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateStorefrontSettingsInput) => storefrontSettingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storefrontSettingsKeys.all });
    },
  });
};

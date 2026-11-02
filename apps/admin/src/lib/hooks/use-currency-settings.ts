import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  currencySettingsApi,
  type CurrencySettingsResponse,
  type UpdateCurrencySettingsRequest,
} from "@/lib/api/currency-settings";

// ─────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────

export const currencySettingsKeys = {
  all: ["currency-settings"] as const,
  settings: () => [...currencySettingsKeys.all, "settings"] as const,
  coverage: () => [...currencySettingsKeys.all, "coverage"] as const,
};

// ─────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────

export const useCurrencySettings = () => {
  return useQuery({
    queryKey: currencySettingsKeys.settings(),
    queryFn: currencySettingsApi.getSettings,
  });
};

export const useCurrencyCoverage = (enabled = true) => {
  return useQuery({
    queryKey: currencySettingsKeys.coverage(),
    queryFn: currencySettingsApi.getCoverage,
    enabled,
  });
};

// ─────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────

export const useUpdateCurrencySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCurrencySettingsRequest) =>
      currencySettingsApi.updateSettings(data),
    onSuccess: (result) => {
      if (result.applied) {
        queryClient.setQueryData<CurrencySettingsResponse>(
          currencySettingsKeys.settings(),
          result.settings
        );
        queryClient.setQueryData(currencySettingsKeys.coverage(), result.coverage);
      }
    },
  });
};

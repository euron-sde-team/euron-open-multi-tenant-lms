"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTaxConfig, type TaxConfigResponse } from "@/lib/api/tenant-config";

const TAX_CONFIG_KEY = ["tax-config"] as const;

const DEFAULT_CONFIG: TaxConfigResponse = {
  tax_mode: "INCLUSIVE",
  tax_percentage: 18,
  is_indian: true,
};

export function useTaxConfig() {
  const { data, isLoading } = useQuery<TaxConfigResponse>({
    queryKey: TAX_CONFIG_KEY,
    queryFn: fetchTaxConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    taxMode: data?.tax_mode ?? DEFAULT_CONFIG.tax_mode,
    taxPercentage: data?.tax_percentage ?? DEFAULT_CONFIG.tax_percentage,
    isIndian: data?.is_indian ?? DEFAULT_CONFIG.is_indian,
    isLoading,
  };
}

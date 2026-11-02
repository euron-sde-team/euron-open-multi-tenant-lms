import { apiGet } from "./api-client";

export interface TaxConfigResponse {
  tax_mode: "INCLUSIVE" | "EXCLUSIVE";
  tax_percentage: number;
  is_indian: boolean;
}

export const fetchTaxConfig = async (): Promise<TaxConfigResponse> =>
  apiGet("/tenant/tax-config");

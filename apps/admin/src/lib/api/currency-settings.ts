import { apiClient } from "./axios";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TenantCurrencyRow {
  currency: string;
  is_default: boolean;
  /** ISO-3166 alpha-2 codes served by this currency; "*" = rest of world. */
  countries: string[];
  is_active: boolean;
  sort_order: number;
}

export interface CurrencyRegistryEntry {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  razorpaySupported: boolean;
  stripeSupported: boolean;
}

export interface CurrencySettingsResponse {
  currencies: TenantCurrencyRow[];
  is_virtual: boolean;
  registry: CurrencyRegistryEntry[];
  gateway_warnings: string[];
}

export interface UpdateCurrencyInput {
  currency: string;
  is_default: boolean;
  countries: string[];
}

export interface UpdateCurrencySettingsRequest {
  currencies: UpdateCurrencyInput[];
  confirm_removal?: boolean;
}

export interface CurrencyCoverageTarget {
  entity_type: string;
  missing_count: number;
  sample: Array<{ id: string; title: string }>;
}

export interface CurrencyCoverageResponse {
  default_currency: string;
  total_missing: number;
  targets: CurrencyCoverageTarget[];
}

/** Returned when removals need confirmation (HTTP 200, applied: false). */
export interface UpdateCurrencySettingsConfirmationResponse {
  applied: false;
  requires_confirmation: true;
  removal_impact: Record<string, number>;
  message: string;
}

/** Returned when the update was applied. */
export interface UpdateCurrencySettingsAppliedResponse {
  applied: true;
  deleted_price_rows: number;
  settings: CurrencySettingsResponse;
  coverage: CurrencyCoverageResponse;
}

export type UpdateCurrencySettingsResponse =
  | UpdateCurrencySettingsConfirmationResponse
  | UpdateCurrencySettingsAppliedResponse;

export interface FxSuggestion {
  currency: string;
  rate: number;
  amount: number;
  source: string;
}

export interface FxSuggestResponse {
  from: string;
  amount: number;
  suggestions: FxSuggestion[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─────────────────────────────────────────────────────────────
// API functions
// ─────────────────────────────────────────────────────────────

const BASE = "/tenant/currency-settings";

export const currencySettingsApi = {
  getSettings: async (): Promise<CurrencySettingsResponse> => {
    const response = await apiClient.get<ApiResponse<CurrencySettingsResponse>>(BASE);
    return response.data.data;
  },

  updateSettings: async (
    data: UpdateCurrencySettingsRequest
  ): Promise<UpdateCurrencySettingsResponse> => {
    const response = await apiClient.put<ApiResponse<UpdateCurrencySettingsResponse>>(
      BASE,
      data
    );
    return response.data.data;
  },

  getCoverage: async (): Promise<CurrencyCoverageResponse> => {
    const response = await apiClient.get<ApiResponse<CurrencyCoverageResponse>>(
      `${BASE}/coverage`
    );
    return response.data.data;
  },

  fxSuggest: async (params: {
    from: string;
    to: string[];
    amount: number;
  }): Promise<FxSuggestResponse> => {
    const search = new URLSearchParams({
      from: params.from,
      to: params.to.join(","),
      amount: String(params.amount),
    });
    const response = await apiClient.get<ApiResponse<FxSuggestResponse>>(
      `${BASE}/fx-suggest?${search.toString()}`
    );
    return response.data.data;
  },
};

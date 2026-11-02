import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  invoice_type: "PLAN_SUBSCRIPTION" | "USER_PURCHASE";
  subscription_id?: string;
  currency: string;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  invoice_url: string;
  payment_method?: string;
  transaction_id?: string;
  status: string;
  generated_at: string;
  created_at: string;
}

interface InvoicesListResponse {
  items: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export async function getInvoices(params?: {
  invoice_type?: string;
  page?: number;
  limit?: number;
}): Promise<InvoicesListResponse> {
  const response = await apiClient.get<ApiResponse<InvoicesListResponse>>(
    "/tenant/invoices",
    { params }
  );
  return response.data.data;
}

export const invoicesApi = { getInvoices };

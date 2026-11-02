import { apiGet } from "./api-client";

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  invoice_type: "PLAN_SUBSCRIPTION" | "USER_PURCHASE";
  order_id?: string;
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

export const invoicesApi = {
  listMyInvoices: (params?: {
    page?: number;
    limit?: number;
  }): Promise<InvoicesListResponse> => apiGet("/invoices", { params }),

  getInvoice: (id: string): Promise<Invoice> => apiGet(`/invoices/${id}`),
};

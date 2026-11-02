import { useQuery } from "@tanstack/react-query";

import { invoicesApi } from "../api/invoices";

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (filters?: Record<string, unknown>) =>
    [...invoiceKeys.all, "list", filters] as const,
};

export function useInvoices(filters?: {
  invoice_type?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoicesApi.getInvoices(filters),
    staleTime: 60_000,
  });
}

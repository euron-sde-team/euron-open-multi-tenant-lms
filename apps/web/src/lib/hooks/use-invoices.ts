"use client";

import { useQuery } from "@tanstack/react-query";
import { invoicesApi } from "@/lib/api/invoices";

export function useMyInvoices(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["my-invoices", params],
    queryFn: () => invoicesApi.listMyInvoices(params),
    staleTime: 60_000,
  });
}

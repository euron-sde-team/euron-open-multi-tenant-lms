"use client";

import { useState } from "react";
import { TenantThemeProvider } from "@/components/providers/tenant-theme-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { useMyInvoices } from "@/lib/hooks/use-invoices";
import { cn } from "@open-mtlms/core";
import { Download, FileText, Loader2 } from "lucide-react";
import { formatMoney, type ThemeConfig, type TenantLayout } from "@open-mtlms/shared";
import type { Invoice } from "@/lib/api/invoices";

interface Props {
  theme?: ThemeConfig;
  layout?: TenantLayout | null;
}

export function MyInvoicesClient({ theme, layout }: Props) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyInvoices({ page, limit: 20 });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatAmount = (amount: string, currency: string) =>
    formatMoney(parseFloat(amount), currency, { alwaysShowDecimals: true });

  return (
    <AuthGuard>
      <LayoutWrapper layout={layout ?? null} theme={theme}>
        <TenantThemeProvider theme={theme}>
          <div className="mx-auto max-w-4xl px-4 py-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">
                My Invoices
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View and download your purchase invoices
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !data?.items?.length ? (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-muted-foreground">
                <FileText className="mb-3 h-10 w-10 opacity-50" />
                <p className="text-sm">No invoices yet</p>
                <p className="mt-1 text-xs">
                  Invoices will appear here after you make a purchase
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-foreground">
                          Invoice #
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-foreground">
                          Date
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-foreground">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-foreground"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((invoice: Invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b last:border-0 transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {invoice.invoice_number}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(invoice.generated_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">
                            {formatAmount(invoice.total_amount, invoice.currency)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <a
                              href={invoice.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.total > data.limit && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Page {page} of {Math.ceil(data.total / data.limit)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          page === 1
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-muted"
                        )}
                      >
                        Previous
                      </button>
                      <button
                        disabled={page * data.limit >= data.total}
                        onClick={() => setPage((p) => p + 1)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          page * data.limit >= data.total
                            ? "cursor-not-allowed opacity-50"
                            : "hover:bg-muted"
                        )}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TenantThemeProvider>
      </LayoutWrapper>
    </AuthGuard>
  );
}

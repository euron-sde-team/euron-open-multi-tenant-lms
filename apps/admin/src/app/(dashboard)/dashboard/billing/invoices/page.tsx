"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";

import type { Invoice } from "@/lib/api/invoices";
import { useInvoices } from "@/lib/hooks/use-invoices";

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useInvoices({ page, limit: 20 });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatAmount = (amount: string, currency: string) => {
    const symbol = currency === "INR" ? "\u20B9" : "$";
    return `${symbol}${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View and download your plan invoices
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.items?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No invoices yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">
                      Invoice #
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-right px-4 py-3 font-medium">
                      Amount
                    </th>
                    <th className="text-left px-4 py-3 font-medium">
                      Payment
                    </th>
                    <th className="text-right px-4 py-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((invoice: Invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(invoice.generated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center text-xs font-medium text-foreground">
                          {invoice.invoice_type === "PLAN_SUBSCRIPTION"
                            ? "Plan"
                            : "Purchase"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatAmount(invoice.total_amount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {invoice.payment_method || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={invoice.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
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
          )}
        </CardContent>
      </Card>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * data.limit + 1}&ndash;
            {Math.min(page * data.limit, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * data.limit >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

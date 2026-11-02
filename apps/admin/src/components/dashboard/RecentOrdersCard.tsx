"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";

import type { RecentOrder } from "../../lib/types/dashboard";

interface RecentOrdersCardProps {
  orders: RecentOrder[];
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function statusVariant(status: string) {
  if (status === "PAID") return "default" as const;
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED")
    return "destructive" as const;
  return "secondary" as const;
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "INR") return `₹${num.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${num.toLocaleString("en-US")}`;
  return `${currency} ${num.toLocaleString()}`;
}

export function RecentOrdersCard({ orders }: RecentOrdersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardDescription>Latest payment orders</CardDescription>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No orders yet
          </p>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div
                key={o.id}
                className="flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {o.member_name || o.member_email || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    #{o.order_number}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold">
                    {formatCurrency(o.total_amount, o.currency)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={statusVariant(o.status)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {o.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTimeAgo(o.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

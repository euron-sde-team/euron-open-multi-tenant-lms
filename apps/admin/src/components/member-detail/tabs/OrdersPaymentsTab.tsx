"use client";

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@open-mtlms/core";
import { CreditCard, RotateCcw, Ticket } from "lucide-react";

import {
  useMemberOrders,
  useMemberRefunds,
  useMemberCouponRedemptions,
} from "../../../lib/hooks/use-members";
import type {
  MemberOrder,
  MemberRefund,
  MemberCouponRedemption,
} from "../../../lib/types/members";
import { MemberDataTable, type Column } from "../shared/MemberDataTable";
import { StatusBadge } from "../shared/StatusBadge";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);
  if (currency === "INR") return `₹${num.toLocaleString("en-IN")}`;
  if (currency === "USD") return `$${num.toLocaleString("en-US")}`;
  return `${currency} ${num.toLocaleString()}`;
}

interface OrdersPaymentsTabProps {
  memberId: string;
  enabled: boolean;
}

export function OrdersPaymentsTab({ memberId, enabled }: OrdersPaymentsTabProps) {
  const { data: orders, isLoading: loadingO } = useMemberOrders(memberId);
  const { data: refunds, isLoading: loadingR } = useMemberRefunds(memberId, enabled);
  const { data: coupons, isLoading: loadingC } = useMemberCouponRedemptions(memberId, enabled);

  const orderColumns: Column<MemberOrder>[] = [
    { key: "number", label: "Order #", render: (o) => <span className="font-mono text-xs">{o.order_number}</span> },
    { key: "type", label: "Type", render: (o) => <Badge variant="outline" className="text-[10px]">{o.order_type.replace(/_/g, " ")}</Badge> },
    { key: "base", label: "Base", align: "right", render: (o) => <span className="text-muted-foreground">{formatCurrency(o.base_amount, o.currency)}</span> },
    { key: "discount", label: "Discount", align: "right", render: (o) => {
      const disc = parseFloat(o.discount_amount);
      return disc > 0 ? <span className="text-emerald-600">-{formatCurrency(o.discount_amount, o.currency)}</span> : <span className="text-muted-foreground">-</span>;
    }},
    { key: "total", label: "Total", align: "right", render: (o) => <span className="font-medium">{formatCurrency(o.total_amount, o.currency)}</span> },
    { key: "coupon", label: "Coupon", render: (o) => o.coupon_code_snapshot ? <Badge variant="secondary" className="text-[10px]">{o.coupon_code_snapshot}</Badge> : <span className="text-muted-foreground">-</span> },
    { key: "gateway", label: "Gateway", render: (o) => <span className="text-muted-foreground text-xs">{o.gateway_provider_name ?? "-"}</span> },
    { key: "status", label: "Status", render: (o) => <StatusBadge status={o.status} /> },
    { key: "date", label: "Date", render: (o) => <span className="text-muted-foreground">{formatDate(o.paid_at || o.created_at)}</span> },
  ];

  const refundColumns: Column<MemberRefund>[] = [
    { key: "order", label: "Order #", render: (r) => <span className="font-mono text-xs">{r.order_number}</span> },
    { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-medium text-destructive">{formatCurrency(r.amount, "INR")}</span> },
    { key: "reason", label: "Reason", render: (r) => <span className="text-muted-foreground">{r.reason || "-"}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "processed", label: "Processed", render: (r) => <span className="text-muted-foreground">{r.processed_at ? formatDate(r.processed_at) : "Pending"}</span> },
    { key: "created", label: "Initiated", render: (r) => <span className="text-muted-foreground">{formatDate(r.created_at)}</span> },
  ];

  const couponColumns: Column<MemberCouponRedemption>[] = [
    { key: "code", label: "Coupon Code", render: (c) => <Badge variant="secondary" className="text-[10px] font-mono">{c.coupon_code}</Badge> },
    { key: "type", label: "Discount Type", render: (c) => <span>{c.coupon_discount_type === "PERCENTAGE" ? `${c.coupon_discount_value}%` : formatCurrency(c.coupon_discount_value, c.currency)}</span> },
    { key: "saved", label: "Amount Saved", align: "right", render: (c) => <span className="font-medium text-emerald-600">{formatCurrency(c.discount_amount, c.currency)}</span> },
    { key: "order", label: "Order #", render: (c) => <span className="font-mono text-xs">{c.order_number}</span> },
    { key: "date", label: "Used On", render: (c) => <span className="text-muted-foreground">{formatDate(c.created_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Payment History
          </CardTitle>
          <CardDescription>All payment orders from this student</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberDataTable columns={orderColumns} data={orders} isLoading={loadingO} emptyMessage="No orders yet." emptyIcon={CreditCard} keyExtractor={(o) => o.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" /> Refunds
          </CardTitle>
          <CardDescription>Refund requests and history</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberDataTable columns={refundColumns} data={refunds} isLoading={loadingR} emptyMessage="No refunds." emptyIcon={RotateCcw} keyExtractor={(r) => r.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" /> Coupon Usage
          </CardTitle>
          <CardDescription>Coupons redeemed by this student</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberDataTable columns={couponColumns} data={coupons} isLoading={loadingC} emptyMessage="No coupons used yet." emptyIcon={Ticket} keyExtractor={(c) => c.id} />
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Badge } from "@open-mtlms/core";

const statusVariantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  // Common
  ACTIVE: "default",
  COMPLETED: "default",
  PAID: "default",
  ISSUED: "default",
  CONFIRMED: "default",
  REPLIED: "default",
  OPEN: "default",
  // Neutral / pending
  PENDING: "secondary",
  IN_PROGRESS: "secondary",
  PROCESSING: "secondary",
  DRAFT: "secondary",
  INITIATED: "secondary",
  CREATED: "secondary",
  PAYMENT_PENDING: "secondary",
  // Warning / expired
  EXPIRED: "outline",
  CLOSED: "outline",
  RESCHEDULED: "outline",
  NO_SHOW: "outline",
  TRIALING: "outline",
  PAST_DUE: "outline",
  // Danger
  CANCELLED: "destructive",
  SUSPENDED: "destructive",
  DEACTIVATED: "destructive",
  FAILED: "destructive",
  REVOKED: "destructive",
  REVERSED: "destructive",
  REFUNDED: "destructive",
  REFUND_INITIATED: "destructive",
  PARTIALLY_REFUNDED: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = statusVariantMap[status] ?? "secondary";
  return (
    <Badge variant={variant} className="text-[10px]">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

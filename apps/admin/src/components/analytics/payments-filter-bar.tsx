"use client";

import { Button, Input } from "@open-mtlms/core";
import { X } from "lucide-react";

import type { PaymentFilters } from "@/lib/api/analytics";

import { MultiSelectDropdown, type MultiSelectOption } from "./multi-select-dropdown";

const STATUS_OPTIONS: MultiSelectOption[] = [
  { id: "PAID", label: "Paid" },
  { id: "PAYMENT_PENDING", label: "Pending" },
  { id: "CREATED", label: "Created" },
  { id: "FAILED", label: "Failed" },
  { id: "EXPIRED", label: "Expired" },
  { id: "REFUNDED", label: "Refunded" },
  { id: "PARTIALLY_REFUNDED", label: "Partially refunded" },
  { id: "REFUND_INITIATED", label: "Refund initiated" },
];

const TYPE_OPTIONS: MultiSelectOption[] = [
  { id: "COURSE", label: "Course" },
  { id: "BOOK", label: "Book" },
  { id: "BUNDLE", label: "Bundle" },
  { id: "CART", label: "Cart" },
  { id: "WEBINAR", label: "Webinar" },
  { id: "PRODUCT_HUB_ITEM", label: "Hub item" },
  { id: "PRODUCT_HUB_PACKAGE", label: "Hub package" },
];

export function PaymentsFilterBar({
  value,
  onChange,
}: {
  value: PaymentFilters;
  onChange: (next: PaymentFilters) => void;
}) {
  const set = (patch: Partial<PaymentFilters>) => onChange({ ...value, ...patch });
  const hasAny =
    !!value.statuses?.length ||
    !!value.orderTypes?.length ||
    value.minAmount != null ||
    value.maxAmount != null;

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
      <MultiSelectDropdown
        label="Status"
        options={STATUS_OPTIONS}
        selected={value.statuses ?? []}
        onChange={(ids) => set({ statuses: ids })}
        width="w-56"
      />
      <MultiSelectDropdown
        label="Type"
        options={TYPE_OPTIONS}
        selected={value.orderTypes ?? []}
        onChange={(ids) => set({ orderTypes: ids })}
        width="w-56"
      />

      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">Amount</span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Min"
            value={value.minAmount ?? ""}
            onChange={(e) =>
              set({ minAmount: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="h-9 w-24"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Max"
            value={value.maxAmount ?? ""}
            onChange={(e) =>
              set({ maxAmount: e.target.value === "" ? undefined : Number(e.target.value) })
            }
            className="h-9 w-24"
          />
        </div>
      </div>

      {hasAny && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() => onChange({})}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

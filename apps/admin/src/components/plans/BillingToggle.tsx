"use client";

import { Badge, cn } from "@open-mtlms/core";

interface BillingToggleProps {
  billingCycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  onToggle: (cycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY") => void;
  yearlySavingsPercent?: number;
  twoYearlySavingsPercent?: number;
}

export function BillingToggle({
  billingCycle,
  onToggle,
  yearlySavingsPercent,
  twoYearlySavingsPercent,
}: BillingToggleProps) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onToggle("MONTHLY")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition-colors",
          billingCycle === "MONTHLY"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onToggle("YEARLY")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition-colors",
          billingCycle === "YEARLY"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        Yearly
      </button>
      {yearlySavingsPercent != null && yearlySavingsPercent > 0 && (
        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Save {yearlySavingsPercent}%
        </Badge>
      )}
      <button
        type="button"
        onClick={() => onToggle("TWO_YEARLY")}
        className={cn(
          "rounded-full px-5 py-2 text-sm font-medium transition-colors",
          billingCycle === "TWO_YEARLY"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        2 Yearly
      </button>
      {twoYearlySavingsPercent != null && twoYearlySavingsPercent > 0 && (
        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Save {twoYearlySavingsPercent}%
        </Badge>
      )}
    </div>
  );
}

"use client";

import { Badge, cn } from "@open-mtlms/core";
import { Check, Minus, X } from "lucide-react";

import type { PlanProductItem } from "@/lib/api/plans";

interface FeatureValueCellProps {
  product: PlanProductItem | null;
  /** Current usage for COUNT/LIMIT products (from entitlements) */
  currentUsed?: number;
  isCurrentPlan?: boolean;
}

export function FeatureValueCell({
  product,
  currentUsed,
  isCurrentPlan,
}: FeatureValueCellProps) {
  // Feature not included in this plan
  if (!product) {
    return (
      <div className="flex justify-center">
        <Minus className="text-muted-foreground/40 h-4 w-4" />
      </div>
    );
  }

  const { constraint_type, limit_value, is_unlimited, unit } = product;

  // BOOLEAN: checkmark or X
  if (constraint_type === "BOOLEAN") {
    const enabled = is_unlimited || limit_value >= 1;
    return (
      <div className="flex justify-center">
        {enabled ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <X className="text-muted-foreground/40 h-4 w-4" />
        )}
      </div>
    );
  }

  // COUNT or LIMIT
  if (is_unlimited) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Badge variant="secondary" className="text-xs font-normal">
          Unlimited
        </Badge>
      </div>
    );
  }

  const displayValue = unit ? `${limit_value} ${unit}` : `${limit_value}`;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("text-sm font-medium", isCurrentPlan && "text-primary")}>
        {displayValue}
      </span>
      {isCurrentPlan && currentUsed != null && currentUsed > 0 && (
        <span className="text-muted-foreground text-[11px]">
          {currentUsed} used
        </span>
      )}
    </div>
  );
}

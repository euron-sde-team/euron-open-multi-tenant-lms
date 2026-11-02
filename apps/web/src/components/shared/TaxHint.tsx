"use client";

import { useTaxConfig } from "@/lib/hooks/use-tax-config";

export function TaxHint() {
  const { taxMode, taxPercentage } = useTaxConfig();

  if (taxPercentage === 0) return null;

  return (
    <span className="text-muted-foreground text-xs">
      {taxMode === "EXCLUSIVE"
        ? `+ ${taxPercentage}% tax`
        : "incl. tax"}
    </span>
  );
}

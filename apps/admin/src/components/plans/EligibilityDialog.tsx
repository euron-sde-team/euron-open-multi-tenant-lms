"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { AlertTriangle, Loader2, Zap } from "lucide-react";

import type { PlanWithProducts } from "@/lib/api/plans";
import { usePlanEligibility } from "@/lib/hooks/use-plans";

interface EligibilityDialogProps {
  plan: PlanWithProducts | null;
  billingCycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  isOpen: boolean;
  onConfirm: (planVersionId: string, billingCycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY") => void;
  onCancel: () => void;
  isSubscribing: boolean;
}

function formatPrice(amount: number, currency: "INR" | "USD"): string {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function EligibilityDialog({
  plan,
  billingCycle,
  currency,
  isOpen,
  onConfirm,
  onCancel,
  isSubscribing,
}: EligibilityDialogProps) {
  const { data: eligibility, isLoading } = usePlanEligibility(
    isOpen && plan ? plan.id : undefined,
    currency
  );

  if (!plan) return null;

  const price =
    billingCycle === "TWO_YEARLY"
      ? currency === "INR" ? plan.price_two_yearly_inr : plan.price_two_yearly_usd
      : billingCycle === "YEARLY"
        ? currency === "INR" ? plan.price_yearly_inr : plan.price_yearly_usd
        : currency === "INR" ? plan.price_monthly_inr : plan.price_monthly_usd;

  const hasConflicts =
    eligibility && !eligibility.can_subscribe && eligibility.conflicts && eligibility.conflicts.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isLoading
              ? "Checking eligibility..."
              : hasConflicts
                ? "Cannot switch plan"
                : `Subscribe to ${plan.plan_name}`}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Verifying your current usage against the new plan limits."
              : hasConflicts
                ? "Your current usage exceeds some limits in this plan. Please resolve these conflicts first."
                : `${formatPrice(price, currency)}/${billingCycle === "MONTHLY" ? "month" : billingCycle === "YEARLY" ? "year" : "2 years"} + 18% taxes applicable. You'll be redirected to complete payment.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {hasConflicts && eligibility.conflicts && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-sm">
                Resolve the following conflicts before switching plans:
              </span>
            </div>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-3 py-2 text-left font-medium">Feature</th>
                    <th className="px-3 py-2 text-center font-medium">Your Usage</th>
                    <th className="px-3 py-2 text-center font-medium">Plan Limit</th>
                    <th className="px-3 py-2 text-left font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibility.conflicts.map((conflict) => {
                    const excess = conflict.current_used - conflict.new_limit;
                    return (
                      <tr key={conflict.product_code} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium">
                          {conflict.feature_name}
                        </td>
                        <td className="px-3 py-2 text-center text-red-600 dark:text-red-400">
                          {conflict.current_used}
                          {conflict.unit ? ` ${conflict.unit}` : ""}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {conflict.new_limit}
                          {conflict.unit ? ` ${conflict.unit}` : ""}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-xs">
                          Reduce by {excess}
                          {conflict.unit ? ` ${conflict.unit}` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubscribing}>
            Cancel
          </Button>
          {!isLoading && !hasConflicts && (
            <Button
              onClick={() => onConfirm(plan.id, billingCycle)}
              disabled={isSubscribing}
            >
              {isSubscribing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3.5 w-3.5" />
              )}
              Confirm &amp; Pay
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

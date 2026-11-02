"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { useEffect } from "react";

import type { RenewalStatus } from "@/lib/api/subscriptions";
import {
  invalidateAfterRenewal,
  useRenewalStatus,
  useStartRenewal,
} from "@/lib/hooks/use-subscriptions";
import { useRenewalPaymentStore } from "@/lib/stores/renewal-payment-store";

/** Stop polling for the webhook after this long; the strip stays until it lands. */
const AWAIT_PAYMENT_MS = 10 * 60 * 1000;

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

/**
 * The last day a period covers. Ends are stored as the instant the period
 * runs out, usually midnight IST, so the raw date reads one day late
 * ("expired 19 Jul" for a plan paid through 18 Jul).
 */
export function formatEndDay(iso: string): string {
  return formatDay(new Date(Date.parse(iso) - 1000).toISOString());
}

export function cycleWord(cycle: RenewalStatus["billing_cycle"], n = 1): string {
  const word = cycle === "MONTHLY" ? "month" : cycle === "YEARLY" ? "year" : "2-year term";
  return n === 1 ? word : `${word}s`;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between"}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * The renewal breakdown, then off to Razorpay. Every figure here comes from the
 * backend quote, the same numbers Razorpay is told to charge, so what the
 * tenant reads is what they pay.
 */
export function RenewalPayDialog({
  renewal,
  open,
  onOpenChange,
}: {
  renewal: RenewalStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const startRenewal = useStartRenewal();
  const startAwaiting = useRenewalPaymentStore((s) => s.start);

  const r = renewal;
  const money = (n: number) => formatMoney(n, r.currency);
  const deferred = new Date(r.charge_on).getTime() > Date.now() + 60_000;

  async function pay() {
    try {
      const result = await startRenewal.mutateAsync();
      if (!result.short_url) throw new Error("Payment link was not created. Please try again.");
      window.open(result.short_url, "_blank", "noopener,noreferrer");
      startAwaiting();
      onOpenChange(false);
      toast({
        title: "Payment opened in a new tab",
        description: "Complete it on Razorpay, then come back here. This page updates by itself.",
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Could not start the payment",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renew your {r.plan_name} plan</DialogTitle>
          <DialogDescription>
            {r.state === "DUE_SOON"
              ? `Your plan is paid until ${formatEndDay(r.period_end)}. Set up autopay now so nothing stops.`
              : `Your plan expired on ${formatEndDay(r.period_end)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border p-4 text-sm">
          <Row label={`${r.plan_name}, per ${cycleWord(r.billing_cycle)}`} value={money(r.cycle_base)} />
          <Row label="GST (18%)" value={money(r.cycle_gst)} />
          <Row label={`Total per ${cycleWord(r.billing_cycle)}`} value={money(r.cycle_total)} strong />

          {r.back_due_cycles > 0 && r.back_due_from && r.back_due_to && (
            <div className="border-t pt-2">
              <Row
                label={`Overdue: ${r.back_due_cycles} ${cycleWord(r.billing_cycle, r.back_due_cycles)} (${formatDay(r.back_due_from)} to ${formatEndDay(r.back_due_to)})`}
                value={money(r.back_due_total)}
              />
            </div>
          )}

          <div className="border-t pt-2">
            <Row
              label="Charged today"
              value={r.first_charge_total > 0 ? money(r.first_charge_total) : money(0)}
              strong
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {deferred
            ? `Autopay then charges ${money(r.cycle_total)} every ${cycleWord(r.billing_cycle)}, starting ${formatEndDay(r.charge_on)}.`
            : `Autopay then charges ${money(r.cycle_total)} every ${cycleWord(r.billing_cycle)} from today.`}{" "}
          {r.first_charge_total === 0 &&
            "Razorpay may place a small verification hold to set up autopay; it is refunded. "}
          You can cancel autopay anytime from Plans.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={pay} disabled={startRenewal.isPending}>
            {startRenewal.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {r.first_charge_total > 0
              ? `Pay ${money(r.first_charge_total)}`
              : "Set up autopay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Watches for a renewal payment to land and says so. Mounted once in the
 * dashboard layout, so it outlives the strip / lock screen that started the
 * payment (both vanish the moment the payment is confirmed).
 */
export function RenewalPaymentWatcher() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awaitingSince, stop } = useRenewalPaymentStore();
  const { data: renewal } = useRenewalStatus({ awaitingPayment: awaitingSince !== null });

  useEffect(() => {
    if (awaitingSince === null) return;
    // The webhook confirmed it: nothing is due any more.
    if (renewal === null) {
      stop();
      invalidateAfterRenewal(queryClient);
      toast({ title: "Payment confirmed", description: "Your plan is renewed. Thank you!" });
      return;
    }
    // Stop polling after a while; the strip stays until the webhook lands.
    if (Date.now() - awaitingSince > AWAIT_PAYMENT_MS) stop();
  }, [renewal, awaitingSince, stop, queryClient, toast]);

  return null;
}

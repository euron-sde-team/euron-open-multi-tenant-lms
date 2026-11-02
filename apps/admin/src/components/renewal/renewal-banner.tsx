"use client";

import { Button } from "@open-mtlms/core";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { useRenewalStatus } from "@/lib/hooks/use-subscriptions";

import { formatDay, formatEndDay, formatMoney, RenewalPayDialog } from "./renewal-pay-dialog";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Matches the backend: locked once MORE than 7 full days past expiry. */
const LOCK_AFTER_DAYS = 8;

/**
 * The red "payment due" strip, on every dashboard page, until the plan is paid.
 *
 * Shown for a plan nothing renews on its own (assigned from core-admin, or an
 * autopay that lapsed) from 30 days before expiry. Past 7 days overdue the
 * lock screen covers the dashboard (SubscriptionStatusOverlay). Staff who can't pay are
 * told who can, rather than offered a button that would fail.
 */
export function RenewalBanner() {
  const { data: renewal } = useRenewalStatus();
  const [open, setOpen] = useState(false);

  // LOCKED still renders: on the pages the lock leaves open (Plans, invoices)
  // this strip is the way to pay. Everywhere else the lock screen covers it.
  if (!renewal) return null;

  const money = (n: number) => formatMoney(n, renewal.currency);
  const lockOn = new Date(new Date(renewal.period_end).getTime() + LOCK_AFTER_DAYS * DAY_MS);

  const message =
    renewal.state === "DUE_SOON"
      ? `Your ${renewal.plan_name} plan expires on ${formatEndDay(renewal.period_end)} (${renewal.days_left} day${renewal.days_left === 1 ? "" : "s"} left). Renew now to keep your dashboard running: ${money(renewal.cycle_total)} incl. GST, ${renewal.first_charge_total > 0 ? "charged today" : `charged on ${formatEndDay(renewal.charge_on)}`}.`
      : renewal.state === "OVERDUE"
        ? `Your ${renewal.plan_name} plan expired on ${formatEndDay(renewal.period_end)}. Pay ${money(renewal.first_charge_total)} (incl. GST) now to continue. Your dashboard will be locked on ${formatDay(lockOn.toISOString())} if unpaid.`
        : `Your ${renewal.plan_name} plan expired on ${formatEndDay(renewal.period_end)} and your dashboard is locked. Pay ${money(renewal.first_charge_total)} (incl. GST) to unlock it.`;

  return (
    <div className="flex flex-col gap-3 border-b bg-red-600 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">
            {renewal.state === "DUE_SOON" ? "Plan renewal due" : "Payment overdue"}
          </p>
          <p className="text-sm text-white/90">
            {message}
            {!renewal.can_pay && " Please ask your account owner to renew."}
          </p>
        </div>
      </div>
      {renewal.can_pay && (
        <>
          <Button
            size="sm"
            className="shrink-0 bg-white text-red-700 hover:bg-white/90"
            onClick={() => setOpen(true)}
          >
            {renewal.state === "DUE_SOON" ? "Renew now" : "Pay now"}
          </Button>
          <RenewalPayDialog renewal={renewal} open={open} onOpenChange={setOpen} />
        </>
      )}
    </div>
  );
}

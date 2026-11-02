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
import { AlertTriangle, Loader2 } from "lucide-react";

import type { CurrentSubscription } from "@/lib/api/subscriptions";

interface CancelSubscriptionDialogProps {
  subscription: CurrentSubscription;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function CancelSubscriptionDialog({
  subscription,
  isOpen,
  onConfirm,
  onCancel,
  isPending,
}: CancelSubscriptionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Cancel Subscription</DialogTitle>
          <DialogDescription className="text-center">
            Are you sure you want to cancel your{" "}
            <span className="font-medium text-foreground">
              {subscription.plan_name_snapshot}
            </span>{" "}
            plan?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border p-4 text-sm">
          <p className="text-muted-foreground">What will happen:</p>
          <ul className="text-muted-foreground space-y-1.5 pl-4">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Your access continues until{" "}
              <span className="font-medium text-foreground">
                {formatDate(subscription.current_period_end)}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              After that, LMS features will be disabled
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
              Your data will be preserved, you can reactivate anytime
            </li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Keep Subscription
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Yes, Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

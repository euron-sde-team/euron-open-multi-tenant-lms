"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@open-mtlms/core";
import { Loader2 } from "lucide-react";

interface PaymentProcessingDialogProps {
  isOpen: boolean;
}

export function PaymentProcessingDialog({ isOpen }: PaymentProcessingDialogProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="sm:max-w-md"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="text-primary h-12 w-12 animate-spin" />
          <div className="space-y-1 text-center">
            <DialogTitle>Processing your payment</DialogTitle>
            <DialogDescription>
              Please wait while we activate your subscription. This may take up to
              10 seconds.
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

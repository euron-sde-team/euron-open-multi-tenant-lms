"use client";

import { EasyCheckoutModal } from "./easy-checkout-modal";
import type { useBuyNowGuard } from "@/lib/hooks/use-buy-now-guard";

type Guard = ReturnType<typeof useBuyNowGuard>;

/**
 * Renders the EasyCheckoutModal driven by a useBuyNowGuard() return value.
 * Use this at the JSX root of any page that wraps Buy Now buttons in `guard.run(...)`.
 */
export function EasyCheckoutGuardModal({ guard }: { guard: Guard }) {
  return (
    <EasyCheckoutModal
      open={guard.modalOpen}
      onOpenChange={(o) => {
        if (!o) guard.onClose();
      }}
      onSuccess={guard.onSuccess}
    />
  );
}

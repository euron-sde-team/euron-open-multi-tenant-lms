"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { userAuthApi } from "@/lib/api/auth";
import { NameConfirmationModal } from "./name-confirmation-modal";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];
// Never interrupt an in-progress purchase: the name modal is a hard block, so
// showing it over checkout/payment would stop the user reaching the gateway.
const CHECKOUT_ROUTES = [
  "/checkout",
  "/cart",
  "/payment-bridge",
  "/payment-callback",
];
const SUPPRESSED_ROUTES = [...AUTH_ROUTES, ...CHECKOUT_ROUTES];

/**
 * Shows the one-time name confirmation modal when the tenant admin has enabled it
 * and the member has not confirmed their name yet. Once the member confirms,
 * `name_confirmed_at` is set and the modal never shows again.
 */
export function NameConfirmationGuard() {
  const member = useUserAuthStore((s) => s.member);
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  const isSuppressedRoute = SUPPRESSED_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  useEffect(() => {
    if (!isAuthenticated || isSuppressedRoute) return;

    userAuthApi
      .getConfig()
      .then((config) => {
        setEnabled(config.nameConfirmationEnabled);
      })
      .catch(() => {});
  }, [isAuthenticated, isSuppressedRoute]);

  const showModal =
    isAuthenticated && enabled && !!member && !member.nameConfirmedAt && !isSuppressedRoute;

  return <NameConfirmationModal open={showModal} />;
}

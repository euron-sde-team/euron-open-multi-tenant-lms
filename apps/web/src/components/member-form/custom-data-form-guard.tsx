"use client";

import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { memberFormKeys, useMemberForms } from "@/lib/hooks/use-member-form";
import { useMemberFormDismissStore } from "@/lib/stores/member-form-dismiss-store";
import { useUserAuthStore } from "@/lib/stores/auth-store";
import { CustomDataFormModal } from "./custom-data-form-modal";

// Routes where the custom data form must never appear. Auth routes (no member
// yet) plus the entire payment journey: the /checkout namespace (/checkout,
// /checkout/direct, /checkout/success), /payment-bridge (opens the Razorpay
// modal), and /payment-callback (post-payment return). Easy checkout creates
// an account mid-purchase, so we must keep the whole payment flow frictionless.
// A MANDATORY form still surfaces on the next ordinary page the buyer lands on,
// so the requirement is only deferred, never dropped.
const SUPPRESSED_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/checkout",
  "/payment-bridge",
  "/payment-callback",
];

interface Props {
  children: React.ReactNode;
}

export function CustomDataFormGuard({ children }: Props) {
  const member = useUserAuthStore((s) => s.member);
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const logout = useUserAuthStore((s) => s.logout);
  const pathname = usePathname();
  const qc = useQueryClient();

  const dismiss = useMemberFormDismissStore((s) => s.dismiss);
  // Subscribe to the dismissal MAP (not the getter fn). The getter is a stable
  // reference, so selecting it never re-renders when a form is dismissed.
  // which left the controlled modal open. Selecting the map (a fresh object on
  // each dismiss) re-renders the guard so `nextForm` recomputes and the
  // dismissed form drops out.
  const dismissedMap = useMemberFormDismissStore((s) => s.dismissedAt);

  const isSuppressedRoute = SUPPRESSED_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );
  const enabled = isAuthenticated && !isSuppressedRoute && !!member;

  const { data } = useMemberForms(enabled, member?.id);

  // Walk the admin-defined sequence and surface the first form this member
  // still needs to see. MANDATORY forms always show until completed; OPTIONAL
  // forms honour a per-form, per-user dismissal cooldown.
  const nextForm =
    enabled && member && data
      ? data.forms.find((form) => {
          if (form.completed) return false;
          if (form.mode === "MANDATORY") return true;
          const dismissedAt = dismissedMap[`${member.id}:${form.id}`];
          if (
            dismissedAt &&
            Date.now() - dismissedAt <
              form.repromptAfterHours * 60 * 60 * 1000
          ) {
            return false;
          }
          return true;
        })
      : undefined;

  if (!nextForm || !member) {
    return <>{children}</>;
  }

  // On complete or dismiss, refetch so the queue advances to the next form (a
  // completed form drops out server-side; a dismissed optional drops out via
  // the cooldown above).
  const handleCompleted = () => {
    qc.invalidateQueries({ queryKey: memberFormKeys.config(member.id) });
  };

  return (
    <>
      {children}
      <CustomDataFormModal
        key={nextForm.id}
        open
        form={nextForm}
        onCompleted={handleCompleted}
        onDismiss={() => dismiss(`${member.id}:${nextForm.id}`)}
        onLogout={logout}
      />
    </>
  );
}

"use client";

import { useEffect } from "react";

import { onAccountSuspended } from "@/lib/api/api-client";
import { toast } from "@/components/ui/use-toast";

/**
 * Surfaces the "your account was suspended" toast when the API client detects a
 * 401 carrying ACCOUNT_SUSPENDED / ACCOUNT_DEACTIVATED.
 *
 * Lives in the root layout on purpose: the same 401 logs the member out, which
 * makes AuthGuard redirect to /login. A toast owned by a page component would be
 * unmounted by that navigation before anyone read it; one owned by the root
 * layout survives it and is still on screen when the login page paints.
 *
 * Renders nothing, it exists only to bridge the API client's module-level
 * emitter (the Axios interceptor cannot call a hook) into React.
 */
export function AccountStatusToast() {
  useEffect(
    () =>
      onAccountSuspended((description) => {
        toast({
          variant: "destructive",
          title: "Account suspended",
          description,
        });
      }),
    [],
  );

  return null;
}

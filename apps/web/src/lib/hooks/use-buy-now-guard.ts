"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { userAuthApi } from "../api/auth";
import { useUserAuthStore } from "../stores/auth-store";

interface QueuedClick {
  action: () => void;
  redirectTo?: string;
}

/**
 * Gates Buy Now style click handlers.
 *  - logged in: runs the action
 *  - logged out, Easy Checkout enabled: opens the EasyCheckoutModal which captures
 *    email + phone, creates an account (or recovers via OTP if already taken),
 *    persists the JWT, then resumes the original action
 *  - logged out, Easy Checkout disabled: routes to /login?redirect=... (today's behaviour)
 *  - cold-load (auth-config still resolving): the click is QUEUED, not dropped.
 *    once the config arrives the queued click is replayed against the resolved
 *    branch. This keeps the first click on a page from being silently lost when
 *    the network hasn't returned the auth config yet.
 *
 * The pending action is held in component state. Each call to run() re-checks
 * isAuthenticated, so a parallel login from another tab takes precedence.
 */
export function useBuyNowGuard() {
  const router = useRouter();
  const isAuthenticated = useUserAuthStore((s) => s.isAuthenticated);
  const cfgQuery = useQuery({
    queryKey: ["auth-config"],
    queryFn: () => userAuthApi.getConfig(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const cfg = cfgQuery.data;
  // Ready means the config has resolved (either from initialData or from a
  // completed network request). Until then, callers must NOT branch on
  // `easyCheckoutEnabled` because that value is `undefined` and any redirect
  // to `/login` would be premature.
  const isReady = cfgQuery.isSuccess || cfgQuery.isFetched;

  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  // Cold-load queue: clicks that arrive before the auth-config resolves are
  // parked here, then replayed by the effect below once we know whether to
  // open the modal or redirect. Using a ref so a click and the resolution
  // arriving in the same tick don't drop each other via stale-state rewrite.
  const coldQueueRef = useRef<QueuedClick | null>(null);
  const [coldQueueVersion, setColdQueueVersion] = useState(0);

  const dispatch = useCallback(
    (action: () => void, redirectTo?: string) => {
      if (isAuthenticated) {
        action();
        return;
      }
      if (cfg?.easyCheckoutEnabled) {
        setPendingAction(() => action);
        return;
      }
      const target =
        redirectTo ??
        (typeof window !== "undefined" ? window.location.pathname : "/");
      router.push(`/login?redirect=${encodeURIComponent(target)}`);
    },
    [isAuthenticated, cfg?.easyCheckoutEnabled, router]
  );

  // Drain the cold-load queue once the config resolves.
  useEffect(() => {
    if (!isReady) return;
    const queued = coldQueueRef.current;
    if (!queued) return;
    coldQueueRef.current = null;
    dispatch(queued.action, queued.redirectTo);
  }, [isReady, coldQueueVersion, dispatch]);

  const run = useCallback(
    (action: () => void, redirectTo?: string) => {
      if (!isReady) {
        // Queue the click; the effect above replays it once auth-config arrives.
        coldQueueRef.current = { action, redirectTo };
        // Bump the version so the effect runs even if `isReady` was already
        // resolving when the click arrived (covers the rare race where
        // queue gets set right as React commits an `isReady=true` render).
        setColdQueueVersion((v) => v + 1);
        return;
      }
      dispatch(action, redirectTo);
    },
    [isReady, dispatch]
  );

  const onSuccess = useCallback(() => {
    setPendingAction((prev) => {
      prev?.();
      return null;
    });
  }, []);

  const onClose = useCallback(() => {
    setPendingAction(null);
  }, []);

  return {
    modalOpen: pendingAction !== null,
    /**
     * `undefined` until the config query resolves. Consumers MUST treat
     * `undefined` as "do not branch yet" instead of "disabled" so a slow
     * network does not wrongly redirect a user out of an easy-checkout flow.
     */
    easyCheckoutEnabled: isReady ? Boolean(cfg?.easyCheckoutEnabled) : undefined,
    isReady,
    run,
    onSuccess,
    onClose,
  };
}

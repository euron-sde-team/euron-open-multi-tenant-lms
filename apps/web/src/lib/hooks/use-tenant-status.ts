import { useSyncExternalStore } from "react";
import {
  getTenantStatusSnapshot,
  onTenantStatusChange,
  type TenantStatusEvent,
} from "@/lib/api/api-client";

let snapshot: TenantStatusEvent | null = getTenantStatusSnapshot();

const unsubscribe = onTenantStatusChange((status) => {
  snapshot = status;
});

// Keep reference alive, module-level subscription
void unsubscribe;

function subscribe(callback: () => void): () => void {
  return onTenantStatusChange(() => {
    snapshot = getTenantStatusSnapshot();
    callback();
  });
}

function getSnapshot(): TenantStatusEvent | null {
  return snapshot;
}

function getServerSnapshot(): TenantStatusEvent | null {
  return null;
}

export function useTenantStatus() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    isSuspended: status === "suspended",
    isOffline: status === "offline",
    canPurchase: status === null,
  };
}

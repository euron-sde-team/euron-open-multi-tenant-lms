"use client";

import { createContext, useContext } from "react";

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  customDomain?: string;
  logoUrl?: string;
  faviconUrl?: string;
  isActive: boolean;
  settings?: Record<string, unknown>;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  isLoading: boolean;
}

export const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  isLoading: true,
});

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

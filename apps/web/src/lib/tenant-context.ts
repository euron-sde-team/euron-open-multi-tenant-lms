"use client";

import { createContext, useContext } from "react";
import type { ThemeConfig } from "@open-mtlms/shared";

// Tenant information
export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  isActive: boolean;
  plan: string;
  settings?: TenantSettings;
  theme?: ThemeConfig;
}

// Tenant settings
export interface TenantSettings {
  allowCustomDomain?: boolean;
  maxCourses?: number;
  maxStudents?: number;
  features?: string[];
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  analytics?: {
    googleAnalyticsId?: string;
    facebookPixelId?: string;
  };
}

// Context value
interface TenantContextValue {
  tenant: TenantInfo | null;
  isLoading: boolean;
}

// Create context
export const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  isLoading: true,
});

// Hook to use tenant context
export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

// Get tenant from headers (server-side)
export function getTenantFromHeaders(headers: Headers): { tenantId: string | null; tenantSlug: string | null } {
  return {
    tenantId: headers.get("x-tenant-id"),
    tenantSlug: headers.get("x-tenant-slug"),
  };
}

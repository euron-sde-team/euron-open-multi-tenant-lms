"use client";

import type { SidebarNavItem } from "@open-mtlms/shared";
import React, { createContext, useContext } from "react";

import { useSidebarNav } from "@/lib/hooks/use-sidebar-nav";

interface TenantLayoutContextValue {
  sidebarNavItems: SidebarNavItem[];
  isLoading: boolean;
}

const TenantLayoutContext = createContext<TenantLayoutContextValue>({
  sidebarNavItems: [],
  isLoading: true,
});

export function useTenantLayout() {
  return useContext(TenantLayoutContext);
}

export function TenantLayoutProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSidebarNav();

  const value: TenantLayoutContextValue = {
    sidebarNavItems: data?.items ?? [],
    isLoading,
  };

  return (
    <TenantLayoutContext.Provider value={value}>
      {children}
    </TenantLayoutContext.Provider>
  );
}

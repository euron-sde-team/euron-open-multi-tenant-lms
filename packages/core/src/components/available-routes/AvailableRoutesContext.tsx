"use client";

/**
 * AvailableRoutesContext
 *
 * Provides tenant-scoped available routes for the Button Generation Engine.
 * Used by EditableClickable and link editors to show only valid internal routes.
 *
 * Usage:
 *   // Admin: fetch from API
 *   <AvailableRoutesProvider fetchUrl="/api/v1/routes/available">
 *     <Editor />
 *   </AvailableRoutesProvider>
 *
 *   // Web: use routes from template response
 *   <AvailableRoutesProvider initialRoutes={pageConfig.availableRoutes}>
 *     <Page />
 *   </AvailableRoutesProvider>
 */

import type { AvailableRoute, AvailableRoutesResponse } from "@open-mtlms/shared";
import * as React from "react";

// ============================================================================
// Types
// ============================================================================

export interface AvailableRoutesContextValue {
  /** All internal + system routes flattened for lookup */
  routes: AvailableRoute[];
  /** Internal routes only (tenant pages, courses, books) */
  internal: AvailableRoute[];
  /** System routes (login, signup, learn) */
  system: AvailableRoute[];
  /** Whether routes are loading (fetch mode) */
  isLoading: boolean;
  /** Refetch routes (fetch mode) */
  refetch: () => void;
  /** Check if a path is a valid internal route */
  isPathAvailable: (path: string) => boolean;
}

const defaultContextValue: AvailableRoutesContextValue = {
  routes: [],
  internal: [],
  system: [],
  isLoading: false,
  refetch: () => {},
  isPathAvailable: () => false,
};

const AvailableRoutesContext =
  React.createContext<AvailableRoutesContextValue>(defaultContextValue);

// ============================================================================
// Provider Props
// ============================================================================

export interface AvailableRoutesProviderProps {
  children: React.ReactNode;
  /** Pre-loaded routes (e.g. from template response). When provided, no fetch. */
  initialRoutes?: AvailableRoutesResponse | null;
  /** API URL to fetch routes (e.g. /api/v1/routes/available). Requires auth headers. */
  fetchUrl?: string;
  /** Headers to include when fetching (e.g. Authorization). Can be a function for dynamic values. */
  fetchHeaders?: Record<string, string> | (() => Record<string, string>);
}

// ============================================================================
// Provider
// ============================================================================

function AvailableRoutesProvider({
  children,
  initialRoutes,
  fetchUrl,
  fetchHeaders = {},
}: AvailableRoutesProviderProps) {
  const [routesData, setRoutesData] = React.useState<AvailableRoutesResponse | null>(
    initialRoutes ?? null
  );
  const [isLoading, setIsLoading] = React.useState(!initialRoutes && !!fetchUrl);

  const fetchRoutes = React.useCallback(async () => {
    if (!fetchUrl) return;
    setIsLoading(true);
    try {
      const headers = typeof fetchHeaders === "function" ? fetchHeaders() : (fetchHeaders ?? {});
      const res = await fetch(fetchUrl, { headers });
      if (!res.ok) throw new Error("Failed to fetch routes");
      const json = await res.json();
      const data = json.data ?? json;
      setRoutesData({
        internal: data.internal ?? [],
        system: data.system ?? [],
      });
    } catch (err) {
      console.error("[AvailableRoutes] Fetch failed:", err);
      setRoutesData({ internal: [], system: [] });
    } finally {
      setIsLoading(false);
    }
  }, [fetchUrl, fetchHeaders]);

  React.useEffect(() => {
    if (initialRoutes) {
      setRoutesData(initialRoutes);
      setIsLoading(false);
      return;
    }
    if (fetchUrl) {
      fetchRoutes();
    }
  }, [initialRoutes, fetchUrl, fetchRoutes]);

  const value = React.useMemo<AvailableRoutesContextValue>(() => {
    const internal = routesData?.internal ?? [];
    const system = routesData?.system ?? [];
    const routes = [...internal, ...system];
    const pathSet = new Set(routes.map((r) => r.path));

    return {
      routes,
      internal,
      system,
      isLoading,
      refetch: fetchRoutes,
      isPathAvailable: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        return pathSet.has(normalized);
      },
    };
  }, [routesData, isLoading, fetchRoutes]);

  return (
    <AvailableRoutesContext.Provider value={value}>{children}</AvailableRoutesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

function useAvailableRoutes(): AvailableRoutesContextValue {
  const context = React.useContext(AvailableRoutesContext);
  return context ?? defaultContextValue;
}

// ============================================================================
// Exports
// ============================================================================

export { AvailableRoutesContext, AvailableRoutesProvider, useAvailableRoutes };

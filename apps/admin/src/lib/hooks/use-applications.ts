import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { applicationsApi } from "../api/applications";
import { useApplicationStore } from "../stores/application-store";
import type {
  ResolvedApplication,
  ResolvedFeature,
  TenantApplication,
} from "../types/features";

/* ------------------------------------------------------------------ */
/*  Query key factory                                                  */
/* ------------------------------------------------------------------ */

export const applicationKeys = {
  all: ["applications"] as const,
  list: (tenantId: string) => [...applicationKeys.all, tenantId] as const,
  features: (tenantId: string, appCode?: string) =>
    [...applicationKeys.all, "features", tenantId, appCode] as const,
};

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch active applications for the tenant and auto-populate the store.
 */
export function useApplications(tenantId: string | undefined) {
  const setApplications = useApplicationStore((s) => s.setApplications);

  const query = useQuery<TenantApplication[]>({
    queryKey: applicationKeys.list(tenantId ?? ""),
    queryFn: () => applicationsApi.getApplications(),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 min cache – apps rarely change
  });

  // Sync result into Zustand store
  useEffect(() => {
    if (query.data) {
      setApplications(query.data);
    }
  }, [query.data, setApplications]);

  return query;
}

/**
 * Fetch resolved features for the selected application.
 */
export function useResolvedFeatures(
  tenantId: string | undefined,
  applicationCode: string | undefined
) {
  return useQuery<ResolvedApplication[]>({
    queryKey: applicationKeys.features(tenantId ?? "", applicationCode),
    queryFn: () => applicationsApi.getResolvedFeatures(applicationCode),
    enabled: !!tenantId && !!applicationCode,
    staleTime: 2 * 60 * 1000, // 2 min cache
  });
}

/**
 * Convenience hook: returns a Set of enabled feature keys for the selected app.
 * Re-derives whenever the query data changes.
 */
export function useEnabledFeatures(
  tenantId: string | undefined,
  applicationCode: string | undefined
): {
  enabledFeatures: Set<string>;
  featuresMap: Map<string, ResolvedFeature>;
  isLoading: boolean;
} {
  const { data, isLoading } = useResolvedFeatures(tenantId, applicationCode);

  const { enabledFeatures, featuresMap } = useMemo(() => {
    const enabled = new Set<string>();
    const fMap = new Map<string, ResolvedFeature>();

    if (!data) return { enabledFeatures: enabled, featuresMap: fMap };

    for (const app of data) {
      for (const feature of app.features) {
        fMap.set(feature.key, feature);
        if (feature.enabled) {
          enabled.add(feature.key);
        }
      }
    }

    return { enabledFeatures: enabled, featuresMap: fMap };
  }, [data]);

  return { enabledFeatures, featuresMap, isLoading };
}

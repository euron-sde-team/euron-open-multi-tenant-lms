import { create } from "zustand";

import { NAV_ITEMS } from "../config/navigation-registry";
import type { ResolvedFeature } from "../types/features";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type FeatureAccessState = "active" | "locked" | "coming_soon";

export interface FeatureAccessInfo {
  state: FeatureAccessState;
  /** Feature name from API (null for items not found in API) */
  name: string | null;
}

const DEFAULT_INFO: FeatureAccessInfo = { state: "locked", name: null };

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

interface FeatureAccessStoreState {
  /** Map of feature key -> access info */
  featureMap: Map<string, FeatureAccessInfo>;
  /** Whether the store has been populated at least once */
  isReady: boolean;
}

interface FeatureAccessStoreActions {
  /**
   * Populate the store from resolved features (API data) + navigation registry.
   * Called when features load or on tenant/app switch.
   */
  populate: (resolvedFeatures: Map<string, ResolvedFeature>) => void;
  /** Get access state for a feature key */
  getFeatureAccess: (featureKey: string) => FeatureAccessInfo;
  /** Check if any feature key in a list is active (OR logic) */
  isAnyFeatureActive: (featureKeys: string[]) => boolean;
  /** Clear state (on logout/tenant switch) */
  clearFeatureAccess: () => void;
}

export type FeatureAccessStore = FeatureAccessStoreState &
  FeatureAccessStoreActions;

export const useFeatureAccessStore = create<FeatureAccessStore>()(
  (set, get) => ({
    featureMap: new Map(),
    isReady: false,

    populate: (resolvedFeatures) => {
      const featureMap = new Map<string, FeatureAccessInfo>();

      for (const navItem of NAV_ITEMS) {
        // System items are always active
        if (navItem.type === "system") {
          featureMap.set(navItem.key, { state: "active", name: navItem.label });
          continue;
        }

        // Coming-soon items are always coming_soon regardless of API data
        if (navItem.status === "coming_soon") {
          const apiFeature = navItem.featureKeys
            .map((fk) => resolvedFeatures.get(fk))
            .find(Boolean);
          featureMap.set(navItem.key, {
            state: "coming_soon",
            name: apiFeature?.name ?? navItem.label,
          });
          continue;
        }

        // Implemented feature items: check if any feature key is enabled
        const isEnabled = navItem.featureKeys.some((fk) => {
          const feature = resolvedFeatures.get(fk);
          return feature?.enabled === true;
        });

        const apiFeature = navItem.featureKeys
          .map((fk) => resolvedFeatures.get(fk))
          .find(Boolean);

        featureMap.set(navItem.key, {
          state: isEnabled ? "active" : "locked",
          name: apiFeature?.name ?? navItem.label,
        });
      }

      // Second pass: also index by feature keys so FeatureGate/isAnyFeatureActive
      // work when the feature key differs from the nav item key (e.g. hub_services
      // vs hub_overview). OR logic: active if ANY nav item using that key is active.
      for (const navItem of NAV_ITEMS) {
        for (const fk of navItem.featureKeys) {
          if (featureMap.has(fk)) continue; // nav key === feature key already stored
          const navInfo = featureMap.get(navItem.key);
          if (!navInfo) continue;
          // If this feature key already has an active entry from a previous iteration
          // of this loop (another nav item), keep it active (OR logic).
          const existing = featureMap.get(fk);
          if (existing?.state === "active") continue;
          featureMap.set(fk, navInfo);
        }
      }

      set({ featureMap, isReady: true });
    },

    getFeatureAccess: (featureKey) => {
      return get().featureMap.get(featureKey) ?? DEFAULT_INFO;
    },

    isAnyFeatureActive: (featureKeys) => {
      const { featureMap } = get();
      return featureKeys.some(
        (fk) => featureMap.get(fk)?.state === "active"
      );
    },

    clearFeatureAccess: () => {
      set({ featureMap: new Map(), isReady: false });
    },
  })
);

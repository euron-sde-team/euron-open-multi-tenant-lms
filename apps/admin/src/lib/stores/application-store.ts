import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { TenantApplication } from "../types/features";

interface ApplicationState {
  /** Currently selected application code (e.g. "lms") */
  selectedApplicationCode: string | null;
  /** Currently selected application object */
  selectedApplication: TenantApplication | null;
  /** All available applications for the tenant */
  applications: TenantApplication[];
}

interface ApplicationActions {
  /** Set the list of available applications (auto-selects if only one) */
  setApplications: (apps: TenantApplication[]) => void;
  /** Manually select an application by code */
  selectApplication: (code: string) => void;
  /** Clear state (e.g. on logout or tenant switch) */
  clearApplicationState: () => void;
}

export type ApplicationStore = ApplicationState & ApplicationActions;

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set, get) => ({
      selectedApplicationCode: null,
      selectedApplication: null,
      applications: [],

      setApplications: (apps) => {
        const { selectedApplicationCode } = get();

        let selected: TenantApplication | null = null;

        if (apps.length > 0) {
          // Try to preserve current selection
          if (selectedApplicationCode) {
            selected =
              apps.find((a) => a.code === selectedApplicationCode) ?? null;
          }
          // Fallback: auto-select the first (sorted by sort_order already)
          if (!selected) {
            selected = apps[0];
          }
        }

        set({
          applications: apps,
          selectedApplicationCode: selected?.code ?? null,
          selectedApplication: selected,
        });
      },

      selectApplication: (code) => {
        const { applications } = get();
        const app = applications.find((a) => a.code === code);
        if (app) {
          set({
            selectedApplicationCode: code,
            selectedApplication: app,
          });
        }
      },

      clearApplicationState: () => {
        set({
          selectedApplicationCode: null,
          selectedApplication: null,
          applications: [],
        });
      },
    }),
    {
      name: "lms-admin-application-store",
    }
  )
);

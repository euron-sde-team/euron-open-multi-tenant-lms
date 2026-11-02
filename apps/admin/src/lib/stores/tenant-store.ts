import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useAuthStore } from "./auth-store";
import type { TenantMembership } from "../types/auth";

interface TenantState {
  // Current selected tenant
  selectedTenantId: string | null;
  selectedTenant: TenantMembership | null;
  
  // Available tenants (from user profile)
  tenants: TenantMembership[];
}

interface TenantActions {
  // Set available tenants (from user profile)
  setTenants: (tenants: TenantMembership[]) => void;

  // Select a tenant. Pass `tenantMeta` when selecting a tenant that isn't in
  // the in-memory memberships list (e.g. a platform admin picking a searched
  // tenant) so the switcher can still label it.
  selectTenant: (
    tenantId: string,
    tenantMeta?: Pick<
      TenantMembership,
      "tenant_id" | "tenant_name" | "tenant_slug"
    >
  ) => void;

  // Clear tenant state (on logout)
  clearTenantState: () => void;
}

export type TenantStore = TenantState & TenantActions;

export const useTenantStore = create<TenantStore>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedTenantId: null,
      selectedTenant: null,
      tenants: [],

      // Actions
      setTenants: (tenants) => {
        const { selectedTenantId, selectedTenant } = get();

        // Platform admins operate tenants they are NOT members of (picked via
        // the switcher search), so their membership list is often empty and
        // MUST NOT clobber the active selection. Once a platform admin has a
        // selection, keep it verbatim and only refresh the membership list.
        // Without this, every /me refetch returns tenants:[] and wipes the org
        // they just switched to (name flashes then reverts to "Select org").
        const isPlatformAdmin = useAuthStore.getState().isPlatformAdmin;
        if (isPlatformAdmin && selectedTenantId) {
          set({ tenants, selectedTenantId, selectedTenant });
          return;
        }

        // No tenants, clear selection entirely
        if (tenants.length === 0) {
          set({ tenants: [], selectedTenantId: null, selectedTenant: null });
          return;
        }

        // Try to keep the current selection if it's still valid
        let newSelectedTenant: TenantMembership | null = null;
        let newSelectedTenantId: string | null = selectedTenantId;

        if (selectedTenantId) {
          newSelectedTenant = tenants.find(t => t.tenant_id === selectedTenantId) || null;
        }

        // If no valid selection, pick the first owned tenant or just the first one
        if (!newSelectedTenant) {
          newSelectedTenant = tenants.find(t => t.is_owner) || tenants[0];
          newSelectedTenantId = newSelectedTenant.tenant_id;
        }

        set({
          tenants,
          selectedTenantId: newSelectedTenantId,
          selectedTenant: newSelectedTenant,
        });
      },

      selectTenant: (tenantId, tenantMeta) => {
        const { tenants } = get();
        const tenant = tenants.find((t) => t.tenant_id === tenantId);

        // Fall back to the supplied meta when the tenant isn't a membership of
        // this user (platform admin picking a searched tenant), so the switcher
        // trigger shows the right name. Synthesize a minimal membership object.
        const resolvedTenant: TenantMembership | null =
          tenant ??
          (tenantMeta
            ? {
                id: tenantMeta.tenant_id,
                tenant_id: tenantMeta.tenant_id,
                tenant_name: tenantMeta.tenant_name,
                tenant_slug: tenantMeta.tenant_slug,
                status: "ACTIVE",
                is_owner: false,
                joined_at: null,
              }
            : null);

        // Always set selectedTenantId, even if the membership object isn't
        // in the in-memory tenants list yet. Critical for the onboarding
        // auto-provision flow: the wizard needs to set the X-Tenant-Id
        // header for the first /me refetch RIGHT AFTER backend tenant
        // creation, at which point the tenants list is still empty
        // because /me hasn't yet returned with the new tenant. Previously
        // selectTenant was a no-op in this state, so the refetch went
        // without a tenant header and cascaded into 403s + clearTenantState.
        // selectedTenant (membership object) gets populated when
        // setTenants is later called from /me's queryFn.
        set({
          selectedTenantId: tenantId,
          selectedTenant: resolvedTenant,
        });
      },

      clearTenantState: () => {
        set({
          selectedTenantId: null,
          selectedTenant: null,
          tenants: [],
        });
      },
    }),
    {
      name: "lms-admin-tenant-store",
    }
  )
);

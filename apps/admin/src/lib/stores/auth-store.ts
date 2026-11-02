import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "../types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  roles: string[];
  permissions: string[];
  isOwner: boolean;
  /** True for platform operators, drives the all-tenants switcher search */
  isPlatformAdmin: boolean;
  /**
   * False until zustand has rehydrated this store from localStorage.
   *
   * The dashboard entry route decides WHERE to send someone based on
   * `isOwner`, and on the first client render that is still the default
   * `false`, so a redirect fired before rehydration sends every owner to the
   * classic overview instead of the Command Center, and does it silently.
   * Deliberately excluded from `partialize`: a persisted "already hydrated"
   * flag would be true before hydration on the next load, which is the exact
   * lie this guards against.
   */
  _hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  login: (user: User) => void;
  logout: () => void;
  setPermissions: (roles: string[], permissions: string[], isOwner: boolean) => void;
  setPlatformAdmin: (isPlatformAdmin: boolean) => void;
  clearPermissions: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      roles: [],
      permissions: [],
      isOwner: false,
      isPlatformAdmin: false,
      _hasHydrated: false,

      setHasHydrated: (hydrated) => set({ _hasHydrated: hydrated }),

      setUser: (user) => set({ user }),

      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      login: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          roles: [],
          permissions: [],
          isOwner: false,
          isPlatformAdmin: false,
        }),

      setPermissions: (roles, permissions, isOwner) =>
        set({ roles, permissions, isOwner }),

      setPlatformAdmin: (isPlatformAdmin) => set({ isPlatformAdmin }),

      clearPermissions: () =>
        set({ roles: [], permissions: [], isOwner: false, isPlatformAdmin: false }),
    }),
    {
      name: "admin-auth-storage",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        roles: state.roles,
        permissions: state.permissions,
        isOwner: state.isOwner,
        isPlatformAdmin: state.isPlatformAdmin,
      }),
      // Fires after rehydration, and also when there was nothing stored to
      // rehydrate, so a logged-out visitor is not left waiting forever.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

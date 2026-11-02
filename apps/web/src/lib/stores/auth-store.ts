import { create } from "zustand";
import { persist } from "zustand/middleware";
import { userAuthApi, type ProfileMetadata } from "../api/auth";
import { clearStoredTokens, hasStoredToken } from "../auth-tokens";

export interface MemberInfo {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: string;
  // Null until the user confirms their name via the one-time name confirmation
  // modal. Non-null (ISO timestamp) means confirmed, the modal never shows again.
  nameConfirmedAt: string | null;
  // Optional, backend stamps `signupSource: "EASY_CHECKOUT"` on auto-created
  // easy-checkout accounts. Used by EmailVerificationGuard to decide whether
  // the verify-now nag applies (suppressed for easy-checkout members; shown
  // for regular signups exactly as before).
  profileMetadata?: ProfileMetadata | null;
}

interface AuthState {
  member: MemberInfo | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (member: MemberInfo, token: string) => void;
  logout: () => void;
  setMember: (member: MemberInfo) => void;
}

export type AuthStore = AuthState & AuthActions;

export const useUserAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      member: null,
      token: null,
      isAuthenticated: false,

      login: (member, token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("authToken", token);
        }
        set({ member, token, isAuthenticated: true });
      },

      /**
       * Clear the session locally and, if we still hold a token, tell the server.
       *
       * Idempotent on purpose. The axios interceptor calls this on EVERY 401, and
       * a signed-out page keeps polling (wallet balance, exchange rate, layout
       * data), so this used to fire several times a second, each time POSTing to
       * /auth/logout, which itself requires a valid token and therefore 401'd too.
       * Bailing out when already signed out stops that churn dead.
       */
      logout: () => {
        if (!get().isAuthenticated && !hasStoredToken()) return;

        // Only worth telling the server if we still have something to present;
        // /auth/logout is an authenticated route and 401s without a token.
        if (hasStoredToken()) {
          userAuthApi.logout().catch(() => {});
        }
        clearStoredTokens();
        set({ member: null, token: null, isAuthenticated: false });
      },

      setMember: (member) => set({ member }),
    }),
    {
      name: "user-auth-storage",
      partialize: (state) => ({
        member: state.member,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

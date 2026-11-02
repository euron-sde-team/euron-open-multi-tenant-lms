/**
 * Where the end-user's auth token lives in localStorage.
 *
 * Its own module, deliberately: both `api/api-client.ts` and
 * `stores/auth-store.ts` need it, and those two already sit on a require cycle
 * (auth-store → api/auth → api-client → auth-store). Hanging the helpers off
 * either end would deepen that cycle; this file imports nothing, so it can't.
 *
 * The read path and the clear path MUST cover the same keys. When logout only
 * removed "authToken", `getStoredToken` fell through to the legacy keys and
 * handed the dead token straight back, so a signed-out user kept
 * re-authenticating with a token the server had already rejected. Every request
 * 401'd, every 401 called logout, and the app never settled. That was the
 * login/logout redirect loop.
 */
const TOKEN_KEYS = ["authToken", "auth_token", "accessToken"] as const;

/** Canonical key. The others are legacy and are folded into this one on read. */
const CANONICAL_KEY = "authToken";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  const current = localStorage.getItem(CANONICAL_KEY);
  if (current) return current;

  // Migration: fold a legacy key into the canonical one on first read.
  const legacy = localStorage.getItem("auth_token");
  if (legacy) {
    localStorage.setItem(CANONICAL_KEY, legacy);
    localStorage.removeItem("auth_token");
    return legacy;
  }

  return localStorage.getItem("accessToken");
}

/** Remove the token from every key it could be living under. */
export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;
  for (const key of TOKEN_KEYS) localStorage.removeItem(key);
}

/** True when any stored token exists, used to skip authed calls when signed out. */
export function hasStoredToken(): boolean {
  return getStoredToken() !== null;
}

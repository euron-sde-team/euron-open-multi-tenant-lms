// Detection + one-shot recovery for deploy-version skew: a tab loaded from a
// previous build tries to lazy-load route chunks / flight payloads that the
// newly deployed build no longer serves (Amplify swaps builds atomically, so
// back-to-back deploys strand every open session). The only correct recovery
// is a full page reload so the browser picks up the new HTML + manifest.

const RELOAD_MARKER = "lms-stale-deploy-reload";
const RELOAD_COOLDOWN_MS = 60_000;

const STALE_DEPLOY_PATTERNS = [
  /loading chunk [\w-]+ failed/i,
  /loading css chunk/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /failed to load chunk/i,
  /expected a javascript module script/i,
];

export function isStaleDeployError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "ChunkLoadError") return true;
  const message = error.message || "";
  return STALE_DEPLOY_PATTERNS.some((re) => re.test(message));
}

/**
 * Full-reload the page to pick up the current deployment, at most once per
 * cooldown window (sessionStorage guard) so a genuinely broken asset can
 * never cause an infinite reload loop.
 *
 * Returns true if a reload was initiated (caller should render nothing/quietly),
 * false if we already reloaded recently (caller should show its error UI).
 */
export function attemptStaleDeployRecovery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_MARKER) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_MARKER, String(Date.now()));
  } catch {
    // sessionStorage unavailable (rare), still better to reload once than
    // strand the user on a dead error screen; the cooldown just won't apply.
  }
  window.location.reload();
  return true;
}

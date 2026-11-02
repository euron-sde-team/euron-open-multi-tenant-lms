/**
 * UTM parameter utilities with localStorage persistence.
 *
 * Resolution order (per the user's spec):
 *   1. Current URL search params  (freshest, if present, overwrite storage)
 *   2. localStorage               (persisted from a previous page load)
 *   3. Nothing                    (no UTM context)
 *
 * New URL params always overwrite stored values (merge semantics).
 */

const UTM_STORAGE_KEY = "lms_admin_utm";

const UTM_KEYS = [
  "ref",
  "click_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_channel",
  "utm_adset",
  "utm_matchtype",
  "gclid",
  "fbclid",
  "msclkid",
  "li_fat_id",
  "twclid",
  "ttclid",
  "dclid",
] as const;

// ─── localStorage helpers ────────────────────────────────────────────

function saveToStorage(params: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(params));
  } catch {
    // localStorage unavailable
  }
}

function readFromStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UTM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ─── URL extraction ──────────────────────────────────────────────────

function extractFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) utm[key] = val;
  }
  return utm;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Capture UTM params from the current URL into localStorage.
 * New URL values overwrite existing stored values (merge).
 * Call this early (e.g. in a layout-level effect) so params are
 * persisted before any redirect strips them from the URL.
 */
export function captureUtmFromUrl(): void {
  const fromUrl = extractFromUrl();
  if (Object.keys(fromUrl).length === 0) return;

  const stored = readFromStorage();
  // Merge: URL values overwrite stored values
  saveToStorage({ ...stored, ...fromUrl });
}

/**
 * Get the canonical set of UTM params.
 * Checks URL first (and persists if found), then falls back to localStorage.
 */
export function getUtmParams(): Record<string, string> {
  const fromUrl = extractFromUrl();
  if (Object.keys(fromUrl).length > 0) {
    // Persist to storage so they survive subsequent navigations
    const stored = readFromStorage();
    const merged = { ...stored, ...fromUrl };
    saveToStorage(merged);
    return merged;
  }
  return readFromStorage();
}

/**
 * Append UTM params to any URL string (relative or absolute).
 * Existing params on the target URL take precedence.
 */
export function appendUtmToUrl(url: string): string {
  const utm = getUtmParams();
  if (Object.keys(utm).length === 0) return url;
  try {
    const isRelative = url.startsWith("/");
    const fullUrl = isRelative ? new URL(url, "http://x") : new URL(url);
    for (const [key, value] of Object.entries(utm)) {
      if (!fullUrl.searchParams.has(key)) {
        fullUrl.searchParams.set(key, value);
      }
    }
    return isRelative ? fullUrl.pathname + fullUrl.search : fullUrl.toString();
  } catch {
    return url;
  }
}

/**
 * Get UTM params formatted for sending to backend APIs.
 * Returns undefined when no UTM data exists.
 */
export function getUtmParamsForApi(): Record<string, string> | undefined {
  const utm = getUtmParams();
  return Object.keys(utm).length > 0 ? utm : undefined;
}

/**
 * Build the `utm` object in the shape the tenant-admin backend expects
 * (RequestMeta.utm): `{ source, medium, campaign, content, term }`.
 * Returns undefined if no standard UTM fields are present.
 */
export function buildUtmForBackend(
  params: Record<string, string>,
): Record<string, string> | undefined {
  const utm: Record<string, string> = {};
  if (params.utm_source) utm.source = params.utm_source;
  if (params.utm_medium) utm.medium = params.utm_medium;
  if (params.utm_campaign) utm.campaign = params.utm_campaign;
  if (params.utm_content) utm.content = params.utm_content;
  if (params.utm_term) utm.term = params.utm_term;
  return Object.keys(utm).length > 0 ? utm : undefined;
}

/**
 * Clear stored UTM params (e.g. after successful lead creation).
 */
export function clearUtmStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

// ─── Session ID (for click dedup) ───────────────────────────────────

const SESSION_ID_KEY = "lms_admin_session_id";

/**
 * Get or create a session ID stored in sessionStorage.
 * Survives page reloads within the same tab but resets when the tab closes.
 * Used for click dedup on the backend (same session + ref = 1 click).
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

// ─── Tracked ref (prevent duplicate click calls) ────────────────────

const TRACKED_REF_KEY = "lms_admin_tracked_ref";

/**
 * Check if a click has already been tracked for this ref code in this session.
 */
export function isRefAlreadyTracked(ref: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(TRACKED_REF_KEY) === ref;
  } catch {
    return false;
  }
}

/**
 * Mark a ref code as tracked in this session.
 */
export function markRefTracked(ref: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TRACKED_REF_KEY, ref);
  } catch {
    // sessionStorage unavailable
  }
}

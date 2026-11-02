// Generic asset URL helper. Uploaded assets are stored as relative keys
// ("tenants/abc/logo.png"); the public base URL of the asset store comes from
// config so any S3-compatible bucket, CDN or local folder can serve them.
//
// Next.js inlines NEXT_PUBLIC_* values only when they are written literally as
// `process.env.NEXT_PUBLIC_X`, so keep these reads literal.
declare const process: { env: Record<string, string | undefined> } | undefined;

function readEnv(read: () => string | undefined): string {
  try {
    return (read() || "").trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

/** Public base URL for uploaded assets (no trailing slash). Empty = same origin. */
export function getAssetBaseUrl(): string {
  return readEnv(() => process!.env.NEXT_PUBLIC_ASSET_BASE_URL);
}

/** Public base URL for tenant organisation assets (logos, favicons). Falls back to the asset base. */
export function getTenantAssetsBaseUrl(): string {
  return readEnv(() => process!.env.NEXT_PUBLIC_TENANT_ASSETS_BASE_URL) || getAssetBaseUrl();
}

const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Resolve a stored asset key or URL to a URL the browser can load.
 * Absolute URLs (http, https, data, blob, protocol-relative) pass through.
 * Relative keys are joined onto `baseUrl` (default: NEXT_PUBLIC_ASSET_BASE_URL);
 * with no base configured they resolve against the current origin.
 */
export function assetUrl(
  key: string | null | undefined,
  baseUrl: string = getAssetBaseUrl()
): string | null {
  if (!key) return null;
  if (ABSOLUTE_URL.test(key)) return key;
  const path = key.replace(/^\/+/, "");
  const base = baseUrl.replace(/\/+$/, "");
  return base ? `${base}/${path}` : `/${path}`;
}

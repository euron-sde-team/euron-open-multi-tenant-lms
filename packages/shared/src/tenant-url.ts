// Build the public-facing URL for a tenant.
// - If the tenant has a custom domain, that wins (no subdomain prefix).
// - Else, returns `https://{slug}.{rootHost}`.
//
// rootHost should be passed in from config (e.g. process.env.MAIN_DOMAIN on
// the backend, or NEXT_PUBLIC_MAIN_DOMAIN on the frontend) so this helper
// stays environment-agnostic.
export function buildTenantUrl(
  slug: string,
  customDomain: string | null | undefined,
  rootHost: string,
): string {
  if (customDomain && customDomain.trim().length > 0) {
    return `https://${customDomain}`;
  }
  return `https://${slug}.${rootHost}`;
}

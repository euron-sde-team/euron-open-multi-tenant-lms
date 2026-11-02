/**
 * Platform brand + domain config for the learner storefront.
 *
 * Tenant pages carry their own branding (from the tenant layout); these values
 * only appear where no tenant could be resolved (404, "build your site" CTA,
 * llms.txt fallbacks). Every value can be overridden at build time.
 */

/** Product name shown when no tenant is resolved. */
export const BRAND_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Open LMS Cloud";

/** Marketing / sign-up URL of the platform operator. */
export const BRAND_URL = process.env.NEXT_PUBLIC_PLATFORM_URL || "https://example.com";

/**
 * Root domain tenants are served under as subdomains (`<tenant>.<root>`).
 * `lvh.me` resolves every subdomain to 127.0.0.1, so `northwind.lvh.me:3620`
 * works locally with no /etc/hosts edits.
 */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me").toLowerCase();

/** Subdomains of ROOT_DOMAIN that never resolve to a tenant. */
export const RESERVED_SUBDOMAINS: readonly string[] = (
  process.env.NEXT_PUBLIC_RESERVED_SUBDOMAINS || "www,admin,api,console"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** BRAND_URL without the protocol, for display. */
export const BRAND_URL_DISPLAY = BRAND_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Single source for product branding and platform identifiers in the
 * operator console. Override with NEXT_PUBLIC_* env vars at build time.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Open LMS Cloud';

export const CONSOLE_TITLE = `${BRAND_NAME} Console`;

/** Public URL of this console, without a trailing slash. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3600';

/** Root domain tenant storefronts live under ({slug}.{ROOT_DOMAIN}). */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'lvh.me';

/** Default storefront URL for a tenant slug. */
export const tenantStorefrontHost = (slug: string): string => `${slug}.${ROOT_DOMAIN}`;

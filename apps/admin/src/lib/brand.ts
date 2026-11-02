/**
 * Single source of truth for product brand strings and platform domains.
 * Everything here can be overridden with NEXT_PUBLIC_* env vars at build time.
 */

/** Product name shown in titles, auth screens and exports. */
export const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Open LMS Cloud";

/** Name of the tenant admin dashboard. */
export const ADMIN_APP_NAME = `${PLATFORM_NAME} Admin`;

/** Root domain that tenant subdomains hang off (northwind.<ROOT_DOMAIN>). */
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "lvh.me").replace(/^\.+|\/+$/g, "");

/** Example tenant host used in placeholders and help text. */
export const EXAMPLE_TENANT_HOST = `your-academy.${ROOT_DOMAIN}`;

/** Sender address used as an example in email settings. */
export const EXAMPLE_SENDER_EMAIL = process.env.NEXT_PUBLIC_PLATFORM_SENDER_EMAIL || "noreply@example.com";

/** Example custom sending domain used in help text. */
export const EXAMPLE_SENDING_DOMAIN = "mail.example.com";

/** Support contact shown on error pages. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

/** Logo shown on auth and onboarding screens (served from public/). */
export const PLATFORM_LOGO_URL = process.env.NEXT_PUBLIC_PLATFORM_LOGO_URL || "/brand-logo.svg";

/**
 * Reserved slugs that cannot be used as tenant subdomains
 * These are reserved for system use, common routes, or could cause conflicts
 */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "dev",
  "www",
  "main",
  "staging",
  "test",
  "demo",
  "help",
  "support",
  "billing",
  "dashboard",
  "app",
  "static",
  "assets",
  "cdn",
  "mail",
  "email",
  "auth",
  "login",
  "signup",
  "docs",
  "blog",
  "status",
  "health",
  "metrics",
  "console",
  "api-console",
  "api-admin",
  "assets",
  "tenant",
  "tenants",
  "user",
  "users",
  "account",
  "accounts",
  "settings",
  "config",
  "system",
  "internal",
  "public",
  "private",
  "root",
  "null",
  "undefined",
  "true",
  "false",
];

/**
 * Check if a slug is reserved
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

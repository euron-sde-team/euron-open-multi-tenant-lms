/**
 * Page Category Routes - Single Source of Truth
 *
 * To add a new page: add one entry to PAGE_CATEGORY_ROUTES below.
 * - all-available-routes.ts automatically includes it (admin + web)
 * - apps/admin page-categories.ts automatically shows it (with default icon)
 * - Optionally add ADMIN_CATEGORY_METADATA in admin for custom icon/description
 */

import type { AvailableRoute } from "../types/link";

export interface PageCategoryRouteDefinition {
  id: string;
  path: string;
  label: string;
  category: string;
  slug: string;
}

export const PAGE_CATEGORY_ROUTES: PageCategoryRouteDefinition[] = [
  { id: "home", path: "/", label: "Home", category: "main", slug: "home" },
  { id: "about", path: "/about", label: "About Us", category: "pages", slug: "about" },
  { id: "contact", path: "/contact", label: "Contact", category: "pages", slug: "contact" },
  { id: "faq", path: "/faq", label: "FAQ", category: "pages", slug: "faq" },
  { id: "privacy", path: "/privacy", label: "Privacy Policy", category: "pages", slug: "privacy" },
  { id: "terms", path: "/terms", label: "Terms of Service", category: "pages", slug: "terms" },
  { id: "login", path: "/login", label: "Login", category: "auth", slug: "login" },
  { id: "profile", path: "/profile", label: "Profile", category: "auth", slug: "profile" },
  { id: "cart", path: "/cart", label: "Cart", category: "commerce", slug: "cart" },
  { id: "bookmark", path: "/bookmark", label: "Bookmarks", category: "commerce", slug: "bookmark" },
];

/** As AvailableRoute[] for use in all-available-routes */
export const PAGE_CATEGORY_ROUTES_AS_AVAILABLE: AvailableRoute[] = PAGE_CATEGORY_ROUTES.map(
  (r) => ({ path: r.path, label: r.label, category: r.category })
);

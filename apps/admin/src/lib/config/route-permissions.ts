/**
 * Route → required-permission map for pages that have NO sidebar nav entry.
 *
 * The <RouteGuard> resolves a page's required permissions primarily from the
 * nav registry (NAV_ITEMS[].permissions), so nav visibility and route access
 * stay in lockstep. But several privileged surfaces are reached only via the
 * "Settings & Admin" hub (or a button), not the sidebar, so they have no nav
 * entry to key off. This map fills that gap.
 *
 * Semantics (mirrors the nav filter): a user may open a route if they hold ANY
 * of the listed permissions. Owner and the `admin` role bypass via hasFullAccess.
 * Longest-prefix match wins, so more specific routes override broader ones.
 */
export const HUB_ONLY_ROUTE_PERMISSIONS: Record<string, string[]> = {
  // Team & roles
  "/dashboard/team": ["roles.view", "staff.view"],
  // The Settings & Admin hub landing itself, visible if you can reach ANY
  // surface it links to. Kept broad on purpose; the page also filters per-card.
  "/dashboard/admin": [
    "roles.view",
    "staff.view",
    "gateway.configure",
    "settings.domains",
    "settings.organization",
    "settings.currencies",
    "settings.auth",
    "settings.navigation",
    "audit.view",
    "certificates.manage",
    "billing.manage",
  ],
  // Billing / money
  "/dashboard/payment": ["gateway.configure"],
  "/dashboard/plans": ["billing.manage"],
  "/dashboard/subscriptions": ["subscriptions.view", "subscriptions.manage"],
  // Audit
  "/dashboard/activity": ["audit.view"],
  // Settings sub-pages that lack a nav entry
  "/dashboard/settings/domains": ["settings.domains"],
  "/dashboard/settings/authentication": ["settings.auth"],
  "/dashboard/settings/storefront": ["settings.organization"],
  "/dashboard/settings/organisation": ["settings.organization"],
  "/dashboard/settings/billing": ["settings.organization"],
  "/dashboard/settings/currencies": ["settings.currencies"],
  "/dashboard/settings/certificates": ["certificates.manage", "settings.organization"],
  "/dashboard/settings/course-access": ["settings.organization"],
};

/**
 * Pattern rules for EDITING surfaces whose route contains a dynamic id, so a
 * static prefix can't target them. These live UNDER a view-only parent (e.g.
 * /dashboard/courses needs only courses.view to open the list), but the editor
 * itself: Save, Edit Pricing, AI-generate, curriculum, writes the course and
 * its landing page, so it needs the UPDATE permission.
 *
 * Checked BEFORE the prefix map, and they win: a role with courses.view can
 * browse the catalog but not land on a course/book EDIT surface.
 */
export const ROUTE_PATTERN_PERMISSIONS: { pattern: RegExp; permissions: string[] }[] = [
  // /dashboard/courses/<id>/editor, /<id>/lms, /<id>/lms/editor, quizzes editor
  { pattern: /^\/dashboard\/courses\/[^/]+\/(editor|lms)(\/|$)/, permissions: ["courses.update"] },
  // /dashboard/books/<id>/editor
  { pattern: /^\/dashboard\/books\/[^/]+\/editor(\/|$)/, permissions: ["books.update"] },
  // /dashboard/pages/<id>/editor
  { pattern: /^\/dashboard\/pages\/[^/]+\/editor(\/|$)/, permissions: ["pages.update"] },
];

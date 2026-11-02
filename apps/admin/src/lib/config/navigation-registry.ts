import {
  Award,
  BookOpen,
  BookText,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  MessageSquareQuote,
  Package,
  PanelLeft,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type NavItemStatus = "implemented" | "coming_soon";

export type NavItemType = "system" | "feature";

export type NavGroupId = "main" | "content" | "commerce" | "people" | "system";

export interface NavGroupConfig {
  id: NavGroupId;
  label: string;
  /** Whether the group is collapsible (main and system groups are not) */
  collapsible: boolean;
  /** Sort order for groups */
  order: number;
}

export interface NavItemConfig {
  /** Unique key, matches feature key for feature items, or a system id */
  key: string;
  /** Display label */
  label: string;
  /** Dashboard route */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Group this item belongs to */
  group: NavGroupId;
  /** Whether this is a system item or feature item */
  type: NavItemType;
  /** Whether the feature page is implemented or coming soon */
  status: NavItemStatus;
  /** Sort order within the group */
  order: number;
  /**
   * Feature keys that determine access state (OR logic).
   * Empty for system items.
   */
  featureKeys: string[];
  /** Use exact path matching (not prefix) for active highlight */
  exactMatch?: boolean;
  /** Description shown in tooltip for coming-soon items */
  comingSoonDescription?: string;
  /**
   * Permission codes required to see this nav item (OR logic).
   * Empty or undefined = always visible (system items, no permission needed).
   * Owner always sees everything (handled in the permission hook).
   */
  permissions?: string[];
}

/* ------------------------------------------------------------------ */
/*  Groups                                                             */
/* ------------------------------------------------------------------ */

export const NAV_GROUPS: NavGroupConfig[] = [
  { id: "main", label: "", collapsible: false, order: 0 },
  { id: "content", label: "Content", collapsible: true, order: 1 },
  { id: "commerce", label: "Commerce", collapsible: true, order: 2 },
  { id: "people", label: "People", collapsible: true, order: 3 },
  { id: "system", label: "", collapsible: false, order: 4 },
];

/* ------------------------------------------------------------------ */
/*  Items                                                              */
/* ------------------------------------------------------------------ */

export const NAV_ITEMS: NavItemConfig[] = [
  // ─── MAIN (system, always visible) ─────────────────────────────────
  // Dashboard leads the rail. href is /dashboard/overview, not /dashboard,
  // because /dashboard is the entry route and would bounce through a redirect.
  { key: "dashboard", label: "Dashboard", href: "/dashboard/overview", icon: LayoutDashboard, group: "main", type: "system", status: "implemented", order: 0, featureKeys: [] },
  { key: "pages", label: "Pages", href: "/dashboard/pages", icon: FileText, group: "main", type: "system", status: "implemented", order: 3, featureKeys: [], permissions: ["pages.view"] },
  { key: "navigation", label: "Navigation", href: "/dashboard/settings/navigation", icon: PanelLeft, group: "main", type: "system", status: "implemented", order: 4, featureKeys: [], permissions: ["settings.navigation"] },

  // ─── CONTENT (everything you create) ───────────────────────────────
  { key: "all_courses", label: "All Courses", href: "/dashboard/courses", icon: LayoutGrid, group: "content", type: "feature", status: "implemented", order: 0, featureKeys: ["self_paced_courses"], exactMatch: true, permissions: ["courses.view"] },
  { key: "self_paced_courses", label: "Self Paced Courses", href: "/dashboard/courses/self-paced", icon: BookOpen, group: "content", type: "feature", status: "implemented", order: 1, featureKeys: ["self_paced_courses"], permissions: ["courses.view"] },
  { key: "books", label: "Books", href: "/dashboard/books", icon: BookText, group: "content", type: "feature", status: "implemented", order: 5, featureKeys: ["books"], permissions: ["books.view"] },
  { key: "testseries", label: "Test Series", href: "/dashboard/test-series", icon: ClipboardCheck, group: "content", type: "feature", status: "implemented", order: 12, featureKeys: ["testseries"], permissions: ["tests.view"] },

  // Bundles (in content group)
  { key: "bundles", label: "Bundles", href: "/dashboard/bundles", icon: Package, group: "content", type: "feature", status: "implemented", order: 10, featureKeys: ["bundles"], permissions: ["bundles.view"] },

  // Batches (cohorts): fixed-start group of courses + books
  { key: "batches", label: "Batches", href: "/dashboard/batches", icon: CalendarDays, group: "content", type: "feature", status: "implemented", order: 12, featureKeys: ["batches"], permissions: ["batches.view"] },

  // ─── COMMERCE ──────────────────────────────────────────────────────
  { key: "categories", label: "Categories", href: "/dashboard/categories", icon: FolderTree, group: "commerce", type: "feature", status: "implemented", order: 1, featureKeys: ["categories"], permissions: ["categories.view"] },
  { key: "coupons", label: "Coupons", href: "/dashboard/coupons", icon: Ticket, group: "commerce", type: "system", status: "implemented", order: 2, featureKeys: [], permissions: ["coupons.view"] },
  { key: "user-subscriptions", label: "User Subscriptions", href: "/dashboard/subscriptions", icon: CreditCard, group: "commerce", type: "feature", status: "implemented", order: 3, featureKeys: ["self_paced_courses", "books"], permissions: ["subscriptions.view"] },

  // ─── PEOPLE ────────────────────────────────────────────────────────
  { key: "users", label: "Users", href: "/dashboard/users", icon: Users, group: "people", type: "system", status: "implemented", order: 0, featureKeys: [], permissions: ["members.view"] },
  { key: "instructors", label: "Instructors", href: "/dashboard/instructors", icon: GraduationCap, group: "people", type: "feature", status: "implemented", order: 1, featureKeys: ["instructors"], permissions: ["instructors.view"] },
  { key: "testimonials", label: "Testimonials", href: "/dashboard/testimonials", icon: MessageSquareQuote, group: "people", type: "feature", status: "implemented", order: 2, featureKeys: ["testimonials"], permissions: ["testimonials.view"] },
  { key: "user_data_form", label: "User Data Forms", href: "/dashboard/settings/user-data-form", icon: ClipboardList, group: "people", type: "system", status: "implemented", order: 3, featureKeys: [], permissions: ["members.view"] },

  // Issue Certificates, bulk-issue freeform certificates to recipients from a spreadsheet
  { key: "certificates", label: "Issue Certificates", href: "/dashboard/certificates", icon: Award, group: "people", type: "system", status: "implemented", order: 5, featureKeys: [], permissions: ["certificates.view"] },

  // ─── SYSTEM (always visible, bottom) ───────────────────────────────
  { key: "settings_admin", label: "Settings & Admin", href: "/dashboard/admin", icon: Settings, group: "system", type: "system", status: "implemented", order: 0, featureKeys: [], permissions: ["roles.view", "staff.view", "gateway.configure", "settings.domains", "settings.organization", "settings.currencies", "settings.auth", "settings.navigation", "audit.view", "certificates.manage", "billing.manage"] },
  // NOTE: the Activity Log is deliberately NOT a sidebar item. Every admin
  // surface (Team, Payment, Domains, Billing…) is a card inside Settings &
  // Admin; the log lives next to Team there, since it answers the same question
  // that page raises, who has access, and what did they do with it.
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get all groups in order */
export function getNavGroups(): NavGroupConfig[] {
  return [...NAV_GROUPS].sort((a, b) => a.order - b.order);
}

/** Get items for a specific group, sorted by order. */
export function getNavItemsByGroup(groupId: NavGroupId): NavItemConfig[] {
  return NAV_ITEMS.filter((item) => item.group === groupId).sort((a, b) => a.order - b.order);
}

/** Get all groups with their items, sorted */
export function getGroupedNavItems(): Array<NavGroupConfig & { items: NavItemConfig[] }> {
  return getNavGroups()
    .map((group) => ({ ...group, items: getNavItemsByGroup(group.id) }))
    .filter((g) => g.items.length > 0);
}

/** Find a nav item by key */
export function findNavItem(key: string): NavItemConfig | undefined {
  return NAV_ITEMS.find((item) => item.key === key);
}

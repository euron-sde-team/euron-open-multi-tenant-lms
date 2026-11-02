/**
 * The capability layer, a human vocabulary on top of the permission codes.
 *
 * WHY THIS EXISTS
 * ---------------
 * The engine enforces ~260 permission codes (`courses.lms.manage`,
 * `hub.dms.respond`, `entitlements.reconcile`). Those are OUR routing vocabulary
 *, a tenant admin cannot look at them and answer the only question they
 * actually have: "if I give Priya this role, what will she be able to do?"
 *
 * A CAPABILITY is one plain-English sentence, "Can create and publish courses"
 *, that GRANTS a set of codes. Admins read sentences; the engine keeps enforcing
 * codes. Nothing about `requirePermission()` changes.
 *
 * IT ALSO STOPS THE DRIFT
 * -----------------------
 * Permission codes used to be hand-copied into a seed script in ANOTHER repo.
 * People forgot, and 25 codes ended up enforced-but-ungrantable, no checkbox
 * existed for them, so no staff member could ever be given Batches, Tests, Code
 * Judge, etc. The owner/admin bypass hid it completely.
 *
 * Now each feature declares its own capabilities in a manifest next to itself,
 * and a CI check asserts that every code a route enforces is granted by some
 * capability. A developer physically cannot reintroduce the drift.
 */

/** The ~10 areas a tenant admin sees. Deliberately mirrors the sidebar, so the
 *  permission screen matches the app they already navigate. */
export const CAPABILITY_AREAS = [
  "COURSES_AND_CONTENT",
  "LEARNERS",
  "SALES_AND_PAYMENTS",
  "MARKETING",
  "COMMUNITY",
  "REPORTS",
  "AI_TOOLS",
  "PRODUCT_HUB",
  "STORE",
  "BUSINESS_TOOLS",
  "SETTINGS_AND_TEAM",
] as const;

export type CapabilityArea = (typeof CAPABILITY_AREAS)[number];

export const AREA_LABELS: Record<CapabilityArea, string> = {
  COURSES_AND_CONTENT: "Courses & Content",
  LEARNERS: "Learners",
  SALES_AND_PAYMENTS: "Sales & Payments",
  MARKETING: "Marketing",
  COMMUNITY: "Community",
  REPORTS: "Reports",
  AI_TOOLS: "AI Tools",
  PRODUCT_HUB: "Product Hub",
  STORE: "Store",
  BUSINESS_TOOLS: "Business Tools",
  SETTINGS_AND_TEAM: "Settings & Team",
};

/** Order the areas appear in the UI. */
export const AREA_ORDER: CapabilityArea[] = [...CAPABILITY_AREAS];

/**
 * Why a capability deserves a warning next to it. These are the things a tenant
 * owner would want to think twice about before handing over, we surface them
 * by name rather than burying them in a list.
 */
export type DangerLevel =
  /** Irreversible. Deletes content or people. */
  | "DESTRUCTIVE"
  /** Moves money, refunds, payouts, gateway config. */
  | "FINANCIAL"
  /** Exposes learner personal data (contact details, exports). */
  | "PERSONAL_DATA"
  /** Immediately visible to learners / the public. */
  | "PUBLIC";

export const DANGER_LABELS: Record<DangerLevel, string> = {
  DESTRUCTIVE: "Permanent",
  FINANCIAL: "Moves money",
  PERSONAL_DATA: "Personal data",
  PUBLIC: "Learners see this",
};

export interface Capability {
  /** Stable id, e.g. "courses.author". Never shown to the user. */
  id: string;
  /** The sentence the admin reads. Always starts "Can …". */
  label: string;
  /** One line of plain English explaining the consequence. */
  description: string;
  /** The permission codes this capability grants. THE only link to the engine. */
  grants: string[];
  danger?: DangerLevel;
  /**
   * Ticked by default when creating a new role. For the baseline things nearly
   * every staff member needs, chiefly the dashboard, which is the page they
   * land on after signing in. Without this, a new role's first experience is
   * "Failed to load dashboard: Insufficient permissions".
   */
  defaultOn?: boolean;
  /**
   * Owner-only capabilities can never be granted to a role at all, they belong
   * to the account owner alone (billing, payment gateways, who-can-do-what).
   * Shown greyed-out with an explanation rather than hidden, so nobody wonders
   * why they can't delegate it.
   */
  ownerOnly?: boolean;
  /**
   * The feature this capability belongs to has been built but isn't live for
   * tenants yet. Kept in the manifest (so its codes stay grantable and the
   * definition is ready) but hidden from the role editor by getCapabilityTree().
   * Delete the flag to reveal it when the feature ships.
   */
  comingSoon?: boolean;
}

/**
 * One feature's declaration. Lives NEXT TO the feature it describes, so shipping
 * Test Series means adding a manifest, not remembering to edit a list in
 * another repo.
 */
export interface FeatureCapabilities {
  /** Where these capabilities appear in the UI. */
  area: CapabilityArea;
  /** Short name of the feature, used in the "new feature" prompt to the owner. */
  feature: string;
  /**
   * When this feature shipped, "YYYY-MM". Existing roles do NOT silently gain a
   * new feature, instead the owner is prompted: "Test Series is new. Who should
   * have access?" This date is what drives that prompt.
   */
  addedIn: string;
  /**
   * The whole feature is built but not yet live for tenants. It stays in the
   * registry (its codes remain grantable, definitions ready) but is hidden from
   * the role editor by getCapabilityTree(). Delete the flag to launch it.
   */
  comingSoon?: boolean;
  capabilities: Capability[];
}

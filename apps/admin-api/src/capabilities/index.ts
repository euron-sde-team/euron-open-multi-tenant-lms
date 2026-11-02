/**
 * The capability layer's public surface.
 *
 * Admins read capabilities ("Can create and publish courses"). The engine keeps
 * enforcing permission codes. This module is the only translation between them.
 */
import { FEATURE_MANIFESTS } from "./manifests";
import {
  AREA_LABELS,
  AREA_ORDER,
  DANGER_LABELS,
  type Capability,
  type CapabilityArea,
  type FeatureCapabilities,
} from "./types";

export * from "./types";
export { FEATURE_MANIFESTS } from "./manifests";

/** Flat list of every capability across every feature. */
export const ALL_CAPABILITIES: Capability[] = FEATURE_MANIFESTS.flatMap(
  (m) => m.capabilities
);

const BY_ID = new Map<string, Capability>(
  ALL_CAPABILITIES.map((c) => [c.id, c])
);

export function getCapability(id: string): Capability | undefined {
  return BY_ID.get(id);
}

/**
 * Capability ids → the permission codes they grant.
 *
 * This is the ONLY place a role's stored codes are derived from what the admin
 * ticked. Unknown ids are ignored rather than throwing, so a stale capability id
 * left over in a saved role never breaks the role.
 */
export function capabilitiesToPermissionCodes(
  capabilityIds: string[]
): string[] {
  const codes = new Set<string>();
  for (const id of capabilityIds) {
    const cap = BY_ID.get(id);
    if (!cap) continue;
    for (const code of cap.grants) codes.add(code);
  }
  return [...codes];
}

/**
 * The reverse: which capabilities does this set of codes represent?
 *
 * A capability counts as "on" only if EVERY code it grants is present. If a role
 * was hand-edited in the Advanced view it may not map cleanly, the caller
 * surfaces that as a "Custom" role rather than silently losing the extra codes.
 * The codes always remain the source of truth for enforcement.
 */
export function permissionCodesToCapabilities(codes: string[]): {
  capabilityIds: string[];
  /** True when the codes are exactly what the capabilities grant, i.e. the
   *  Simple view can represent this role faithfully. */
  exact: boolean;
} {
  const have = new Set(codes);
  const capabilityIds: string[] = [];
  const covered = new Set<string>();

  for (const cap of ALL_CAPABILITIES) {
    if (cap.grants.length > 0 && cap.grants.every((c) => have.has(c))) {
      capabilityIds.push(cap.id);
      for (const c of cap.grants) covered.add(c);
    }
  }

  // Any code held that no selected capability accounts for means this role was
  // customised beyond what the Simple view can express.
  const exact = codes.every((c) => covered.has(c));
  return { capabilityIds, exact };
}

export interface CapabilityAreaView {
  area: CapabilityArea;
  label: string;
  features: {
    feature: string;
    addedIn: string;
    capabilities: Capability[];
  }[];
}

/**
 * The shape the admin UI renders: areas → features → capabilities.
 *
 * `comingSoon` features (and `comingSoon` capabilities inside a live feature)
 * are built but not yet launched for tenants, so they're filtered out here.
 * the ONLY place the tree is shaped for the editor. Their codes stay grantable
 * and their definitions stay in the manifest; deleting the flag reveals them.
 * A feature left with no visible capabilities, or an area left with no visible
 * features, drops out too, no empty group headers.
 */
export function getCapabilityTree(): CapabilityAreaView[] {
  return AREA_ORDER.map((area) => {
    const features = FEATURE_MANIFESTS.filter(
      (m: FeatureCapabilities) => m.area === area && !m.comingSoon
    )
      .map((m) => ({
        feature: m.feature,
        addedIn: m.addedIn,
        capabilities: m.capabilities.filter((c) => !c.comingSoon),
      }))
      .filter((f) => f.capabilities.length > 0);
    return { area, label: AREA_LABELS[area], features };
  }).filter((a) => a.features.length > 0);
}

export { AREA_LABELS, AREA_ORDER, DANGER_LABELS };

/**
 * Capabilities the account owner keeps to themselves, billing, payment
 * gateways, and who-can-do-what. They can never be granted to a role.
 */
export const OWNER_ONLY_CAPABILITY_IDS: string[] = ALL_CAPABILITIES.filter(
  (c) => c.ownerOnly
).map((c) => c.id);

/**
 * Ticked by default on a new role. Currently just the dashboard, the page
 * every staff member lands on after signing in. A new role without it greets
 * its first user with "Failed to load dashboard: Insufficient permissions",
 * which is a terrible way to meet a product.
 */
export const DEFAULT_CAPABILITY_IDS: string[] = ALL_CAPABILITIES.filter(
  (c) => c.defaultOn
).map((c) => c.id);

/** Permission codes reachable through a grantable (non-owner-only) capability. */
export function grantableCodes(): Set<string> {
  const set = new Set<string>();
  for (const cap of ALL_CAPABILITIES) {
    if (cap.ownerOnly) continue;
    for (const code of cap.grants) set.add(code);
  }
  return set;
}

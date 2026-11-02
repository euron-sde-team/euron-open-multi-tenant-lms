import tenantApplicationRepository, {
  type TenantApplicationRow,
} from "../repositories/tenant-application.repository";
import featuresRepository from "../repositories/features.repository";
import entitlementsRepository, {
  type EntitlementRow,
} from "../repositories/entitlements.repository";
import usageService from "./usage.service";

/* ------------------------------------------------------------------ */
/*  Response DTOs                                                      */
/* ------------------------------------------------------------------ */

export interface TenantApplicationDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  status: string;
  sort_order: number;
}

export interface ResolvedProductDto {
  code: string;
  constraint_type: string; // BOOLEAN | COUNT | LIMIT
  limit_value: number;
  used_value: number;
  is_unlimited: boolean;
  unit: string | null;
}

export interface ResolvedFeatureDto {
  key: string;
  name: string | null;
  category: string | null;
  /** true when at least one BOOLEAN product has limit>=1 (or is_unlimited),
   *  OR when the feature has no BOOLEAN gate at all (all COUNT/LIMIT). */
  enabled: boolean;
  products: ResolvedProductDto[];
}

export interface ResolvedApplicationDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  features: ResolvedFeatureDto[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Group an array by a key function, preserving insertion order.
 */
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Service                                                            */
/* ------------------------------------------------------------------ */

class TenantFeaturesService {
  /**
   * List active applications for the tenant (lightweight, no feature data).
   */
  async getApplicationsForTenant(
    tenantId: string
  ): Promise<TenantApplicationDto[]> {
    const rows = await tenantApplicationRepository.findActiveByTenantId(
      tenantId
    );
    return rows.map(toApplicationDto);
  }

  /**
   * Full feature resolver: for each active application (optionally filtered),
   * returns every feature with its entitlement state.
   *
   * This is the **single source of truth** the frontend uses to decide
   * which sidebar items, pages, and actions are available.
   */
  async getResolvedFeatures(
    tenantId: string,
    applicationCode?: string
  ): Promise<ResolvedApplicationDto[]> {
    // 1. Active applications for the tenant
    let apps = await tenantApplicationRepository.findActiveByTenantId(tenantId);
    if (applicationCode) {
      apps = apps.filter((a) => a.application_code === applicationCode);
    }
    if (apps.length === 0) return [];

    const appIds = apps.map((a) => a.application_id);

    // 2. All features (with their product definitions) for those apps
    const featureProductRows =
      await featuresRepository.findByApplicationIdsWithProducts(appIds);

    // 3. All active entitlements + usage counters for this tenant
    const [entitlements, usageMap] = await Promise.all([
      entitlementsRepository.findActiveByTenantId(tenantId),
      usageService.getAllUsage(tenantId),
    ]);

    // Build a quick lookup: product_code → entitlement
    const entitlementByProduct = new Map<string, EntitlementRow>();
    for (const ent of entitlements) {
      entitlementByProduct.set(ent.product_code, ent);
    }

    // 4. Group feature+product rows by application, then by feature
    const featuresByApp = groupBy(featureProductRows, (r) => r.application_id);

    // 5. Assemble response
    return apps.map((app) => {
      const rows = featuresByApp.get(app.application_id) ?? [];
      const featuresByKey = groupBy(rows, (r) => r.key);

      const features: ResolvedFeatureDto[] = [];

      for (const [featureKey, featureRows] of featuresByKey) {
        const first = featureRows[0];

        // Collect unique products (a feature row is repeated per product due to LEFT JOIN)
        const products: ResolvedProductDto[] = [];
        let hasBooleanGate = false;
        let booleanEnabled = false;

        for (const row of featureRows) {
          if (!row.product_code) continue; // no product for this feature

          // Avoid duplicates (same product_code can't repeat, but guard anyway)
          if (products.some((p) => p.code === row.product_code)) continue;

          const ent = entitlementByProduct.get(row.product_code);

          const isBooleanType = row.product_constraint_type === "BOOLEAN";

          if (isBooleanType) {
            hasBooleanGate = true;
            if (ent) {
              const isOn =
                Boolean(ent.is_unlimited) || ent.limit_value >= 1;
              if (isOn) booleanEnabled = true;
            }
            // No entitlement for a BOOLEAN product → not enabled
          }

          products.push({
            code: row.product_code,
            constraint_type: row.product_constraint_type ?? "BOOLEAN",
            limit_value: ent ? ent.limit_value : 0,
            used_value: usageMap.get(row.product_code) ?? 0,
            is_unlimited: ent ? Boolean(ent.is_unlimited) : false,
            unit: row.product_unit ?? null,
          });
        }

        // Feature is enabled when:
        //  - It has a BOOLEAN gate product that is ON, OR
        //  - It has no BOOLEAN gate (all products are COUNT/LIMIT) and at least one entitlement exists
        const enabled = hasBooleanGate
          ? booleanEnabled
          : products.length > 0 &&
            products.some((p) => {
              const ent = entitlementByProduct.get(p.code);
              return !!ent;
            });

        features.push({
          key: featureKey,
          name: first.name,
          category: first.category,
          enabled,
          products,
        });
      }

      return {
        id: app.application_id,
        code: app.application_code,
        name: app.application_name,
        description: app.application_description,
        icon_url: app.application_icon_url,
        features,
      };
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers (private)                                                  */
/* ------------------------------------------------------------------ */

function toApplicationDto(row: TenantApplicationRow): TenantApplicationDto {
  return {
    id: row.application_id,
    code: row.application_code,
    name: row.application_name,
    description: row.application_description,
    icon_url: row.application_icon_url,
    status: String(row.status),
    sort_order: Number(row.application_sort_order),
  };
}

const tenantFeaturesService = new TenantFeaturesService();
export default tenantFeaturesService;

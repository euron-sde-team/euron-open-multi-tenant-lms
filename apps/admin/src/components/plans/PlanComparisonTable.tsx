"use client";

import { cn } from "@open-mtlms/core";
import { useMemo } from "react";

import type { PlanProductItem, PlanWithProducts } from "@/lib/api/plans";
import type { Entitlement } from "@/lib/types/entitlements";

import { FeatureValueCell } from "./FeatureValueCell";
import { PlanColumnHeader } from "./PlanColumnHeader";

/**
 * Consolidated row: one row per logical feature.
 * BOOLEAN products are merged away when a COUNT/LIMIT product exists
 * for the same feature_key (since having a count implies enabled).
 */
interface FeatureRow {
  productCode: string;
  featureName: string;
  featureCategory: string;
  featureSortOrder: number;
  planProducts: (PlanProductItem | null)[];
}

interface CategoryGroup {
  category: string;
  rows: FeatureRow[];
}

type PlanRelation = "current" | "upgrade" | "downgrade" | "new";

interface PlanComparisonTableProps {
  plans: PlanWithProducts[];
  billingCycle: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
  currency: "INR" | "USD";
  currentPlanVersionId: string | null;
  entitlements: Entitlement[] | undefined;
  onSelectPlan: (planVersionId: string) => void;
  onActivateFreePlan?: (planVersionId: string) => void;
  isSubscribing: boolean;
}

/** Decode HTML entities stored in the database (e.g. &amp; → &) */
function decodeEntities(text: string): string {
  if (typeof document === "undefined") return text.replaceAll(/&amp;/gi, "&");
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

/**
 * Derive a readable display name from a product_code.
 * e.g. "self_paced_courses_count" → "Self Paced Courses"
 *      "live_course_sessions"     → "Live Course Sessions"
 *      "quiz_questions_per_quiz"  → "Quiz Questions Per Quiz"
 */
function productCodeToDisplayName(code: string): string {
  return code
    .replace(/_count$/, "")
    .replace(/_enabled$/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface FeatureGroup {
  name: string;
  category: string;
  sortOrder: number;
  productCodes: Map<string, "BOOLEAN" | "COUNT" | "LIMIT">;
  productTitles: Map<string, string | null>;
}

/** Collect all products grouped by feature_key across all plans */
function collectFeatureGroups(
  plans: PlanWithProducts[]
): Map<string, FeatureGroup> {
  const groups = new Map<string, FeatureGroup>();
  for (const plan of plans) {
    for (const product of plan.products) {
      let group = groups.get(product.feature_key);
      if (!group) {
        group = {
          name: product.feature_name,
          category: product.feature_category,
          sortOrder: product.feature_sort_order,
          productCodes: new Map(),
          productTitles: new Map(),
        };
        groups.set(product.feature_key, group);
      }
      group.productCodes.set(product.product_code, product.constraint_type);
      group.productTitles.set(product.product_code, product.product_title);
    }
  }
  return groups;
}

/** Determine which product codes are visible (filter out redundant BOOLEANs) */
function getVisibleProductCodes(
  featureGroups: Map<string, FeatureGroup>
): Set<string> {
  const visible = new Set<string>();
  for (const group of featureGroups.values()) {
    const hasNonBoolean = Array.from(group.productCodes.values()).some(
      (t) => t !== "BOOLEAN"
    );
    for (const [code, type] of group.productCodes) {
      if (type === "BOOLEAN" && hasNonBoolean) continue;
      visible.add(code);
    }
  }
  return visible;
}

/** For a given row, find the best product to show per plan (exact match or BOOLEAN fallback) */
function resolvePlanProducts(
  plans: PlanWithProducts[],
  productCode: string,
  featureKey: string
): (PlanProductItem | null)[] {
  return plans.map((plan) => {
    const exact = plan.products.find((p) => p.product_code === productCode);
    if (exact) return exact;
    // Fallback: plan only has the BOOLEAN for this feature → show ✓/✗
    return (
      plan.products.find(
        (p) => p.feature_key === featureKey && p.constraint_type === "BOOLEAN"
      ) ?? null
    );
  });
}

/** Group rows by decoded category and sort categories by min sort order */
function groupByCategory(rows: FeatureRow[]): CategoryGroup[] {
  const categoryMap = new Map<string, FeatureRow[]>();
  for (const row of rows) {
    const cat = decodeEntities(row.featureCategory || "General");
    const list = categoryMap.get(cat) ?? [];
    list.push(row);
    categoryMap.set(cat, list);
  }
  return Array.from(categoryMap.entries())
    .map(([category, catRows]) => ({ category, rows: catRows }))
    .sort((a, b) => {
      const aMin = Math.min(...a.rows.map((r) => r.featureSortOrder));
      const bMin = Math.min(...b.rows.map((r) => r.featureSortOrder));
      return aMin - bMin;
    });
}

/**
 * Build the feature matrix with smart merging:
 * 1. Group products by feature_key across all plans
 * 2. If both BOOLEAN and COUNT/LIMIT exist for a feature → drop the BOOLEAN row
 * 3. For plans that only have the BOOLEAN (no COUNT/LIMIT), show ✓/✗ as fallback
 * 4. When a feature has multiple visible products, derive distinct names from product_code
 */
function buildFeatureMatrix(plans: PlanWithProducts[]): CategoryGroup[] {
  const featureGroups = collectFeatureGroups(plans);
  const visibleCodes = getVisibleProductCodes(featureGroups);

  // Count how many visible products each feature has (to decide naming strategy)
  const visibleCountByFeature = new Map<string, number>();
  for (const [featureKey, group] of featureGroups) {
    let count = 0;
    for (const [code] of group.productCodes) {
      if (visibleCodes.has(code)) count++;
    }
    visibleCountByFeature.set(featureKey, count);
  }

  const rows: FeatureRow[] = [];
  const seenCodes = new Set<string>();

  for (const [featureKey, group] of featureGroups) {
    const hasMultipleProducts = (visibleCountByFeature.get(featureKey) ?? 0) > 1;

    for (const [productCode] of group.productCodes) {
      if (!visibleCodes.has(productCode) || seenCodes.has(productCode))
        continue;
      seenCodes.add(productCode);

      // Priority: product_title > feature_name (single) / productCodeToDisplayName (multi)
      const productTitle = group.productTitles.get(productCode);
      const fallbackName = hasMultipleProducts
        ? productCodeToDisplayName(productCode)
        : group.name;
      const displayName = productTitle || fallbackName;

      rows.push({
        productCode,
        featureName: displayName,
        featureCategory: group.category,
        featureSortOrder: group.sortOrder,
        planProducts: resolvePlanProducts(plans, productCode, featureKey),
      });
    }
  }

  rows.sort((a, b) => {
    if (a.featureSortOrder !== b.featureSortOrder)
      return a.featureSortOrder - b.featureSortOrder;
    return a.featureName.localeCompare(b.featureName);
  });

  return groupByCategory(rows);
}

function getPlanRelation(
  plan: PlanWithProducts,
  currentPlanVersionId: string | null,
  plans: PlanWithProducts[]
): PlanRelation {
  if (!currentPlanVersionId) return "new";
  if (plan.id === currentPlanVersionId) return "current";

  const currentPlan = plans.find((p) => p.id === currentPlanVersionId);
  if (!currentPlan) return "new";

  return plan.sort_order > currentPlan.sort_order ? "upgrade" : "downgrade";
}

export function PlanComparisonTable({
  plans,
  billingCycle,
  currency,
  currentPlanVersionId,
  entitlements,
  onSelectPlan,
  onActivateFreePlan,
  isSubscribing,
}: PlanComparisonTableProps) {
  const categories = useMemo(() => buildFeatureMatrix(plans), [plans]);

  const planCount = plans.length;

  // Build entitlement lookup by product_code
  const entitlementMap = useMemo(() => {
    if (!entitlements) return new Map<string, Entitlement>();
    const map = new Map<string, Entitlement>();
    for (const e of entitlements) {
      map.set(e.product_code, e);
    }
    return map;
  }, [entitlements]);

  // Find current plan's column index
  const currentPlanIndex = plans.findIndex(
    (p) => p.id === currentPlanVersionId
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="overflow-x-auto rounded-xl border shadow-sm">
        <table className="w-full border-collapse">
          {/* Column sizing, adapt for plan count */}
          <colgroup>
            <col
              className={cn(
                "min-w-[180px]",
                planCount === 1 ? "w-[45%]" : "w-[220px]"
              )}
            />
            {plans.map((plan) => (
              <col key={plan.id} className="min-w-[200px]" />
            ))}
          </colgroup>

          {/* Sticky header row */}
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="bg-background sticky left-0 z-30 border-b border-r p-4">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Compare features
                </span>
              </th>
              {plans.map((plan, idx) => (
                <th
                  key={plan.id}
                  className={cn(
                    "border-b border-r p-0 last:border-r-0",
                    idx === currentPlanIndex ? "bg-primary/5" : "bg-background"
                  )}
                >
                  {idx === currentPlanIndex && (
                    <div className="bg-primary h-1 w-full" />
                  )}
                  <PlanColumnHeader
                    plan={plan}
                    billingCycle={billingCycle}
                    currency={currency}
                    relation={getPlanRelation(
                      plan,
                      currentPlanVersionId,
                      plans
                    )}
                    onSelect={onSelectPlan}
                    onActivateFreePlan={onActivateFreePlan}
                    isSubscribing={isSubscribing}
                  />
                </th>
              ))}
            </tr>
          </thead>

          {/* Feature rows grouped by category */}
          <tbody>
            {categories.map((group) => (
              <CategorySection
                key={group.category}
                group={group}
                plans={plans}
                planCount={planCount}
                currentPlanIndex={currentPlanIndex}
                entitlementMap={entitlementMap}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders a category header + its feature rows.
 * Extracted to a named component for React key stability (avoids Fragment key warning).
 */
function CategorySection({
  group,
  plans,
  planCount,
  currentPlanIndex,
  entitlementMap,
}: Readonly<{
  group: CategoryGroup;
  plans: PlanWithProducts[];
  planCount: number;
  currentPlanIndex: number;
  entitlementMap: Map<string, Entitlement>;
}>) {
  return (
    <>
      {/* Category header row */}
      <tr className="bg-muted/40">
        <td
          colSpan={planCount + 1}
          className="text-muted-foreground px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
        >
          {group.category}
        </td>
      </tr>

      {/* Feature rows */}
      {group.rows.map((row, rowIdx) => {
        const ent = entitlementMap.get(row.productCode);
        const isLast = rowIdx === group.rows.length - 1;
        return (
          <tr
            key={row.productCode}
            className={cn(
              "hover:bg-muted/20 transition-colors",
              !isLast && "border-b border-dashed"
            )}
          >
            <td className="bg-background sticky left-0 z-10 border-r px-4 py-3 text-sm">
              {decodeEntities(row.featureName)}
            </td>

            {row.planProducts.map((product, colIdx) => (
              <td
                key={plans[colIdx].id}
                className={cn(
                  "border-r px-4 py-3 text-center last:border-r-0",
                  colIdx === currentPlanIndex && "bg-primary/5"
                )}
              >
                <FeatureValueCell
                  product={product}
                  currentUsed={ent?.used_value}
                  isCurrentPlan={colIdx === currentPlanIndex}
                />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

import { db } from "../db/connection";
import type { content_discount_type, price_entity_type } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { getTenantCurrencyConfig } from "../services/currency-context.service";
import { isAccessManaged, SELF_SERVE_BLOCKED_MESSAGE } from "./assert-self-serve";

/**
 * Merged-view price resolution (the server twin of @open-mtlms/shared resolvePrice).
 *
 * Legacy price_inr/price_usd columns are a PERMANENT first-class price source
 * for INR/USD (no backfill ever runs): for each currency the effective price is
 * the content_prices row when one exists, else the legacy column while that
 * currency is enabled for the tenant. Resolution picks the requested currency
 * first, then the tenant default (DEFAULT_FALLBACK; the order is charged in the
 * default currency). A PAID item with nothing resolvable is UNAVAILABLE.
 */

export type PriceSource =
  | "PRICE_BOOK"
  | "DEFAULT_FALLBACK"
  | "ENABLED_FALLBACK"
  | "LEGACY_COLUMNS";

export interface ResolvedContentPrice {
  /** Currency the order will actually be charged in. */
  currency: string;
  /** List price after the catalog discount (coupons apply later). */
  baseAmount: number;
  /** List price before the catalog discount. */
  listAmount: number;
  priceSource: PriceSource;
}

/**
 * One currency's entry in a catalog price map. `discount_type` travels with the
 * amount so the frontend resolver reads the discount the same way the server
 * does, instead of inferring it from the entity type.
 */
export interface PriceMapEntry {
  amount: number;
  discount: number;
  discount_type: content_discount_type;
}

/**
 * Legacy discount columns carry no type; they are always a percentage.
 * Price-book rows never come through here; they carry their own
 * `discount_type` and the admin chooses it per item.
 */
function legacyDiscountTypeFor(_entityType: price_entity_type): content_discount_type {
  return "PERCENTAGE";
}

export interface LegacyPriceRow {
  price_inr?: unknown;
  price_usd?: unknown;
  discount_inr?: unknown;
  discount_usd?: unknown;
}

function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * A PRICE, as opposed to a discount. Non-positive means the currency is not
 * priced at all, the admin left it blank, so it must not enter the resolution
 * chain: a buyer whose currency is unpriced falls through to one that is priced,
 * rather than resolving to a free item. Discounts keep using `toAmount`, where 0
 * is a legitimate value meaning "no discount".
 */
function toPriceAmount(value: unknown): number | null {
  const n = toAmount(value);
  return n === null || n <= 0 ? null : n;
}

/** Requested currency if enabled for the tenant, else the tenant default. */
export async function normalizeCurrencyForTenant(
  tenantId: string,
  requested: string,
): Promise<string> {
  const { rows } = await getTenantCurrencyConfig(tenantId);
  const code = String(requested ?? "").toUpperCase();
  if (rows.some((r) => r.currency === code)) return code;
  return rows.find((r) => r.is_default)?.currency ?? rows[0].currency;
}

export async function resolveContentPrice(opts: {
  tenantId: string;
  entityType: price_entity_type;
  entityId: string;
  requestedCurrency: string;
  legacyRow: LegacyPriceRow;
  /**
   * Fallback only. The mode now lives on the content_prices row
   * (`discount_type`), because an admin picks it per item. This is used solely
   * for prices that come from the legacy columns, which carry no type, and
   * legacy discounts have always been percentages, so callers should normally
   * leave it unset.
   */
  discountMode?: "percent" | "amount";
}): Promise<ResolvedContentPrice> {
  // Access-managed storefront: nothing is priceable. Every caller is a
  // user-initiated purchase path (checkout, cart, coupon validation), all of
  // which are already 403-gated by assertSelfServeAllowed, this throw is the
  // backstop that guarantees no order can ever be priced.
  if (await isAccessManaged(opts.tenantId)) {
    throw new BadRequestError(SELF_SERVE_BLOCKED_MESSAGE);
  }

  const { rows } = await getTenantCurrencyConfig(opts.tenantId);
  const enabled = new Set(rows.map((r) => r.currency));
  const defaultCurrency = rows.find((r) => r.is_default)?.currency ?? rows[0].currency;
  const requested = String(opts.requestedCurrency ?? "").toUpperCase();

  // Fetch every enabled currency so the chain can fall through to any priced
  // one (the enabled set is small: typically 2-5 currencies).
  const priceRows = await db
    .selectFrom("content_prices")
    .select(["currency", "amount", "discount", "discount_type"])
    .where("tenant_id", "=", opts.tenantId)
    .where("entity_type", "=", opts.entityType)
    .where("entity_id", "=", opts.entityId)
    .where("currency", "in", [...enabled])
    .execute();

  type Entry = {
    amount: number;
    discount: number;
    discountType: content_discount_type;
    fromBook: boolean;
  };

  const effective = new Map<string, Entry>();
  for (const r of priceRows) {
    const amount = toPriceAmount(r.amount);
    if (amount === null) continue;
    effective.set(r.currency, {
      amount,
      discount: toAmount(r.discount) ?? 0,
      discountType: r.discount_type,
      fromBook: true,
    });
  }
  const addLegacy = (code: "INR" | "USD", amountRaw: unknown, discountRaw: unknown) => {
    if (effective.has(code) || !enabled.has(code)) return;
    const amount = toPriceAmount(amountRaw);
    if (amount === null) return;
    effective.set(code, {
      amount,
      discount: toAmount(discountRaw) ?? 0,
      // An explicit caller override wins; otherwise see legacyDiscountTypeFor.
      discountType:
        opts.discountMode === "amount"
          ? "FLAT"
          : opts.discountMode === "percent"
            ? "PERCENTAGE"
            : legacyDiscountTypeFor(opts.entityType),
      fromBook: false,
    });
  };
  addLegacy("INR", opts.legacyRow.price_inr, opts.legacyRow.discount_inr);
  addLegacy("USD", opts.legacyRow.price_usd, opts.legacyRow.discount_usd);

  // Chain: requested > tenant default > first enabled currency (tenant sort
  // order) that has a price. An item priced in ANY enabled currency is always
  // purchasable; only fully unpriced items are unavailable.
  let pick: { code: string; entry: Entry; source: PriceSource } | null = null;
  if (effective.has(requested)) {
    const entry = effective.get(requested)!;
    pick = { code: requested, entry, source: entry.fromBook ? "PRICE_BOOK" : "LEGACY_COLUMNS" };
  } else if (effective.has(defaultCurrency)) {
    pick = { code: defaultCurrency, entry: effective.get(defaultCurrency)!, source: "DEFAULT_FALLBACK" };
  } else {
    for (const row of rows) {
      const entry = effective.get(row.currency);
      if (entry) {
        pick = { code: row.currency, entry, source: "ENABLED_FALLBACK" };
        break;
      }
    }
  }

  if (!pick) {
    throw new BadRequestError(
      "This item is not available for purchase in the store's enabled currencies",
    );
  }

  // The mode travels with the price row that was actually picked, so an item
  // priced FLAT in INR and falling back to USD still uses that USD row's own
  // type rather than something inferred from the caller.
  const discount = Math.max(0, pick.entry.discount);
  const baseAmount =
    pick.entry.discountType === "FLAT"
      ? Math.max(0, pick.entry.amount - discount)
      : Math.max(0, pick.entry.amount * (1 - Math.min(100, discount) / 100));

  return {
    currency: pick.code,
    baseAmount,
    listAmount: pick.entry.amount,
    priceSource: pick.source,
  };
}

/**
 * Bulk variant for catalog/list responses: returns each entity's price map
 * (currency -> { amount, discount }) limited to the tenant's enabled
 * currencies, merging price-book rows over enabled legacy columns. Display
 * layers feed this straight into @open-mtlms/shared resolvePrice.
 */
export async function getPriceMapsForEntities(
  tenantId: string,
  entityType: price_entity_type,
  entities: Array<{ id: string } & LegacyPriceRow>,
): Promise<Map<string, Record<string, PriceMapEntry>>> {
  const result = new Map<string, Record<string, PriceMapEntry>>();
  if (entities.length === 0) return result;

  // Access-managed storefront: catalog responses carry no price data. Empty
  // maps here (plus the response-edge legacy-column scrub) keep amounts out
  // of the browser entirely; the web app renders Contact Support instead.
  if (await isAccessManaged(tenantId)) {
    for (const entity of entities) result.set(entity.id, {});
    return result;
  }

  const { rows } = await getTenantCurrencyConfig(tenantId);
  const enabled = new Set(rows.map((r) => r.currency));

  const priceRows = await db
    .selectFrom("content_prices")
    .select(["entity_id", "currency", "amount", "discount", "discount_type"])
    .where("tenant_id", "=", tenantId)
    .where("entity_type", "=", entityType)
    .where("entity_id", "in", entities.map((e) => e.id))
    .execute();
  const byEntity = new Map<
    string,
    Array<{ currency: string; amount: unknown; discount: unknown; discount_type: content_discount_type }>
  >();
  for (const r of priceRows) {
    const list = byEntity.get(r.entity_id) ?? [];
    list.push(r);
    byEntity.set(r.entity_id, list);
  }

  for (const entity of entities) {
    const map: Record<string, PriceMapEntry> = {};
    for (const r of byEntity.get(entity.id) ?? []) {
      if (!enabled.has(r.currency)) continue;
      const amount = toPriceAmount(r.amount);
      if (amount === null) continue;
      map[r.currency] = {
        amount,
        discount: toAmount(r.discount) ?? 0,
        discount_type: r.discount_type,
      };
    }
    const addLegacy = (code: "INR" | "USD", amountRaw: unknown, discountRaw: unknown) => {
      if (map[code] || !enabled.has(code)) return;
      const amount = toPriceAmount(amountRaw);
      if (amount === null) return;
      map[code] = {
        amount,
        discount: toAmount(discountRaw) ?? 0,
        discount_type: legacyDiscountTypeFor(entityType),
      };
    };
    addLegacy("INR", entity.price_inr, entity.discount_inr);
    addLegacy("USD", entity.price_usd, entity.discount_usd);
    result.set(entity.id, map);
  }
  return result;
}

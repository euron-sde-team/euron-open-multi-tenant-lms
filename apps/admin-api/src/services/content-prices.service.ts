import type { Transaction } from "kysely";

import type { content_discount_type, price_entity_type } from "../db/enums";
import type { DB } from "../db/types";
import { BadRequestError } from "../errors/bad-request.error";
import contentPricesRepository, {
  type ContentPriceInput,
} from "../repositories/content-prices.repository";
import { getCurrencyDef } from "../utils/currency-registry";
import currencySettingsService from "./currency-settings.service";

/**
 * THE single home of the bidirectional price dual-write rule. Entity services
 * (courses/books/bundles/batches/test-series) call into
 * this service; the rule must never be copied per entity.
 *
 *  - `prices` payload provided: content_prices mirrors the payload exactly and
 *    the INR/USD entries are derived into the legacy price_inr/price_usd
 *    columns (NULL when absent, including when the tenant disabled INR/USD).
 *  - Only legacy fields provided (old admin UI, mobile): INR/USD price rows
 *    are synthesized from them, ONLY while those currencies are enabled.
 *    Rows in other currencies are never touched, and disabled currencies are
 *    never resurrected.
 */

export interface PricesPayloadEntry {
  currency: string;
  amount: number | string;
  discount?: number | string | null;
  /**
   * PERCENTAGE (default) or FLAT. One value per entity, every entry that
   * specifies it must agree. Omitted entirely by older clients, which is why
   * the fallback below reproduces the previous hardcoded behaviour exactly.
   */
  discount_type?: content_discount_type | null;
}

export interface LegacyPriceColumns {
  price_inr: string | null;
  price_usd: string | null;
  discount_inr: string | null;
  discount_usd: string | null;
}

export interface PreparedPrices {
  rows: ContentPriceInput[];
  legacy: LegacyPriceColumns;
}

export interface ContentPriceDto {
  currency: string;
  amount: number;
  discount: number;
  discount_type: content_discount_type;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

class ContentPricesService {
  /**
   * The mode this entity's discount is written in.
   *
   * Before flat discounts became selectable this was hardcoded to
   * `entityType === "HUB_PRODUCT"`. That fallback is preserved verbatim for
   * payloads that carry no `discount_type`, so every existing client, and
   * every hub product, keeps behaving exactly as it did.
   *
   * The value is per ENTITY, not per currency: a mixed payload ("INR is flat,
   * USD is a percentage") is rejected rather than silently resolved, because
   * the resolver reads the mode off whichever currency row it happens to pick.
   */
  private resolveDiscountType(
    entityType: price_entity_type,
    payload: PricesPayloadEntry[],
  ): content_discount_type {
    const specified = payload
      .map((e) => e?.discount_type)
      .filter((t): t is content_discount_type => t === "PERCENTAGE" || t === "FLAT");

    const invalid = payload.find(
      (e) =>
        e?.discount_type !== undefined &&
        e?.discount_type !== null &&
        e.discount_type !== "PERCENTAGE" &&
        e.discount_type !== "FLAT",
    );
    if (invalid) {
      throw new BadRequestError(
        `Invalid discount_type: ${String(invalid.discount_type)}. Expected PERCENTAGE or FLAT`,
      );
    }

    if (specified.length === 0) {
      return "PERCENTAGE";
    }
    if (specified.some((t) => t !== specified[0])) {
      throw new BadRequestError(
        "discount_type must be the same for every currency of an item",
      );
    }
    return specified[0];
  }

  /**
   * Validate and normalize a `prices` request payload. Returns null when the
   * payload is absent (legacy-only writer). Throws BadRequestError on invalid
   * entries, disabled currencies, or a missing default-currency price for PAID
   * content (the invariant that keeps the default-currency fallback safe).
   */
  async prepareFromPayload(
    tenantId: string,
    entityType: price_entity_type,
    payload: unknown,
    opts: { purchaseMode?: string | null } = {},
  ): Promise<PreparedPrices | null> {
    if (payload === undefined || payload === null) return null;
    if (!Array.isArray(payload)) {
      throw new BadRequestError("prices must be an array of { currency, amount, discount }");
    }

    const { currencies } = await currencySettingsService.getEffectiveConfig(tenantId);
    const enabled = new Set(currencies.map((c) => c.currency));
    const defaultCurrency = currencies.find((c) => c.is_default)?.currency ?? "USD";

    // Resolved once for the whole entity, before any row is validated, the
    // per-row rules below differ by mode.
    const discountType = this.resolveDiscountType(entityType, payload as PricesPayloadEntry[]);

    const rows: ContentPriceInput[] = [];
    const seen = new Set<string>();
    for (const entry of payload as PricesPayloadEntry[]) {
      const code = String(entry?.currency ?? "").toUpperCase();
      if (!getCurrencyDef(code)) {
        throw new BadRequestError(`Unsupported currency: ${String(entry?.currency)}`);
      }
      if (!enabled.has(code)) {
        // Stale entry for a currency the tenant has since disabled (e.g. a
        // form hydrated from legacy columns before the switch). Drop it rather
        // than failing the save: the same skip semantics as
        // syncFromLegacyColumns, and deriveLegacy below then NULLs its legacy
        // column, which is exactly the disabled-currency contract.
        continue;
      }
      if (seen.has(code)) {
        throw new BadRequestError(`Duplicate price entry for ${code}`);
      }
      seen.add(code);

      const amount = toNumber(entry.amount);
      if (amount === null || amount < 0) {
        throw new BadRequestError(`Invalid amount for ${code}`);
      }
      if (amount === 0) {
        // Blank field, not a price of zero: the admin priced some other
        // currency and left this one empty. Persisting a 0 row would make the
        // currency look "priced, at free" to every resolver, which is exactly
        // how a USD buyer ended up seeing $0 on an INR-only course. Dropping it
        // (replaceEntityPrices deletes any currency absent from the payload)
        // also clears a previously set price, and deriveLegacy then NULLs the
        // matching legacy column. Mirrors the `amount <= 0` skip in the read
        // resolvers (@open-mtlms/shared money.ts and learner-api price-resolver).
        continue;
      }
      const discount = toNumber(entry.discount) ?? 0;
      if (discount < 0) {
        throw new BadRequestError(`Invalid discount for ${code}`);
      }
      if (discountType === "FLAT") {
        if (discount > amount) {
          throw new BadRequestError(`Discount cannot exceed the price for ${code}`);
        }
      } else if (discount > 100) {
        throw new BadRequestError(`Discount percent cannot exceed 100 for ${code}`);
      }
      rows.push({ currency: code, amount, discount, discount_type: discountType });
    }

    if ((opts.purchaseMode ?? "PAID") === "PAID") {
      const hasDefault = rows.some((r) => r.currency === defaultCurrency && r.amount > 0);
      if (!hasDefault) {
        throw new BadRequestError(
          `Paid content requires a price in the store default currency (${defaultCurrency})`,
        );
      }
    }

    return { rows, legacy: this.deriveLegacy(rows) };
  }

  /** Apply a prepared payload inside the caller's transaction (full mirror). */
  async applyPrepared(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    prepared: PreparedPrices,
    trx: Transaction<DB>,
  ): Promise<void> {
    await contentPricesRepository.syncForEntity(tenantId, entityType, entityId, prepared.rows, trx);
  }

  /**
   * An entity's stored price book as a PreparedPrices, for duplication flows:
   * apply it to the copy with `applyPrepared` and stamp `legacy` onto the
   * copy's INR/USD columns. Null when the entity has no price book rows (a
   * legacy-only record) so callers can fall back to `syncFromLegacyColumns`.
   *
   * Deliberately NOT routed through `prepareFromPayload`: a duplicate must be
   * a faithful copy. Re-validating against today's currency settings would
   * make duplication start failing for items priced under earlier settings
   * (e.g. the default currency changed since), and it must never reinterpret
   * the stored `discount_type`, copying a flat hub discount through the
   * legacy columns is exactly what turned a ₹1,000-off product into a
   * 100%-off free one.
   */
  async snapshotEntityPrices(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    trx?: Transaction<DB>,
  ): Promise<PreparedPrices | null> {
    const stored = await contentPricesRepository.listByEntity(tenantId, entityType, entityId, trx);
    if (stored.length === 0) return null;
    const rows: ContentPriceInput[] = stored.map((r) => ({
      currency: r.currency,
      amount: Number(r.amount),
      discount: Number(r.discount),
      discount_type: r.discount_type,
    }));
    return { rows, legacy: this.deriveLegacy(rows) };
  }

  /**
   * Legacy-only writers: synthesize INR/USD rows from the legacy column values
   * that the caller is about to persist. Pass undefined for fields the request
   * did not touch (they are left alone); null/empty clears the row.
   */
  async syncFromLegacyColumns(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    legacy: {
      price_inr?: unknown;
      price_usd?: unknown;
      discount_inr?: unknown;
      discount_usd?: unknown;
    },
    trx: Transaction<DB>,
  ): Promise<void> {
    const { currencies } = await currencySettingsService.getEffectiveConfig(tenantId);
    const enabled = new Set(currencies.map((c) => c.currency));

    /**
     * The type a legacy-only WRITER means by its discount value.
     *
     * Non-hub legacy discounts have always been percentages. Hub legacy
     * clients, however, have always sent FLAT amounts, the hardcoded
     * pre-`discount_type` behaviour, and the same rule the learner-api's
     * `legacyDiscountTypeFor()` applies when reading un-typed hub columns.
     * Stamping hub syncs as PERCENTAGE created rows like "amount 10000,
     * discount 1000, PERCENTAGE", which the resolver clamps to 100% off: a
     * free product (this is how duplicating a hub product broke its price).
     *
     * Known trade-off: a post-migration legacy client that echoes back the
     * percent-equivalent it read from our derived columns gets its value
     * stored as FLAT, which UNDER-discounts slightly. That is accepted, the
     * PERCENTAGE reading of a genuine flat amount over-discounts up to 100%,
     * and no current client writes hub prices legacy-only (the admin UI
     * always sends `prices[]`; this path serves old external clients).
     */
    const legacyWriterType: content_discount_type =
      "PERCENTAGE";

    const upserts: ContentPriceInput[] = [];
    const removals: string[] = [];
    const handle = (code: "INR" | "USD", amountRaw: unknown, discountRaw: unknown) => {
      if (amountRaw === undefined) return; // field untouched by this request
      if (!enabled.has(code)) return; // never resurrect a disabled currency
      const amount = toNumber(amountRaw);
      if (amount === null || amount < 0) {
        removals.push(code);
        return;
      }
      upserts.push({
        currency: code,
        amount,
        discount: toNumber(discountRaw) ?? 0,
        discount_type: legacyWriterType,
      });
    };
    handle("INR", legacy.price_inr, legacy.discount_inr);
    handle("USD", legacy.price_usd, legacy.discount_usd);

    if (upserts.length === 0 && removals.length === 0) return;
    await contentPricesRepository.upsertPartial(
      tenantId,
      entityType,
      entityId,
      upserts,
      removals,
      trx,
    );
  }

  /** Detail-response helper: the entity's full price book as numbers. */
  async getEntityPrices(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
  ): Promise<ContentPriceDto[]> {
    const rows = await contentPricesRepository.listByEntity(tenantId, entityType, entityId);
    return rows.map((r) => ({
      currency: r.currency,
      amount: Number(r.amount),
      discount: Number(r.discount),
      discount_type: r.discount_type,
    }));
  }

  /**
   * Publish-time guard: a PAID item must have a resolvable price (> 0) in the
   * tenant default currency, via a price row or, for INR/USD while enabled,
   * the legacy columns (merged-view rule).
   */
  async checkDefaultCurrencyPrice(
    tenantId: string,
    entityType: price_entity_type,
    entityId: string,
    legacyRow: { price_inr?: unknown; price_usd?: unknown },
  ): Promise<{ ok: boolean; defaultCurrency: string }> {
    const { currencies } = await currencySettingsService.getEffectiveConfig(tenantId);
    const defaultCurrency = currencies.find((c) => c.is_default)?.currency ?? "USD";

    const rows = await contentPricesRepository.listByEntity(tenantId, entityType, entityId);
    const row = rows.find((r) => r.currency === defaultCurrency);
    if (row && Number(row.amount) > 0) return { ok: true, defaultCurrency };

    const legacyValue =
      defaultCurrency === "INR"
        ? toNumber(legacyRow.price_inr)
        : defaultCurrency === "USD"
          ? toNumber(legacyRow.price_usd)
          : null;
    return { ok: legacyValue !== null && legacyValue > 0, defaultCurrency };
  }

  /**
   * The legacy discount columns are ALWAYS a percentage.
   *
   * Every reader of price_inr/discount_inr treats that number as a percent.
   * the mobile app most importantly, since it ships on its own release cycle
   * and has its own copy of the price resolver. Writing a flat ₹100 through
   * unchanged would be read as "100% off" and hand the item over for free.
   *
   * So a FLAT row is mirrored as its percent equivalent. content_prices keeps
   * the authoritative flat amount; this is a compatibility shim and nothing
   * may ever write back from it.
   *
   * It cannot go stale: the price cannot change without coming through this
   * same write path, which recomputes the percentage in the same transaction.
   */
  private legacyDiscountPercent(row: ContentPriceInput | undefined): string | null {
    if (!row) return null;
    if (row.discount_type !== "FLAT") return row.discount.toFixed(2);
    // A zero/absent price has no meaningful percentage; 0 is the safe reading
    // (no discount) rather than a division by zero.
    if (row.amount <= 0) return "0.00";
    const percent = (row.discount / row.amount) * 100;
    return Math.min(100, Math.max(0, percent)).toFixed(2);
  }

  private deriveLegacy(rows: ContentPriceInput[]): LegacyPriceColumns {
    const inr = rows.find((r) => r.currency === "INR");
    const usd = rows.find((r) => r.currency === "USD");
    return {
      price_inr: inr ? inr.amount.toFixed(2) : null,
      price_usd: usd ? usd.amount.toFixed(2) : null,
      discount_inr: this.legacyDiscountPercent(inr),
      discount_usd: this.legacyDiscountPercent(usd),
    };
  }
}

export default new ContentPricesService();

import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import couponsRepository from "../repositories/coupons.repository";
import type { CouponListParams, CreateCouponApplicableItem, CreateCouponInput } from "../repositories/coupons.repository";
import { db } from "../db/connection";

/**
 * FIXED coupons reach this table two ways: legacy rows, and the test-series
 * coupons folded in by docs/migrations/coupons-test-series-and-private.sql.
 * The admin UI only authors PERCENTAGE, but editing a FIXED coupon must be able
 * to round-trip its own type rather than silently rewriting it.
 */
export type CouponDiscountType = "PERCENTAGE" | "FIXED";

export interface CreateCouponRequest {
  code: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  valid_from: string;
  valid_to?: string | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  /** false = redeemable by code only, never advertised on the storefront. */
  is_public?: boolean;
  applicable_to_all?: boolean;
  applicable_items?: CreateCouponApplicableItem[];
  /** Required for FIXED (the amount is in this currency); ignored for PERCENTAGE. */
  currency?: string | null;
}

export interface UpdateCouponRequest {
  code?: string;
  discount_type?: CouponDiscountType;
  discount_value?: number;
  valid_from?: string;
  valid_to?: string | null;
  max_uses?: number | null;
  max_uses_per_user?: number | null;
  is_public?: boolean;
  applicable_to_all?: boolean;
  applicable_items?: CreateCouponApplicableItem[];
  /** Required for FIXED (the amount is in this currency); ignored for PERCENTAGE. */
  currency?: string | null;
}

class CouponsService {
  /**
   * PERCENTAGE coupons are currency-agnostic (null). A FIXED amount means
   * nothing without a currency, so it must name one the tenant has enabled.
   */
  private async resolveCouponCurrency(
    tenantId: string,
    type: CouponDiscountType,
    currency: string | null | undefined
  ): Promise<string | null> {
    if (type !== "FIXED") return null;
    const code = (currency ?? "").trim().toUpperCase();
    if (!code) throw new BadRequestError("A FIXED coupon needs a currency (e.g. INR or USD)");
    const enabled = await db
      .selectFrom("tenant_currencies")
      .select("currency")
      .where("tenant_id", "=", tenantId)
      .where("is_active", "=", true)
      .execute();
    // Zero rows means the built-in default set (INR + USD).
    const allowed = enabled.length ? enabled.map((r) => r.currency) : ["INR", "USD"];
    if (!allowed.includes(code)) {
      throw new BadRequestError(`Currency ${code} is not enabled for this school`);
    }
    return code;
  }

  async listCoupons(tenantId: string, params: CouponListParams) {
    return couponsRepository.findAll(tenantId, params);
  }

  async getCoupon(tenantId: string, id: string) {
    const coupon = await couponsRepository.findById(tenantId, id);
    if (!coupon) throw new NotFoundError("Coupon not found");
    const applicableItems = await couponsRepository.findApplicableItems(tenantId, id);
    return { ...coupon, applicableItems };
  }

  async createCoupon(tenantId: string, req: CreateCouponRequest) {
    const code = req.code.trim().toUpperCase();
    if (!code) throw new BadRequestError("Coupon code is required");

    if (req.discount_value <= 0) {
      throw new BadRequestError("Discount value must be greater than zero");
    }
    if (req.discount_type === "PERCENTAGE" && req.discount_value > 100) {
      throw new BadRequestError("Percentage discount must be between 1 and 100");
    }

    // Validate the dates BEFORE they become Date objects. `new Date(undefined)`
    // is an Invalid Date, and an Invalid Date handed to the driver serialises
    // as "0NaN-NaN-NaN…", a Postgres DateTimeParseError surfacing as a 500
    // for what is really a caller mistake.
    const validFrom = new Date(req.valid_from);
    if (!req.valid_from || Number.isNaN(validFrom.getTime())) {
      throw new BadRequestError("valid_from is required (an ISO date, e.g. 2026-10-01)");
    }
    const validTo = req.valid_to ? new Date(req.valid_to) : null;
    if (validTo && Number.isNaN(validTo.getTime())) {
      throw new BadRequestError("valid_to is not a readable date (use ISO, e.g. 2026-10-01)");
    }
    if (validTo && validTo <= validFrom) {
      throw new BadRequestError("Expiry date must be after start date");
    }

    const currency = await this.resolveCouponCurrency(tenantId, req.discount_type, req.currency);

    const existing = await couponsRepository.findByCode(tenantId, code);
    if (existing) throw new ConflictError(`Coupon code "${code}" already exists`);

    const input: CreateCouponInput = {
      code,
      discount_type: req.discount_type,
      discount_value: req.discount_value,
      valid_from: validFrom,
      valid_to: validTo,
      max_uses: req.max_uses ?? null,
      max_uses_per_user: req.max_uses_per_user ?? null,
      is_public: req.is_public ?? true,
      currency,
      applicable_items: req.applicable_to_all ? [] : (req.applicable_items ?? []),
    };

    return db.transaction().execute(async (trx) => {
      return couponsRepository.create(tenantId, input, trx);
    });
  }

  async updateCoupon(tenantId: string, id: string, req: UpdateCouponRequest) {
    const coupon = await couponsRepository.findById(tenantId, id);
    if (!coupon) throw new NotFoundError("Coupon not found");

    if (req.code) {
      const code = req.code.trim().toUpperCase();
      const existing = await couponsRepository.findByCode(tenantId, code);
      if (existing && existing.id !== id) throw new ConflictError(`Coupon code "${code}" already exists`);
      req.code = code;
    }

    if (req.discount_value !== undefined) {
      if (req.discount_value <= 0) {
        throw new BadRequestError("Discount value must be greater than zero");
      }
      // A partial update may change the value without restating the type, so
      // fall back to the stored one rather than skipping the bound entirely.
      const effectiveType = req.discount_type ?? coupon.discount_type;
      if (effectiveType === "PERCENTAGE" && req.discount_value > 100) {
        throw new BadRequestError("Percentage discount must be between 1 and 100");
      }
    }

    // Re-resolve when the type or currency changes; a FIXED coupon always
    // carries the currency its amount is in.
    const nextType = req.discount_type ?? (coupon.discount_type as CouponDiscountType);
    const currency =
      req.discount_type !== undefined || req.currency !== undefined
        ? await this.resolveCouponCurrency(tenantId, nextType, req.currency ?? coupon.currency)
        : undefined;

    return db.transaction().execute(async (trx) => {
      const updated = await couponsRepository.update(
        tenantId,
        id,
        {
          code: req.code,
          discount_type: req.discount_type,
          discount_value: req.discount_value,
          valid_from: req.valid_from ? new Date(req.valid_from) : undefined,
          valid_to:
            req.valid_to !== undefined ? (req.valid_to ? new Date(req.valid_to) : null) : undefined,
          max_uses: req.max_uses !== undefined ? req.max_uses : undefined,
          max_uses_per_user: req.max_uses_per_user !== undefined ? req.max_uses_per_user : undefined,
          is_public: req.is_public !== undefined ? req.is_public : undefined,
          currency,
        },
        trx,
      );

      // Flipping a coupon back to "applies to all products" has to clear its old
      // restriction rows. Keying only off `applicable_items !== undefined` left
      // them in place, so the coupon stayed silently scoped.
      if (req.applicable_to_all === true) {
        await couponsRepository.syncApplicableItems(tenantId, id, [], trx);
      } else if (req.applicable_items !== undefined) {
        await couponsRepository.syncApplicableItems(tenantId, id, req.applicable_items, trx);
      }

      return updated;
    });
  }

  async toggleCoupon(tenantId: string, id: string) {
    const coupon = await couponsRepository.findById(tenantId, id);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return couponsRepository.toggleActive(tenantId, id);
  }

  async deleteCoupon(tenantId: string, id: string) {
    const coupon = await couponsRepository.findById(tenantId, id);
    if (!coupon) throw new NotFoundError("Coupon not found");
    await couponsRepository.delete(tenantId, id);
  }

  async getAnalytics(tenantId: string, couponId: string) {
    const coupon = await couponsRepository.findById(tenantId, couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return couponsRepository.getAnalytics(tenantId, couponId);
  }

  async getDetailedAnalytics(tenantId: string, couponId: string) {
    const coupon = await couponsRepository.findById(tenantId, couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return couponsRepository.getDetailedAnalytics(
      tenantId,
      couponId,
      coupon.max_uses ?? null,
      typeof coupon.used_count === "string" ? parseInt(coupon.used_count, 10) : Number(coupon.used_count ?? 0),
    );
  }

  async getRedemptions(tenantId: string, couponId: string, page: number, limit: number) {
    const coupon = await couponsRepository.findById(tenantId, couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return couponsRepository.getRedemptions(tenantId, couponId, page, limit);
  }
}

export default new CouponsService();

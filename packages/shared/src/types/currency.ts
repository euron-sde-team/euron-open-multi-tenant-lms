/**
 * Multi-currency pricing types shared across admin, web, and template packages.
 * The display registry lives in ../constants/currencies (frontend variant of the
 * backend currency registries; keep in sync per the mirror note there).
 */

export interface ContentPrice {
  /** ISO 4217 code, e.g. "INR", "MAD". */
  currency: string;
  /** Major-unit price (e.g. 499.00). */
  amount: number;
  /** Read according to `discount_type`. */
  discount: number | null;
  /**
   * How `discount` is read. Chosen by the admin per item and stored on the
   * price-book row, replacing the old rule of inferring it from the entity type
   * (percent everywhere, flat for hub products).
   *
   * Optional because it is absent on legacy-derived entries and on responses
   * cached before the column existed; `resolvePrice` falls back to the caller's
   * `discountMode` in that case.
   */
  discount_type?: "PERCENTAGE" | "FLAT" | null;
}

export interface TenantCurrencyConfig {
  currency: string;
  is_default: boolean;
  /** ISO-3166 alpha-2 codes served by this currency; "*" = rest-of-world catch-all. */
  countries: string[];
  sort_order: number;
}

export interface TenantCurrencySettings {
  currencies: TenantCurrencyConfig[];
  /** True when the tenant has never saved settings (virtual INR+USD configuration). */
  is_virtual?: boolean;
}

/** Response shape of the learner-api GET /currency-context endpoint. */
export interface CurrencyContext {
  /** Buyer's resolved presentment currency. */
  currency: string;
  /** ISO-3166 alpha-2 country, when resolvable. */
  country: string | null;
  /** How the currency was resolved (MEMBER_PREF, GEO_CF, GEO_DB, TZ_HINT, TENANT_DEFAULT, LEGACY). */
  source: string;
  default_currency: string;
  enabled_currencies: Array<{
    code: string;
    symbol: string;
    decimals: number;
    is_default: boolean;
  }>;
  member_preference: string | null;
  /**
   * Access-managed storefront: prices hidden, all self-serve purchase blocked,
   * access assigned only by tenant admins. Optional for backward compatibility
   * with older server responses, treat missing as false.
   */
  access_managed?: boolean;
  /** Contact target for the "Contact Support" CTA; only populated when access_managed is true. */
  support_email?: string | null;
  /**
   * Whether learners can access certificates (Certificates profile tab).
   * Optional for backward compatibility, treat missing as true (enabled by default).
   */
  certificate_tab_enabled?: boolean;
  /**
   * When true, the job portal shows only organisation-posted jobs, external
   * job search (and its API/quota) is hidden. Optional for backward
   * compatibility, treat missing as false (external search allowed).
   */
  /**
   * When true, learners only see the courses they are enrolled in, the public
   * course catalog / explore surfaces are hidden across web and mobile, and the
   * learner-api forces enrolled-only listing for everyone (including
   * subscribers). Optional for backward compatibility, treat missing as false
   * (full catalog visible).
   */
  enrolled_courses_only_enabled?: boolean;
}

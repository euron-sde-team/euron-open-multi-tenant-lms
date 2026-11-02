import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import {
  REST_OF_WORLD,
  VIRTUAL_TENANT_CURRENCIES,
  getCurrencyDef,
} from "../utils/currency-registry";
import { getCountryFromIp } from "../utils/geo-country";

/**
 * Buyer currency resolution for the storefront.
 *
 * Resolution order:
 *   member preference (if still enabled)
 *   > country (cf-ipcountry > geoip lookup > timezone hint)
 *     mapped through tenant rules (exact country > "*" catch-all > default row)
 *   > tenant default currency.
 *
 * A tenant with zero tenant_currencies rows runs the virtual default config
 * (INR for IN, USD default for the rest of the world), which reproduces the
 * pre-multi-currency behavior exactly.
 */

export type CurrencySource =
  | "MEMBER_PREF"
  | "GEO_CF"
  | "GEO_DB"
  | "TZ_HINT"
  | "TENANT_DEFAULT"
  | "LEGACY";

export interface TenantCurrencyConfig {
  currency: string;
  is_default: boolean;
  countries: string[];
  sort_order: number;
}

export interface CurrencyContextResult {
  currency: string;
  country: string | null;
  source: CurrencySource;
  default_currency: string;
  enabled_currencies: Array<{
    code: string;
    symbol: string;
    decimals: number;
    is_default: boolean;
  }>;
  member_preference: string | null;
}

const CONFIG_CACHE_TTL_MS = 60 * 1000;
const configCache = new Map<
  string,
  { config: { rows: TenantCurrencyConfig[]; isVirtual: boolean }; expiresAt: number }
>();

function parseCountries(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Tenant currency configuration with the virtual default applied (60s cache). */
export async function getTenantCurrencyConfig(
  tenantId: string,
): Promise<{ rows: TenantCurrencyConfig[]; isVirtual: boolean }> {
  const cached = configCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.config;

  const dbRows = await db
    .selectFrom("tenant_currencies")
    .select(["currency", "is_default", "countries", "sort_order"])
    .where("tenant_id", "=", tenantId)
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .execute();

  const config =
    dbRows.length === 0
      ? {
          rows: VIRTUAL_TENANT_CURRENCIES.map((v) => ({
            currency: v.currency,
            is_default: v.is_default,
            countries: [...v.countries],
            sort_order: v.sort_order,
          })),
          isVirtual: true,
        }
      : {
          rows: dbRows.map((r) => ({
            currency: r.currency,
            is_default: r.is_default,
            countries: parseCountries(r.countries),
            sort_order: r.sort_order,
          })),
          isVirtual: false,
        };

  configCache.set(tenantId, { config, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  return config;
}

export async function getEnabledCurrencyCodes(tenantId: string): Promise<string[]> {
  const { rows } = await getTenantCurrencyConfig(tenantId);
  return rows.map((r) => r.currency);
}

export async function getDefaultCurrency(tenantId: string): Promise<string> {
  const { rows } = await getTenantCurrencyConfig(tenantId);
  return rows.find((r) => r.is_default)?.currency ?? "USD";
}

const INDIAN_TIMEZONES = new Set(["Asia/Kolkata", "Asia/Calcutta"]);

function isValidCountry(value: unknown): value is string {
  // Cloudflare uses XX (unknown) and T1 (Tor); treat both as unresolved.
  return typeof value === "string" && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1";
}

async function resolveCountry(opts: {
  cfCountry?: string | null;
  ip?: string | null;
  tz?: string | null;
}): Promise<{ country: string | null; source: "GEO_CF" | "GEO_DB" | "TZ_HINT" | null }> {
  const cf = opts.cfCountry?.toUpperCase();
  if (isValidCountry(cf)) return { country: cf, source: "GEO_CF" };

  const fromIp = await getCountryFromIp(opts.ip);
  if (fromIp) return { country: fromIp, source: "GEO_DB" };

  if (opts.tz && INDIAN_TIMEZONES.has(opts.tz)) return { country: "IN", source: "TZ_HINT" };
  return { country: null, source: null };
}

function mapCountryToCurrency(
  rows: TenantCurrencyConfig[],
  country: string | null,
): { currency: string; viaDefault: boolean } {
  if (country) {
    const exact = rows.find((r) => r.countries.includes(country));
    if (exact) return { currency: exact.currency, viaDefault: false };
  }
  const catchAll = rows.find((r) => r.countries.includes(REST_OF_WORLD));
  if (catchAll) return { currency: catchAll.currency, viaDefault: false };
  const def = rows.find((r) => r.is_default) ?? rows[0];
  return { currency: def.currency, viaDefault: true };
}

async function getMemberPreference(
  tenantId: string,
  memberId: string,
): Promise<string | null> {
  const row = await db
    .selectFrom("tenant_members")
    .select("profile_metadata")
    .where("id", "=", memberId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!row?.profile_metadata) return null;
  const metadata =
    typeof row.profile_metadata === "string"
      ? (() => {
          try {
            return JSON.parse(row.profile_metadata as string) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : (row.profile_metadata as Record<string, unknown>);
  const preferred = metadata?.preferred_currency;
  return typeof preferred === "string" && preferred.length > 0 ? preferred.toUpperCase() : null;
}

export async function resolveCurrencyContext(
  tenantId: string,
  opts: {
    memberId?: string | null;
    cfCountry?: string | null;
    ip?: string | null;
    tz?: string | null;
  },
): Promise<CurrencyContextResult> {
  const { rows, isVirtual } = await getTenantCurrencyConfig(tenantId);
  const enabled = new Set(rows.map((r) => r.currency));
  const defaultCurrency = rows.find((r) => r.is_default)?.currency ?? rows[0].currency;

  const memberPreference = opts.memberId
    ? await getMemberPreference(tenantId, opts.memberId)
    : null;

  const { country, source: countrySource } = await resolveCountry(opts);

  let currency: string;
  let source: CurrencySource;
  if (memberPreference && enabled.has(memberPreference)) {
    currency = memberPreference;
    source = "MEMBER_PREF";
  } else {
    const mapped = mapCountryToCurrency(rows, country);
    currency = mapped.currency;
    if (mapped.viaDefault || !countrySource) {
      source = isVirtual ? "LEGACY" : "TENANT_DEFAULT";
    } else {
      source = countrySource;
    }
  }

  return {
    currency,
    country,
    source,
    default_currency: defaultCurrency,
    enabled_currencies: rows.map((r) => {
      const def = getCurrencyDef(r.currency);
      return {
        code: r.currency,
        symbol: def?.symbol ?? r.currency,
        decimals: def?.decimals ?? 2,
        is_default: r.is_default,
      };
    }),
    member_preference: memberPreference && enabled.has(memberPreference) ? memberPreference : null,
  };
}

/** Persist the buyer's manual currency choice on their member profile. */
export async function setMemberCurrencyPreference(
  tenantId: string,
  memberId: string,
  currency: string,
): Promise<void> {
  const code = String(currency ?? "").toUpperCase();
  if (!getCurrencyDef(code)) throw new BadRequestError(`Unsupported currency: ${currency}`);
  const enabled = await getEnabledCurrencyCodes(tenantId);
  if (!enabled.includes(code)) {
    throw new BadRequestError(`Currency ${code} is not enabled for this store`);
  }

  const row = await db
    .selectFrom("tenant_members")
    .select("profile_metadata")
    .where("id", "=", memberId)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();
  if (!row) throw new BadRequestError("Member not found");

  let metadata: Record<string, unknown> = {};
  if (row.profile_metadata) {
    if (typeof row.profile_metadata === "string") {
      try {
        metadata = JSON.parse(row.profile_metadata) as Record<string, unknown>;
      } catch {
        metadata = {};
      }
    } else {
      metadata = { ...(row.profile_metadata as Record<string, unknown>) };
    }
  }
  metadata.preferred_currency = code;

  await db
    .updateTable("tenant_members")
    .set({ profile_metadata: JSON.stringify(metadata), updated_at: new Date() })
    .where("id", "=", memberId)
    .where("tenant_id", "=", tenantId)
    .execute();
}

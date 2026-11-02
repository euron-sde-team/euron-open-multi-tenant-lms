/**
 * Platform currency registry (ISO 4217).
 *
 * MIRRORED FILE: keep all four copies in sync.
 *  - apps/learner-api/src/utils/currency-registry.ts
 *  - apps/admin-api/src/utils/currency-registry.ts
 *  - apps/console-api/src/utils/currency-registry.ts
 *  - packages/shared/src/constants/currencies.ts (frontend variant)
 *
 * `decimals` is the ISO 4217 minor-unit exponent. Gateway amounts are sent in the
 * smallest unit, so JPY 1000 stays 1000 while INR 1000 becomes 100000 paise.
 * Gateway support flags drive checkout validation and tenant-admin settings warnings.
 */

export type GatewayProviderName = "RAZORPAY" | "STRIPE";

export interface CurrencyDef {
  code: string;
  name: string;
  symbol: string;
  decimals: 0 | 2 | 3;
  razorpaySupported: boolean;
  stripeSupported: boolean;
}

const def = (
  code: string,
  name: string,
  symbol: string,
  decimals: 0 | 2 | 3 = 2,
): CurrencyDef => ({
  code,
  name,
  symbol,
  decimals,
  // Razorpay international acceptance needs merchant approval on their side.
  razorpaySupported: true,
  stripeSupported: true,
});

export const CURRENCY_LIST: CurrencyDef[] = [
  def("INR", "Indian Rupee", "₹"),
  def("USD", "US Dollar", "$"),
  def("EUR", "Euro", "€"),
  def("GBP", "British Pound", "£"),
  def("AED", "UAE Dirham", "AED"),
  def("MAD", "Moroccan Dirham", "MAD"),
  def("SAR", "Saudi Riyal", "SAR"),
  def("QAR", "Qatari Riyal", "QAR"),
  def("KWD", "Kuwaiti Dinar", "KD", 3),
  def("BHD", "Bahraini Dinar", "BD", 3),
  def("OMR", "Omani Rial", "OMR", 3),
  def("SGD", "Singapore Dollar", "S$"),
  def("MYR", "Malaysian Ringgit", "RM"),
  def("IDR", "Indonesian Rupiah", "Rp"),
  def("THB", "Thai Baht", "฿"),
  def("PHP", "Philippine Peso", "₱"),
  def("VND", "Vietnamese Dong", "₫", 0),
  def("JPY", "Japanese Yen", "¥", 0),
  def("KRW", "South Korean Won", "₩", 0),
  def("AUD", "Australian Dollar", "A$"),
  def("NZD", "New Zealand Dollar", "NZ$"),
  def("CAD", "Canadian Dollar", "C$"),
  def("CHF", "Swiss Franc", "CHF"),
  def("HKD", "Hong Kong Dollar", "HK$"),
  def("CNY", "Chinese Yuan", "CN¥"),
  def("ZAR", "South African Rand", "R"),
  def("NGN", "Nigerian Naira", "₦"),
  def("KES", "Kenyan Shilling", "KSh"),
  def("EGP", "Egyptian Pound", "E£"),
  def("BDT", "Bangladeshi Taka", "৳"),
  def("LKR", "Sri Lankan Rupee", "Rs"),
  def("NPR", "Nepalese Rupee", "Rs"),
  def("BRL", "Brazilian Real", "R$"),
  def("MXN", "Mexican Peso", "MX$"),
];

export const CURRENCY_REGISTRY: Record<string, CurrencyDef> = Object.fromEntries(
  CURRENCY_LIST.map((c) => [c.code, c]),
);

export function getCurrencyDef(code: string | null | undefined): CurrencyDef | null {
  if (!code) return null;
  return CURRENCY_REGISTRY[code.toUpperCase()] ?? null;
}

export function isRegistryCurrency(code: string | null | undefined): boolean {
  return getCurrencyDef(code) !== null;
}

/**
 * Convert a major-unit amount to the gateway smallest unit per ISO 4217.
 * Unknown codes fall back to 2 decimals (the pre-multi-currency behavior).
 */
export function toSmallestUnit(amount: number, code: string): number {
  const decimals = getCurrencyDef(code)?.decimals ?? 2;
  return Math.round(amount * Math.pow(10, decimals));
}

export function fromSmallestUnit(minor: number, code: string): number {
  const decimals = getCurrencyDef(code)?.decimals ?? 2;
  return minor / Math.pow(10, decimals);
}

export function gatewaySupportsCurrency(provider: string, code: string): boolean {
  const definition = getCurrencyDef(code);
  if (!definition) return false;
  switch (provider) {
    case "RAZORPAY":
      return definition.razorpaySupported;
    case "STRIPE":
      return definition.stripeSupported;
    default:
      // Unknown providers are validated conservatively.
      return false;
  }
}

/** Special country marker on tenant_currencies.countries: rest-of-world catch-all. */
export const REST_OF_WORLD = "*";

/**
 * Virtual tenant currency configuration. A tenant with zero tenant_currencies rows
 * behaves exactly as today: INR for India, USD (default) for the rest of the world.
 * Shared by the tenant-admin settings service and the learner-api currency context
 * resolver; real rows are materialized only when a tenant first saves settings.
 */
export interface VirtualTenantCurrency {
  currency: string;
  is_default: boolean;
  countries: string[];
  sort_order: number;
}

export const VIRTUAL_TENANT_CURRENCIES: VirtualTenantCurrency[] = [
  { currency: "INR", is_default: false, countries: ["IN"], sort_order: 0 },
  { currency: "USD", is_default: true, countries: [REST_OF_WORLD], sort_order: 1 },
];

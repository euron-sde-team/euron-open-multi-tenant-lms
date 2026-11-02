/**
 * Platform currency registry (ISO 4217), frontend variant.
 *
 * MIRRORED FILE: keep all three copies in sync.
 *  - apps/learner-api/src/utils/currency-registry.ts
 *  - apps/admin-api/src/utils/currency-registry.ts
 *  - packages/shared/src/constants/currencies.ts (this file)
 *
 * `decimals` is the ISO 4217 minor-unit exponent (0 for JPY/KRW/VND, 3 for KWD/BHD/OMR).
 * `locale` drives Intl.NumberFormat grouping and symbol placement in formatMoney().
 * `gateways` powers informational badges in the tenant admin currency settings.
 */

export interface PlatformCurrency {
  code: string;
  name: string;
  symbol: string;
  decimals: 0 | 2 | 3;
  locale: string;
  gateways: Array<"razorpay" | "stripe">;
}

const def = (
  code: string,
  name: string,
  symbol: string,
  locale: string,
  decimals: 0 | 2 | 3 = 2,
): PlatformCurrency => ({
  code,
  name,
  symbol,
  decimals,
  locale,
  gateways: ["razorpay", "stripe"],
});

export const PLATFORM_CURRENCIES: PlatformCurrency[] = [
  def("INR", "Indian Rupee", "₹", "en-IN"),
  def("USD", "US Dollar", "$", "en-US"),
  def("EUR", "Euro", "€", "en-IE"),
  def("GBP", "British Pound", "£", "en-GB"),
  def("AED", "UAE Dirham", "AED", "en-AE"),
  def("MAD", "Moroccan Dirham", "MAD", "fr-MA"),
  def("SAR", "Saudi Riyal", "SAR", "en-SA"),
  def("QAR", "Qatari Riyal", "QAR", "en-QA"),
  def("KWD", "Kuwaiti Dinar", "KD", "en-KW", 3),
  def("BHD", "Bahraini Dinar", "BD", "en-BH", 3),
  def("OMR", "Omani Rial", "OMR", "en-OM", 3),
  def("SGD", "Singapore Dollar", "S$", "en-SG"),
  def("MYR", "Malaysian Ringgit", "RM", "ms-MY"),
  def("IDR", "Indonesian Rupiah", "Rp", "id-ID"),
  def("THB", "Thai Baht", "฿", "th-TH"),
  def("PHP", "Philippine Peso", "₱", "en-PH"),
  def("VND", "Vietnamese Dong", "₫", "vi-VN", 0),
  def("JPY", "Japanese Yen", "¥", "ja-JP", 0),
  def("KRW", "South Korean Won", "₩", "ko-KR", 0),
  def("AUD", "Australian Dollar", "A$", "en-AU"),
  def("NZD", "New Zealand Dollar", "NZ$", "en-NZ"),
  def("CAD", "Canadian Dollar", "C$", "en-CA"),
  def("CHF", "Swiss Franc", "CHF", "de-CH"),
  def("HKD", "Hong Kong Dollar", "HK$", "en-HK"),
  def("CNY", "Chinese Yuan", "CN¥", "zh-CN"),
  def("ZAR", "South African Rand", "R", "en-ZA"),
  def("NGN", "Nigerian Naira", "₦", "en-NG"),
  def("KES", "Kenyan Shilling", "KSh", "en-KE"),
  def("EGP", "Egyptian Pound", "E£", "en-EG"),
  def("BDT", "Bangladeshi Taka", "৳", "bn-BD"),
  def("LKR", "Sri Lankan Rupee", "Rs", "en-LK"),
  def("NPR", "Nepalese Rupee", "Rs", "ne-NP"),
  def("BRL", "Brazilian Real", "R$", "pt-BR"),
  def("MXN", "Mexican Peso", "MX$", "es-MX"),
];

export const PLATFORM_CURRENCY_MAP: Record<string, PlatformCurrency> = Object.fromEntries(
  PLATFORM_CURRENCIES.map((c) => [c.code, c]),
);

export function getPlatformCurrency(code: string | null | undefined): PlatformCurrency | null {
  if (!code) return null;
  return PLATFORM_CURRENCY_MAP[code.toUpperCase()] ?? null;
}

export function getCurrencySymbol(code: string | null | undefined): string {
  return getPlatformCurrency(code)?.symbol ?? (code ? code.toUpperCase() : "");
}

/** Special country marker on tenant currency rows: rest-of-world catch-all. */
export const REST_OF_WORLD = "*";

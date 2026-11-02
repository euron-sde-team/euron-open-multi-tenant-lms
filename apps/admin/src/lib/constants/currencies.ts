export interface CurrencyOption {
  code: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "ZAR", name: "South African Rand" },
  { code: "MXN", name: "Mexican Peso" },
];

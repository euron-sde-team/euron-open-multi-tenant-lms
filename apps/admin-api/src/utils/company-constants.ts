import { BRAND } from "../lib/brand";

/** Platform operator identity used on platform invoices. */
export const PLATFORM_COMPANY = BRAND;

export const TAX_RATES = {
  GST_TOTAL: 0.18,
  CGST: 0.09,
  SGST: 0.09,
  IGST: 0.18,
};

export interface TaxBreakdownResult {
  subtotal: number;
  cgst: number | undefined;
  sgst: number | undefined;
  totalTax: number;
  total: number;
  taxLabel: string;
}

export function calculateTaxBreakdown(
  amount: number,
  currency: string,
  options?: {
    taxPercentage?: number;
    taxMode?: "INCLUSIVE" | "EXCLUSIVE";
    isIndian?: boolean;
  },
): TaxBreakdownResult {
  const rate = options?.taxPercentage ?? 18;
  const mode = options?.taxMode ?? "INCLUSIVE";
  const isIndian = options?.isIndian ?? currency === "INR";

  if (rate === 0) {
    return {
      subtotal: amount,
      cgst: undefined,
      sgst: undefined,
      totalTax: 0,
      total: amount,
      taxLabel: "",
    };
  }

  let subtotal: number;
  let totalTax: number;
  let total: number;

  if (mode === "INCLUSIVE") {
    subtotal = +(amount / (1 + rate / 100)).toFixed(2);
    totalTax = +(amount - subtotal).toFixed(2);
    total = amount;
  } else {
    subtotal = amount;
    totalTax = +((amount * rate) / 100).toFixed(2);
    total = +(amount + totalTax).toFixed(2);
  }

  let cgst: number | undefined;
  let sgst: number | undefined;
  let taxLabel: string;

  if (isIndian) {
    const halfRate = +(rate / 2).toFixed(2);
    cgst = +((subtotal * halfRate) / 100).toFixed(2);
    sgst = +((subtotal * halfRate) / 100).toFixed(2);
    taxLabel = `CGST (${halfRate}%) + SGST (${halfRate}%)`;
  } else {
    cgst = undefined;
    sgst = undefined;
    taxLabel = `Tax (${rate}%)`;
  }

  return { subtotal, cgst, sgst, totalTax, total, taxLabel };
}

export function generateInvoiceNumber(prefix: string): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${dateStr}-${random}`;
}

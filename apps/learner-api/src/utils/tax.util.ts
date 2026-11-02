import { db } from "../db/connection";

export interface TenantTaxConfig {
  taxMode: "INCLUSIVE" | "EXCLUSIVE";
  taxPercentage: number;
  isIndian: boolean;
}

const DEFAULT_TAX_CONFIG: TenantTaxConfig = {
  taxMode: "INCLUSIVE",
  taxPercentage: 18,
  isIndian: true,
};

export async function fetchTenantTaxConfig(tenantId: string): Promise<TenantTaxConfig> {
  const row = await db
    .selectFrom("tenant_org_details")
    .select(["tax_mode", "tax_percentage", "gstin", "billing_address"] as const)
    .where("tenant_id", "=", tenantId)
    .executeTakeFirst();

  if (!row) return DEFAULT_TAX_CONFIG;

  const taxMode = (row.tax_mode === "EXCLUSIVE" ? "EXCLUSIVE" : "INCLUSIVE") as TenantTaxConfig["taxMode"];
  const taxPercentage = parseFloat(String(row.tax_percentage ?? 18));

  // Determine if Indian tenant: GSTIN present OR billing address country contains "India"
  let isIndian = false;
  if (row.gstin) {
    isIndian = true;
  } else if (row.billing_address) {
    const addr = typeof row.billing_address === "string"
      ? JSON.parse(row.billing_address)
      : row.billing_address;
    if (addr && typeof addr === "object" && "country" in addr) {
      isIndian = String(addr.country).toLowerCase().includes("india");
    }
  }

  return { taxMode, taxPercentage, isIndian };
}

import { db } from "../db/connection";
import { TenantEmailStyle } from "./email-template.util";
import logger from "./logger";

/**
 * The per-tenant email style preference, the opt-out switch for the luxe
 * mail design.
 *
 * Stored in `tenant_org_details.metadata.email_style` ("luxe" | "simple"),
 * which needs no schema migration and is editable from the tenant admin's
 * organisation settings. Absent, unreadable, or anything unexpected means
 * LUXE: the premium design is the default, and only an explicit "simple"
 * opts a tenant out.
 *
 * Cached in-process for five minutes per tenant: mail sends are bursty
 * (a subscription sweep can send hundreds) and the preference changes
 * rarely; a five-minute lag on a style switch is invisible.
 */
const cache = new Map<string, { style: TenantEmailStyle; at: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getTenantEmailStyle(tenantId: string): Promise<TenantEmailStyle> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.style;

  let style: TenantEmailStyle = "luxe";
  try {
    const row = await db
      .selectFrom("tenant_org_details")
      .select("metadata")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
    const value = (row?.metadata as Record<string, unknown> | null)?.email_style;
    if (value === "simple") style = "simple";
  } catch (err) {
    logger.warn(
      `[email-style] lookup failed for tenant ${tenantId}: ${err instanceof Error ? err.message : err}`
    );
  }
  cache.set(tenantId, { style, at: Date.now() });
  return style;
}

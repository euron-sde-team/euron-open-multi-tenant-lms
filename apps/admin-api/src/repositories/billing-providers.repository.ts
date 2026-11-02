import { db } from "../db/connection";

/**
 * List billing providers that are active and visible to tenants (for payment gateway selection).
 * Includes credential_schema so the frontend can render dynamic forms.
 */
export async function findVisibleProviders(): Promise<
  { id: string; name: string; credential_schema: unknown }[]
> {
  const rows = await db
    .selectFrom("billing_providers")
    .select(["id", "name", "credential_schema"])
    .where("is_active", "=", true)
    .where("is_visible_to_tenant", "=", true)
    .orderBy("name")
    .execute();
  return rows;
}

/**
 * Find provider by name (e.g. RAZORPAY).
 */
export async function findProviderByName(
  name: string
): Promise<{ id: string; name: string } | null> {
  const row = await db
    .selectFrom("billing_providers")
    .select(["id", "name"])
    .where("name", "=", name)
    .where("is_active", "=", true)
    .executeTakeFirst();
  return row ?? null;
}

/**
 * Find provider by id (for validation).
 */
export async function findProviderById(
  id: string
): Promise<{
  id: string;
  name: string;
  is_visible_to_tenant: boolean;
  credential_schema: unknown;
} | null> {
  const row = await db
    .selectFrom("billing_providers")
    .select(["id", "name", "is_visible_to_tenant", "credential_schema"])
    .where("id", "=", id)
    .where("is_active", "=", true)
    .executeTakeFirst();
  return row ?? null;
}

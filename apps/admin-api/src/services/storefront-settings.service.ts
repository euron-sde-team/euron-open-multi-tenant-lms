import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";

export interface StorefrontSettings {
  access_managed_enabled: boolean;
  access_managed_enabled_at: Date | null;
}

class StorefrontSettingsService {
  async getSettings(tenantId: string): Promise<StorefrontSettings> {
    const row = await db
      .selectFrom("tenants")
      .select([
        "access_managed_enabled",
        "access_managed_enabled_at",
      ])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Tenant not found");
    return {
      access_managed_enabled: row.access_managed_enabled,
      access_managed_enabled_at: row.access_managed_enabled_at,
    };
  }

  /**
   * Toggle the access-managed storefront: self-checkout is removed and access
   * comes from admin grants.
   */
  async updateSettings(
    tenantId: string,
    enabled: boolean,
    updatedByUserId: string,
  ): Promise<StorefrontSettings> {
    const current = await this.getSettings(tenantId);

    if (enabled === current.access_managed_enabled) return current;

    await db
      .updateTable("tenants")
      .set({
        access_managed_enabled: enabled,
        access_managed_enabled_at: enabled ? new Date() : null,
        access_managed_enabled_by_user_id: enabled ? updatedByUserId : null,
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return this.getSettings(tenantId);
  }
}

export default new StorefrontSettingsService();

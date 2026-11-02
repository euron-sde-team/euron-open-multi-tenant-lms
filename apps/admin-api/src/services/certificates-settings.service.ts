import { db } from "../db/connection";
import { NotFoundError } from "../errors/not-found.error";

export interface CertificatesSettings {
  /** Whether learners see the Certificates tab in their profile. Default: true. */
  certificate_tab_enabled: boolean;
}

class CertificatesSettingsService {
  async getSettings(tenantId: string): Promise<CertificatesSettings> {
    const row = await db
      .selectFrom("tenants")
      .select(["certificate_tab_enabled"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (!row) throw new NotFoundError("Tenant not found");
    return {
      // Default ON: treat a null column (older rows) as enabled.
      certificate_tab_enabled: row.certificate_tab_enabled ?? true,
    };
  }

  async updateSettings(tenantId: string, enabled: boolean): Promise<CertificatesSettings> {
    const current = await this.getSettings(tenantId);
    if (enabled === current.certificate_tab_enabled) return current;

    await db
      .updateTable("tenants")
      .set({
        certificate_tab_enabled: enabled,
        updated_at: new Date(),
      })
      .where("id", "=", tenantId)
      .execute();

    return this.getSettings(tenantId);
  }
}

export default new CertificatesSettingsService();

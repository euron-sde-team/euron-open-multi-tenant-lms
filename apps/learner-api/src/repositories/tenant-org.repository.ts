import { db } from "../db/connection";

interface TenantOrgDetailsRow {
  id: string;
  tenant_id: string;
  logo_light_key: string | null;
  logo_dark_key: string | null;
  favicon_key: string | null;
  tagline: string | null;
  contact_email: string | null;
  support_email: string | null;
  legal_entity_name: string | null;
  social_links: unknown;
  android_app_url: string | null;
  ios_app_url: string | null;
}

class TenantOrgRepository {
  async findByTenantId(tenantId: string): Promise<TenantOrgDetailsRow | undefined> {
    return db
      .selectFrom("tenant_org_details")
      .select([
        "id",
        "tenant_id",
        "logo_light_key",
        "logo_dark_key",
        "favicon_key",
        "tagline",
        "contact_email",
        "support_email",
        "legal_entity_name",
        "social_links",
        "android_app_url",
        "ios_app_url",
      ])
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }
}

export default new TenantOrgRepository();

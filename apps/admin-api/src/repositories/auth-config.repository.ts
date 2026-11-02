import { db } from "../db/connection";

interface AuthConfigRow {
  id: string;
  tenant_id: string;
  email_password_enabled: boolean;
  google_oauth_enabled: boolean;
  email_otp_enabled: boolean;
  phone_otp_enabled: boolean;
  signup_enabled: boolean;
  auto_signup_on_login: boolean;
  phone_number_required?: boolean;
  easy_checkout_enabled?: boolean;
  name_confirmation_enabled?: boolean;
  google_client_id: string | null;
  created_at: Date;
  updated_at: Date;
}

class AuthConfigRepository {
  async findByTenantId(tenantId: string): Promise<AuthConfigRow | undefined> {
    return db
      .selectFrom("tenant_auth_config")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async upsert(
    id: string,
    tenantId: string,
    data: Omit<AuthConfigRow, "id" | "tenant_id" | "created_at" | "updated_at">
  ): Promise<AuthConfigRow> {
    const now = new Date();
    const existing = await this.findByTenantId(tenantId);

    if (existing) {
      await db
        .updateTable("tenant_auth_config")
        .set({
          email_password_enabled: data.email_password_enabled,
          google_oauth_enabled: data.google_oauth_enabled,
          email_otp_enabled: data.email_otp_enabled,
          phone_otp_enabled: data.phone_otp_enabled,
          signup_enabled: data.signup_enabled,
          auto_signup_on_login: data.auto_signup_on_login,
          phone_number_required: data.phone_number_required,
          easy_checkout_enabled: data.easy_checkout_enabled,
          name_confirmation_enabled: data.name_confirmation_enabled,
          google_client_id: data.google_client_id,
          updated_at: now,
        })
        .where("tenant_id", "=", tenantId)
        .execute();

      return (await this.findByTenantId(tenantId))!;
    }

    await db
      .insertInto("tenant_auth_config")
      .values({
        id,
        tenant_id: tenantId,
        email_password_enabled: data.email_password_enabled,
        google_oauth_enabled: data.google_oauth_enabled,
        email_otp_enabled: data.email_otp_enabled,
        phone_otp_enabled: data.phone_otp_enabled,
        signup_enabled: data.signup_enabled,
        auto_signup_on_login: data.auto_signup_on_login,
        phone_number_required: data.phone_number_required,
        easy_checkout_enabled: data.easy_checkout_enabled,
        name_confirmation_enabled: data.name_confirmation_enabled,
        google_client_id: data.google_client_id,
        created_at: now,
        updated_at: now,
      })
      .execute();

    return (await this.findByTenantId(tenantId))!;
  }

  async updateGoogleClientId(
    tenantId: string,
    googleClientId: string
  ): Promise<AuthConfigRow> {
    const now = new Date();
    const existing = await this.findByTenantId(tenantId);

    if (existing) {
      await db
        .updateTable("tenant_auth_config")
        .set({
          google_client_id: googleClientId,
          google_oauth_enabled: true,
          updated_at: now,
        })
        .where("tenant_id", "=", tenantId)
        .execute();

      return (await this.findByTenantId(tenantId))!;
    }

    const { ulid } = await import("ulid");
    await db
      .insertInto("tenant_auth_config")
      .values({
        id: ulid(),
        tenant_id: tenantId,
        email_password_enabled: true,
        google_oauth_enabled: true,
        email_otp_enabled: false,
        phone_otp_enabled: false,
        signup_enabled: true,
        auto_signup_on_login: false,
        phone_number_required: false,
        easy_checkout_enabled: false,
        google_client_id: googleClientId,
        created_at: now,
        updated_at: now,
      })
      .execute();

    return (await this.findByTenantId(tenantId))!;
  }

  async clearGoogleClientId(tenantId: string): Promise<AuthConfigRow | undefined> {
    const existing = await this.findByTenantId(tenantId);
    if (!existing) return undefined;

    await db
      .updateTable("tenant_auth_config")
      .set({
        google_client_id: null,
        google_oauth_enabled: false,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .execute();

    return (await this.findByTenantId(tenantId))!;
  }
}

export default new AuthConfigRepository();

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
  name_confirmation_enabled?: boolean;
  google_client_id?: string | null;
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
}

export default new AuthConfigRepository();

import { db } from "../db/connection";

class PasswordResetRepository {
  async create(data: {
    id: string;
    tenant_id: string;
    email: string;
    token: string;
    expires_at: Date;
  }): Promise<void> {
    await db
      .insertInto("tenant_password_resets")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        email: data.email,
        token: data.token,
        expires_at: data.expires_at,
        used: false,
        created_at: new Date(),
      })
      .execute();
  }

  async findValidByToken(token: string): Promise<{
    id: string;
    tenant_id: string | null;
    email: string;
    token: string;
    expires_at: Date;
  } | undefined> {
    return db
      .selectFrom("tenant_password_resets")
      .select(["id", "tenant_id", "email", "token", "expires_at"])
      .where("token", "=", token)
      .where("used", "=", false)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
  }

  async markUsed(id: string): Promise<void> {
    await db
      .updateTable("tenant_password_resets")
      .set({ used: true })
      .where("id", "=", id)
      .execute();
  }

  async deleteExpiredForEmail(tenantId: string, email: string): Promise<void> {
    await db
      .deleteFrom("tenant_password_resets")
      .where("tenant_id", "=", tenantId)
      .where("email", "=", email)
      .where("expires_at", "<", new Date())
      .execute();
  }
}

export default new PasswordResetRepository();

import { db } from "../db/connection";

class PasswordResetRepository {
  async create(data: {
    id: string;
    tenant_id: string | null;
    email: string;
    token: string;
    expires_at: Date;
  }) {
    await db
      .insertInto("tenant_password_resets")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        email: data.email,
        token: data.token,
        expires_at: data.expires_at,
      })
      .execute();
  }

  async findValidByToken(token: string) {
    return db
      .selectFrom("tenant_password_resets")
      .selectAll()
      .where("token", "=", token)
      .where("used", "=", false)
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
  }

  async markUsed(id: string) {
    await db
      .updateTable("tenant_password_resets")
      .set({ used: true })
      .where("id", "=", id)
      .execute();
  }

  async deleteExpiredForEmail(email: string) {
    await db
      .deleteFrom("tenant_password_resets")
      .where("email", "=", email)
      .where("expires_at", "<", new Date())
      .execute();
  }
}

export default new PasswordResetRepository();

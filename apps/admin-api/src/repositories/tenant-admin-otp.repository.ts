import { db } from "../db/connection";

interface OtpRow {
  id: string;
  user_id: string;
  identifier: string;
  code: string;
  channel: string;
  expires_at: Date;
  verified: boolean;
  attempts: number;
  created_at: Date;
}

interface OtpInsert {
  id: string;
  user_id: string;
  identifier: string;
  code: string;
  channel: string;
  expires_at: Date;
}

class TenantAdminOtpRepository {
  async create(data: OtpInsert): Promise<void> {
    await db
      .insertInto("tenant_admin_otp_codes")
      .values({
        ...data,
        verified: false,
        attempts: 0,
        created_at: new Date(),
      })
      .execute();
  }

  /**
   * Find the latest non-expired, non-verified OTP for the given user + identifier + channel.
   */
  async findLatestValid(
    userId: string,
    identifier: string,
    channel: string
  ): Promise<OtpRow | undefined> {
    return db
      .selectFrom("tenant_admin_otp_codes")
      .selectAll()
      .where("user_id", "=", userId)
      .where("identifier", "=", identifier)
      .where("channel", "=", channel)
      .where("verified", "=", false)
      .where("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .executeTakeFirst();
  }

  /**
   * Find a recent OTP created within the last `secondsAgo` seconds (for rate limiting).
   */
  async findRecent(
    userId: string,
    identifier: string,
    channel: string,
    secondsAgo: number
  ): Promise<OtpRow | undefined> {
    const cutoff = new Date(Date.now() - secondsAgo * 1000);
    return db
      .selectFrom("tenant_admin_otp_codes")
      .selectAll()
      .where("user_id", "=", userId)
      .where("identifier", "=", identifier)
      .where("channel", "=", channel)
      .where("created_at", ">", cutoff)
      .executeTakeFirst();
  }

  async incrementAttempts(id: string): Promise<void> {
    await db
      .updateTable("tenant_admin_otp_codes")
      .set((eb) => ({
        attempts: eb("attempts", "+", 1),
      }))
      .where("id", "=", id)
      .execute();
  }

  async markVerified(id: string): Promise<void> {
    await db
      .updateTable("tenant_admin_otp_codes")
      .set({ verified: true })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Delete expired OTPs for the given user + identifier + channel.
   */
  async deleteExpired(userId: string, identifier: string, channel: string): Promise<void> {
    await db
      .deleteFrom("tenant_admin_otp_codes")
      .where("user_id", "=", userId)
      .where("identifier", "=", identifier)
      .where("channel", "=", channel)
      .where("expires_at", "<=", new Date())
      .execute();
  }
}

export default new TenantAdminOtpRepository();

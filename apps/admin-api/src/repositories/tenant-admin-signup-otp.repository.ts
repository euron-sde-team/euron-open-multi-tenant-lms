import { db } from "../db/connection";

interface SignupOtpRow {
  id: string;
  phone: string;
  code: string;
  channel: string;
  expires_at: Date;
  verified: boolean;
  attempts: number;
  created_at: Date;
}

interface SignupOtpInsert {
  id: string;
  phone: string;
  code: string;
  channel: string;
  expires_at: Date;
}

class TenantAdminSignupOtpRepository {
  async create(data: SignupOtpInsert): Promise<void> {
    await db
      .insertInto("tenant_admin_signup_otp_codes")
      .values({
        ...data,
        verified: false,
        attempts: 0,
        created_at: new Date(),
      })
      .execute();
  }

  /**
   * Find the latest non-expired, non-verified OTP for the given phone + channel.
   */
  async findLatestValid(
    phone: string,
    channel: string
  ): Promise<SignupOtpRow | undefined> {
    const row = await db
      .selectFrom("tenant_admin_signup_otp_codes")
      .selectAll()
      .where("phone", "=", phone)
      .where("channel", "=", channel)
      .where("verified", "=", false)
      .where("expires_at", ">", new Date())
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    if (!row) return undefined;
    return row as unknown as SignupOtpRow;
  }

  /**
   * Find a recent OTP created within the last `secondsAgo` seconds (for rate limiting).
   */
  async findRecent(
    phone: string,
    channel: string,
    secondsAgo: number
  ): Promise<SignupOtpRow | undefined> {
    const cutoff = new Date(Date.now() - secondsAgo * 1000);
    const row = await db
      .selectFrom("tenant_admin_signup_otp_codes")
      .selectAll()
      .where("phone", "=", phone)
      .where("channel", "=", channel)
      .where("created_at", ">", cutoff)
      .executeTakeFirst();

    if (!row) return undefined;
    return row as unknown as SignupOtpRow;
  }

  async incrementAttempts(id: string): Promise<void> {
    await db
      .updateTable("tenant_admin_signup_otp_codes")
      .set((eb) => ({
        attempts: eb("attempts", "+", 1),
      }))
      .where("id", "=", id)
      .execute();
  }

  async markVerified(id: string): Promise<void> {
    await db
      .updateTable("tenant_admin_signup_otp_codes")
      .set({ verified: true })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Delete expired OTPs for the given phone + channel.
   */
  async deleteExpired(phone: string, channel: string): Promise<void> {
    await db
      .deleteFrom("tenant_admin_signup_otp_codes")
      .where("phone", "=", phone)
      .where("channel", "=", channel)
      .where("expires_at", "<=", new Date())
      .execute();
  }
}

export default new TenantAdminSignupOtpRepository();

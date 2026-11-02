import { sql } from "kysely";
import { db } from "../db/connection";
import { normalizePhone } from "../utils/normalize-phone";

interface MemberRow {
  id: string;
  tenant_id: string;
  email: string | null;
  name: string;
  phone: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  name_confirmed_at?: Date | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: string;
  last_login_at: Date | null;
  joined_at: Date;
  invited_by: string | null;
  created_at: Date;
  updated_at: Date;
  about?: string | null;
  gender?: string | null;
  profile_metadata?: unknown | null;
}

interface CreateMemberData {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  phone?: string | null;
  password_hash?: string | null;
  avatar_url?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  oauth_provider?: string | null;
  oauth_provider_id?: string | null;
  profile_metadata?: string | null;
  /** Stamp when the name is captured from the user directly (e.g. easy checkout),
   *  so the one-time name confirmation modal never fires for them. */
  name_confirmed_at?: Date | null;
}

class AuthRepository {
  async findByEmailAndTenant(email: string, tenantId: string): Promise<MemberRow | undefined> {
    // Case-insensitive comparison. Older signup paths (OTP-only, phone
    // first, etc.) stored tenant_members.email as the user typed it. A
    // direct `=` against the toLowerCase()'d input silently misses those
    // rows, the caller then tries to auto-signup with the same email,
    // hits a duplicate, and the user is stranded with "OTP correct but
    // can't log in". Compare LOWER(email) so the lookup works regardless
    // of historical casing.
    return db
      .selectFrom("tenant_members")
      .selectAll()
      .where(sql`LOWER(email)`, "=", email.toLowerCase())
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async findByPhoneAndTenant(phone: string, tenantId: string): Promise<MemberRow | undefined> {
    // Match against the normalized form (digits only) so that legacy rows still
    // containing spaces or punctuation (e.g. "+1 555-1234") collapse onto the
    // canonical form ("15551234") that easy-checkout and OTP signup now write.
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    return db
      .selectFrom("tenant_members")
      .selectAll()
      .where(sql<boolean>`regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ${normalized}`)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  async findById(id: string): Promise<MemberRow | undefined> {
    return db
      .selectFrom("tenant_members")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async createMember(data: CreateMemberData): Promise<MemberRow> {
    const now = new Date();

    const values: Record<string, unknown> = {
      id: data.id,
      tenant_id: data.tenant_id,
      // Normalize email on insert so the case-insensitive lookups in
      // mobile-auth.repository (and any future lookups) don't have to
      // pay for `LOWER(email)` on every query, a future index can
      // assume the column is already lowercased.
      email: data.email ? data.email.toLowerCase().trim() : data.email,
      name: data.name,
      phone: data.phone ?? null,
      password_hash: data.password_hash ?? null,
      avatar_url: data.avatar_url ?? null,
      email_verified: data.email_verified ?? false,
      phone_verified: data.phone_verified ?? false,
      oauth_provider: data.oauth_provider ?? null,
      oauth_provider_id: data.oauth_provider_id ?? null,
      status: "ACTIVE",
      joined_at: now,
      created_at: now,
      updated_at: now,
    };
    if (data.profile_metadata !== undefined && data.profile_metadata !== null) {
      values.profile_metadata = data.profile_metadata;
    }
    if (data.name_confirmed_at !== undefined && data.name_confirmed_at !== null) {
      values.name_confirmed_at = data.name_confirmed_at;
    }

    await db
      .insertInto("tenant_members")
      .values(values as never)
      .execute();

    return (await this.findById(data.id))!;
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async setEmailVerified(id: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        email_verified: true,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async setPhoneVerified(id: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        phone_verified: true,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /** Replace a member's email and mark it verified (used by the name/email confirmation flow after OTP). */
  async updateEmailAndVerify(id: string, email: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        email: email.toLowerCase().trim(),
        email_verified: true,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /** Set the confirmed name and stamp name_confirmed_at so the one-time modal never shows again. */
  async markNameConfirmed(id: string, name: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        name,
        name_confirmed_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async updateOAuthProvider(id: string, provider: string, providerId: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        oauth_provider: provider,
        oauth_provider_id: providerId,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async updateProfile(
    id: string,
    data: {
      name?: string;
      phone?: string;
      avatar_url?: string;
      about?: string;
      gender?: string;
      profile_metadata?: string;
    }
  ): Promise<MemberRow> {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url;
    if (data.about !== undefined) updates.about = data.about;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.profile_metadata !== undefined) updates.profile_metadata = data.profile_metadata;

    await db
      .updateTable("tenant_members")
      .set(updates as Record<string, string | Date>)
      .where("id", "=", id)
      .execute();

    const member = await this.findById(id);
    if (!member) throw new Error("Member not found after update");
    return member;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        password_hash: passwordHash,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  async deactivateMember(id: string): Promise<void> {
    await db
      .updateTable("tenant_members")
      .set({
        status: "DEACTIVATED",
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }
}

export default new AuthRepository();

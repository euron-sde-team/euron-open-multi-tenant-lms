import { db } from "../db/connection";

// Define proper types for repository use
interface TenantUser {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  avatar_url: string | null;
  oauth_provider: string | null;
  oauth_provider_id: string | null;
  status: string;
  email_verified: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // Phone verification
  phone: string | null;
  phone_verified: boolean;
  // Geo/metadata
  signup_ip: string | null;
  signup_country: string | null;
  signup_city: string | null;
  signup_user_agent: string | null;
  signup_referrer: string | null;
  signup_utm: unknown;
  timezone: string | null;
  // Login tracking
  last_login_ip: string | null;
  login_count: number;
  // Profile enrichment
  designation: string | null;
  profile_completed_at: Date | null;
}

interface TenantUserInsert {
  id: string;
  email: string;
  password_hash?: string | null;
  name: string;
  avatar_url?: string | null;
  oauth_provider?: string | null;
  oauth_provider_id?: string | null;
  status?: string;
  email_verified?: boolean;
  created_at: Date;
  updated_at: Date;
  // Optional phone fields (captured at signup)
  phone?: string | null;
  phone_verified?: boolean;
  // Optional geo/metadata fields for signup
  signup_ip?: string | null;
  signup_country?: string | null;
  signup_city?: string | null;
  signup_user_agent?: string | null;
  signup_referrer?: string | null;
  signup_utm?: string | null;
  timezone?: string | null;
}

function mapRow(result: Record<string, unknown>): TenantUser {
  return {
    ...result,
    status: result.status as string,
    email_verified: result.email_verified as boolean,
    phone_verified: result.phone_verified as boolean,
    login_count: typeof result.login_count === "string"
      ? parseInt(result.login_count, 10)
      : Number(result.login_count ?? 0),
    last_login_at: result.last_login_at ? new Date(result.last_login_at as string) : null,
    created_at: new Date(result.created_at as string),
    updated_at: new Date(result.updated_at as string),
    profile_completed_at: result.profile_completed_at
      ? new Date(result.profile_completed_at as string)
      : null,
  } as TenantUser;
}

class TenantUserRepository {
  /**
   * Find tenant user by email
   */
  async findByEmail(email: string): Promise<TenantUser | undefined> {
    const result = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("email", "=", email)
      .executeTakeFirst();

    if (!result) return undefined;
    return mapRow(result as unknown as Record<string, unknown>);
  }

  /**
   * Find tenant user by ID
   */
  async findById(id: string): Promise<TenantUser | undefined> {
    const result = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;
    return mapRow(result as unknown as Record<string, unknown>);
  }

  /**
   * Find tenant user by phone number (globally unique)
   */
  async findByPhone(phone: string): Promise<TenantUser | undefined> {
    const result = await db
      .selectFrom("tenant_users")
      .selectAll()
      .where("phone", "=", phone)
      .executeTakeFirst();

    if (!result) return undefined;
    return mapRow(result as unknown as Record<string, unknown>);
  }

  /**
   * Create a new tenant user
   */
  async create(data: TenantUserInsert): Promise<TenantUser> {
    const result = await db
      .insertInto("tenant_users")
      .values({
        id: data.id,
        email: data.email,
        password_hash: data.password_hash ?? null,
        name: data.name,
        avatar_url: data.avatar_url ?? null,
        oauth_provider: data.oauth_provider ?? null,
        oauth_provider_id: data.oauth_provider_id ?? null,
        status: (data.status ?? "ACTIVE") as "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "INVITED",
        email_verified: data.email_verified ?? false,
        phone: data.phone ?? null,
        phone_verified: data.phone_verified ?? false,
        created_at: data.created_at,
        updated_at: data.updated_at,
        signup_ip: data.signup_ip ?? null,
        signup_country: data.signup_country ?? null,
        signup_city: data.signup_city ?? null,
        signup_user_agent: data.signup_user_agent ?? null,
        signup_referrer: data.signup_referrer ?? null,
        signup_utm: data.signup_utm ?? null,
        timezone: data.timezone ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return mapRow(result as unknown as Record<string, unknown>);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .updateTable("tenant_users")
      .set({
        last_login_at: new Date(),
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Update login metadata: increment login_count, set last_login_ip + last_login_at
   */
  async updateLoginMetadata(
    id: string,
    data: { last_login_ip?: string }
  ): Promise<void> {
    await db
      .updateTable("tenant_users")
      .set((eb) => ({
        last_login_at: new Date(),
        updated_at: new Date(),
        login_count: eb("login_count", "+", 1),
        ...(data.last_login_ip ? { last_login_ip: data.last_login_ip } : {}),
      }))
      .where("id", "=", id)
      .execute();
  }

  /**
   * Set phone as verified and update the phone number
   */
  async setPhoneVerified(id: string, phone: string): Promise<void> {
    await db
      .updateTable("tenant_users")
      .set({
        phone,
        phone_verified: true,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Update tenant user profile
   */
  async update(
    id: string,
    data: Partial<{
      name: string;
      avatar_url: string | null;
      email_verified: boolean;
      status: string;
      phone: string | null;
      phone_verified: boolean;
      designation: string | null;
      profile_completed_at: Date | null;
      signup_ip: string | null;
      signup_country: string | null;
      signup_city: string | null;
      signup_user_agent: string | null;
      timezone: string | null;
      signup_quiz_answers: unknown;
      creator_intent_profile: unknown;
    }>
  ): Promise<TenantUser | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
    if (data.email_verified !== undefined) updateData.email_verified = data.email_verified;
    if (data.status !== undefined) {
      updateData.status = data.status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "INVITED";
    }
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.phone_verified !== undefined) updateData.phone_verified = data.phone_verified;
    if (data.designation !== undefined) updateData.designation = data.designation;
    if (data.profile_completed_at !== undefined) updateData.profile_completed_at = data.profile_completed_at;
    if (data.signup_ip !== undefined) updateData.signup_ip = data.signup_ip;
    if (data.signup_country !== undefined) updateData.signup_country = data.signup_country;
    if (data.signup_city !== undefined) updateData.signup_city = data.signup_city;
    if (data.signup_user_agent !== undefined) updateData.signup_user_agent = data.signup_user_agent;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.signup_quiz_answers !== undefined) {
      updateData.signup_quiz_answers =
        typeof data.signup_quiz_answers === "string"
          ? data.signup_quiz_answers
          : JSON.stringify(data.signup_quiz_answers);
    }
    if (data.creator_intent_profile !== undefined) {
      updateData.creator_intent_profile =
        typeof data.creator_intent_profile === "string"
          ? data.creator_intent_profile
          : JSON.stringify(data.creator_intent_profile);
    }

    const result = await db
      .updateTable("tenant_users")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;
    return mapRow(result as unknown as Record<string, unknown>);
  }

  /**
   * Update password hash for a tenant user
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await db
      .updateTable("tenant_users")
      .set({
        password_hash: passwordHash,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Check if email exists (for validation)
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = db
      .selectFrom("tenant_users")
      .select("id")
      .where("email", "=", email.toLowerCase());

    if (excludeId) {
      query = query.where("id", "!=", excludeId);
    }

    const result = await query.executeTakeFirst();
    return !!result;
  }
}

export default new TenantUserRepository();

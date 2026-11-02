import { db } from "../db/connection";

// Define proper types for repository use
interface TenantStaffMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  invited_by: string | null;
  invited_at: Date | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TenantStaffMembershipInsert {
  id: string;
  tenant_id: string;
  user_id: string;
  status?: string;
  invited_by?: string | null;
  invited_at?: Date | null;
  joined_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface MembershipWithTenant {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  invited_by: string | null;
  invited_at: Date | null;
  joined_at: Date | null;
  created_at: Date;
  updated_at: Date;
  tenant_name: string;
  tenant_slug: string;
  tenant_status: string;
  is_owner: boolean;
}

class TenantMembershipRepository {
  /**
   * Find membership by ID
   */
  async findById(id: string): Promise<TenantStaffMembership | undefined> {
    const result = await db
      .selectFrom("tenant_staff_memberships")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Create a new membership
   */
  async create(data: TenantStaffMembershipInsert): Promise<TenantStaffMembership> {
    const result = await db
      .insertInto("tenant_staff_memberships")
      .values({
        id: data.id,
        tenant_id: data.tenant_id,
        user_id: data.user_id,
        status: (data.status ?? "ACTIVE") as "ACTIVE" | "SUSPENDED" | "INVITED",
        invited_by: data.invited_by ?? null,
        invited_at: data.invited_at ?? null,
        joined_at: data.joined_at ?? null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...result,
      status: result.status as string,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Find all memberships for a user
   */
  async findByUserId(userId: string): Promise<TenantStaffMembership[]> {
    const results = await db
      .selectFrom("tenant_staff_memberships")
      .selectAll()
      .where("user_id", "=", userId)
      .execute();

    return results.map((result) => ({
      ...result,
      status: result.status as string,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    }));
  }

  /**
   * Find memberships for a user with tenant details
   */
  async findByUserIdWithTenants(userId: string): Promise<MembershipWithTenant[]> {
    const results = await db
      .selectFrom("tenant_staff_memberships")
      .innerJoin("tenants", "tenants.id", "tenant_staff_memberships.tenant_id")
      .select([
        "tenant_staff_memberships.id",
        "tenant_staff_memberships.tenant_id",
        "tenant_staff_memberships.user_id",
        "tenant_staff_memberships.status",
        "tenant_staff_memberships.invited_by",
        "tenant_staff_memberships.invited_at",
        "tenant_staff_memberships.joined_at",
        "tenant_staff_memberships.created_at",
        "tenant_staff_memberships.updated_at",
        "tenants.name as tenant_name",
        "tenants.slug as tenant_slug",
        "tenants.status as tenant_status",
        "tenants.owner_user_id",
      ])
      .where("tenant_staff_memberships.user_id", "=", userId)
      .execute();

    return results.map((result) => ({
      id: result.id,
      tenant_id: result.tenant_id,
      user_id: result.user_id,
      status: result.status as string,
      invited_by: result.invited_by,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
      tenant_name: result.tenant_name,
      tenant_slug: result.tenant_slug,
      tenant_status: result.tenant_status as string,
      is_owner: result.owner_user_id === userId,
    }));
  }

  /**
   * Find membership by user ID and tenant ID
   */
  async findByUserIdAndTenantId(
    userId: string,
    tenantId: string
  ): Promise<TenantStaffMembership | undefined> {
    const result = await db
      .selectFrom("tenant_staff_memberships")
      .selectAll()
      .where("user_id", "=", userId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }

  /**
   * Update membership status
   */
  async update(
    id: string,
    data: Partial<{
      status: string;
      joined_at: Date | null;
    }>
  ): Promise<TenantStaffMembership | undefined> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (data.status !== undefined) {
      updateData.status = data.status as "ACTIVE" | "SUSPENDED" | "INVITED";
    }
    if (data.joined_at !== undefined) updateData.joined_at = data.joined_at;

    const result = await db
      .updateTable("tenant_staff_memberships")
      .set(updateData)
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!result) return undefined;

    return {
      ...result,
      status: result.status as string,
      invited_at: result.invited_at ? new Date(result.invited_at) : null,
      joined_at: result.joined_at ? new Date(result.joined_at) : null,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at),
    };
  }
}

export default new TenantMembershipRepository();

import { NotFoundError } from "../errors/not-found.error";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantUserRepository from "../repositories/tenant-user.repository";
import { TenantMembership, UserProfile } from "../types/auth.type";

interface UpdateProfileData {
  name?: string;
  avatar_url?: string | null;
}

class TenantUserService {
  /**
   * Get user profile with tenant memberships
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await tenantUserRepository.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Get all tenant memberships
    const memberships = await tenantMembershipRepository.findByUserIdWithTenants(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      status: user.status,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      phone: user.phone,
      phone_verified: user.phone_verified,
      designation: user.designation,
      profile_completed_at: user.profile_completed_at,
      tenants: memberships.map((m) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        status: m.status,
        is_owner: m.is_owner,
        joined_at: m.joined_at,
      })),
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    const user = await tenantUserRepository.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Update user with provided fields
    const updatedUser = await tenantUserRepository.update(userId, {
      name: data.name,
      avatar_url: data.avatar_url,
    });

    if (!updatedUser) {
      throw new NotFoundError("User not found");
    }

    // Get all tenant memberships
    const memberships = await tenantMembershipRepository.findByUserIdWithTenants(userId);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar_url: updatedUser.avatar_url,
      status: updatedUser.status,
      email_verified: updatedUser.email_verified,
      last_login_at: updatedUser.last_login_at,
      created_at: updatedUser.created_at,
      phone: updatedUser.phone,
      phone_verified: updatedUser.phone_verified,
      designation: updatedUser.designation,
      profile_completed_at: updatedUser.profile_completed_at,
      tenants: memberships.map((m) => ({
        id: m.id,
        tenant_id: m.tenant_id,
        tenant_name: m.tenant_name,
        tenant_slug: m.tenant_slug,
        status: m.status,
        is_owner: m.is_owner,
        joined_at: m.joined_at,
      })),
    };
  }

  /**
   * Get all tenants user belongs to
   */
  async getUserTenants(userId: string): Promise<TenantMembership[]> {
    const user = await tenantUserRepository.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const memberships = await tenantMembershipRepository.findByUserIdWithTenants(userId);

    return memberships.map((m) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      tenant_name: m.tenant_name,
      tenant_slug: m.tenant_slug,
      status: m.status,
      is_owner: m.is_owner,
      joined_at: m.joined_at,
    }));
  }

}

export default new TenantUserService();

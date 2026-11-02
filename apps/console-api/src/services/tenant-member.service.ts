import { NotFoundError } from "../errors/not-found.error";
import tenantMemberRepository from "../repositories/tenant-member.repository";
import tenantRepository from "../repositories/tenant.repository";
import {
  GlobalMemberListResponse,
  GlobalMemberQueryParams,
  GlobalMemberResponse,
  TenantMemberListResponse,
  TenantMemberQueryParams,
  TenantMemberResponse,
} from "../types/tenant.type";

class TenantMemberService {
  /**
   * List tenant members (end-users) with pagination, search, and status filter.
   */
  async listTenantMembers(
    tenantId: string,
    params: TenantMemberQueryParams
  ): Promise<TenantMemberListResponse> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const { members, total } = await tenantMemberRepository.findByTenant(
      tenantId,
      params
    );

    return {
      data: members.map((m) => this.mapToResponse(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * List all members (end-users) across all tenants with pagination, search, status, and tenant filter.
   */
  async listAllMembers(
    params: GlobalMemberQueryParams
  ): Promise<GlobalMemberListResponse> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const { members, total } = await tenantMemberRepository.findAllMembers(params);

    return {
      data: members.map((m) => this.mapToGlobalResponse(m)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private mapToResponse(
    m: Awaited<
      ReturnType<typeof tenantMemberRepository.findByTenant>
    >["members"][number]
  ): TenantMemberResponse {
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      status: m.status,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
      created_at: m.created_at,
      updated_at: m.updated_at,
      email: m.email,
      name: m.name,
      avatar_url: m.avatar_url,
      email_verified: m.email_verified,
      last_login_at: m.last_login_at,
      phone: m.phone,
    };
  }

  private mapToGlobalResponse(
    m: Awaited<
      ReturnType<typeof tenantMemberRepository.findAllMembers>
    >["members"][number]
  ): GlobalMemberResponse {
    return {
      id: m.id,
      tenant_id: m.tenant_id,
      status: m.status,
      joined_at: m.joined_at,
      invited_by: m.invited_by,
      created_at: m.created_at,
      updated_at: m.updated_at,
      email: m.email,
      name: m.name,
      avatar_url: m.avatar_url,
      email_verified: m.email_verified,
      last_login_at: m.last_login_at,
      phone: m.phone,
      tenant_name: m.tenant_name,
      tenant_slug: m.tenant_slug,
    };
  }
}

export default new TenantMemberService();

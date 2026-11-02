import tenantRepository from "../repositories/tenant.repository";
import { findTenantAuditLogs } from "../repositories/tenant-audit.repository";
import {
  TenantAuditLogQueryParams,
  TenantAuditLogListResponse,
} from "../types/tenant.type";
import { NotFoundError } from "../errors/not-found.error";

class TenantAuditService {
  /**
   * List unified audit log entries for a tenant (application + addon events).
   */
  async listTenantAuditLogs(
    tenantId: string,
    params: TenantAuditLogQueryParams
  ): Promise<TenantAuditLogListResponse> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const { entries, total } = await findTenantAuditLogs(tenantId, params);

    return {
      data: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export default new TenantAuditService();

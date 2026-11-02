import { NotFoundError } from "../errors/not-found.error";
import tenantSalesRepository from "../repositories/tenant-sales.repository";
import tenantRepository from "../repositories/tenant.repository";
import {
  RevenueQueryParams,
  SalesOrdersListResponse,
  SalesOrdersQueryParams,
  TenantRevenueSummary,
} from "../types/tenant-offerings.type";

class TenantSalesService {
  private async ensureTenant(tenantId: string): Promise<void> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }
  }

  async listOrders(
    tenantId: string,
    params: SalesOrdersQueryParams
  ): Promise<SalesOrdersListResponse> {
    await this.ensureTenant(tenantId);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const { items, total } = await tenantSalesRepository.listOrders(
      tenantId,
      params
    );
    return { data: items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getRevenueSummary(
    tenantId: string,
    params: RevenueQueryParams
  ): Promise<TenantRevenueSummary> {
    await this.ensureTenant(tenantId);
    return tenantSalesRepository.getRevenueSummary(tenantId, params);
  }
}

export default new TenantSalesService();

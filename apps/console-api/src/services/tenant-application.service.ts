import { ulid } from "ulid";
import tenantRepository from "../repositories/tenant.repository";
import tenantApplicationRepository, {
  TenantApplicationWithDetails,
} from "../repositories/tenant-application.repository";
import {
  GrantApplicationRequest,
  TenantApplicationQueryParams,
  TenantApplicationListResponse,
  TenantApplicationResponse,
  UpdateTenantApplicationRequest,
} from "../types/tenant.type";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { AuditActor } from "../types/audit-log.type";
import { db } from "../db/connection";
import auditService from "./audit.service";
import logger from "../utils/logger";

class TenantApplicationService {
  /**
   * List tenant applications with pagination, search, and filters.
   */
  async listTenantApplications(
    tenantId: string,
    params: TenantApplicationQueryParams
  ): Promise<TenantApplicationListResponse> {
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const { applications, total } = await tenantApplicationRepository.findByTenant(
      tenantId,
      params
    );

    return {
      data: applications.map((a) => this.mapToResponse(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Grant (assign) an application to a tenant
   */
  async grantApplication(
    tenantId: string,
    data: GrantApplicationRequest,
    actor: AuditActor
  ): Promise<TenantApplicationResponse> {
    const adminId = actor.adminId ?? "";
    // Verify tenant exists and is active
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }
    if (tenant.status !== "ACTIVE" && tenant.status !== "PENDING") {
      throw new BadRequestError(`Cannot assign application to ${tenant.status.toLowerCase()} tenant`);
    }

    // Verify application exists
    const application = await db
      .selectFrom("applications")
      .select(["id", "code", "name", "is_active"])
      .where("id", "=", data.application_id)
      .executeTakeFirst();

    if (!application) {
      throw new NotFoundError(`Application with ID '${data.application_id}' not found`);
    }
    if (!application.is_active) {
      throw new BadRequestError("Cannot assign an inactive application");
    }

    // Check for existing active/trialing assignment
    const existing = await tenantApplicationRepository.findActiveByTenantAndApp(
      tenantId,
      data.application_id
    );
    if (existing) {
      throw new ConflictError(
        `Tenant already has an active assignment for application '${application.name}'`
      );
    }

    const now = new Date();
    const id = ulid();

    const tenantApp = await tenantApplicationRepository.create({
      id,
      tenant_id: tenantId,
      application_id: data.application_id,
      status: data.source === "ADMIN_TRIAL" ? "TRIALING" : "ACTIVE",
      source: data.source,
      granted_by: adminId,
      grant_reason: data.reason || null,
      trial_ends_at: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
      created_at: now,
      updated_at: now,
    });

    logger.info(
      `Granted application '${application.code}' to tenant '${tenantId}'. ` +
        `Source: ${data.source}. Admin: ${adminId}`
    );

    await auditService.record({
      actor,
      action: "APPLICATION_GRANTED",
      category: "APPLICATION",
      resourceId: id,
      resourceLabel: application.name,
      tenantId,
      summary: `Granted application ${application.name} to tenant ${tenant.name}`,
      metadata: {
        application_code: application.code,
        source: data.source,
        reason: data.reason ?? null,
      },
    });

    return this.mapToResponse(tenantApp);
  }

  /**
   * Update a tenant application (suspend, reactivate, cancel)
   */
  async updateTenantApplication(
    tenantId: string,
    tenantAppId: string,
    data: UpdateTenantApplicationRequest,
    actor: AuditActor
  ): Promise<TenantApplicationResponse> {
    const tenantApp = await tenantApplicationRepository.findByIdWithDetails(tenantAppId, tenantId);
    if (!tenantApp) {
      throw new NotFoundError(`Tenant application with ID '${tenantAppId}' not found`);
    }

    if (!data.status) {
      throw new BadRequestError("Status is required");
    }

    // Validate transitions
    const current = tenantApp.status;
    const target = data.status;

    const validTransitions: Record<string, string[]> = {
      ACTIVE: ["SUSPENDED", "CANCELLED"],
      TRIALING: ["ACTIVE", "SUSPENDED", "CANCELLED"],
      SUSPENDED: ["ACTIVE", "CANCELLED"],
      CANCELLED: ["ACTIVE"], // Re-activate
    };

    if (!validTransitions[current]?.includes(target)) {
      throw new BadRequestError(
        `Cannot transition from '${current}' to '${target}'`
      );
    }

    const now = new Date();
    const updated = await tenantApplicationRepository.update(tenantAppId, tenantId, {
      status: target,
      suspended_at: target === "SUSPENDED" ? now : (target === "ACTIVE" ? null : undefined),
      updated_at: now,
    });

    if (!updated) {
      throw new NotFoundError(`Tenant application with ID '${tenantAppId}' not found`);
    }

    logger.info(
      `Updated tenant application '${tenantAppId}' for tenant '${tenantId}': ` +
        `${current} -> ${target}. Reason: ${data.reason || "N/A"}`
    );

    const actionByTarget: Record<string, string> = {
      SUSPENDED: "APPLICATION_SUSPENDED",
      CANCELLED: "APPLICATION_REVOKED",
      ACTIVE: "APPLICATION_REACTIVATED",
    };
    await auditService.record({
      actor,
      action: actionByTarget[target] ?? "APPLICATION_UPDATED",
      category: "APPLICATION",
      resourceId: tenantAppId,
      resourceLabel: tenantApp.application_name,
      tenantId,
      summary: `${target === "SUSPENDED" ? "Suspended" : target === "CANCELLED" ? "Revoked" : "Reactivated"} application ${tenantApp.application_name} for tenant ${tenantId}`,
      metadata: {
        from: current,
        to: target,
        reason: data.reason ?? null,
      },
    });

    return this.mapToResponse(updated);
  }

  private mapToResponse(app: TenantApplicationWithDetails): TenantApplicationResponse {
    return {
      id: app.id,
      tenant_id: app.tenant_id,
      application_id: app.application_id,
      application_code: app.application_code,
      application_name: app.application_name,
      status: app.status,
      source: app.source,
      source_subscription_id: app.source_subscription_id,
      granted_by: app.granted_by,
      grant_reason: app.grant_reason,
      activated_at: app.activated_at,
      suspended_at: app.suspended_at,
      trial_ends_at: app.trial_ends_at,
      created_at: app.created_at,
      updated_at: app.updated_at,
    };
  }
}

export default new TenantApplicationService();

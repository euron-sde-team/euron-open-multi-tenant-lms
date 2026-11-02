import * as XLSX from "xlsx";
import { ulid } from "ulid";
import { db } from "../db/connection";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { NotFoundError } from "../errors/not-found.error";
import tenantMembershipRepository from "../repositories/tenant-membership.repository";
import tenantRoleRepository from "../repositories/tenant-role.repository";
import tenantUserRepository from "../repositories/tenant-user.repository";
import tenantRepository from "../repositories/tenant.repository";
import {
  CreateTenantRequest,
  CreateTenantRoleRequest,
  SuspendTenantRequest,
  TenantListResponse,
  TenantQueryParams,
  TenantResponse,
  TenantRoleResponse,
  UpdateTenantRequest,
  UpdateTenantRoleRequest,
} from "../types/tenant.type";
import { AuditActor } from "../types/audit-log.type";
import config from "../config";
import logger from "../utils/logger";
import auditService from "./audit.service";

/** Fallback contact email when a tenant has no configured contact email. */
const DEFAULT_SUPPORT_EMAIL = config.DEFAULT_SUPPORT_EMAIL;

class TenantService {
  /**
   * Public app info for whitelabel pages (mobile account-deletion guide).
   * Returns the org display name and a usable contact email (configured contact
   * email if present, otherwise the platform fallback).
   */
  async getPublicAppInfo(
    slug: string
  ): Promise<{ name: string; support_email: string }> {
    const info = await tenantRepository.findPublicAppInfoBySlug(slug);
    if (!info) {
      throw new NotFoundError("Tenant not found");
    }

    return {
      name: info.name,
      support_email:
        this.extractFirstEmail(info.recipient_emails) ?? DEFAULT_SUPPORT_EMAIL,
    };
  }

  /** Pull the first valid-looking email out of a recipient_emails JSON value. */
  private extractFirstEmail(raw: unknown): string | null {
    let value: unknown = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        value = [raw];
      }
    }
    if (!Array.isArray(value)) return null;
    const first = value.find(
      (e) => typeof e === "string" && e.includes("@")
    );
    return typeof first === "string" ? first.trim() : null;
  }

  /**
   * List tenants with pagination and filters
   */
  async listTenants(params: TenantQueryParams): Promise<TenantListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 50;

    const { tenants, total } = await tenantRepository.findAll(params);

    return {
      data: tenants.map((t) => this.mapToResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Create a new tenant with an existing user as owner.
   * Does not create users; owner_user_id must reference an existing ACTIVE tenant user.
   */
  async createTenant(
    data: CreateTenantRequest,
    actor: AuditActor
  ): Promise<TenantResponse> {
    if (!data.owner_user_id?.trim()) {
      throw new BadRequestError("owner_user_id is required");
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(data.slug)) {
      throw new BadRequestError(
        "Slug must contain only lowercase letters, numbers, and hyphens"
      );
    }

    // Check slug uniqueness
    const slugExists = await tenantRepository.slugExists(data.slug);
    if (slugExists) {
      throw new ConflictError(`Tenant with slug '${data.slug}' already exists`);
    }

    // Check custom domain uniqueness if provided
    if (data.custom_domain) {
      const domainExists = await tenantRepository.customDomainExists(data.custom_domain);
      if (domainExists) {
        throw new ConflictError(`Custom domain '${data.custom_domain}' is already in use`);
      }
    }

    // Ensure owner user exists and is ACTIVE
    const ownerUser = await tenantUserRepository.findById(data.owner_user_id);
    if (!ownerUser) {
      throw new NotFoundError(`User with ID '${data.owner_user_id}' not found`);
    }
    if (ownerUser.status !== "ACTIVE") {
      throw new BadRequestError(
        `User '${ownerUser.email}' is not active and cannot be set as tenant owner`
      );
    }

    const now = new Date();
    const tenantId = ulid();
    const membershipId = ulid();

    const tenant = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto("tenants")
        .values({
          id: tenantId,
          name: data.name,
          slug: data.slug,
          custom_domain: data.custom_domain || null,
          owner_user_id: data.owner_user_id,
          status: "ACTIVE",
          created_at: now,
          updated_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tenantMembershipRepository.create(
        {
          id: membershipId,
          tenant_id: tenantId,
          user_id: data.owner_user_id,
          status: "ACTIVE",
          joined_at: now,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // Assign global ADMIN role to owner if it exists
      const adminRole = await tenantRoleRepository.findByCode("ADMIN", trx);
      if (adminRole) {
        await tenantMembershipRepository.assignRole(
          membershipId,
          adminRole.id,
          undefined,
          trx
        );
      }

      logger.info(
        `Created tenant '${created.name}' with owner user '${ownerUser.email}'`
      );

      return created;
    });

    await auditService.record({
      actor,
      action: "TENANT_CREATED",
      category: "TENANT",
      resourceId: tenant.id,
      resourceLabel: tenant.name,
      tenantId: tenant.id,
      summary: `Created tenant ${tenant.name} (${tenant.slug})`,
      metadata: { slug: tenant.slug, owner_email: ownerUser.email },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      custom_domain: tenant.custom_domain,
      owner_user_id: tenant.owner_user_id,
      status: tenant.status as TenantResponse["status"],
      created_at: tenant.created_at as Date,
      updated_at: tenant.updated_at as Date,
    };
  }

  /**
   * Get tenant by ID with details
   */
  async getTenantById(id: string): Promise<TenantResponse> {
    const tenant = await tenantRepository.findByIdWithOwner(id);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    // Get owner's membership in this tenant
    const ownerMembership = await tenantMembershipRepository.findByTenantAndUser(
      id,
      tenant.owner_user_id
    );

    // Get subscription info + domains
    const [subscriptionCount, activeSubscription, domains] = await Promise.all([
      tenantRepository.getSubscriptionCount(id),
      tenantRepository.getActiveSubscription(id),
      tenantRepository.findDomainsByTenantId(id),
    ]);

    return {
      ...this.mapToResponse(tenant),
      owner: {
        id: tenant.owner_user_id,
        email: tenant.owner_email,
        name: tenant.owner_name,
        avatar_url: tenant.owner_avatar_url,
        status: tenant.owner_status as "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "INVITED",
        email_verified: tenant.owner_email_verified,
        last_login_at: tenant.owner_last_login_at,
        created_at: tenant.owner_created_at,
        updated_at: tenant.owner_updated_at,
        phone: tenant.owner_phone,
        phone_verified: tenant.owner_phone_verified,
        signup_country: tenant.owner_signup_country,
        signup_city: tenant.owner_signup_city,
        signup_ip: tenant.owner_signup_ip,
        signup_referrer: tenant.owner_signup_referrer,
        timezone: tenant.owner_timezone,
        designation: tenant.owner_designation,
        login_count: tenant.owner_login_count,
        last_login_ip: tenant.owner_last_login_ip,
        profile_completed_at: tenant.owner_profile_completed_at,
        membership: ownerMembership
          ? {
            id: ownerMembership.id,
            tenant_id: id,
            user_id: tenant.owner_user_id,
            status: ownerMembership.status,
            invited_by: ownerMembership.invited_by,
            invited_at: ownerMembership.invited_at,
            joined_at: ownerMembership.joined_at,
            created_at: ownerMembership.created_at,
            updated_at: ownerMembership.updated_at,
            is_owner: true,
          }
          : undefined,
      },
      subscription_count: subscriptionCount,
      active_subscription: activeSubscription
        ? {
          id: activeSubscription.id,
          tenant_id: activeSubscription.tenant_id,
          plan_version_id: activeSubscription.plan_version_id,
          plan_code_snapshot: activeSubscription.plan_code_snapshot,
          plan_name_snapshot: activeSubscription.plan_name_snapshot,
          plan_version_snapshot: activeSubscription.plan_version_snapshot,
          billing_cycle: activeSubscription.billing_cycle as "MONTHLY" | "YEARLY",
          currency: activeSubscription.currency as "INR" | "USD",
          original_price: Number(activeSubscription.original_price),
          discount_applied: Number(activeSubscription.discount_applied),
          price_snapshot: Number(activeSubscription.price_snapshot),
          external_subscription_id: activeSubscription.external_subscription_id,
          external_customer_id: activeSubscription.external_customer_id,
          started_at: activeSubscription.started_at,
          current_period_start: activeSubscription.current_period_start,
          current_period_end: activeSubscription.current_period_end,
          cancelled_at: activeSubscription.cancelled_at,
          cancel_effective_at: activeSubscription.cancel_effective_at,
          status: activeSubscription.status as "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED" | "EXPIRED",
          created_at: activeSubscription.created_at,
          updated_at: activeSubscription.updated_at,
        }
        : null,
      domains: domains.map((d) => ({
        id: d.id,
        domain_type: d.domain_type as "SUBDOMAIN" | "CUSTOM",
        domain_name: d.domain_name,
        subdomain_prefix: d.subdomain_prefix,
        status: d.status as "PENDING_VERIFICATION" | "VERIFIED" | "FAILED" | "EXPIRED",
        is_primary: d.is_primary,
        ssl_active: d.ssl_active,
        ssl_status: d.ssl_status,
        ownership_verified: d.ownership_verified,
        verified_at: d.verified_at,
        created_at: d.created_at,
      })),
    };
  }

  /**
   * Update tenant
   */
  async updateTenant(
    id: string,
    data: UpdateTenantRequest,
    actor: AuditActor
  ): Promise<TenantResponse> {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    // Check custom domain uniqueness if being updated
    if (data.custom_domain && data.custom_domain !== existing.custom_domain) {
      const domainExists = await tenantRepository.customDomainExists(data.custom_domain, id);
      if (domainExists) {
        throw new ConflictError(`Custom domain '${data.custom_domain}' is already in use`);
      }
    }

    const updated = await tenantRepository.update(id, {
      name: data.name,
      custom_domain: data.custom_domain,
      updated_at: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    logger.info(`Updated tenant '${id}'`);

    await auditService.record({
      actor,
      action: "TENANT_UPDATED",
      category: "TENANT",
      resourceId: updated.id,
      resourceLabel: updated.name,
      tenantId: updated.id,
      summary: `Updated tenant ${updated.name}`,
      metadata: {
        before: { name: existing.name, custom_domain: existing.custom_domain },
        after: { name: updated.name, custom_domain: updated.custom_domain },
      },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(
    id: string,
    data: SuspendTenantRequest,
    actor: AuditActor
  ): Promise<TenantResponse> {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    if (existing.status === "SUSPENDED") {
      throw new BadRequestError("Tenant is already suspended");
    }

    if (existing.status === "CANCELLED") {
      throw new BadRequestError("Cannot suspend a cancelled tenant");
    }

    const updated = await tenantRepository.update(id, {
      status: "SUSPENDED",
      updated_at: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    logger.info(`Suspended tenant '${id}'. Reason: ${data.reason}`);

    await auditService.record({
      actor,
      action: "TENANT_SUSPENDED",
      category: "TENANT",
      resourceId: updated.id,
      resourceLabel: updated.name,
      tenantId: updated.id,
      summary: `Suspended tenant ${updated.name}`,
      metadata: { reason: data.reason },
    });

    return this.mapToResponse(updated);
  }

  /**
   * Reactivate suspended tenant
   */
  async reactivateTenant(
    id: string,
    actor: AuditActor
  ): Promise<TenantResponse> {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    if (existing.status !== "SUSPENDED") {
      throw new BadRequestError("Only suspended tenants can be reactivated");
    }

    const updated = await tenantRepository.update(id, {
      status: "ACTIVE",
      updated_at: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    logger.info(`Reactivated tenant '${id}'`);

    await auditService.record({
      actor,
      action: "TENANT_REACTIVATED",
      category: "TENANT",
      resourceId: updated.id,
      resourceLabel: updated.name,
      tenantId: updated.id,
      summary: `Reactivated tenant ${updated.name}`,
    });

    return this.mapToResponse(updated);
  }

  /**
   * Permanently delete a tenant and all related data (cascaded by DB FK constraints).
   */
  async deleteTenant(
    id: string,
    actor: AuditActor
  ): Promise<{ id: string; name: string; slug: string }> {
    const existing = await tenantRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Tenant with ID '${id}' not found`);
    }

    const { name, slug } = existing;

    const deleted = await tenantRepository.deleteById(id);
    if (!deleted) {
      throw new NotFoundError(`Tenant with ID '${id}' could not be deleted`);
    }

    logger.info(
      `Permanently deleted tenant '${name}' (slug: ${slug}, id: ${id}) and all related data`
    );

    await auditService.record({
      actor,
      action: "TENANT_DELETED",
      category: "TENANT",
      resourceId: id,
      resourceLabel: name,
      tenantId: id,
      summary: `Permanently deleted tenant ${name} (${slug})`,
      metadata: { slug },
    });

    return { id, name, slug };
  }

  /**
   * Check if tenant exists
   */
  async tenantExists(id: string): Promise<boolean> {
    const tenant = await tenantRepository.findById(id);
    return !!tenant;
  }

  /**
   * Get tenant owner ID
   */
  async getTenantOwnerId(tenantId: string): Promise<string | null> {
    const tenant = await tenantRepository.findById(tenantId);
    return tenant?.owner_user_id || null;
  }

  /**
   * List all global tenant roles
   */
  async listTenantRoles(): Promise<TenantRoleResponse[]> {
    return tenantRoleRepository.findAll();
  }

  /**
   * Create a global tenant role
   */
  async createTenantRole(data: CreateTenantRoleRequest): Promise<TenantRoleResponse> {
    const code = data.code?.trim() || "";
    const name = data.name?.trim() || "";

    if (!code) {
      throw new BadRequestError("Role code is required");
    }
    if (!name) {
      throw new BadRequestError("Role name is required");
    }

    if (!/^[a-z][a-z0-9_]*$/.test(code)) {
      throw new BadRequestError(
        "Role code must be lowercase and contain only lowercase letters, numbers, and underscores (e.g. admin, content_manager)"
      );
    }

    const exists = await tenantRoleRepository.codeExists(code);
    if (exists) {
      throw new ConflictError(
        `A role with code '${code}' already exists`
      );
    }

    const now = new Date();
    const roleId = ulid();

    return tenantRoleRepository.create({
      id: roleId,
      code,
      name,
      description: data.description?.trim() || null,
      is_system: false,
      created_at: now,
      updated_at: now,
    });
  }

  /**
   * Update a global tenant role (code, name, description)
   */
  async updateTenantRole(
    roleId: string,
    data: UpdateTenantRoleRequest
  ): Promise<TenantRoleResponse> {
    const existing = await tenantRoleRepository.findById(roleId);
    if (!existing) {
      throw new NotFoundError(`Role with ID '${roleId}' not found`);
    }

    if (data.code !== undefined) {
      const code = data.code.trim();
      if (!code) {
        throw new BadRequestError("Role code cannot be empty");
      }
      if (!/^[a-z][a-z0-9_]*$/.test(code)) {
        throw new BadRequestError(
          "Role code must be lowercase and contain only lowercase letters, numbers, and underscores (e.g. admin, content_manager)"
        );
      }
      const exists = await tenantRoleRepository.codeExists(code, roleId);
      if (exists) {
        throw new ConflictError(`A role with code '${code}' already exists`);
      }
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) {
        throw new BadRequestError("Role name cannot be empty");
      }
    }

    const now = new Date();
    const payload: {
      code?: string;
      name?: string;
      description?: string | null;
      updated_at: Date;
    } = { updated_at: now };
    if (data.code !== undefined) payload.code = data.code.trim();
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.description !== undefined) {
      payload.description = data.description.trim() || null;
    }

    return tenantRoleRepository.update(roleId, payload);
  }

  /**
   * Export tenants filtered by signup date range as an Excel (.xlsx) buffer.
   */
  async exportTenants(startDate?: Date, endDate?: Date): Promise<Buffer> {
    const rows = await tenantRepository.exportTenants(startDate, endDate);

    const sheetRows = rows.map((t) => ({
      "Tenant ID": t.id,
      "Tenant Name": t.name,
      "Slug": t.slug,
      "Status": t.status,
      "Signup Date": t.created_at ? new Date(t.created_at).toISOString().split("T")[0] : "",
      "Owner Name": t.owner_name ?? "",
      "Owner Email": t.owner_email ?? "",
      "Owner Phone": t.owner_phone ?? "",
      "Signup Country": t.owner_signup_country ?? "",
      "Signup City": t.owner_signup_city ?? "",
      "Last Login": t.owner_last_login_at
        ? new Date(t.owner_last_login_at).toISOString().replace("T", " ").substring(0, 19)
        : "",
      "Login Count": t.owner_login_count,
      "Active Plan": t.active_plan_name ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tenants");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(tenant: {
    id: string;
    name: string;
    slug: string;
    custom_domain: string | null;
    owner_user_id: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    owner_email?: string | null;
    owner_name?: string | null;
    active_plan_name?: string | null;
  }): TenantResponse {
    const base: TenantResponse = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      custom_domain: tenant.custom_domain,
      owner_user_id: tenant.owner_user_id,
      status: tenant.status as TenantResponse["status"],
      created_at: tenant.created_at,
      updated_at: tenant.updated_at,
    };
    const extra = tenant as Record<string, unknown>;
    if (tenant.owner_email !== undefined) base.owner_email = tenant.owner_email;
    if (tenant.owner_name !== undefined) base.owner_name = tenant.owner_name;
    if (extra.owner_phone !== undefined)
      base.owner_phone = extra.owner_phone as string | null;
    if (tenant.active_plan_name !== undefined) base.active_plan_name = tenant.active_plan_name;
    if (extra.active_plan_code !== undefined)
      base.active_plan_code = extra.active_plan_code as string | null;
    if (extra.active_plan_status !== undefined)
      base.active_plan_status = extra.active_plan_status as string | null;
    if (extra.active_billing_cycle !== undefined)
      base.active_billing_cycle = extra.active_billing_cycle as string | null;
    if (extra.active_period_start !== undefined)
      base.active_period_start = extra.active_period_start as Date | null;
    if (extra.active_period_end !== undefined)
      base.active_period_end = extra.active_period_end as Date | null;
    if (extra.primary_domain !== undefined)
      base.primary_domain = extra.primary_domain as string | null;
    return base;
  }
}

export default new TenantService();

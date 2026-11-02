import { ulid } from "ulid";
import tenantAddonRepository from "../repositories/tenant-addon.repository";
import addonRepository from "../repositories/addon.repository";
import applicationRepository from "../repositories/application.repository";
import productRepository from "../repositories/product.repository";
import entitlementRepository from "../repositories/entitlement.repository";
import tenantRepository from "../repositories/tenant.repository";
import { db } from "../db/connection";
import {
  GrantAddonRequest,
  CancelTenantAddonRequest,
  TenantAddonResponse,
  TenantAddonQueryParams,
  TenantAddonListResponse,
  AddonCatalogResponse,
  AddonCatalogListResponse,
  AddonCatalogQueryParams,
  CreateAddonRequest,
  UpdateAddonRequest,
} from "../types/tenant.type";
import { NotFoundError } from "../errors/not-found.error";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { AuditActor } from "../types/audit-log.type";
import auditService from "./audit.service";
import logger from "../utils/logger";

class TenantAddonService {
  /**
   * Get addon by ID (catalog)
   */
  async getAddonById(id: string): Promise<AddonCatalogResponse> {
    const addon = await addonRepository.findByIdWithDetails(id);
    if (!addon) {
      throw new NotFoundError(`Addon with ID '${id}' not found`);
    }
    return this.mapAddonToResponse(addon);
  }

  /**
   * List available addons (catalog)
   */
  async listAvailableAddons(params: AddonCatalogQueryParams): Promise<AddonCatalogListResponse> {
    const { addons, total } = await addonRepository.findAll(params);

    return {
      addons: addons.map((a) => this.mapAddonToResponse(a)),
      total,
    };
  }

  /**
   * Create addon (catalog)
   */
  async createAddon(data: CreateAddonRequest): Promise<AddonCatalogResponse> {
    const existingByCode = await addonRepository.findByCode(data.code);
    if (existingByCode) {
      throw new ConflictError(`Addon with code '${data.code}' already exists`);
    }

    const application = await applicationRepository.findById(data.application_id);
    if (!application) {
      throw new NotFoundError(`Application with ID '${data.application_id}' not found`);
    }

    const product = await productRepository.findByIdWithDetails(data.product_id);
    if (!product) {
      throw new NotFoundError(`Product with ID '${data.product_id}' not found`);
    }
    if (product.application_id !== data.application_id) {
      throw new BadRequestError(
        `Product does not belong to the selected application`
      );
    }

    const addon = await addonRepository.create(data);
    const withDetails = await addonRepository.findByIdWithDetails(addon.id);
    if (!withDetails) {
      throw new NotFoundError(`Addon created but could not be retrieved`);
    }
    return this.mapAddonToResponse(withDetails);
  }

  /**
   * Update addon (catalog)
   */
  async updateAddon(id: string, data: UpdateAddonRequest): Promise<AddonCatalogResponse> {
    const existing = await addonRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Addon with ID '${id}' not found`);
    }

    await addonRepository.update(id, data);
    const withDetails = await addonRepository.findByIdWithDetails(id);
    if (!withDetails) {
      throw new NotFoundError(`Addon updated but could not be retrieved`);
    }
    return this.mapAddonToResponse(withDetails);
  }

  /**
   * List tenant addons
   */
  async listTenantAddons(
    tenantId: string,
    params: TenantAddonQueryParams
  ): Promise<TenantAddonListResponse> {
    // Verify tenant exists
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    const page = params.page || 1;
    const limit = params.limit || 50;

    const { addons, total } = await tenantAddonRepository.findByTenant(tenantId, params);

    return {
      data: addons.map((a) => this.mapToResponse(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Grant addon to tenant
   * This creates the tenant_addon and corresponding entitlement
   */
  async grantAddon(
    tenantId: string,
    data: GrantAddonRequest,
    actor: AuditActor
  ): Promise<TenantAddonResponse> {
    const adminId = actor.adminId ?? undefined;
    // Verify tenant exists and is active
    const tenant = await tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant with ID '${tenantId}' not found`);
    }

    if (tenant.status !== "ACTIVE") {
      throw new BadRequestError(`Cannot grant addon to ${tenant.status.toLowerCase()} tenant`);
    }

    // Verify addon exists
    const addon = await addonRepository.findByIdWithDetails(data.addon_id);
    if (!addon) {
      throw new NotFoundError(`Addon with ID '${data.addon_id}' not found`);
    }

    if (!addon.is_active) {
      throw new BadRequestError("Cannot grant an inactive addon");
    }

    // Check if tenant already has this addon
    const hasAddon = await tenantAddonRepository.tenantHasAddon(tenantId, data.addon_id);
    if (hasAddon) {
      throw new ConflictError("Tenant already has this addon");
    }

    // Require reason for free grants
    if (data.source === "ADMIN_FREE" && (!data.reason || data.reason.trim().length < 5)) {
      throw new BadRequestError("Reason is required for free addon grants (minimum 5 characters)");
    }

    // Get addon product details for entitlement creation
    const productDetails = await addonRepository.getAddonProductDetails(data.addon_id);
    if (!productDetails) {
      throw new Error("Failed to get addon product details");
    }

    const now = new Date();
    const tenantAddonId = ulid();
    const entitlementId = ulid();

    // Determine grant value
    const grantValue = data.custom_grant_value ?? productDetails.grant_value;
    const isUnlimited = productDetails.is_unlimited;

    // Calculate expiry
    let expiresAt: Date | null = null;
    if (data.expires_at) {
      expiresAt = new Date(data.expires_at);
      if (expiresAt <= now) {
        throw new BadRequestError("Expiry date must be in the future");
      }
    }

    // Execute in transaction
    const tenantAddon = await db.transaction().execute(async (trx) => {
      // 1. Create entitlement for the addon
      const entitlement = await entitlementRepository.create(
        {
          id: entitlementId,
          tenant_id: tenantId,
          product_id: productDetails.product_id,
          application_code: productDetails.application_code,
          feature_key: productDetails.feature_key,
          product_code: productDetails.product_code,
          is_unlimited: isUnlimited,
          limit_value: grantValue,
          used_value: 0,
          source: "ADDON",
          source_addon_id: data.addon_id,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // 2. Create tenant_addon record
      const tenantAddon = await tenantAddonRepository.create(
        {
          id: tenantAddonId,
          tenant_id: tenantId,
          addon_id: data.addon_id,
          source: data.source,
          status: "ACTIVE",
          custom_grant_value: data.custom_grant_value ?? null,
          entitlement_id: entitlement.id,
          granted_by: adminId ?? null,
          reason: data.reason ?? null,
          activated_at: now,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        },
        trx
      );

      // 3. Record event (event_type must match tenant_addon_event_type enum)
      const eventType =
        data.source === "ADMIN_FREE"
          ? "ADMIN_GRANTED_FREE"
          : data.source === "ADMIN_PAID"
            ? "ADMIN_GRANTED_PAID"
            : "PURCHASED";
      await tenantAddonRepository.createEvent(
        {
          id: ulid(),
          tenant_addon_id: tenantAddon.id,
          tenant_id: tenantId,
          addon_id: data.addon_id,
          event_type: eventType,
          new_status: "ACTIVE",
          reason: data.reason ?? null,
          admin_id: adminId ?? null,
        },
        trx
      );

      logger.info(
        `Granted addon '${addon.code}' to tenant '${tenantId}'. ` +
          `Source: ${data.source}, Grant value: ${isUnlimited ? "unlimited" : grantValue}` +
          (adminId ? `, Admin: ${adminId}` : "")
      );

      return tenantAddon;
    });

    await auditService.record({
      actor,
      action: "ADDON_GRANTED",
      category: "ADDON",
      resourceId: tenantAddon.id,
      resourceLabel: addon.name ?? addon.code,
      tenantId,
      summary: `Granted addon ${addon.name ?? addon.code} to tenant ${tenant.name}`,
      metadata: {
        addon_code: addon.code,
        source: data.source,
        grant_value: isUnlimited ? "unlimited" : grantValue,
        reason: data.reason ?? null,
      },
    });

    // Fetch with details for response
    const result = await tenantAddonRepository.findByIdWithDetails(tenantAddon.id);
    return this.mapToResponse(result!);
  }

  /**
   * Get tenant addon by ID
   */
  async getTenantAddonById(
    tenantId: string,
    tenantAddonId: string
  ): Promise<TenantAddonResponse> {
    const tenantAddon = await tenantAddonRepository.findByIdWithDetails(tenantAddonId);
    if (!tenantAddon || tenantAddon.tenant_id !== tenantId) {
      throw new NotFoundError(`Tenant addon with ID '${tenantAddonId}' not found`);
    }

    return this.mapToResponse(tenantAddon);
  }

  /**
   * Cancel tenant addon
   */
  async cancelTenantAddon(
    tenantId: string,
    tenantAddonId: string,
    data: CancelTenantAddonRequest,
    actor: AuditActor
  ): Promise<TenantAddonResponse> {
    const adminId = actor.adminId ?? undefined;
    const tenantAddon = await tenantAddonRepository.findByIdAndTenant(tenantAddonId, tenantId);
    if (!tenantAddon) {
      throw new NotFoundError(`Tenant addon with ID '${tenantAddonId}' not found`);
    }

    if (tenantAddon.status === "CANCELLED" || tenantAddon.status === "EXPIRED") {
      throw new BadRequestError("Addon is already cancelled or expired");
    }

    const now = new Date();

    // Execute in transaction
    await db.transaction().execute(async (trx) => {
      // 1. Archive the entitlement
      if (tenantAddon.entitlement_id) {
        await entitlementRepository.archiveByAddon(tenantAddon.addon_id, trx);
      }

      // 2. Update tenant addon status
      await tenantAddonRepository.update(
        tenantAddonId,
        {
          status: "CANCELLED",
          cancelled_at: now,
          updated_at: now,
        },
        trx
      );

      // 3. Record event
      await tenantAddonRepository.createEvent(
        {
          id: ulid(),
          tenant_addon_id: tenantAddonId,
          tenant_id: tenantId,
          addon_id: tenantAddon.addon_id,
          event_type: "CANCELLED",
          old_status: tenantAddon.status,
          new_status: "CANCELLED",
          reason: data.reason ?? null,
          admin_id: adminId ?? null,
        },
        trx
      );
    });

    logger.info(
      `Cancelled addon '${tenantAddon.addon_id}' for tenant '${tenantId}'` +
        (adminId ? `. Admin: ${adminId}` : "") +
        (data.reason ? `. Reason: ${data.reason}` : "")
    );

    const result = await tenantAddonRepository.findByIdWithDetails(tenantAddonId);

    await auditService.record({
      actor,
      action: "ADDON_CANCELLED",
      category: "ADDON",
      resourceId: tenantAddonId,
      resourceLabel: result?.addon_name ?? tenantAddon.addon_id,
      tenantId,
      summary: `Cancelled addon ${result?.addon_name ?? tenantAddon.addon_id} for tenant ${tenantId}`,
      metadata: { reason: data.reason ?? null },
    });

    return this.mapToResponse(result!);
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapToResponse(tenantAddon: {
    id: string;
    tenant_id: string;
    addon_id: string;
    source: string;
    status: string;
    custom_grant_value: number | null;
    addon_subscription_id: string | null;
    entitlement_id: string | null;
    granted_by: string | null;
    reason: string | null;
    activated_at: Date;
    cancelled_at: Date | null;
    expires_at: Date | null;
    created_at: Date;
    updated_at: Date;
    addon_code?: string;
    addon_name?: string;
    addon_description?: string | null;
    application_code?: string;
    product_code?: string;
    grant_value?: number;
    is_unlimited?: boolean;
  }): TenantAddonResponse {
    return {
      id: tenantAddon.id,
      tenant_id: tenantAddon.tenant_id,
      addon_id: tenantAddon.addon_id,
      source: tenantAddon.source as TenantAddonResponse["source"],
      status: tenantAddon.status as TenantAddonResponse["status"],
      custom_grant_value: tenantAddon.custom_grant_value,
      addon_subscription_id: tenantAddon.addon_subscription_id,
      entitlement_id: tenantAddon.entitlement_id,
      granted_by: tenantAddon.granted_by,
      reason: tenantAddon.reason,
      activated_at: tenantAddon.activated_at,
      cancelled_at: tenantAddon.cancelled_at,
      expires_at: tenantAddon.expires_at,
      created_at: tenantAddon.created_at,
      updated_at: tenantAddon.updated_at,
      addon_name: tenantAddon.addon_name ?? undefined,
      product_code: tenantAddon.product_code ?? undefined,
      grant_value: tenantAddon.grant_value ?? undefined,
      addon: tenantAddon.addon_code
        ? {
            id: tenantAddon.addon_id,
            code: tenantAddon.addon_code,
            name: tenantAddon.addon_name!,
            description: tenantAddon.addon_description ?? null,
            application_id: "",
            application_code: tenantAddon.application_code,
            product_id: "",
            product_code: tenantAddon.product_code,
            grant_value: tenantAddon.grant_value!,
            is_unlimited: tenantAddon.is_unlimited!,
          }
        : undefined,
    };
  }

  private mapAddonToResponse(addon: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    application_id: string;
    application_code: string;
    application_name: string;
    product_id: string;
    product_code: string;
    product_constraint_type: string;
    feature_key: string;
    grant_value: number;
    is_unlimited: boolean;
    price_monthly_inr: number;
    price_yearly_inr: number;
    price_monthly_usd: number;
    price_yearly_usd: number;
    is_active: boolean;
    is_public: boolean;
    sort_order: number;
  }): AddonCatalogResponse {
    return {
      id: addon.id,
      code: addon.code,
      name: addon.name,
      description: addon.description,
      application_id: addon.application_id,
      application_code: addon.application_code,
      application_name: addon.application_name,
      product_id: addon.product_id,
      product_code: addon.product_code,
      product_constraint_type: addon.product_constraint_type,
      feature_key: addon.feature_key,
      grant_value: addon.grant_value,
      is_unlimited: addon.is_unlimited,
      price_monthly_inr: addon.price_monthly_inr,
      price_yearly_inr: addon.price_yearly_inr,
      price_monthly_usd: addon.price_monthly_usd,
      price_yearly_usd: addon.price_yearly_usd,
      is_active: addon.is_active,
      is_public: addon.is_public,
      sort_order: addon.sort_order,
    };
  }
}

export default new TenantAddonService();

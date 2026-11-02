import { NextFunction, Request, Response } from "express";
import tenantAddonService from "../services/tenant-addon.service";
import {
    AddonCatalogQueryParams,
    CancelTenantAddonRequest,
    CreateAddonRequest,
    GrantAddonRequest,
    TenantAddonQueryParams,
    TenantAddonSource,
    TenantAddonStatus,
    UpdateAddonRequest,
} from "../types/tenant.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * Get addon by ID (catalog)
 * GET /admin/entitlements/addons/:id
 */
export const getAddonById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const addon = await tenantAddonService.getAddonById(id as string);

  sendSuccessResponse({
    res,
    data: addon,
    statusCode: HttpSuccessStatus.OK,
    message: "Addon retrieved successfully",
  });
};

/**
 * Create addon (catalog)
 * POST /admin/entitlements/addons
 */
export const createAddon = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreateAddonRequest = {
    application_id: req.body.application_id,
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    product_id: req.body.product_id,
    grant_value: req.body.grant_value,
    is_unlimited: req.body.is_unlimited ?? false,
    price_monthly_inr: req.body.price_monthly_inr,
    price_yearly_inr: req.body.price_yearly_inr,
    price_monthly_usd: req.body.price_monthly_usd,
    price_yearly_usd: req.body.price_yearly_usd,
    discount_monthly_inr_type: req.body.discount_monthly_inr_type,
    discount_monthly_inr_value: req.body.discount_monthly_inr_value,
    discount_yearly_inr_type: req.body.discount_yearly_inr_type,
    discount_yearly_inr_value: req.body.discount_yearly_inr_value,
    discount_monthly_usd_type: req.body.discount_monthly_usd_type,
    discount_monthly_usd_value: req.body.discount_monthly_usd_value,
    discount_yearly_usd_type: req.body.discount_yearly_usd_type,
    discount_yearly_usd_value: req.body.discount_yearly_usd_value,
    is_active: req.body.is_active,
    is_public: req.body.is_public,
    sort_order: req.body.sort_order,
  };

  const addon = await tenantAddonService.createAddon(data);

  sendSuccessResponse({
    res,
    data: addon,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Addon created successfully",
  });
};

/**
 * Update addon (catalog)
 * PUT /admin/entitlements/addons/:id
 */
export const updateAddon = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  const data: UpdateAddonRequest = {
    name: req.body.name,
    description: req.body.description,
    grant_value: req.body.grant_value,
    is_unlimited: req.body.is_unlimited,
    price_monthly_inr: req.body.price_monthly_inr,
    price_yearly_inr: req.body.price_yearly_inr,
    price_monthly_usd: req.body.price_monthly_usd,
    price_yearly_usd: req.body.price_yearly_usd,
    discount_monthly_inr_type: req.body.discount_monthly_inr_type,
    discount_monthly_inr_value: req.body.discount_monthly_inr_value,
    discount_yearly_inr_type: req.body.discount_yearly_inr_type,
    discount_yearly_inr_value: req.body.discount_yearly_inr_value,
    discount_monthly_usd_type: req.body.discount_monthly_usd_type,
    discount_monthly_usd_value: req.body.discount_monthly_usd_value,
    discount_yearly_usd_type: req.body.discount_yearly_usd_type,
    discount_yearly_usd_value: req.body.discount_yearly_usd_value,
    is_active: req.body.is_active,
    is_public: req.body.is_public,
    sort_order: req.body.sort_order,
  };

  const addon = await tenantAddonService.updateAddon(id as string, data);

  sendSuccessResponse({
    res,
    data: addon,
    statusCode: HttpSuccessStatus.OK,
    message: "Addon updated successfully",
  });
};

/**
 * List available addons (catalog)
 * GET /admin/entitlements/addons
 */
export const listAvailableAddons = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: AddonCatalogQueryParams = {
    application_id: req.query.application_id as string | undefined,
    product_id: req.query.product_id as string | undefined,
    is_active:
      req.query.is_active !== undefined
        ? req.query.is_active === "true"
        : undefined,
    is_public:
      req.query.is_public !== undefined
        ? req.query.is_public === "true"
        : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantAddonService.listAvailableAddons(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Available addons retrieved successfully",
  });
};

/**
 * List tenant addons
 * GET /admin/tenants/:tenantId/addons
 */
export const listTenantAddons = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: TenantAddonQueryParams = {
    status: req.query.status as TenantAddonStatus | undefined,
    source: req.query.source as TenantAddonSource | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await tenantAddonService.listTenantAddons(tenantId as string, params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant addons retrieved successfully",
  });
};

/**
 * Grant addon to tenant
 * POST /admin/tenants/:tenantId/addons
 */
export const grantAddon = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const data: GrantAddonRequest = {
    addon_id: req.body.addon_id,
    source: req.body.source as TenantAddonSource,
    custom_grant_value: req.body.custom_grant_value,
    reason: req.body.reason,
    expires_at: req.body.expires_at,
  };

  const tenantAddon = await tenantAddonService.grantAddon(
    tenantId as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenantAddon,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Addon granted to tenant successfully",
  });
};

/**
 * Get tenant addon by ID
 * GET /admin/tenants/:tenantId/addons/:id
 */
export const getTenantAddonById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const tenantAddon = await tenantAddonService.getTenantAddonById(
    tenantId as string,
    id as string
  );

  sendSuccessResponse({
    res,
    data: tenantAddon,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant addon retrieved successfully",
  });
};

/**
 * Cancel tenant addon
 * POST /admin/tenants/:tenantId/addons/:id/cancel
 */
export const cancelTenantAddon = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: CancelTenantAddonRequest = {
    reason: req.body.reason,
  };

  const tenantAddon = await tenantAddonService.cancelTenantAddon(
    tenantId as string,
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: tenantAddon,
    statusCode: HttpSuccessStatus.OK,
    message: "Tenant addon cancelled successfully",
  });
};

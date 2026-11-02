import { NextFunction, Request, Response } from "express";
import planEntitlementSyncService from "../services/plan-entitlement-sync.service";
import planService from "../services/plan.service";
import {
  EntitlementSyncApplyRequest,
  EntitlementSyncOptions,
} from "../types/entitlement-sync.type";
import {
  AddPlanVersionProductRequest,
  CreatePlanRequest,
  CreatePlanVersionRequest,
  CreatePlanWithVersionRequest,
  LinkPlanApplicationRequest,
  PlanQueryParams,
  PlanType,
  UpdatePlanRequest,
  UpdatePlanVersionRequest,
} from "../types/catalog.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

// ============================================
// PLAN CRUD
// ============================================

/**
 * List all plans
 * GET /admin/plans
 */
export const listPlans = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: PlanQueryParams = {
    plan_type: req.query.plan_type as PlanType | undefined,
    is_active:
      req.query.is_active !== undefined
        ? req.query.is_active === "true"
        : undefined,
    is_public:
      req.query.is_public !== undefined
        ? req.query.is_public === "true"
        : undefined,
    has_active_version:
      req.query.has_active_version !== undefined
        ? req.query.has_active_version === "true"
        : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await planService.listPlans(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Plans retrieved successfully",
  });
};

/**
 * Create a new plan
 * POST /admin/plans
 */
export const createPlan = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreatePlanRequest = {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    plan_type: req.body.plan_type,
    sort_order: req.body.sort_order,
    is_public: req.body.is_public,
  };

  const plan = await planService.createPlan(data, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: plan,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Plan created successfully",
  });
};

/**
 * Create a new plan with its first version
 * POST /admin/plans/with-version
 */
export const createPlanWithVersion = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const data: CreatePlanWithVersionRequest = {
    code: req.body.code,
    name: req.body.name,
    description: req.body.description,
    plan_type: req.body.plan_type,
    sort_order: req.body.sort_order,
    is_public: req.body.is_public,
    application_ids: req.body.application_ids,
    price_monthly_inr: req.body.price_monthly_inr,
    price_yearly_inr: req.body.price_yearly_inr,
    price_monthly_usd: req.body.price_monthly_usd,
    price_yearly_usd: req.body.price_yearly_usd,
  };

  const result = await planService.createPlanWithVersion(
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Plan and version created successfully",
  });
};

/**
 * Get plan by ID
 * GET /admin/plans/:id
 */
export const getPlanById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const plan = await planService.getPlanById(id);

  sendSuccessResponse({
    res,
    data: plan,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan retrieved successfully",
  });
};

/**
 * Update a plan
 * PATCH /admin/plans/:id
 */
export const updatePlan = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  const data: UpdatePlanRequest = {
    name: req.body.name,
    description: req.body.description,
    sort_order: req.body.sort_order,
    is_active: req.body.is_active,
    is_public: req.body.is_public,
  };

  const plan = await planService.updatePlan(id, data, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: plan,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan updated successfully",
  });
};

/**
 * Deactivate a plan
 * DELETE /admin/plans/:id
 */
export const deactivatePlan = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const id = req.params.id as string;
  await planService.deactivatePlan(id, buildAuditActor(req));

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan deactivated successfully",
  });
};

// ============================================
// PLAN VERSIONS
// ============================================

/**
 * List plan versions
 * GET /admin/plans/:planId/versions
 */
export const listPlanVersions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const result = await planService.listPlanVersions(planId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan versions retrieved successfully",
  });
};

/**
 * Create a new plan version
 * POST /admin/plans/:planId/versions
 */
export const createPlanVersion = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const data: CreatePlanVersionRequest = {
    pricing_frequency: req.body.pricing_frequency,
    purchase_mode: req.body.purchase_mode,
    price_monthly_inr: req.body.price_monthly_inr,
    price_yearly_inr: req.body.price_yearly_inr,
    discount_monthly_inr_type: req.body.discount_monthly_inr_type,
    discount_monthly_inr_value: req.body.discount_monthly_inr_value,
    discount_yearly_inr_type: req.body.discount_yearly_inr_type,
    discount_yearly_inr_value: req.body.discount_yearly_inr_value,
    price_monthly_usd: req.body.price_monthly_usd,
    price_yearly_usd: req.body.price_yearly_usd,
    discount_monthly_usd_type: req.body.discount_monthly_usd_type,
    discount_monthly_usd_value: req.body.discount_monthly_usd_value,
    discount_yearly_usd_type: req.body.discount_yearly_usd_type,
    discount_yearly_usd_value: req.body.discount_yearly_usd_value,
    price_two_yearly_inr: req.body.price_two_yearly_inr,
    price_two_yearly_usd: req.body.price_two_yearly_usd,
    discount_two_yearly_inr_type: req.body.discount_two_yearly_inr_type,
    discount_two_yearly_inr_value: req.body.discount_two_yearly_inr_value,
    discount_two_yearly_usd_type: req.body.discount_two_yearly_usd_type,
    discount_two_yearly_usd_value: req.body.discount_two_yearly_usd_value,
    is_offer: req.body.is_offer,
    offer_name: req.body.offer_name,
    offer_description: req.body.offer_description,
    offer_valid_from: req.body.offer_valid_from,
    offer_valid_to: req.body.offer_valid_to,
    products: req.body.products,
  };

  const version = await planService.createPlanVersion(
    planId,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: version,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Plan version created successfully",
  });
};

/**
 * Update a draft plan version
 * PATCH /admin/plans/:planId/versions/:versionId
 */
export const updatePlanVersion = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const data: UpdatePlanVersionRequest = {
    pricing_frequency: req.body.pricing_frequency,
    purchase_mode: req.body.purchase_mode,
    price_monthly_inr: req.body.price_monthly_inr,
    price_yearly_inr: req.body.price_yearly_inr,
    discount_monthly_inr_type: req.body.discount_monthly_inr_type,
    discount_monthly_inr_value: req.body.discount_monthly_inr_value,
    discount_yearly_inr_type: req.body.discount_yearly_inr_type,
    discount_yearly_inr_value: req.body.discount_yearly_inr_value,
    price_monthly_usd: req.body.price_monthly_usd,
    price_yearly_usd: req.body.price_yearly_usd,
    discount_monthly_usd_type: req.body.discount_monthly_usd_type,
    discount_monthly_usd_value: req.body.discount_monthly_usd_value,
    discount_yearly_usd_type: req.body.discount_yearly_usd_type,
    discount_yearly_usd_value: req.body.discount_yearly_usd_value,
    price_two_yearly_inr: req.body.price_two_yearly_inr,
    price_two_yearly_usd: req.body.price_two_yearly_usd,
    discount_two_yearly_inr_type: req.body.discount_two_yearly_inr_type,
    discount_two_yearly_inr_value: req.body.discount_two_yearly_inr_value,
    discount_two_yearly_usd_type: req.body.discount_two_yearly_usd_type,
    discount_two_yearly_usd_value: req.body.discount_two_yearly_usd_value,
    is_offer: req.body.is_offer,
    offer_name: req.body.offer_name,
    offer_description: req.body.offer_description,
    offer_valid_from: req.body.offer_valid_from,
    offer_valid_to: req.body.offer_valid_to,
  };

  const version = await planService.updatePlanVersion(
    planId,
    versionId,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: version,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan version updated successfully",
  });
};

/**
 * Get plan version by ID
 * GET /admin/plans/:planId/versions/:versionId
 */
export const getPlanVersionById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const version = await planService.getPlanVersionById(planId, versionId);

  sendSuccessResponse({
    res,
    data: version,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan version retrieved successfully",
  });
};

/**
 * Publish a plan version
 * POST /admin/plans/:planId/versions/:versionId/publish
 */
export const publishPlanVersion = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const version = await planService.publishPlanVersion(
    planId,
    versionId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: version,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan version published successfully",
  });
};

/**
 * Retire a plan version
 * POST /admin/plans/:planId/versions/:versionId/retire
 */
export const retirePlanVersion = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const version = await planService.retirePlanVersion(
    planId,
    versionId,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: version,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan version retired successfully",
  });
};

// ============================================
// PLAN VERSION PRODUCTS
// ============================================

/**
 * Add product to plan version
 * POST /admin/plans/:planId/versions/:versionId/products
 */
export const addVersionProduct = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const data: AddPlanVersionProductRequest = {
    product_id: req.body.product_id,
    limit_value: req.body.limit_value,
    is_unlimited: req.body.is_unlimited,
  };

  const product = await planService.addVersionProduct(planId, versionId, data);

  sendSuccessResponse({
    res,
    data: product,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Product added to version successfully",
  });
};

/**
 * Remove product from plan version
 * DELETE /admin/plans/:planId/versions/:versionId/products/:productId
 */
export const removeVersionProduct = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const versionId = req.params.versionId as string;
  const productId = req.params.productId as string;
  await planService.removeVersionProduct(planId, versionId, productId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Product removed from version successfully",
  });
};

// ============================================
// PLAN APPLICATIONS
// ============================================

/**
 * Get applications linked to a plan
 * GET /admin/plans/:planId/applications
 */
export const getPlanApplications = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const result = await planService.getPlanApplications(planId);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Plan applications retrieved successfully",
  });
};

/**
 * Link application to plan
 * POST /admin/plans/:planId/applications
 */
export const linkApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const data: LinkPlanApplicationRequest = {
    application_id: req.body.application_id,
  };

  const planApp = await planService.linkApplication(planId, data);

  sendSuccessResponse({
    res,
    data: planApp,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Application linked to plan successfully",
  });
};

/**
 * Unlink application from plan
 * DELETE /admin/plans/:planId/applications/:appId
 */
export const unlinkApplication = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const appId = req.params.appId as string;
  await planService.unlinkApplication(planId, appId);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Application unlinked from plan successfully",
  });
};

// ============================================
// ENTITLEMENT SYNC (backfill to existing tenants)
// ============================================

/** Shared body parsing for both sync endpoints. */
const parseSyncOptions = (req: Request): EntitlementSyncOptions => ({
  source_version_id: req.body.source_version_id,
  version_ids: req.body.version_ids,
  statuses: req.body.statuses,
  tenant_ids: req.body.tenant_ids,
  grant_missing_applications: req.body.grant_missing_applications,
  raise_existing_limits: req.body.raise_existing_limits,
});

/**
 * Preview an entitlement sync (dry run, writes nothing)
 * POST /admin/plans/:planId/entitlement-sync/preview
 */
export const previewEntitlementSync = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const result = await planEntitlementSyncService.preview(
    planId,
    parseSyncOptions(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement sync preview generated successfully",
  });
};

/**
 * Apply an entitlement sync to the plan's existing tenants
 * POST /admin/plans/:planId/entitlement-sync/apply
 */
export const applyEntitlementSync = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const planId = req.params.planId as string;
  const data: EntitlementSyncApplyRequest = {
    ...parseSyncOptions(req),
    reason: req.body.reason,
  };

  const result = await planEntitlementSyncService.apply(
    planId,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Entitlement sync applied successfully",
  });
};

import { NextFunction, Request, Response } from "express";
import subscriptionService from "../services/subscription.service";
import {
    BillingCycle,
    CancelSubscriptionRequest,
    CreateSubscriptionRequest,
    Currency,
    GlobalSubscriptionQueryParams,
    SubscriptionQueryParams,
    SubscriptionStatus,
    UpgradeSubscriptionRequest,
} from "../types/tenant.type";
import { buildAuditActor } from "../utils/audit-actor.util";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

/**
 * List all subscriptions across all tenants (global view)
 * GET /admin/subscriptions
 */
export const listAllSubscriptions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const params: GlobalSubscriptionQueryParams = {
    status: req.query.status as SubscriptionStatus | undefined,
    billing_cycle: req.query.billing_cycle as BillingCycle | undefined,
    currency: req.query.currency as Currency | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await subscriptionService.listAllSubscriptions(params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscriptions retrieved successfully",
  });
};

/**
 * List subscriptions for a tenant
 * GET /admin/tenants/:tenantId/subscriptions
 */
export const listSubscriptions = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const params: SubscriptionQueryParams = {
    status: req.query.status as SubscriptionStatus | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
  };

  const result = await subscriptionService.listSubscriptions(tenantId as string, params);

  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscriptions retrieved successfully",
  });
};

/**
 * Assign plan to tenant (create subscription)
 * POST /admin/tenants/:tenantId/subscriptions
 */
export const assignPlanToTenant = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId } = req.params;
  const data: CreateSubscriptionRequest = {
    plan_version_id: req.body.plan_version_id,
    billing_cycle: req.body.billing_cycle as BillingCycle,
    currency: req.body.currency as Currency,
    external_subscription_id: req.body.external_subscription_id,
    external_customer_id: req.body.external_customer_id,
    is_trial: req.body.is_trial,
    trial_ends_at: req.body.trial_ends_at,
    valid_from: req.body.valid_from,
    valid_to: req.body.valid_to,
    replace_existing: req.body.replace_existing,
    force: req.body.force,
  };

  const subscription = await subscriptionService.assignPlanToTenant(
    tenantId as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: subscription,
    statusCode: HttpSuccessStatus.CREATED,
    message: "Plan assigned to tenant successfully",
  });
};

/**
 * Get subscription by ID
 * GET /admin/tenants/:tenantId/subscriptions/:id
 */
export const getSubscriptionById = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const subscription = await subscriptionService.getSubscriptionById(
    tenantId as string,
    id as string
  );

  sendSuccessResponse({
    res,
    data: subscription,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscription retrieved successfully",
  });
};

/**
 * Cancel subscription
 * POST /admin/tenants/:tenantId/subscriptions/:id/cancel
 */
export const cancelSubscription = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: CancelSubscriptionRequest = {
    reason: req.body.reason,
    cancel_immediately: req.body.cancel_immediately,
  };

  const subscription = await subscriptionService.cancelSubscription(
    tenantId as string,
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: subscription,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscription cancelled successfully",
  });
};

/**
 * Upgrade subscription to new plan version
 * POST /admin/tenants/:tenantId/subscriptions/:id/upgrade
 */
export const upgradeSubscription = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  const { tenantId, id } = req.params;
  const data: UpgradeSubscriptionRequest = {
    new_plan_version_id: req.body.new_plan_version_id,
    prorate: req.body.prorate,
    force: req.body.force,
  };

  const subscription = await subscriptionService.upgradeSubscription(
    tenantId as string,
    id as string,
    data,
    buildAuditActor(req)
  );

  sendSuccessResponse({
    res,
    data: subscription,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscription upgraded successfully",
  });
};

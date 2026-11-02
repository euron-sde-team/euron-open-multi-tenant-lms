import { Request, Response } from "express";
import config from "../config";
import { ForbiddenError } from "../errors/forbidden.error";
import tenantSubscriptionsService from "../services/tenant-subscriptions.service";
import { IResponseFormat } from "../types/response.type";
import { sendSuccessResponse, HttpSuccessStatus } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) throw new ForbiddenError("Tenant context required");
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const createPlan = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const { deactivate_conflicting, ...planData } = req.body;
  const result = await tenantSubscriptionsService.createPlan(tenantId, {
    ...planData,
    deactivate_conflicting,
  });
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.CREATED, message: "Subscription plan created" });
};

export const listPlans = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const includeInactive = req.query.include_inactive === "true";
  const result = await tenantSubscriptionsService.listPlans(tenantId, includeInactive);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Plans retrieved" });
};

export const getPlan = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const planId = param(req, "id");
  const result = await tenantSubscriptionsService.getPlan(tenantId, planId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Plan retrieved" });
};

export const updatePlan = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const planId = param(req, "id");
  const result = await tenantSubscriptionsService.updatePlan(tenantId, planId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Plan updated" });
};

export const deactivatePlan = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const planId = param(req, "id");
  const result = await tenantSubscriptionsService.deactivatePlan(tenantId, planId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Plan deactivated" });
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantSubscriptionsService.getSettings(tenantId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Settings retrieved" });
};

export const updateSettings = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantSubscriptionsService.updateSettings(tenantId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Settings updated" });
};

// ─── Page Config ──────────────────────────────────────────────────────────────

export const getPageConfig = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantSubscriptionsService.getPageConfig(tenantId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Page config retrieved" });
};

export const updatePageConfig = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantSubscriptionsService.updatePageConfig(tenantId, req.body.sections);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Page config updated" });
};

// ─── Webhook Config ──────────────────────────────────────────────────────────

export const getSubscriptionWebhookConfig = async (_req: Request, res: Response<IResponseFormat>) => {
  // Learner subscription webhooks are received by learner-api.
  const webhookUrl = `${config.LEARNER_PUBLIC_API_BASE_URL}/webhooks/razorpay`;

  sendSuccessResponse({
    res,
    data: {
      webhook_url: webhookUrl,
      required_events: [
        "subscription.authenticated",
        "subscription.activated",
        "subscription.charged",
        "subscription.pending",
        "subscription.halted",
        "subscription.cancelled",
        "subscription.paused",
        "subscription.resumed",
        "subscription.completed",
      ],
    },
    statusCode: HttpSuccessStatus.OK,
    message: "Subscription webhook config retrieved",
  });
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getSubscriptionAnalytics = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const result = await tenantSubscriptionsService.getAnalytics(tenantId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Subscription analytics retrieved" });
};

// ─── Subscribers ──────────────────────────────────────────────────────────────

export const listSubscribers = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const params = {
    page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
    status: req.query.status as string | undefined,
    planId: req.query.plan_id as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await tenantSubscriptionsService.listSubscribers(tenantId, params);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Subscribers retrieved" });
};

export const getSubscriber = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const subscriptionId = param(req, "id");
  const result = await tenantSubscriptionsService.getSubscriber(tenantId, subscriptionId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Subscriber retrieved" });
};

export const cancelSubscription = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const subscriptionId = param(req, "id");
  await tenantSubscriptionsService.cancelSubscription(tenantId, subscriptionId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Subscription cancellation initiated" });
};

export const pauseSubscription = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const subscriptionId = param(req, "id");
  await tenantSubscriptionsService.pauseSubscription(tenantId, subscriptionId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Subscription pause initiated" });
};

export const resumeSubscription = async (req: Request, res: Response<IResponseFormat>) => {
  const tenantId = getTenantId(req);
  const subscriptionId = param(req, "id");
  await tenantSubscriptionsService.resumeSubscription(tenantId, subscriptionId);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Subscription resume initiated" });
};

import { Request, Response } from "express";
import userSubscriptionService from "../services/user-subscription.service";
import { sendSuccessResponse, HttpSuccessStatus } from "../utils/response.util";
import { BadRequestError } from "../errors/bad-request.error";

function getTenantId(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantId = (req as any).tenant?.id;
  if (!tenantId) throw new BadRequestError("Tenant context required");
  return tenantId;
}

function getMemberId(req: Request): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberId = (req as any).user?.id;
  if (!memberId) throw new BadRequestError("Authentication required");
  return memberId;
}

export const listPlans = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const plans = await userSubscriptionService.listActivePlans(tenantId);
  sendSuccessResponse({ res, data: plans, statusCode: HttpSuccessStatus.OK, message: "Plans retrieved" });
};

export const subscribe = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const { plan_id } = req.body;
  if (!plan_id) throw new BadRequestError("plan_id is required");

  const result = await userSubscriptionService.subscribe(tenantId, memberId, plan_id);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.CREATED, message: "Subscription created" });
};

export const verifyAuth = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const result = await userSubscriptionService.verifyAuthPayment(tenantId, memberId, req.body);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Auth verified" });
};

export const getMySubscription = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const result = await userSubscriptionService.getMySubscription(tenantId, memberId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Subscription retrieved" });
};

export const cancelMySubscription = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const cancelAtPeriodEnd = req.body.cancel_at_period_end !== false;
  await userSubscriptionService.cancelMySubscription(tenantId, memberId, cancelAtPeriodEnd);
  sendSuccessResponse({ res, data: null, statusCode: HttpSuccessStatus.OK, message: "Cancellation initiated" });
};

export const getPaymentUpdateLink = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const result = await userSubscriptionService.getPaymentUpdateLink(tenantId, memberId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Payment update link retrieved" });
};

export const checkAccess = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const memberId = getMemberId(req);
  const result = await userSubscriptionService.checkSubscriptionAccess(tenantId, memberId);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Access status retrieved" });
};

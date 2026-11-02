import { Request, Response } from "express";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { hasPermissions } from "../middlewares/permission.middleware";
import subscriptionBillingService from "../services/billing/subscription-billing.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

export const createCheckout = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const body = req.body as {
    plan_version_id?: string;
    billing_cycle?: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
    currency?: "INR" | "USD";
    trial_days?: number;
    provider?: "RAZORPAY" | "STRIPE";
  };
  if (!body.plan_version_id || !body.billing_cycle || !body.currency) {
    throw new BadRequestError(
      "plan_version_id, billing_cycle, and currency are required"
    );
  }
  if (body.currency !== "INR" && body.currency !== "USD") {
    throw new BadRequestError("currency must be INR or USD");
  }
  if (body.billing_cycle !== "MONTHLY" && body.billing_cycle !== "YEARLY" && body.billing_cycle !== "TWO_YEARLY") {
    throw new BadRequestError("billing_cycle must be MONTHLY, YEARLY, or TWO_YEARLY");
  }
  const result = await subscriptionBillingService.createCheckout(tenantId, {
    plan_version_id: body.plan_version_id,
    billing_cycle: body.billing_cycle,
    currency: body.currency,
    trial_days: body.trial_days ?? 0,
    provider: body.provider,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Checkout created",
  });
};

export const getCurrentSubscription = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const subscription = await subscriptionBillingService.getCurrentSubscription(
    tenantId
  );
  sendSuccessResponse({
    res,
    data: subscription ?? null,
    statusCode: HttpSuccessStatus.OK,
    message: "Current subscription retrieved",
  });
};

/**
 * Is a payment due on the current plan? Feeds the red "payment due" strip and
 * the dashboard lock, so it is read by every staffer, `can_pay` tells the UI
 * whether to offer the button or to say "ask your account owner".
 */
export const getRenewal = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const renewal = await subscriptionBillingService.getRenewalStatus(tenantId);
  sendSuccessResponse({
    res,
    data: renewal
      ? { ...renewal, can_pay: hasPermissions(req.tenantUser, ["billing.manage"]) }
      : null,
    statusCode: HttpSuccessStatus.OK,
    message: "Renewal status",
  });
};

/** Start the Razorpay payment that renews the current plan (+ GST, + any overdue cycles). */
export const createRenewal = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const result = await subscriptionBillingService.createRenewalCheckout(tenantId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Renewal checkout created",
  });
};

export const cancelSubscription = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const subscriptionId = param(req, "id");
  await subscriptionBillingService.cancelSubscription(tenantId, subscriptionId);
  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "Subscription cancellation initiated",
  });
};

export const getInvoiceUrl = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const invoiceUrl = await subscriptionBillingService.getInvoiceUrl(tenantId);
  sendSuccessResponse({
    res,
    data: { invoice_url: invoiceUrl },
    statusCode: HttpSuccessStatus.OK,
    message: "Invoice URL",
  });
};

export const reactivateSubscription = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const body = req.body as {
    plan_version_id?: string;
    billing_cycle?: "MONTHLY" | "YEARLY" | "TWO_YEARLY";
    currency?: "INR" | "USD";
    provider?: "RAZORPAY" | "STRIPE";
  };
  if (!body.plan_version_id || !body.billing_cycle || !body.currency) {
    throw new BadRequestError(
      "plan_version_id, billing_cycle, and currency are required"
    );
  }
  const result = await subscriptionBillingService.reactivateSubscription(tenantId, {
    plan_version_id: body.plan_version_id,
    billing_cycle: body.billing_cycle,
    currency: body.currency,
    provider: body.provider,
  });
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Reactivation checkout created",
  });
};

import { Request, Response } from "express";
import { ForbiddenError } from "../errors/forbidden.error";
import plansRepository from "../repositories/plans.repository";
import subscriptionBillingService from "../services/billing/subscription-billing.service";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";

function getTenantId(req: Request): string {
  const tenantId = req.tenantId;
  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }
  return tenantId;
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export const listPlans = async (req: Request, res: Response) => {
  getTenantId(req);
  const plans = await plansRepository.listPlansWithActiveVersions();
  sendSuccessResponse({
    res,
    data: { plans },
    statusCode: HttpSuccessStatus.OK,
    message: "Plans retrieved successfully",
  });
};

export const listPlansWithProducts = async (req: Request, res: Response) => {
  getTenantId(req);
  const plans = await plansRepository.listPlansWithActiveVersions();
  const planVersionIds = plans.map((p) => p.id);
  const productsMap =
    await plansRepository.listPlanVersionProducts(planVersionIds);
  const result = plans.map((plan) => ({
    ...plan,
    products: productsMap.get(plan.id) || [],
  }));
  sendSuccessResponse({
    res,
    data: { plans: result },
    statusCode: HttpSuccessStatus.OK,
    message: "Plans with products retrieved successfully",
  });
};

export const activateFreePlan = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const planVersionId = param(req, "planVersionId");
  const result = await subscriptionBillingService.activateFreePlan(tenantId, planVersionId);
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Free plan activated successfully",
  });
};

export const getEligibility = async (req: Request, res: Response) => {
  const tenantId = getTenantId(req);
  const planVersionId = param(req, "planVersionId");
  const currency = req.query.currency as "INR" | "USD" | undefined;
  const result = await subscriptionBillingService.checkEligibility(
    tenantId,
    planVersionId,
    currency
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Eligibility checked",
  });
};

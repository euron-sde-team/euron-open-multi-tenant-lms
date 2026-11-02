import { Router } from "express";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";
import {
  createPlan,
  listPlans,
  getPlan,
  updatePlan,
  deactivatePlan,
  getSettings,
  updateSettings,
  getPageConfig,
  updatePageConfig,
  getSubscriptionWebhookConfig,
  getSubscriptionAnalytics,
  listSubscribers,
  getSubscriber,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "../controllers/tenant-subscriptions.controller";

const tenantSubscriptionsRouter: Router = Router();

tenantSubscriptionsRouter.use(asyncHandler(authenticateTenantUser));

// Plans
tenantSubscriptionsRouter.post("/plans", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(createPlan));
tenantSubscriptionsRouter.get("/plans", asyncHandler(requirePermission("subscriptions.view")), asyncHandler(listPlans));
tenantSubscriptionsRouter.get("/plans/:id", asyncHandler(requirePermission("subscriptions.view")), asyncHandler(getPlan));
tenantSubscriptionsRouter.patch("/plans/:id", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(updatePlan));
tenantSubscriptionsRouter.delete("/plans/:id", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(deactivatePlan));

// Settings
tenantSubscriptionsRouter.get("/settings", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(getSettings));
tenantSubscriptionsRouter.put("/settings", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(updateSettings));

// Page Config
tenantSubscriptionsRouter.get("/settings/page-config", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(getPageConfig));
tenantSubscriptionsRouter.put("/settings/page-config", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(updatePageConfig));

// Webhook config
tenantSubscriptionsRouter.get("/webhook-config", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(getSubscriptionWebhookConfig));

// Analytics (must be before /subscribers/:id to avoid path conflict)
tenantSubscriptionsRouter.get("/analytics", asyncHandler(requirePermission("subscriptions.view")), asyncHandler(getSubscriptionAnalytics));

// Subscribers
tenantSubscriptionsRouter.get("/subscribers", asyncHandler(requirePermission("subscriptions.view")), asyncHandler(listSubscribers));
tenantSubscriptionsRouter.get("/subscribers/:id", asyncHandler(requirePermission("subscriptions.view")), asyncHandler(getSubscriber));
tenantSubscriptionsRouter.post("/subscribers/:id/cancel", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(cancelSubscription));
tenantSubscriptionsRouter.post("/subscribers/:id/pause", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(pauseSubscription));
tenantSubscriptionsRouter.post("/subscribers/:id/resume", asyncHandler(requirePermission("subscriptions.manage")), asyncHandler(resumeSubscription));

export default tenantSubscriptionsRouter;

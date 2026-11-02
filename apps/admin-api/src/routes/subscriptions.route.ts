import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import * as subscriptionsController from "../controllers/subscriptions.controller";

const router: Router = Router();

router.use(asyncHandler(authenticateTenantUser));

// These act on the TENANT'S OWN subscription to the platform, starting a paid
// checkout (spends money), reactivating, or cancelling. Owner-only billing
// actions. Previously ungated: any authenticated staffer could cancel the
// tenant's subscription or start a checkout.
router.post("/create-checkout", asyncHandler(requirePermission("billing.manage")), asyncHandler(subscriptionsController.createCheckout));
// Reads stay on auth-only: the current-subscription status feeds GLOBAL UI
// (grace-period banner, subscription-status overlay) shown to every staffer;
// gating these would break the dashboard for staff without a billing role.
router.get("/current", asyncHandler(subscriptionsController.getCurrentSubscription));
router.get("/current/invoice-url", asyncHandler(subscriptionsController.getInvoiceUrl));
// Renewal: the status is global UI (strip + lock) for every staffer, like
// /current; paying is a billing action like create-checkout.
router.get("/renewal", asyncHandler(subscriptionsController.getRenewal));
router.post("/renew", asyncHandler(requirePermission("billing.manage")), asyncHandler(subscriptionsController.createRenewal));
router.post("/reactivate", asyncHandler(requirePermission("billing.manage")), asyncHandler(subscriptionsController.reactivateSubscription));
router.post("/:id/cancel", asyncHandler(requirePermission("billing.manage")), asyncHandler(subscriptionsController.cancelSubscription));

export default router;

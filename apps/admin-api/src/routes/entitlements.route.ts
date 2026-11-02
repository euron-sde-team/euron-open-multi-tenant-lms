import { Router } from "express";
import { getEntitlements, checkEntitlement, getLinkableProducts, reconcileUsage } from "../controllers/entitlements.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const entitlementsRouter: Router = Router();

entitlementsRouter.use(asyncHandler(authenticateTenantUser));

// GET /tenant/entitlements - List entitlements for the authenticated tenant
entitlementsRouter.get("/", asyncHandler(requirePermission("entitlements.view")), asyncHandler(getEntitlements));

// GET /tenant/entitlements/linkable-products - USER-scoped products for content linking
entitlementsRouter.get("/linkable-products", asyncHandler(requirePermission("entitlements.view")), asyncHandler(getLinkableProducts));

// GET /tenant/entitlements/check?product_code=...&amount=1 - Check capacity
entitlementsRouter.get("/check", asyncHandler(requirePermission("entitlements.view")), asyncHandler(checkEntitlement));

// POST /tenant/entitlements/reconcile - Reconcile usage counters for this tenant
entitlementsRouter.post("/reconcile", asyncHandler(requirePermission("entitlements.reconcile")), asyncHandler(reconcileUsage));

export default entitlementsRouter;

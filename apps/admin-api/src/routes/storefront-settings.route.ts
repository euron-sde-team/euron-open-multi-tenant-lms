import { Router } from "express";
import { getStorefrontSettings, updateStorefrontSettings } from "../controllers/storefront-settings.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const storefrontSettingsRouter: Router = Router();

storefrontSettingsRouter.use(asyncHandler(authenticateTenantUser));

storefrontSettingsRouter.get("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(getStorefrontSettings));
storefrontSettingsRouter.put("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(updateStorefrontSettings));

export default storefrontSettingsRouter;

import { Router } from "express";
import { getAuthConfig, updateAuthConfig, saveGoogleClientId, clearGoogleClientId } from "../controllers/auth-config.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const authConfigRouter: Router = Router();

authConfigRouter.use(asyncHandler(authenticateTenantUser));

// Auth configuration management
authConfigRouter.get("/", asyncHandler(requirePermission("settings.auth")), asyncHandler(getAuthConfig));
authConfigRouter.put("/", asyncHandler(requirePermission("settings.auth")), asyncHandler(updateAuthConfig));

// Google OAuth Client ID management
authConfigRouter.put("/google-oauth/client-id", asyncHandler(requirePermission("settings.auth")), asyncHandler(saveGoogleClientId));
authConfigRouter.delete("/google-oauth/client-id", asyncHandler(requirePermission("settings.auth")), asyncHandler(clearGoogleClientId));

export default authConfigRouter;

import { Router } from "express";
import { getCertificatesSettings, updateCertificatesSettings } from "../controllers/certificates-settings.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const certificatesSettingsRouter: Router = Router();

certificatesSettingsRouter.use(asyncHandler(authenticateTenantUser));

certificatesSettingsRouter.get("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(getCertificatesSettings));
certificatesSettingsRouter.put("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(updateCertificatesSettings));

export default certificatesSettingsRouter;

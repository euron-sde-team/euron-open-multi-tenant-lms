import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  getEmailStyle,
  setEmailStyle,
  getOrgDetails,
  updateOrgDetails,
  uploadLogo,
  uploadFavicon,
  uploadFounderPhoto,
  deleteLogo,
  deleteFavicon,
  deleteFounderPhoto,
  getBillingDetails,
  updateBillingDetails,
} from "../controllers/tenant-org.controller";

const upload = multer({ storage: multer.memoryStorage() });
const tenantOrgRouter: Router = Router();

tenantOrgRouter.use(asyncHandler(authenticateTenantUser));

tenantOrgRouter.get("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(getOrgDetails));
tenantOrgRouter.put("/", asyncHandler(requirePermission("settings.organization")), asyncHandler(updateOrgDetails));
// The transactional-mail design switch: luxe (default) or simple (opt-out).
tenantOrgRouter.get("/email-style", asyncHandler(requirePermission("settings.organization")), asyncHandler(getEmailStyle));
tenantOrgRouter.put("/email-style", asyncHandler(requirePermission("settings.organization")), asyncHandler(setEmailStyle));
tenantOrgRouter.post("/logo/:slot", asyncHandler(requirePermission("settings.organization")), upload.single("file"), asyncHandler(uploadLogo));
tenantOrgRouter.post("/favicon", asyncHandler(requirePermission("settings.organization")), upload.single("file"), asyncHandler(uploadFavicon));
tenantOrgRouter.post("/founder-photo", asyncHandler(requirePermission("settings.organization")), upload.single("file"), asyncHandler(uploadFounderPhoto));
tenantOrgRouter.delete("/logo/:slot", asyncHandler(requirePermission("settings.organization")), asyncHandler(deleteLogo));
tenantOrgRouter.delete("/favicon", asyncHandler(requirePermission("settings.organization")), asyncHandler(deleteFavicon));
tenantOrgRouter.delete("/founder-photo", asyncHandler(requirePermission("settings.organization")), asyncHandler(deleteFounderPhoto));
tenantOrgRouter.get("/billing-details", asyncHandler(requirePermission("settings.organization")), asyncHandler(getBillingDetails));
tenantOrgRouter.put("/billing-details", asyncHandler(requirePermission("settings.organization")), asyncHandler(updateBillingDetails));

export default tenantOrgRouter;

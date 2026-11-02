import { Router } from "express";
import {
  getTemplates,
  getSelected,
  selectTemplate,
  togglePublish,
} from "../controllers/certificate-template.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const certificateTemplateRouter: Router = Router();

certificateTemplateRouter.get(
  "/",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("certificates.view")),
  asyncHandler(getTemplates)
);

certificateTemplateRouter.get(
  "/selected",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("certificates.view")),
  asyncHandler(getSelected)
);

certificateTemplateRouter.put(
  "/select",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(selectTemplate)
);

certificateTemplateRouter.post(
  "/publish",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(togglePublish)
);

export default certificateTemplateRouter;

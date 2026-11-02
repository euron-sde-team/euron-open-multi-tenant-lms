import { Router } from "express";
import {
  listEmailSuppressions,
  removeEmailSuppression,
} from "../controllers/email-suppression.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const emailSuppressionRouter: Router = Router();

emailSuppressionRouter.use(asyncHandler(authenticateTenantUser));

emailSuppressionRouter.get(
  "/",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(listEmailSuppressions),
);
emailSuppressionRouter.delete(
  "/:id",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(removeEmailSuppression),
);

export default emailSuppressionRouter;

import { Router } from "express";
import {
  getReputationOverview,
  getReputationHistory,
} from "../controllers/email-reputation.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const emailReputationRouter: Router = Router();

emailReputationRouter.use(asyncHandler(authenticateTenantUser));

emailReputationRouter.get(
  "/",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(getReputationOverview),
);
emailReputationRouter.get(
  "/history",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(getReputationHistory),
);

export default emailReputationRouter;

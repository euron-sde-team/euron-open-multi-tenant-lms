import { Router } from "express";
import { listEmailMessages } from "../controllers/email-messages.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const emailMessagesRouter: Router = Router();

emailMessagesRouter.use(asyncHandler(authenticateTenantUser));

emailMessagesRouter.get(
  "/",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(listEmailMessages),
);

export default emailMessagesRouter;

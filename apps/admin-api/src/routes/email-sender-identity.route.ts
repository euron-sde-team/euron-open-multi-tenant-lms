import { Router } from "express";
import {
  createSenderIdentity,
  listSenderIdentities,
  getSenderIdentity,
  updateSenderIdentity,
  archiveSenderIdentity,
} from "../controllers/email-sender-identity.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const emailSenderIdentityRouter: Router = Router();

emailSenderIdentityRouter.use(asyncHandler(authenticateTenantUser));

emailSenderIdentityRouter.get(
  "/",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(listSenderIdentities),
);
emailSenderIdentityRouter.post(
  "/",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(createSenderIdentity),
);
emailSenderIdentityRouter.get(
  "/:id",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(getSenderIdentity),
);
emailSenderIdentityRouter.patch(
  "/:id",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(updateSenderIdentity),
);
// DELETE is a soft archive (status -> ARCHIVED) so historical message FKs
// stay intact; see service docstring for full semantics.
emailSenderIdentityRouter.delete(
  "/:id",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(archiveSenderIdentity),
);

export default emailSenderIdentityRouter;

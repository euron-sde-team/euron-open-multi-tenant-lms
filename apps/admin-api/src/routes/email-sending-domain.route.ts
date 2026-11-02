import { Router } from "express";
import {
  onboardSendingDomain,
  listSendingDomains,
  getSendingDomain,
  deleteSendingDomain,
  checkSendingDomain,
  getDomainHealth,
  runDomainHealthCheck,
} from "../controllers/email-sending-domain.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const emailSendingDomainRouter: Router = Router();

emailSendingDomainRouter.use(asyncHandler(authenticateTenantUser));

emailSendingDomainRouter.get(
  "/",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(listSendingDomains),
);
emailSendingDomainRouter.post(
  "/",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(onboardSendingDomain),
);
emailSendingDomainRouter.get(
  "/:id",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(getSendingDomain),
);
emailSendingDomainRouter.delete(
  "/:id",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(deleteSendingDomain),
);

// On-demand verification trigger. The 60s background poller catches every
// PENDING domain on its own cadence; this endpoint exists so a tenant admin
// who just published DNS records can get an immediate VERIFIED transition
// instead of waiting up to 60s for the next sweep.
emailSendingDomainRouter.post(
  "/:id/check",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(checkSendingDomain),
);

// Phase 12: post-verification health monitoring. Daily 03:00 UTC sweep
// catches tenants who break DNS after they've already verified. GET returns
// the most recent health check row; POST forces an on-demand check.
emailSendingDomainRouter.get(
  "/:id/health",
  asyncHandler(requirePermission("email_sending.view")),
  asyncHandler(getDomainHealth),
);
emailSendingDomainRouter.post(
  "/:id/check-health",
  asyncHandler(requirePermission("email_sending.manage")),
  asyncHandler(runDomainHealthCheck),
);

export default emailSendingDomainRouter;

import { Router } from "express";

import {
  getAuditFilters,
  listAuditLogs,
  recordDeniedView,
} from "../controllers/tenant-audit.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const auditRouter: Router = Router();

auditRouter.use(asyncHandler(authenticateTenantUser));

// Reading the log is itself a privilege: it shows who did what, which is
// exactly the kind of thing a bad actor would want to read, or edit. There is
// no write endpoint at all; entries only ever arrive via the middleware.
auditRouter.get(
  "/",
  asyncHandler(requirePermission("audit.view")),
  asyncHandler(listAuditLogs)
);

// Deliberately NOT behind audit.view: the people who hit a page they cannot
// open are exactly the ones without permissions. The entry always names the
// caller, so it can only ever record the caller's own attempt.
auditRouter.post("/denied-view", asyncHandler(recordDeniedView));

auditRouter.get(
  "/filters",
  asyncHandler(requirePermission("audit.view")),
  asyncHandler(getAuditFilters)
);

export default auditRouter;

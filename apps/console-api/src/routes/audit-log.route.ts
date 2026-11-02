import { Router } from "express";
import {
  getAuditLogById,
  listAuditLogs,
} from "../controllers/audit-log.controller";
import {
  authenticateAdmin,
  requirePermission,
} from "../middlewares/admin.auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// All routes require admin authentication
router.use(asyncHandler(authenticateAdmin));

// ============================================
// ADMIN AUDIT LOGS (read-only)
// ============================================

// List audit log entries (filters: actor, category, action, tenant_id, from, to, search)
// GET /admin/audit-logs
router.get(
  "/",
  asyncHandler(requirePermission("admin_users.view")),
  asyncHandler(listAuditLogs)
);

// Get a single audit log entry
// GET /admin/audit-logs/:id
router.get(
  "/:id",
  asyncHandler(requirePermission("admin_users.view")),
  asyncHandler(getAuditLogById)
);

export default router;

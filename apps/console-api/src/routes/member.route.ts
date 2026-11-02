import { Router } from "express";
import { listAllMembers } from "../controllers/tenant-member.controller";
import {
    authenticateAdmin,
    requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// ============================================
// GLOBAL MEMBER ROUTES (End-users across all tenants)
// ============================================

// List all members
// GET /admin/members?search=...&status=...&tenant_id=...&page=1&limit=20
router.get("/", requirePermission("members.view"), listAllMembers);

export default router;

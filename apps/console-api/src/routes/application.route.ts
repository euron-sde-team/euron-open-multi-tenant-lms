import { Router } from "express";
import {
    createApplication,
    deactivateApplication,
    getApplicationById,
    listApplications,
    updateApplication,
} from "../controllers/application.controller";
import { listFeaturesByApplication } from "../controllers/feature.controller";
import {
    authenticateAdmin,
    requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// List all applications
// GET /admin/applications
router.get("/", requirePermission("applications.view"), listApplications);

// Create a new application
// POST /admin/applications
router.post("/", requirePermission("applications.manage"), createApplication);

// Get application by ID
// GET /admin/applications/:id
router.get("/:id", requirePermission("applications.view"), getApplicationById);

// Update an application
// PATCH /admin/applications/:id
router.patch("/:id", requirePermission("applications.manage"), updateApplication);

// Deactivate an application
// DELETE /admin/applications/:id
router.delete("/:id", requirePermission("applications.manage"), deactivateApplication);

// List features by application
// GET /admin/applications/:appId/features
router.get("/:appId/features", requirePermission("features.view"), listFeaturesByApplication);

export default router;

import { Router } from "express";
import {
    createFeature,
    deprecateFeature,
    getCategories,
    getFeatureById,
    listFeatures,
    updateFeature,
} from "../controllers/feature.controller";
import { listProductsByFeature } from "../controllers/product.controller";
import {
    authenticateAdmin,
    requirePermission,
} from "../middlewares/admin.auth.middleware";

const router: Router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Get feature categories (put before /:id to avoid conflict)
// GET /admin/features/categories
router.get("/categories", requirePermission("features.view"), getCategories);

// List all features
// GET /admin/features
router.get("/", requirePermission("features.view"), listFeatures);

// Create a new feature
// POST /admin/features
router.post("/", requirePermission("features.manage"), createFeature);

// Get feature by ID
// GET /admin/features/:id
router.get("/:id", requirePermission("features.view"), getFeatureById);

// Update a feature
// PATCH /admin/features/:id
router.patch("/:id", requirePermission("features.manage"), updateFeature);

// Deprecate a feature
// POST /admin/features/:id/deprecate
router.post("/:id/deprecate", requirePermission("features.manage"), deprecateFeature);

// List products by feature
// GET /admin/features/:featureId/products
router.get("/:featureId/products", requirePermission("features.view"), listProductsByFeature);

export default router;

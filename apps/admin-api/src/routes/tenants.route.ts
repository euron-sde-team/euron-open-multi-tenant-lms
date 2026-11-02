import { Router } from "express";
import {
  generateFooter,
  getTenantByDomain,
  getTenantById,
  getTenantBySlug,
  getTenantLayout,
  updateTenantLayout,
} from "../controllers/tenants.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const tenantsRouter: Router = Router();

// Public routes (no authentication required - for web app tenant lookup)

// GET /tenants/slug/:slug - Lookup tenant by subdomain slug
tenantsRouter.get(
  "/slug/:slug",
  asyncHandler(getTenantBySlug)
);

// GET /tenants/domain/:domain - Lookup tenant by custom domain
tenantsRouter.get(
  "/domain/:domain",
  asyncHandler(getTenantByDomain)
);

// GET /tenants/:id/layout - Get tenant layout
tenantsRouter.get(
  "/:id/layout",
  asyncHandler(getTenantLayout)
);

// PUT /tenants/:id/layout - Update tenant layout (authenticated, requires navigation settings permission)
tenantsRouter.put(
  "/:id/layout",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(updateTenantLayout)
);

// POST /tenants/:id/layout/generate-footer - Generate footer from tenant data (authenticated)
tenantsRouter.post(
  "/:id/layout/generate-footer",
  asyncHandler(authenticateTenantUser),
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(generateFooter)
);

// GET /tenants/:id - Get tenant by ID
tenantsRouter.get(
  "/:id",
  asyncHandler(getTenantById)
);

export default tenantsRouter;

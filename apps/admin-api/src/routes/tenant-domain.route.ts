import { Router } from "express";
import {
  addCustomDomain,
  deploySubdomain,
  getDomain,
  getDomainStatus,
  listDomains,
  removeDomain,
  retryDomain,
  setPrimaryDomain,
  verifyDomain,
} from "../controllers/tenant-domain.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const tenantDomainRouter: Router = Router();

tenantDomainRouter.use(asyncHandler(authenticateTenantUser));

// GET /tenant/domains - List all domains for the authenticated tenant
tenantDomainRouter.get("/", asyncHandler(requirePermission("settings.domains")), asyncHandler(listDomains));

// POST /tenant/domains/subdomain - Deploy subdomain for tenant
tenantDomainRouter.post("/subdomain", asyncHandler(requirePermission("settings.domains")), asyncHandler(deploySubdomain));

// POST /tenant/domains/custom - Add a custom domain
tenantDomainRouter.post("/custom", asyncHandler(requirePermission("settings.domains")), asyncHandler(addCustomDomain));

// GET /tenant/domains/:id - Get a specific domain
tenantDomainRouter.get("/:id", asyncHandler(requirePermission("settings.domains")), asyncHandler(getDomain));

// GET /tenant/domains/:id/status - Poll domain status
tenantDomainRouter.get("/:id/status", asyncHandler(requirePermission("settings.domains")), asyncHandler(getDomainStatus));

// POST /tenant/domains/:id/verify - Manually trigger verification check
tenantDomainRouter.post("/:id/verify", asyncHandler(requirePermission("settings.domains")), asyncHandler(verifyDomain));

// POST /tenant/domains/:id/retry - Retry failed verification
tenantDomainRouter.post("/:id/retry", asyncHandler(requirePermission("settings.domains")), asyncHandler(retryDomain));

// POST /tenant/domains/:id/set-primary - Set a domain as primary
tenantDomainRouter.post("/:id/set-primary", asyncHandler(requirePermission("settings.domains")), asyncHandler(setPrimaryDomain));

// DELETE /tenant/domains/:id - Remove a domain
tenantDomainRouter.delete("/:id", asyncHandler(requirePermission("settings.domains")), asyncHandler(removeDomain));

export default tenantDomainRouter;

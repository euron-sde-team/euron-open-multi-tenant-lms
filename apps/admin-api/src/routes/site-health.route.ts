/**
 * Site health.
 *
 * GET because it is a pure read of the PUBLIC site, it fetches pages any
 * visitor can fetch and mutates nothing. Gated on `pages.view` because the
 * report is, in substance, a review of the site's pages: whoever may look at
 * the pages may look at what is wrong with them. Fixes go through the page,
 * nav and layout routes with their own, stronger permissions.
 */
import { Router } from "express";

import { auditSite } from "../controllers/site-health.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const siteHealthRouter: Router = Router();

siteHealthRouter.use(asyncHandler(authenticateTenantUser));

siteHealthRouter.get(
  "/",
  asyncHandler(requirePermission("pages.view")),
  asyncHandler(auditSite)
);

export default siteHealthRouter;

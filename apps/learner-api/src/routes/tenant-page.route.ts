/**
 * Tenant Page Routes
 *
 * Routes for user-facing tenant page APIs.
 * All routes require tenant resolution middleware.
 *
 * Routes:
 * - GET /pages      - List all published pages
 * - GET /pages/:slug - Get a specific page by slug
 */

import { Router } from "express";
import { getPage, listPages } from "../controllers/tenant-page.controller";
import { asyncHandler } from "../utils/asynchandler";

const tenantPageRouter: Router = Router();

// List all published pages for the tenant
tenantPageRouter.get("/", asyncHandler(listPages));

// Get a specific page by slug
tenantPageRouter.get("/:slug", asyncHandler(getPage));

export default tenantPageRouter;

/**
 * Search routes, full-text search and dynamic filter options.
 * Tenant resolution happens at the v1 router level.
 */

import { Router } from "express";
import { search, getFilterOptions } from "../controllers/search.controller";
import { optionalAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const searchRouter: Router = Router();

// GET /search, full-text search with filters (optionalAuth for future access enrichment)
searchRouter.get("/", asyncHandler(optionalAuth), asyncHandler(search));

// GET /search/filters, dynamic filter options based on current filters
searchRouter.get("/filters", asyncHandler(getFilterOptions));

export default searchRouter;

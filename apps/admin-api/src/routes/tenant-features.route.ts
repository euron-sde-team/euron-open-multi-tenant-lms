import { Router } from "express";
import {
  getApplications,
  getResolvedFeatures,
} from "../controllers/tenant-features.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const tenantFeaturesRouter: Router = Router();

tenantFeaturesRouter.use(asyncHandler(authenticateTenantUser));

// GET /tenant/applications - List active applications for the tenant
tenantFeaturesRouter.get("/applications", asyncHandler(getApplications));

// GET /tenant/features - Resolved features (source of truth for sidebar/UI)
// GET /tenant/features?application_code=lms - Filter by application
tenantFeaturesRouter.get("/features", asyncHandler(getResolvedFeatures));

export default tenantFeaturesRouter;

import { Router } from "express";
import {
  dismissChecklist,
  getChecklist,
} from "../controllers/onboarding.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const onboardingRouter: Router = Router();

// All onboarding routes require authentication + tenant context (X-Tenant-Id).
onboardingRouter.use(asyncHandler(authenticateTenantUser));

// GET  /tenant/onboarding/checklist  → derived launch checklist
onboardingRouter.get("/checklist", asyncHandler(getChecklist));

// POST /tenant/onboarding/dismiss    → hide the checklist on the dashboard
onboardingRouter.post("/dismiss", asyncHandler(dismissChecklist));

export default onboardingRouter;

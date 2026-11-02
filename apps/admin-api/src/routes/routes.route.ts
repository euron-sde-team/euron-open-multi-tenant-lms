import { Router } from "express";
import { getAvailableRoutes } from "../controllers/routes.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const routesRouter: Router = Router();

// GET /routes/available - Get available internal routes for tenant (admin use)
routesRouter.get(
  "/available",
  asyncHandler(authenticateTenantUser),
  asyncHandler(getAvailableRoutes)
);

export default routesRouter;

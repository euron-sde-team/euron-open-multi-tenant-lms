import { Router } from "express";
import * as submissionsController from "../controllers/submissions.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const submissionsRouter: Router = Router();

submissionsRouter.use(asyncHandler(authenticateTenantUser));
submissionsRouter.get("/", asyncHandler(requirePermission("assignments.grade")), asyncHandler(submissionsController.listSubmissions));

export default submissionsRouter;

import { Router } from "express";
import {
  getEnrolledCoursesSettings,
  updateEnrolledCoursesSettings,
} from "../controllers/enrolled-courses-settings.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const enrolledCoursesSettingsRouter: Router = Router();

enrolledCoursesSettingsRouter.use(asyncHandler(authenticateTenantUser));

enrolledCoursesSettingsRouter.get(
  "/",
  asyncHandler(requirePermission("settings.organization")),
  asyncHandler(getEnrolledCoursesSettings),
);
enrolledCoursesSettingsRouter.put(
  "/",
  asyncHandler(requirePermission("settings.organization")),
  asyncHandler(updateEnrolledCoursesSettings),
);

export default enrolledCoursesSettingsRouter;

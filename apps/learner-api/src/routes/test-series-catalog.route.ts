import { Router } from "express";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import {
  listCatalog,
  getCatalogDetail,
  listMyEnrollments,
} from "../controllers/test-series-catalog.controller";

const router: Router = Router();

// Public catalog: optional auth so we can return has_access if logged in
router.get("/", asyncHandler(optionalAuth), asyncHandler(listCatalog));
router.get(
  "/by-slug/:slug",
  asyncHandler(optionalAuth),
  asyncHandler(getCatalogDetail)
);

// Authenticated: my enrollments
router.get(
  "/me/enrollments",
  asyncHandler(authenticateUser),
  asyncHandler(listMyEnrollments)
);

export default router;

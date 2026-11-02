import { Router } from "express";

import {
  getCurrencyContext,
  updateCurrencyPreference,
} from "../controllers/currency-context.controller";
import { authenticateUser, optionalAuth } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/asynchandler";

const router: Router = Router();

// Public storefront endpoint: works logged-out (geo only); honors the member
// preference when a session is present.
router.get("/", asyncHandler(optionalAuth), asyncHandler(getCurrencyContext));
router.put("/preference", asyncHandler(authenticateUser), asyncHandler(updateCurrencyPreference));

export default router;

import { Router } from "express";

import {
  getCurrencySettings,
  getFxSuggestions,
  getPricingCoverage,
  updateCurrencySettings,
} from "../controllers/currency-settings.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const currencySettingsRouter: Router = Router();

currencySettingsRouter.use(asyncHandler(authenticateTenantUser));

currencySettingsRouter.get(
  "/",
  asyncHandler(requirePermission("settings.currencies")),
  asyncHandler(getCurrencySettings),
);
currencySettingsRouter.put(
  "/",
  asyncHandler(requirePermission("settings.currencies")),
  asyncHandler(updateCurrencySettings),
);
currencySettingsRouter.get(
  "/coverage",
  asyncHandler(requirePermission("settings.currencies")),
  asyncHandler(getPricingCoverage),
);
currencySettingsRouter.get(
  "/fx-suggest",
  asyncHandler(requirePermission("settings.currencies")),
  asyncHandler(getFxSuggestions),
);

export default currencySettingsRouter;

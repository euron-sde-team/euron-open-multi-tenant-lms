/**
 * Header, footer, sidebar and top bar for the calling workspace.
 *
 * `settings.navigation` throughout, matching the original `/tenants/:id/layout`
 * routes, this changes what every visitor sees on every page, so it is not a
 * general settings permission.
 */
import { Router } from "express";

import {
  addNavItem,
  getMyLayout,
  regenerateMyFooter,
  removeNavItem,
  updateMyLayout,
} from "../controllers/layout.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const layoutRouter: Router = Router();

layoutRouter.use(asyncHandler(authenticateTenantUser));

layoutRouter.get(
  "/",
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(getMyLayout)
);
layoutRouter.put(
  "/",
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(updateMyLayout)
);
layoutRouter.post(
  "/generate-footer",
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(regenerateMyFooter)
);

// Adding or removing ONE menu link, without having to send the whole menu back.
// "Add Roadmaps to the menu" is a read-modify-write, and an assistant plans its
// sequence before any of it runs, so it cannot know the existing links at the
// time it writes the plan. The merge lives here instead.
layoutRouter.post(
  "/nav",
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(addNavItem)
);
layoutRouter.delete(
  "/nav/:navItemId",
  asyncHandler(requirePermission("settings.navigation")),
  asyncHandler(removeNavItem)
);

export default layoutRouter;

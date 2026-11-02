import { Router } from "express";
import {
  getOrderedProductsSettings,
  updateOrderedProductsSettings,
  listOrderableItems,
  reorderItems,
} from "../controllers/ordered-products.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import {
  requirePermission,
  requireAnyPermission,
} from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const orderedProductsRouter: Router = Router();

orderedProductsRouter.use(asyncHandler(authenticateTenantUser));

/**
 * Anyone who can see a catalog may READ the switch.
 *
 * Every catalog page asks for it on load, just to decide whether to draw drag
 * handles. Gating that read behind settings.organization means a staff member
 * with courses.view but no settings access gets a 403 on the courses page and
 * silently never sees handles, which reads as "the feature is broken", not as
 * "you lack a permission". Reading a boolean nobody can act on without the
 * write permission below leaks nothing.
 */
const CAN_VIEW_A_CATALOG = [
  "settings.organization",
  "courses.view",
  "books.view",
  "bundles.view",
  "batches.view",
  "tests.view",
] as const;

// The master switch.
//
// MUST stay above the "/:entity" routes: Express matches top-to-bottom, so
// otherwise GET /settings resolves as entity="settings" and 400s on the
// catalog whitelist instead of returning the toggle.
orderedProductsRouter.get(
  "/settings",
  asyncHandler(requireAnyPermission(...CAN_VIEW_A_CATALOG)),
  asyncHandler(getOrderedProductsSettings)
);
// Flipping it changes the storefront for every learner, so this one stays a
// settings-level action.
orderedProductsRouter.put(
  "/settings",
  asyncHandler(requirePermission("settings.organization")),
  asyncHandler(updateOrderedProductsSettings)
);

// Per-catalog list + reorder. `entity` is validated against a frozen whitelist
// in the service, never used as a table name directly.
//
// Arranging a catalog is an edit to that catalog, so anyone who can update one
// may reorder it. Requiring settings.organization here would mean the person
// who manages the courses can't order them.
const CAN_EDIT_A_CATALOG = [
  "settings.organization",
  "courses.update",
  "books.update",
  "bundles.update",
  "batches.update",
  "tests.manage",
] as const;

orderedProductsRouter.get(
  "/:entity",
  asyncHandler(requireAnyPermission(...CAN_VIEW_A_CATALOG)),
  asyncHandler(listOrderableItems)
);
orderedProductsRouter.put(
  "/:entity/reorder",
  asyncHandler(requireAnyPermission(...CAN_EDIT_A_CATALOG)),
  asyncHandler(reorderItems)
);

export default orderedProductsRouter;

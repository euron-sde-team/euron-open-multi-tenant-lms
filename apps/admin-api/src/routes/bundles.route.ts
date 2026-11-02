import { Router } from "express";
import {
  listBundles,
  getBundle,
  getBundleBySlug,
  createBundle,
  updateBundle,
  togglePublishBundle,
  deleteBundle,
  listBundleItems,
  addBundleItem,
  removeBundleItem,
  reorderBundleItems,
} from "../controllers/bundles.controller";
// Content-product-link gating disabled, routes commented out
// import {
//   listBundleLinkedProducts,
//   setBundleLinkedProducts,
// } from "../controllers/content-product-links.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const bundlesRouter: Router = Router();

bundlesRouter.use(asyncHandler(authenticateTenantUser));

// Bundle CRUD (by-slug must be before :bundleId)
bundlesRouter.get("/by-slug/:slug", asyncHandler(requirePermission("bundles.view")), asyncHandler(getBundleBySlug));
bundlesRouter.get("/", asyncHandler(requirePermission("bundles.view")), asyncHandler(listBundles));
bundlesRouter.post("/", asyncHandler(requirePermission("bundles.create")), asyncHandler(createBundle));
bundlesRouter.get("/:bundleId", asyncHandler(requirePermission("bundles.view")), asyncHandler(getBundle));
bundlesRouter.put("/:bundleId", asyncHandler(requirePermission("bundles.update")), asyncHandler(updateBundle));
bundlesRouter.post("/:bundleId/toggle-publish", asyncHandler(requirePermission("bundles.publish")), asyncHandler(togglePublishBundle));
bundlesRouter.delete("/:bundleId", asyncHandler(requirePermission("bundles.delete")), asyncHandler(deleteBundle));

// Bundle Items
bundlesRouter.get("/:bundleId/items", asyncHandler(requirePermission("bundles.update")), asyncHandler(listBundleItems));
bundlesRouter.post("/:bundleId/items", asyncHandler(requirePermission("bundles.update")), asyncHandler(addBundleItem));
bundlesRouter.delete("/:bundleId/items/:itemId", asyncHandler(requirePermission("bundles.update")), asyncHandler(removeBundleItem));
bundlesRouter.patch("/:bundleId/items/reorder", asyncHandler(requirePermission("bundles.update")), asyncHandler(reorderBundleItems));

// Content-Product Links, disabled (content-product-link gating removed)
// bundlesRouter.get("/:bundleId/linked-products", asyncHandler(requirePermission('bundles.update')), asyncHandler(listBundleLinkedProducts));
// bundlesRouter.put("/:bundleId/linked-products", asyncHandler(requirePermission('bundles.update')), asyncHandler(setBundleLinkedProducts));

export default bundlesRouter;

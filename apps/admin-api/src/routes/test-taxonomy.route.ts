import { Router } from "express";
import {
  listTaxonomy,
  createTaxonomy,
  updateTaxonomy,
  deleteTaxonomy,
  checkBlueprintAvailability,
  importTaxonomyFromTags,
} from "../controllers/test-taxonomy.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testTaxonomyRouter: Router = Router();

testTaxonomyRouter.use(asyncHandler(authenticateTenantUser));

testTaxonomyRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listTaxonomy)
);
testTaxonomyRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createTaxonomy)
);
testTaxonomyRouter.post(
  "/availability",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(checkBlueprintAvailability)
);
testTaxonomyRouter.post(
  "/import-from-tags",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(importTaxonomyFromTags)
);
testTaxonomyRouter.put(
  "/:nodeId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateTaxonomy)
);
testTaxonomyRouter.delete(
  "/:nodeId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(deleteTaxonomy)
);

export default testTaxonomyRouter;

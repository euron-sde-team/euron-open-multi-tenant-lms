import { Router } from "express";
import {
  listRankCurves,
  getRankCurve,
  createRankCurve,
  updateRankCurve,
  deleteRankCurve,
} from "../controllers/test-rank-curves.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testRankCurvesRouter: Router = Router();

testRankCurvesRouter.use(asyncHandler(authenticateTenantUser));

testRankCurvesRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listRankCurves)
);
testRankCurvesRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createRankCurve)
);
testRankCurvesRouter.get(
  "/:id",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getRankCurve)
);
testRankCurvesRouter.put(
  "/:id",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateRankCurve)
);
testRankCurvesRouter.delete(
  "/:id",
  asyncHandler(requirePermission("tests.delete")),
  asyncHandler(deleteRankCurve)
);

export default testRankCurvesRouter;

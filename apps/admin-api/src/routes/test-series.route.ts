import { Router } from "express";
import {
  listSeries,
  getSeries,
  getSeriesBySlug,
  getSeriesEntitlementUsage,
  createSeries,
  updateSeries,
  deleteSeries,
  publishSeries,
  unpublishSeries,
  listSeriesTests,
  addTestToSeries,
  removeTestFromSeries,
  reorderSeriesTests,
  listSeriesAttempts,
  getSeriesAnalytics,
  exportSeriesAnalytics,
} from "../controllers/test-series.controller";
import {
  submitGeneration as submitSeriesAIGeneration,
  getGenerationStatus as getSeriesAIGenerationStatus,
} from "../controllers/test-series-ai.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const testSeriesRouter: Router = Router();

testSeriesRouter.use(asyncHandler(authenticateTenantUser));

// AI generation (must precede :seriesId param routes)
testSeriesRouter.post(
  "/ai/generate",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(requireAiAuthoring),
  asyncHandler(submitSeriesAIGeneration)
);
testSeriesRouter.get(
  "/ai/status/:jobId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(getSeriesAIGenerationStatus)
);

// Live usage snapshot (must precede :seriesId)
testSeriesRouter.get(
  "/entitlement-usage",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getSeriesEntitlementUsage)
);

// by-slug must precede :seriesId
testSeriesRouter.get(
  "/by-slug/:slug",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getSeriesBySlug)
);

// Batch-wise attempt report: all attempts across every test in the series
testSeriesRouter.get(
  "/:seriesId/attempts",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listSeriesAttempts)
);

// Series analytics (aggregated across every test) + detailed Excel export
testSeriesRouter.get(
  "/:seriesId/analytics",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getSeriesAnalytics)
);
testSeriesRouter.get(
  "/:seriesId/analytics-export",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(exportSeriesAnalytics)
);

// Series-Tests linking
testSeriesRouter.get(
  "/:seriesId/tests",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listSeriesTests)
);
testSeriesRouter.post(
  "/:seriesId/tests",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(addTestToSeries)
);
testSeriesRouter.post(
  "/:seriesId/tests/reorder",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(reorderSeriesTests)
);
testSeriesRouter.delete(
  "/:seriesId/tests/:testId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(removeTestFromSeries)
);

// Series CRUD
testSeriesRouter.get(
  "/",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(listSeries)
);
testSeriesRouter.post(
  "/",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(createSeries)
);
testSeriesRouter.get(
  "/:seriesId",
  asyncHandler(requirePermission("tests.view")),
  asyncHandler(getSeries)
);
testSeriesRouter.put(
  "/:seriesId",
  asyncHandler(requirePermission("tests.manage")),
  asyncHandler(updateSeries)
);
testSeriesRouter.delete(
  "/:seriesId",
  asyncHandler(requirePermission("tests.delete")),
  asyncHandler(deleteSeries)
);
testSeriesRouter.post(
  "/:seriesId/publish",
  asyncHandler(requirePermission("tests.publish")),
  asyncHandler(publishSeries)
);
testSeriesRouter.post(
  "/:seriesId/unpublish",
  asyncHandler(requirePermission("tests.publish")),
  asyncHandler(unpublishSeries)
);

export default testSeriesRouter;

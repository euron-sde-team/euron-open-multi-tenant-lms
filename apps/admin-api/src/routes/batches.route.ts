import { Router } from "express";
import * as batchAIController from "../controllers/batch-ai.controller";
import {
  listBatches,
  getBatch,
  getBatchBySlug,
  createBatch,
  updateBatch,
  togglePublishBatch,
  deleteBatch,
  listBatchItems,
  addBatchItem,
  removeBatchItem,
  reorderBatchItems,
  listBatchEnrollments,
} from "../controllers/batches.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requireAiAuthoring } from "../middlewares/ai-authoring.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const batchesRouter: Router = Router();

batchesRouter.use(asyncHandler(authenticateTenantUser));

// Batch CRUD (by-slug must be before :batchId to avoid path collision)
batchesRouter.get(
  "/by-slug/:slug",
  asyncHandler(requirePermission("batches.view")),
  asyncHandler(getBatchBySlug)
);
batchesRouter.get(
  "/",
  asyncHandler(requirePermission("batches.view")),
  asyncHandler(listBatches)
);
batchesRouter.post(
  "/",
  asyncHandler(requirePermission("batches.create")),
  asyncHandler(createBatch)
);
batchesRouter.get(
  "/:batchId",
  asyncHandler(requirePermission("batches.view")),
  asyncHandler(getBatch)
);
batchesRouter.put(
  "/:batchId",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(updateBatch)
);
batchesRouter.post(
  "/:batchId/toggle-publish",
  asyncHandler(requirePermission("batches.publish")),
  asyncHandler(togglePublishBatch)
);
batchesRouter.delete(
  "/:batchId",
  asyncHandler(requirePermission("batches.delete")),
  asyncHandler(deleteBatch)
);

// Items
batchesRouter.get(
  "/:batchId/items",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(listBatchItems)
);
batchesRouter.post(
  "/:batchId/items",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(addBatchItem)
);
batchesRouter.delete(
  "/:batchId/items/:itemId",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(removeBatchItem)
);
batchesRouter.patch(
  "/:batchId/items/reorder",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(reorderBatchItems)
);

// Enrollments (admin analytics)
batchesRouter.get(
  "/:batchId/enrollments",
  asyncHandler(requirePermission("batches.view")),
  asyncHandler(listBatchEnrollments)
);

// AI generation, submits a job + polls status. Job ID is scoped per
// (tenant, batch) so concurrent edits on different batches don't collide.
batchesRouter.post(
  "/:batchId/ai/generate",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(requireAiAuthoring),
  asyncHandler(batchAIController.submitGeneration)
);
batchesRouter.get(
  "/:batchId/ai/status/:jobId",
  asyncHandler(requirePermission("batches.update")),
  asyncHandler(batchAIController.getGenerationStatus)
);

export default batchesRouter;

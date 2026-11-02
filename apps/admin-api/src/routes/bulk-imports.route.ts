import { Router } from "express";
import multer from "multer";

import {
  downloadSample,
  getJob,
  getJobReportUrl,
  listJobs,
  runBookImport,
  runCourseImport,
  runTenantImport,
} from "../controllers/bulk-imports.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { BULK_IMPORT_MAX_FILE_BYTES } from "../types/bulk-imports.type";
import { asyncHandler } from "../utils/asynchandler";

const bulkImportsRouter: Router = Router();

bulkImportsRouter.use(asyncHandler(authenticateTenantUser));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_IMPORT_MAX_FILE_BYTES },
});

// Sample is non-sensitive; the listed-jobs surface uses members.view.
bulkImportsRouter.get(
  "/sample",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(downloadSample),
);

bulkImportsRouter.post(
  "/tenant",
  asyncHandler(requirePermission("members.update")),
  upload.single("file"),
  asyncHandler(runTenantImport),
);

bulkImportsRouter.post(
  "/courses/:courseId",
  asyncHandler(requirePermission("members.update")),
  upload.single("file"),
  asyncHandler(runCourseImport),
);

bulkImportsRouter.post(
  "/books/:bookId",
  asyncHandler(requirePermission("members.update")),
  upload.single("file"),
  asyncHandler(runBookImport),
);

bulkImportsRouter.get(
  "/jobs",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(listJobs),
);

bulkImportsRouter.get(
  "/jobs/:jobId",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getJob),
);

bulkImportsRouter.get(
  "/jobs/:jobId/report",
  asyncHandler(requirePermission("members.view")),
  asyncHandler(getJobReportUrl),
);

export default bulkImportsRouter;

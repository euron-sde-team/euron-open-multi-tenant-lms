import { Router } from "express";
import multer from "multer";

import {
  createBatch,
  createFromSource,
  deleteBatch,
  downloadSample,
  getBatchDetail,
  listBatches,
  resolveRecipients,
  sendBatch,
} from "../controllers/bulk-certificate.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";
import { BULK_CERT_MAX_FILE_BYTES } from "../services/bulk-certificate.parser";

const bulkCertificateRouter: Router = Router();

bulkCertificateRouter.use(asyncHandler(authenticateTenantUser));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BULK_CERT_MAX_FILE_BYTES },
});

bulkCertificateRouter.get(
  "/sample",
  asyncHandler(requirePermission("certificates.view")),
  asyncHandler(downloadSample),
);

bulkCertificateRouter.get(
  "/batches",
  asyncHandler(requirePermission("certificates.view")),
  asyncHandler(listBatches),
);

bulkCertificateRouter.get(
  "/batches/:batchId",
  asyncHandler(requirePermission("certificates.view")),
  asyncHandler(getBatchDetail),
);

bulkCertificateRouter.post(
  "/batches",
  asyncHandler(requirePermission("certificates.manage")),
  upload.single("file"),
  asyncHandler(createBatch),
);

bulkCertificateRouter.delete(
  "/batches/:batchId",
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(deleteBatch),
);

// Resolve a recipient source (course/book enrollees or pasted emails)
// to a deduplicated { name, email } list, used to preview before generating.
bulkCertificateRouter.post(
  "/recipients",
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(resolveRecipients),
);

// Generate a batch directly from a recipient source (no file upload).
bulkCertificateRouter.post(
  "/from-source",
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(createFromSource),
);

// Email every certificate in a batch that has a recipient email.
bulkCertificateRouter.post(
  "/batches/:batchId/send",
  asyncHandler(requirePermission("certificates.manage")),
  asyncHandler(sendBatch),
);

export default bulkCertificateRouter;

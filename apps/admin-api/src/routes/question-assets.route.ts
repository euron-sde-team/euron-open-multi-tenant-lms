import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asynchandler";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import {
  listAssets,
  createAsset,
  deleteAsset,
  importAssetToQuiz,
} from "../controllers/question-assets.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const questionAssetsRouter: Router = Router();

questionAssetsRouter.use(asyncHandler(authenticateTenantUser));

questionAssetsRouter.get(
  "/",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(listAssets)
);
questionAssetsRouter.post(
  "/",
  asyncHandler(requirePermission("courses.lms.manage")),
  upload.single("file"),
  asyncHandler(createAsset)
);
questionAssetsRouter.delete(
  "/:assetId",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(deleteAsset)
);
questionAssetsRouter.post(
  "/:assetId/import-to-quiz",
  asyncHandler(requirePermission("courses.lms.manage")),
  asyncHandler(importAssetToQuiz)
);

export default questionAssetsRouter;

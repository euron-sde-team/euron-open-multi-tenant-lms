import { Router } from "express";
import multer from "multer";
import {
  listDesigns,
  getDesign,
  createDesign,
  updateDesign,
  deleteDesign,
  setDefaultDesign,
  uploadDesignAsset,
} from "../controllers/certificate-designer.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";
import { ALLOWED_ASSET_MIME_TYPES } from "../services/certificate-designer.s3.service";

const certificateDesignerRouter: Router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_ASSET_MIME_TYPES.includes(file.mimetype));
  },
});

const canView = asyncHandler(requirePermission("certificates.view"));
const canManage = asyncHandler(requirePermission("certificates.manage"));

certificateDesignerRouter.use(asyncHandler(authenticateTenantUser));

certificateDesignerRouter.get("/", canView, asyncHandler(listDesigns));
certificateDesignerRouter.post("/", asyncHandler(requirePermission("certificates.manage")), canManage, asyncHandler(createDesign));
certificateDesignerRouter.post(
  "/asset",
  asyncHandler(requirePermission("certificates.manage")),
  canManage,
  upload.single("file"),
  asyncHandler(uploadDesignAsset),
);
certificateDesignerRouter.get("/:id", canView, asyncHandler(getDesign));
certificateDesignerRouter.put("/:id", asyncHandler(requirePermission("certificates.manage")), canManage, asyncHandler(updateDesign));
certificateDesignerRouter.delete("/:id", asyncHandler(requirePermission("certificates.manage")), canManage, asyncHandler(deleteDesign));
certificateDesignerRouter.post(
  "/:id/default",
  asyncHandler(requirePermission("certificates.manage")),
  canManage,
  asyncHandler(setDefaultDesign),
);

export default certificateDesignerRouter;

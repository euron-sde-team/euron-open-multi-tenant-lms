import { Router } from "express";
import multer from "multer";
import {
  deleteFile,
  getPresignedUrl,
  uploadBase64,
  uploadFile,
} from "../controllers/upload.controller";
import { authenticateTenantUser } from "../middlewares/auth.middleware";
import { requirePermission } from "../middlewares/permission.middleware";
import { asyncHandler } from "../utils/asynchandler";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];
const LECTURE_RESOURCE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];
const PDF_TYPES = [
  "application/pdf",
  "application/x-pdf",
  // Some browsers/OSes report PDFs with these, content is verified by magic
  // bytes downstream in upload.service, so we let them through here.
  "application/octet-stream",
  "binary/octet-stream",
  "",
];
const EPUB_TYPES = [
  "application/epub+zip",
  "application/epub",
  "application/zip",
  "application/octet-stream",
  "",
];

/** 250 MB ceiling, book PDFs can be larger than the legacy 50MB lecture cap. */
const MAX_UPLOAD_SIZE_BYTES = 250 * 1024 * 1024;

function allowedTypesFor(uploadType: string | undefined): string[] {
  switch (uploadType) {
    case "lecture_resource":
      return LECTURE_RESOURCE_TYPES;
    case "book_pdf":
      return PDF_TYPES;
    case "book_epub":
      return EPUB_TYPES;
    default:
      return ALLOWED_IMAGE_TYPES;
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const type = req.body?.type as string | undefined;
    const allowed = allowedTypesFor(type);
    // PDF/EPUB allowlists include "" + "application/octet-stream" so ambiguous
    // mimes pass here; magic-bytes validation in upload.service.ts is the real gate.
    if (allowed.includes(file.mimetype ?? "")) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

const uploadRouter: Router = Router();

// All upload routes require authentication
uploadRouter.use(asyncHandler(authenticateTenantUser));

// POST /upload - Upload a file (multipart form data)
uploadRouter.post(
  "/",
  asyncHandler(requirePermission("uploads.manage")),
  upload.single("file"),
  asyncHandler(uploadFile)
);

// POST /upload/base64 - Upload a base64 image
uploadRouter.post(
  "/base64",
  asyncHandler(requirePermission("uploads.manage")),
  asyncHandler(uploadBase64)
);

// POST /upload/presigned - Get presigned URL for direct upload
uploadRouter.post(
  "/presigned",
  asyncHandler(requirePermission("uploads.manage")),
  asyncHandler(getPresignedUrl)
);

// DELETE /upload/:key - Delete a file (key can contain slashes)
uploadRouter.delete(
  "/:key{/*path}",
  asyncHandler(requirePermission("uploads.manage")),
  asyncHandler(deleteFile)
);

export default uploadRouter;

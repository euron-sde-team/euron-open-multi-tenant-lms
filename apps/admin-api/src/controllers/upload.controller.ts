import { Request, Response } from "express";
import uploadService, {
  type ThumbnailSlot,
  type UploadType,
} from "../services/upload.service";
import { IResponseFormat } from "../types/response.type";
import { HttpSuccessStatus, sendSuccessResponse } from "../utils/response.util";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";

/**
 * Upload a file (multipart form data)
 * POST /upload
 * When type=course_thumbnail: body type, tenantId, courseId? (optional for new course), slot (web|mobile|preview)
 * When type=lecture_resource: body type, tenantId, courseId, lectureId
 * When type=book_thumbnail: body type, tenantId, bookId? (optional for new book)
 * When type=book_pdf: body type, tenantId, bookId
 * Otherwise legacy: folder only
 */
export const uploadFile = async (req: Request, res: Response<IResponseFormat>) => {
  const file = req.file;
  const folder = (req.body.folder as string) || "uploads";
  const type = req.body.type as UploadType | undefined;
  const tenantId = req.tenantId;
  const courseId = req.body.courseId as string | undefined;
  const bookId = req.body.bookId as string | undefined;
  const batchId = req.body.batchId as string | undefined;
  const lectureId = req.body.lectureId as string | undefined;
  const slot = (req.body.slot as ThumbnailSlot) || "web";

  if (!file) {
    throw new BadRequestError("No file provided");
  }

  if (type && !tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  if (type === "course_thumbnail") {
    const result = await uploadService.uploadCourseThumbnail(
      tenantId!,
      courseId ?? null,
      slot,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "book_thumbnail") {
    const result = await uploadService.uploadBookThumbnail(
      tenantId!,
      bookId ?? null,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Book thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "category_icon") {
    const result = await uploadService.uploadCategoryIcon(
      tenantId!,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Category icon uploaded successfully",
    });
    return;
  }

  if (type === "testimonial_image") {
    const result = await uploadService.uploadTestimonialImage(
      tenantId!,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Testimonial image uploaded successfully",
    });
    return;
  }

  if (type === "bundle_thumbnail") {
    const bundleId = req.body.bundleId as string | undefined;
    const result = await uploadService.uploadBundleThumbnail(
      tenantId!,
      bundleId ?? null,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Bundle thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "batch_thumbnail") {
    const result = await uploadService.uploadBatchThumbnail(
      tenantId!,
      batchId ?? null,
      slot,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Batch thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "book_pdf") {
    if (!bookId) {
      throw new BadRequestError("bookId is required for book_pdf upload");
    }
    const result = await uploadService.uploadBookPdf(
      tenantId!,
      bookId,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Book PDF uploaded successfully",
    });
    return;
  }

  if (type === "book_epub") {
    if (!bookId) {
      throw new BadRequestError("bookId is required for book_epub upload");
    }
    const result = await uploadService.uploadBookEpub(
      tenantId!,
      bookId,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Book EPUB uploaded successfully",
    });
    return;
  }

  if (type === "lecture_resource") {
    if (!courseId || !lectureId) {
      throw new BadRequestError("courseId and lectureId are required for lecture_resource upload");
    }
    const result = await uploadService.uploadLectureResource(
      tenantId!,
      courseId,
      lectureId,
      file.buffer,
      file.mimetype,
      file.originalname
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Lecture resource uploaded successfully",
    });
    return;
  }

  const result = await uploadService.uploadFile(
    file.buffer,
    file.originalname,
    file.mimetype,
    folder,
    tenantId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "File uploaded successfully",
  });
};

/**
 * Upload a base64 image
 * POST /upload/base64
 * When type=course_thumbnail: body type, tenantId, courseId?, slot, image
 * When type=lecture_resource: body type, tenantId, courseId, lectureId, image
 * When type=book_thumbnail: body type, tenantId, bookId?, image
 * Otherwise legacy: image, folder
 */
export const uploadBase64 = async (req: Request, res: Response<IResponseFormat>) => {
  const { image, folder, type, courseId, bookId, batchId, lectureId, slot } = req.body;
  const tenantId = req.tenantId;
  const effectiveSlot = (slot as ThumbnailSlot) || "web";

  if (!image) {
    throw new BadRequestError("No image data provided");
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    throw new BadRequestError("Invalid image format. Expected base64 data URL");
  }

  const matches = image.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new BadRequestError("Invalid base64 data format");
  }
  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  if (type && !tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  if (type === "course_thumbnail") {
    const result = await uploadService.uploadCourseThumbnail(
      tenantId!,
      courseId ?? null,
      effectiveSlot,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "book_thumbnail") {
    const result = await uploadService.uploadBookThumbnail(
      tenantId!,
      bookId ?? null,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Book thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "category_icon") {
    const result = await uploadService.uploadCategoryIcon(
      tenantId!,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Category icon uploaded successfully",
    });
    return;
  }

  if (type === "bundle_thumbnail") {
    const bundleId = req.body.bundleId as string | undefined;
    const result = await uploadService.uploadBundleThumbnail(
      tenantId!,
      bundleId ?? null,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Bundle thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "batch_thumbnail") {
    const result = await uploadService.uploadBatchThumbnail(
      tenantId!,
      (batchId as string | undefined) ?? null,
      effectiveSlot,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Batch thumbnail uploaded successfully",
    });
    return;
  }

  if (type === "lecture_resource") {
    if (!courseId || !lectureId) {
      throw new BadRequestError("courseId and lectureId are required for lecture_resource upload");
    }
    const result = await uploadService.uploadLectureResource(
      tenantId!,
      courseId,
      lectureId,
      buffer,
      mimeType,
      "image"
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Lecture resource uploaded successfully",
    });
    return;
  }

  const result = await uploadService.uploadBase64Image(
    image,
    folder || "uploads",
    tenantId
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Image uploaded successfully",
  });
};

/**
 * Get a presigned URL for direct upload
 * POST /upload/presigned
 * When type=course_thumbnail: body type, tenantId, courseId?, slot
 * When type=lecture_resource: body type, tenantId, courseId, lectureId
 * When type=book_thumbnail: body type, tenantId, bookId?
 * When type=book_pdf: body type, tenantId, bookId
 * Otherwise legacy: fileName, mimeType, folder
 */
export const getPresignedUrl = async (req: Request, res: Response<IResponseFormat>) => {
  const { fileName, mimeType, folder, type, courseId, bookId, batchId, lectureId, lessonId, slot } = req.body;
  const tenantId = req.tenantId;

  if (type === "course_thumbnail" || type === "lecture_resource" || type === "book_thumbnail" || type === "book_pdf" || type === "book_epub" || type === "bundle_thumbnail" || type === "batch_thumbnail" || type === "category_icon" || type === "testimonial_image") {
    if (!tenantId) {
      throw new ForbiddenError("Tenant context required");
    }
    if (!fileName || !mimeType) {
      throw new BadRequestError("fileName and mimeType are required");
    }
    if (type === "lecture_resource" && !courseId) {
      throw new BadRequestError("courseId is required for lecture_resource");
    }
    if (type === "lecture_resource" && !lectureId && !lessonId) {
      throw new BadRequestError("lectureId or lessonId is required for lecture_resource");
    }
    if (type === "book_pdf" && !bookId) {
      throw new BadRequestError("bookId is required for book_pdf");
    }
    if (type === "book_epub" && !bookId) {
      throw new BadRequestError("bookId is required for book_epub");
    }
    const result = await uploadService.getPresignedUploadUrl(
      fileName,
      mimeType,
      folder || "uploads",
      {
        type,
        tenantId,
        courseId: courseId ?? null,
        bookId: bookId ?? null,
        batchId: batchId ?? null,
        lectureId: lectureId ?? undefined,
        lessonId: lessonId ?? undefined,
        slot: slot || "web",
      }
    );
    sendSuccessResponse({
      res,
      data: result,
      statusCode: HttpSuccessStatus.OK,
      message: "Presigned URL generated successfully",
    });
    return;
  }

  if (!fileName || !mimeType) {
    throw new BadRequestError("fileName and mimeType are required");
  }
  const result = await uploadService.getPresignedUploadUrl(
    fileName,
    mimeType,
    folder || "uploads"
  );
  sendSuccessResponse({
    res,
    data: result,
    statusCode: HttpSuccessStatus.OK,
    message: "Presigned URL generated successfully",
  });
};

/**
 * Delete a file
 * DELETE /upload/:key
 * Optional query or body: bucket (for key-based buckets)
 */
export const deleteFile = async (req: Request, res: Response<IResponseFormat>) => {
  const rawKey = req.params.key;
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  const tenantId = req.tenantId;

  if (!key) {
    throw new BadRequestError("File key is required");
  }

  if (!tenantId) {
    throw new ForbiddenError("Tenant context required");
  }

  // Ensure users can only delete files within their own tenant's S3 directory
  if (key.startsWith("tenants/") && !key.startsWith(`tenants/${tenantId}/`)) {
    throw new ForbiddenError("Cannot delete files belonging to another tenant");
  }

  const bucket = (req.query.bucket as string) || (req.body?.bucket as string);

  await uploadService.deleteFile(key, bucket);

  sendSuccessResponse({
    res,
    data: null,
    statusCode: HttpSuccessStatus.OK,
    message: "File deleted successfully",
  });
};

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFParse } from "pdf-parse";
import sharp from "sharp";
import { ulid } from "ulid";
import config from "../config";
import { createPresignS3Client, createS3Client, s3PublicUrl } from "../utils/s3";
import * as courseLmsRepo from "../repositories/course-lms.repository";
import logger from "../utils/logger";

// Initialize S3 client (single client; bucket chosen per request)
const s3Client = createS3Client();
// Presigned URLs the browser uses are signed for the host it can reach.
const presignClient = createPresignS3Client();

// Allowed image types for thumbnails
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

// Lecture resources: images, PDF, docs, archives, and common types (allow any file via octet-stream fallback)
const LECTURE_RESOURCE_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/javascript",
  "application/octet-stream", // fallback for unknown file types
];

// Max file size: 10MB for images, 50MB for lecture resources/PDFs, 100MB for book files
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Image optimization
const MAX_WIDTH = 1920;
const QUALITY = 80;

/** Optimize raster images: resize if width > MAX_WIDTH, auto-rotate, convert to WebP. Skip SVG. */
async function optimizeImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
  if (mimeType === "image/svg+xml") {
    return { buffer, ext: "svg", contentType: mimeType };
  }
  const metadata = await sharp(buffer).metadata();
  let pipeline = sharp(buffer).rotate();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH, null, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const optimized = await pipeline.webp({ quality: QUALITY }).toBuffer();
  return { buffer: optimized, ext: "webp", contentType: "image/webp" };
}
const MAX_LECTURE_RESOURCE_SIZE = 50 * 1024 * 1024;
const MAX_ASSIGNMENT_PDF_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_BOOK_PDF_SIZE = 250 * 1024 * 1024; // 250MB for book PDFs (matches multer route ceiling)
const MAX_BOOK_EPUB_SIZE = 100 * 1024 * 1024; // 100MB for book EPUBs

const EPUB_MIME_TYPE = "application/epub+zip";

export type UploadType = "course_thumbnail" | "lecture_resource" | "book_thumbnail" | "book_pdf" | "book_epub" | "bundle_thumbnail" | "batch_thumbnail" | "category_icon" | "testimonial_image";
export type ThumbnailSlot = "web" | "mobile" | "preview";

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  bucket: string;
}

/**
 * Resolve a safe, dot-prefixed file extension for an upload. Prefers the original
 * filename's extension; falls back to a small MIME map; returns "" when unknown.
 */
const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/x-zip-compressed": ".zip",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

function getFileExtension(originalName?: string, mimeType?: string): string {
  if (originalName) {
    const match = originalName.toLowerCase().match(/(\.[a-z0-9]{1,12})$/);
    if (match) return match[1];
  }
  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }
  return "";
}

function getThumbnailsBucket(): string {
  return config.THUMBNAILS_S3_BUCKET;
}

function getLectureResourcesBucket(): string {
  return config.S3_LECTURE_RESOURCES_BUCKET;
}

function getTestimonialsBucket(): string {
  return config.TESTIMONIALS_S3_BUCKET;
}

function getBookFilesBucket(): string {
  // Book PDFs share the lecture resources bucket (same storage tier)
  return config.S3_LECTURE_RESOURCES_BUCKET;
}

/** URL-safe filename: replace whitespace with hyphens, add short random id before extension for uniqueness. */
function urlSafeLectureResourceKey(originalFileName: string, ext: string): string {
  const base = originalFileName
    .replace(/\.[^/.]+$/, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "") || "file";
  const shortId = ulid().toLowerCase().slice(-8);
  return `${base}-${shortId}.${ext}`;
}

class UploadService {
  /**
   * Resolve an S3 key to a public URL (assumes bucket allows public read or use presigned GET later)
   */
  getPublicUrl(bucket: string, key: string | null | undefined): string | null {
    if (!key?.trim()) return null;
    return s3PublicUrl(bucket, key);
  }

  /**
   * Get the thumbnails bucket for the current env (for resolving course thumbnail keys)
   */
  getThumbnailsBucket(): string {
    return getThumbnailsBucket();
  }

  /**
   * Get the lecture resources bucket for the current env
   */
  getLectureResourcesBucket(): string {
    return getLectureResourcesBucket();
  }

  /**
   * Get the book files bucket for the current env (used for PDFs)
   */
  getBookFilesBucket(): string {
    return getBookFilesBucket();
  }

  /**
   * Upload a book thumbnail (cover image)
   */
  async uploadBookThumbnail(
    tenantId: string,
    bookId: string | null,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getThumbnailsBucket();
    // Use exact same key format as course thumbnails (web_{ulid}) so S3 permissions work
    const key = `public/tenants/${tenantId}/thumbnails/web_${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a category icon (uses same thumbnails bucket as course/book thumbnails)
   */
  async uploadCategoryIcon(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getThumbnailsBucket();
    const key = `public/tenants/${tenantId}/thumbnails/category_${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a testimonial image (uses thumbnails bucket)
   */
  async uploadTestimonialImage(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getTestimonialsBucket();
    const key = `public/tenants/${tenantId}/testimonials/${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a bundle thumbnail (cover image)
   */
  async uploadBundleThumbnail(
    tenantId: string,
    bundleId: string | null,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getThumbnailsBucket();
    // Use exact same key format as course thumbnails (web_{ulid}) so S3 permissions work
    const key = `public/tenants/${tenantId}/thumbnails/bundle_${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a batch thumbnail. Supports `slot: "web" | "mobile"` so a tenant can
   * provide a portrait mobile asset alongside the desktop one, same contract
   * as `uploadCourseThumbnail`. Key path namespaced by batch id when known so
   * deletes/cascades stay tidy; falls back to a generic per-tenant path during
   * the create-before-save flow.
   */
  async uploadBatchThumbnail(
    tenantId: string,
    batchId: string | null,
    slot: ThumbnailSlot,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getThumbnailsBucket();
    const key = batchId
      ? `public/tenants/${tenantId}/batches/${batchId}/thumbnails/${slot}_${ulid()}.${ext}`
      : `public/tenants/${tenantId}/thumbnails/batch_${slot}_${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a book PDF file as the final stored asset and extract page count.
   * Magic-byte validation is the real gate, since browsers report PDF mime
   * inconsistently (sometimes application/octet-stream or empty).
   */
  async uploadBookPdf(
    tenantId: string,
    bookId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<UploadResult & { pages: number | null }> {
    if (buffer.length < 4 || buffer.toString("utf8", 0, 4) !== "%PDF") {
      throw new Error(
        `File does not look like a valid PDF (got mime "${mimeType || "unknown"}")`
      );
    }
    if (buffer.length > MAX_BOOK_PDF_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_BOOK_PDF_SIZE / 1024 / 1024}MB`);
    }

    const bucket = getBookFilesBucket();
    const safeName = originalName
      .replace(/\.pdf$/i, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 50) || "book";
    const key = `tenants/${tenantId}/books/${bookId}/pdf_${safeName}_${ulid()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    });
    await s3Client.send(command);

    let pages: number | null = null;
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const info = await parser.getInfo();
        pages = typeof info.total === "number" ? info.total : null;
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch (err) {
      logger.warn("Failed to parse PDF page count, continuing without it", {
        tenantId,
        bookId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket, pages };
  }

  /**
   * Upload a book EPUB file
   */
  async uploadBookEpub(
    tenantId: string,
    bookId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<UploadResult> {
    if (mimeType !== EPUB_MIME_TYPE) {
      throw new Error(`Invalid file type: ${mimeType}. Only EPUB files (application/epub+zip) are allowed.`);
    }
    if (buffer.length > MAX_BOOK_EPUB_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_BOOK_EPUB_SIZE / 1024 / 1024}MB`);
    }

    const bucket = getBookFilesBucket();
    const safeName = originalName
      .replace(/\.epub$/i, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 50) || "book";
    const key = `tenants/${tenantId}/books/${bookId}/epub_${safeName}_${ulid()}.epub`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a course thumbnail (web, mobile, or preview image)
   */
  async uploadCourseThumbnail(
    tenantId: string,
    courseId: string | null,
    slot: ThumbnailSlot,
    buffer: Buffer,
    mimeType: string,
    _originalName: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const { buffer: optimizedBuffer, ext, contentType } = await optimizeImage(buffer, mimeType);
    const bucket = getThumbnailsBucket();
    const key = courseId
      ? `public/tenants/${tenantId}/courses/${courseId}/thumbnails/${slot}_${ulid()}.${ext}`
      : `public/tenants/${tenantId}/thumbnails/${slot}_${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: optimizedBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Upload a lecture resource (e.g. PDF, doc)
   */
  async uploadLectureResource(
    tenantId: string,
    courseId: string,
    lectureId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<UploadResult> {
    if (!LECTURE_RESOURCE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed: ${LECTURE_RESOURCE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_LECTURE_RESOURCE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_LECTURE_RESOURCE_SIZE / 1024 / 1024}MB`);
    }

    const bucket = getLectureResourcesBucket();
    const ext = this.getExtensionFromMimeType(mimeType) || (originalName.split(".").pop() ?? "bin");
    const key = `public/tenants/${tenantId}/courses/${courseId}/lectures/${lectureId}/resources/${ulid()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Legacy: upload a file to the default bucket (e.g. page images)
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string = "uploads",
    tenantId?: string
  ): Promise<UploadResult> {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}. Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`);
    }
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
    }

    const bucket = getThumbnailsBucket();
    const fileExtension = this.getExtensionFromMimeType(mimeType);
    const fileName = `${ulid()}.${fileExtension}`;
    // Scope under tenants/<tenantId>/ to match every other upload path; the S3
    // IAM policy only permits writes under the tenants/ prefix, so legacy
    // unscoped keys (e.g. "page-images/...") were rejected with AccessDenied.
    const key = tenantId
      ? `public/tenants/${tenantId}/${folder}/${fileName}`
      : `public/${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    await s3Client.send(command);
    const url = s3PublicUrl(bucket, key);
    return { url, key, bucket };
  }

  /**
   * Upload base64 image (legacy or for course thumbnail via base64 endpoint)
   */
  async uploadBase64Image(
    base64Data: string,
    folder: string = "uploads",
    tenantId?: string
  ): Promise<UploadResult> {
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 data format");
    }
    const mimeType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, "base64");
    return this.uploadFile(buffer, "image", mimeType, folder, tenantId);
  }

  /**
   * Presigned URL for direct client upload (supports type + tenant/course/lecture/slot/book)
   */
  async getPresignedUploadUrl(
    fileName: string,
    mimeType: string,
    folder: string = "uploads",
    options?: {
      type: UploadType;
      tenantId: string;
      courseId?: string | null;
      bookId?: string | null;
      bundleId?: string | null;
      batchId?: string | null;
      lectureId?: string;
      lessonId?: string;
      slot?: ThumbnailSlot;
    }
  ): Promise<PresignedUrlResult & { bucket: string }> {
    if (options?.type === "course_thumbnail") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getThumbnailsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      const slot = options.slot ?? "web";
      const key = options.courseId
        ? `public/tenants/${options.tenantId}/courses/${options.courseId}/thumbnails/${slot}_${ulid()}.${ext}`
        : `public/tenants/${options.tenantId}/thumbnails/${slot}_${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "book_thumbnail") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getThumbnailsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      // Use exact same key format as course thumbnails (web_{ulid}) so S3 permissions work
      const key = `public/tenants/${options.tenantId}/thumbnails/web_${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "category_icon") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getThumbnailsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      const key = `public/tenants/${options.tenantId}/thumbnails/category_${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "bundle_thumbnail") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getThumbnailsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      const key = `public/tenants/${options.tenantId}/thumbnails/bundle_${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "batch_thumbnail") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getThumbnailsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      const slot = options.slot ?? "web";
      // batchId may be null at create-before-save time, mirroring courses.
      const key = options.batchId
        ? `public/tenants/${options.tenantId}/batches/${options.batchId}/thumbnails/${slot}_${ulid()}.${ext}`
        : `public/tenants/${options.tenantId}/thumbnails/batch_${slot}_${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "testimonial_image") {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getTestimonialsBucket();
      const ext = this.getExtensionFromMimeType(mimeType);
      const key = `public/tenants/${options.tenantId}/testimonials/${ulid()}.${ext}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "book_pdf") {
      if (mimeType !== "application/pdf") {
        throw new Error(`Invalid file type: ${mimeType}. Only PDF files are allowed.`);
      }
      if (!options.bookId) {
        throw new Error("bookId required for book_pdf");
      }
      const bucket = getBookFilesBucket();
      const safeName = fileName
        .replace(/\.pdf$/i, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 50) || "book";
      const key = `tenants/${options.tenantId}/books/${options.bookId}/pdf_${safeName}_${ulid()}.pdf`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "book_epub") {
      if (mimeType !== EPUB_MIME_TYPE) {
        throw new Error(`Invalid file type: ${mimeType}. Only EPUB files (application/epub+zip) are allowed.`);
      }
      if (!options.bookId) {
        throw new Error("bookId required for book_epub");
      }
      const bucket = getBookFilesBucket();
      const safeName = fileName
        .replace(/\.epub$/i, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "")
        .slice(0, 50) || "book";
      const key = `tenants/${options.tenantId}/books/${options.bookId}/epub_${safeName}_${ulid()}.epub`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    if (options?.type === "lecture_resource") {
      if (!options.courseId) {
        throw new Error("courseId required for lecture_resource");
      }
      // Resolve the scope folder. Video lessons key under their lecture; the
      // standalone content lessons (PDF/IMAGE/TEXT/LINK types) have no lecture
      // row, so fall back to keying under the lesson id itself.
      let scopeFolder: string | null = null;
      if (options.lectureId) {
        scopeFolder = `lectures/${options.lectureId}`;
      } else if (options.lessonId) {
        const lecture = await courseLmsRepo.findLectureByLessonId(options.tenantId, options.lessonId);
        scopeFolder = lecture
          ? `lectures/${lecture.id}`
          : `lessons/${options.lessonId}`;
      }
      if (!scopeFolder) {
        throw new Error("lectureId or lessonId required for lecture_resource");
      }
      if (!LECTURE_RESOURCE_MIME_TYPES.includes(mimeType)) {
        throw new Error(`Invalid file type: ${mimeType}`);
      }
      const bucket = getLectureResourcesBucket();
      const ext = this.getExtensionFromMimeType(mimeType) || fileName.split(".").pop() || "bin";
      const objectName = urlSafeLectureResourceKey(fileName, ext);
      const key = `public/tenants/${options.tenantId}/courses/${options.courseId}/${scopeFolder}/resources/${objectName}`;
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
      const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
      const publicUrl = this.getPublicUrl(bucket, key)!;
      return { uploadUrl, publicUrl, key, bucket };
    }

    // Legacy: default bucket + folder
    const bucket = getThumbnailsBucket();
    const fileExtension = this.getExtensionFromMimeType(mimeType);
    const uniqueFileName = `${ulid()}.${fileExtension}`;
    const key = `public/${folder}/${uniqueFileName}`;
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType });
    const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn: 3600 });
    const publicUrl = s3PublicUrl(bucket, key);
    return { uploadUrl, publicUrl, key, bucket };
  }

  /**
   * Upload an assignment attachment of any file type (uses lecture resources bucket).
   * The original file extension is preserved in the S3 key so downloads keep a sensible
   * name and the student viewer can decide whether to render inline (PDF) or offer a download.
   */
  async uploadAssignmentPdf(
    tenantId: string,
    assignmentId: string,
    buffer: Buffer,
    mimeType: string,
    originalName?: string
  ): Promise<UploadResult> {
    if (buffer.length > MAX_ASSIGNMENT_PDF_SIZE) {
      throw new Error(`File too large. Max size: ${MAX_ASSIGNMENT_PDF_SIZE / 1024 / 1024}MB`);
    }

    const ext = getFileExtension(originalName, mimeType);
    const bucket = getLectureResourcesBucket();
    const key = `public/tenants/${tenantId}/assignments/${assignmentId}/${ulid()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Get presigned GET URL for assignment PDF (1 hour expiry)
   */
  async getAssignmentPdfSignedUrl(
    pdfKey: string,
    expiresIn = 3600
  ): Promise<string> {
    const bucket = getLectureResourcesBucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: pdfKey });
    return getSignedUrl(presignClient, command, { expiresIn });
  }

  /**
   * Upload a PDF used as the source for AI question generation.
   * Stored under tenants/{tenantId}/test-ai/{jobId}.pdf for easy cleanup.
   */
  async uploadTestAiPdf(
    tenantId: string,
    jobId: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<UploadResult> {
    if (mimeType !== "application/pdf") {
      throw new Error("Invalid file type. Only PDF files are allowed.");
    }
    const MAX_TEST_AI_PDF_SIZE = 25 * 1024 * 1024; // 25MB per PRD
    if (buffer.length > MAX_TEST_AI_PDF_SIZE) {
      throw new Error(
        `File too large. Max size: ${MAX_TEST_AI_PDF_SIZE / 1024 / 1024}MB`
      );
    }

    const bucket = getLectureResourcesBucket();
    const key = `tenants/${tenantId}/test-ai/${jobId}.pdf`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    await s3Client.send(command);

    const url = this.getPublicUrl(bucket, key)!;
    return { url, key, bucket };
  }

  /**
   * Get PDF buffer from S3 (for streaming submission PDFs)
   */
  async getPdfBuffer(pdfKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    const bucket = getLectureResourcesBucket();
    const command = new GetObjectCommand({ Bucket: bucket, Key: pdfKey });
    const response = await s3Client.send(command);
    const body = response.Body;
    if (!body) {
      throw new Error("Empty PDF body");
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const contentType = response.ContentType ?? "application/pdf";
    return { buffer, contentType };
  }

  /**
   * Mint a short-lived presigned PUT URL for the test-AI PDF flow. The client
   * uploads directly to S3, bypassing the Amplify SSR proxy whose ~6 MB Lambda
   * payload cap was the cause of 413s on larger PDFs.
   */
  async getTestAiPdfPresignedUrl(
    tenantId: string,
  ): Promise<{ uploadUrl: string; key: string; bucket: string; expiresIn: number }> {
    const bucket = getLectureResourcesBucket();
    const key = `tenants/${tenantId}/test-ai/${ulid()}.pdf`;
    const expiresIn = 300; // 5 min
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: "application/pdf",
    });
    const uploadUrl = await getSignedUrl(presignClient, command, { expiresIn });
    return { uploadUrl, key, bucket, expiresIn };
  }

  /**
   * Verify a test-AI PDF actually exists in S3 (and how big it is) before we
   * queue a worker job for it. Returns null if the object isn't there.
   */
  async headTestAiPdf(
    key: string,
  ): Promise<{ size: number; contentType: string | undefined } | null> {
    const bucket = getLectureResourcesBucket();
    try {
      const response = await s3Client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
      );
      return {
        size: response.ContentLength ?? 0,
        contentType: response.ContentType,
      };
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotFound" || name === "NoSuchKey") return null;
      throw err;
    }
  }

  /**
   * Delete a file from S3 (bucket required for key-based buckets)
   */
  async deleteFile(key: string, bucket?: string): Promise<void> {
    const targetBucket = bucket ?? (getThumbnailsBucket());
    const command = new DeleteObjectCommand({ Bucket: targetBucket, Key: key });
    await s3Client.send(command);
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "text/plain": "txt",
      "text/csv": "csv",
    };
    return extensions[mimeType] || "bin";
  }
}

export default new UploadService();

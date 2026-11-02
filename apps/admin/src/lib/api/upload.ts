import type { ApiResponse } from "../types/auth";

import { apiClient } from "./axios";

/**
 * Upload requests must bypass the Next.js `/api/proxy` rewrite: it sits behind
 * CloudFront, which caps request body size and rejects multi-MB files (small
 * images slip through, larger originals fail). Pointing straight at the backend
 * avoids that limit. The axios interceptors still attach auth + tenant headers,
 * and the backend allows CORS for these origins. Falls back to the proxy when
 * the direct URL is unset; locally NEXT_PUBLIC_API_URL is the local backend, so
 * uploads work there too.
 */
const UPLOAD_REQUEST_BASE = process.env.NEXT_PUBLIC_API_URL || undefined;

/** Axios config for direct (proxy-bypassing) multipart upload requests. */
const multipartUploadConfig = {
  headers: { "Content-Type": "multipart/form-data" },
  ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
};

/** Axios config for direct (proxy-bypassing) base64 upload requests. */
const base64UploadConfig = UPLOAD_REQUEST_BASE
  ? { baseURL: UPLOAD_REQUEST_BASE }
  : {};

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export interface BookPdfUploadResult extends UploadResult {
  /** Page count extracted server-side via pdf-parse. Null if extraction failed. */
  pages: number | null;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  bucket?: string;
}

export type CourseThumbnailSlot = "web" | "mobile" | "preview";

export interface CourseThumbnailUploadOptions {
  type: "course_thumbnail";
  tenantId: string;
  courseId: string | null;
  slot: CourseThumbnailSlot;
}

export interface LectureResourcePresignedOptions {
  tenantId: string;
  courseId: string;
  lessonId: string;
}

export interface BookThumbnailUploadOptions {
  type: "book_thumbnail";
  tenantId: string;
  bookId: string | null;
}

export interface BookPdfUploadOptions {
  tenantId: string;
  bookId: string;
}

export interface BookEpubUploadOptions {
  tenantId: string;
  bookId: string;
}

/** Batch thumbnail upload, `slot` chooses between web (desktop landscape) and
 *  mobile (portrait) so a tenant can ship distinct assets to each viewport.
 *  Mirrors `CourseThumbnailUploadOptions` 1:1. */
export interface BatchThumbnailUploadOptions {
  type: "batch_thumbnail";
  tenantId: string;
  batchId?: string | null;
  slot: "web" | "mobile";
}

export interface BundleThumbnailUploadOptions {
  type: "bundle_thumbnail";
  tenantId: string;
  bundleId: string | null;
}

export interface RoadmapThumbnailUploadOptions {
  type: "roadmap_thumbnail";
  tenantId: string;
  roadmapId: string | null;
}

export interface CategoryIconUploadOptions {
  type: "category_icon";
  tenantId: string;
}

export interface WebinarImageUploadOptions {
  type: "webinar_image";
  tenantId: string;
}

export interface TestimonialImageUploadOptions {
  type: "testimonial_image";
  tenantId: string;
}

export interface JobPostingLogoUploadOptions {
  type: "job_posting_logo";
  tenantId: string;
}

export interface StoreProductImageUploadOptions {
  type: "store_product_image";
  tenantId: string;
  /** Null while the product is still being created, the file lands under `unassigned/`. */
  productId?: string | null;
}

export const uploadApi = {
  /**
   * Upload a file using multipart form data
   */
  uploadFile: async (file: File, folder = "uploads"): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const response = await apiClient.post<ApiResponse<UploadResult>>(
      "/upload",
      formData,
      multipartUploadConfig
    );
    return response.data.data;
  },

  /**
   * Upload category icon (uses thumbnails bucket: tenants/{tenantId}/thumbnails/category_{ulid}.ext)
   */
  uploadCategoryIcon: async (
    file: File,
    options: CategoryIconUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload webinar image (uses thumbnails bucket: tenants/{tenantId}/webinars/images/{ulid}.ext)
   */
  uploadWebinarImage: async (
    file: File,
    options: WebinarImageUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload testimonial image (uses thumbnails bucket: tenants/{tenantId}/testimonials/{ulid}.ext)
   */
  uploadTestimonialImage: async (
    file: File,
    options: TestimonialImageUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload a store product photo (thumbnails bucket: tenants/{tenantId}/store/{productId}/{ulid}.ext)
   */
  uploadStoreProductImage: async (
    file: File,
    options: StoreProductImageUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.productId) formData.append("productId", options.productId);

    const response = await apiClient.post<ApiResponse<UploadResult>>(
      "/upload",
      formData,
      multipartUploadConfig
    );
    return response.data.data;
  },

  /**
   * Upload job posting logo (uses es-tenant-details bucket, max 200KB)
   */
  uploadJobPostingLogo: async (
    file: File,
    options: JobPostingLogoUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload course thumbnail (S3 key path: tenants/{tenantId}/courses/.../thumbnails/{slot}_{ulid}.ext)
   */
  uploadCourseThumbnail: async (
    file: File,
    options: CourseThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.courseId) formData.append("courseId", options.courseId);
    formData.append("slot", options.slot);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload course thumbnail from base64 (e.g. pasted image)
   */
  uploadCourseThumbnailBase64: async (
    base64DataUrl: string,
    options: CourseThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload/base64", {
      image: base64DataUrl,
      type: options.type,
      tenantId: options.tenantId,
      courseId: options.courseId ?? undefined,
      slot: options.slot,
    }, base64UploadConfig);
    return response.data.data;
  },

  /**
   * Upload a base64 image
   */
  uploadBase64: async (image: string, folder = "uploads"): Promise<UploadResult> => {
    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload/base64", {
      image,
      folder,
    }, base64UploadConfig);
    return response.data.data;
  },

  /**
   * Get a presigned URL for direct client upload
   */
  getPresignedUrl: async (
    fileName: string,
    mimeType: string,
    folder = "uploads"
  ): Promise<PresignedUrlResult> => {
    const response = await apiClient.post<ApiResponse<PresignedUrlResult>>("/upload/presigned", {
      fileName,
      mimeType,
      folder,
    });
    return response.data.data;
  },

  /**
   * Get presigned URL for lecture resource upload (S3 lecture resources bucket).
   * Use with uploadWithPresignedUrl or PUT file to uploadUrl then add publicUrl to resource_links.
   */
  getPresignedLectureResourceUrl: async (
    fileName: string,
    mimeType: string,
    options: LectureResourcePresignedOptions
  ): Promise<PresignedUrlResult> => {
    const response = await apiClient.post<ApiResponse<PresignedUrlResult>>("/upload/presigned", {
      fileName,
      mimeType: mimeType || "application/octet-stream",
      type: "lecture_resource",
      tenantId: options.tenantId,
      courseId: options.courseId,
      lessonId: options.lessonId,
    });
    return response.data.data;
  },

  /**
   * Upload a file as a lecture resource: get presigned URL, PUT to S3, return public URL.
   */
  uploadLectureResource: async (
    file: File,
    options: LectureResourcePresignedOptions
  ): Promise<string> => {
    const mimeType = file.type || "application/octet-stream";
    const { uploadUrl, publicUrl } = await uploadApi.getPresignedLectureResourceUrl(
      file.name,
      mimeType,
      options
    );
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": mimeType },
    });
    return publicUrl;
  },

  /**
   * Upload directly to S3 using presigned URL
   */
  uploadWithPresignedUrl: async (
    file: File,
    folder = "uploads"
  ): Promise<string> => {
    // Get presigned URL
    const { uploadUrl, publicUrl } = await uploadApi.getPresignedUrl(
      file.name,
      file.type,
      folder
    );

    // Upload directly to S3
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    return publicUrl;
  },

  // ===== BOOK UPLOAD METHODS =====

  /**
   * Upload book thumbnail (S3 key path: tenants/{tenantId}/books/{bookId}/thumbnail_{ulid}.ext)
   */
  uploadBookThumbnail: async (
    file: File,
    options: BookThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.bookId) formData.append("bookId", options.bookId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload book thumbnail from base64 (e.g. pasted image)
   */
  uploadBookThumbnailBase64: async (
    base64DataUrl: string,
    options: BookThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload/base64", {
      image: base64DataUrl,
      type: options.type,
      tenantId: options.tenantId,
      bookId: options.bookId ?? undefined,
    }, base64UploadConfig);
    return response.data.data;
  },

  /**
   * Get presigned URL for book PDF upload (S3 lecture resources bucket).
   * Use for large PDF files that should be uploaded directly to S3.
   */
  getPresignedBookPdfUrl: async (
    fileName: string,
    mimeType: string,
    options: BookPdfUploadOptions
  ): Promise<PresignedUrlResult> => {
    const response = await apiClient.post<ApiResponse<PresignedUrlResult>>("/upload/presigned", {
      fileName,
      mimeType: mimeType || "application/pdf",
      type: "book_pdf",
      tenantId: options.tenantId,
      bookId: options.bookId,
    });
    return response.data.data;
  },

  /**
   * Upload a file as a book PDF: get presigned URL, PUT to S3, return public URL.
   */
  uploadBookPdf: async (
    file: File,
    options: BookPdfUploadOptions
  ): Promise<string> => {
    const mimeType = file.type || "application/pdf";
    const { uploadUrl, publicUrl } = await uploadApi.getPresignedBookPdfUrl(
      file.name,
      mimeType,
      options
    );
    await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": mimeType },
    });
    return publicUrl;
  },

  /**
   * Upload book PDF using multipart form data. Backend stores the PDF as the
   * final asset and extracts page count via pdf-parse before responding.
   */
  uploadBookPdfMultipart: async (
    file: File,
    options: BookPdfUploadOptions & { onProgress?: (pct: number) => void }
  ): Promise<BookPdfUploadResult> => {
    const formData = new FormData();
    // Append non-file fields before the file so multer's fileFilter can read
    // req.body.type while parsing the file stream (otherwise type is undefined
    // and the filter falls back to the image-only allowlist).
    formData.append("type", "book_pdf");
    formData.append("tenantId", options.tenantId);
    formData.append("bookId", options.bookId);
    formData.append("file", file);

    const response = await apiClient.post<ApiResponse<BookPdfUploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
      onUploadProgress: options.onProgress
        ? (e) => {
            const total = e.total ?? file.size;
            options.onProgress!(Math.round((e.loaded / total) * 100));
          }
        : undefined,
    });
    return response.data.data;
  },

  // ===== BOOK EPUB UPLOAD METHODS =====

  /**
   * Get presigned URL for book EPUB upload (S3 lecture resources bucket).
   * Use for large EPUB files that should be uploaded directly to S3.
   */
  getPresignedBookEpubUrl: async (
    fileName: string,
    mimeType: string,
    options: BookEpubUploadOptions
  ): Promise<PresignedUrlResult> => {
    const response = await apiClient.post<ApiResponse<PresignedUrlResult>>("/upload/presigned", {
      fileName,
      mimeType: mimeType || "application/epub+zip",
      type: "book_epub",
      tenantId: options.tenantId,
      bookId: options.bookId,
    });
    return response.data.data;
  },

  /**
   * Upload a file as a book EPUB: get presigned URL, PUT to S3, return public URL.
   */
  uploadBookEpub: async (
    file: File,
    options: BookEpubUploadOptions
  ): Promise<string> => {
    const mimeType = file.type || "application/epub+zip";
    // eslint-disable-next-line no-console
    console.log("[uploadBookEpub] step 1: requesting presigned URL", {
      fileName: file.name,
      size: file.size,
      mimeType,
      bookId: options.bookId,
      tenantId: options.tenantId,
    });

    let presigned;
    try {
      presigned = await uploadApi.getPresignedBookEpubUrl(file.name, mimeType, options);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[uploadBookEpub] step 1 FAILED, backend rejected presigned URL request", err);
      throw new Error(
        `Could not get upload URL from backend: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    // eslint-disable-next-line no-console
    console.log("[uploadBookEpub] step 2: PUT to S3", { uploadUrl: presigned.uploadUrl });

    let putRes: Response;
    try {
      putRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": mimeType },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[uploadBookEpub] step 2 FAILED, network error during S3 PUT", err);
      throw new Error(
        `Network error during S3 upload: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error("[uploadBookEpub] step 2 FAILED: S3 returned non-OK", {
        status: putRes.status,
        statusText: putRes.statusText,
        body: detail.slice(0, 500),
      });
      throw new Error(
        `S3 upload failed (status ${putRes.status}): ${detail.slice(0, 200) || putRes.statusText}`
      );
    }

    // eslint-disable-next-line no-console
    console.log("[uploadBookEpub] step 3: complete", { publicUrl: presigned.publicUrl });
    return presigned.publicUrl;
  },

  /**
   * Upload book EPUB using multipart form data (for smaller files)
   */
  uploadBookEpubMultipart: async (
    file: File,
    options: BookEpubUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "book_epub");
    formData.append("tenantId", options.tenantId);
    formData.append("bookId", options.bookId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  // ===== BUNDLE UPLOAD METHODS =====

  /**
   * Upload bundle thumbnail (S3 key path: tenants/{tenantId}/thumbnails/bundle_{ulid}.ext)
   */
  uploadBundleThumbnail: async (
    file: File,
    options: BundleThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.bundleId) formData.append("bundleId", options.bundleId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload bundle thumbnail from base64 (e.g. pasted image)
   */
  uploadBundleThumbnailBase64: async (
    base64DataUrl: string,
    options: BundleThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload/base64", {
      image: base64DataUrl,
      type: options.type,
      tenantId: options.tenantId,
      bundleId: options.bundleId ?? undefined,
    }, base64UploadConfig);
    return response.data.data;
  },

  // ===== BATCH UPLOAD METHODS =====

  /**
   * Upload batch thumbnail (S3 key path:
   * `tenants/{tenantId}/batches/{batchId}/thumbnails/{slot}_{ulid}.ext`).
   * `slot` is "web" or "mobile". Same backend route as course/bundle uploads;
   * the batch_thumbnail type tag is the discriminator.
   */
  uploadBatchThumbnail: async (
    file: File,
    options: BatchThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.batchId) formData.append("batchId", options.batchId);
    formData.append("slot", options.slot);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },

  /**
   * Upload a batch thumbnail from a base64 data URL, used by the AI generation
   * flow which produces images as base64 from the worker.
   */
  uploadBatchThumbnailBase64: async (
    base64DataUrl: string,
    options: BatchThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload/base64", {
      image: base64DataUrl,
      type: options.type,
      tenantId: options.tenantId,
      batchId: options.batchId ?? undefined,
      slot: options.slot,
    }, base64UploadConfig);
    return response.data.data;
  },

  // ===== ROADMAP UPLOAD METHODS =====

  /**
   * Upload roadmap thumbnail (S3 key path: tenants/{tenantId}/roadmaps/{roadmapId}/thumbnails/{ulid}.ext)
   */
  uploadRoadmapThumbnail: async (
    file: File,
    options: RoadmapThumbnailUploadOptions
  ): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", options.type);
    formData.append("tenantId", options.tenantId);
    if (options.roadmapId) formData.append("roadmapId", options.roadmapId);

    const response = await apiClient.post<ApiResponse<UploadResult>>("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      ...(UPLOAD_REQUEST_BASE ? { baseURL: UPLOAD_REQUEST_BASE } : {}),
    });
    return response.data.data;
  },
};

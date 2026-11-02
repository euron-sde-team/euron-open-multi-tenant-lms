import type { Transaction } from "kysely";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import contentPricesService, { type ContentPriceDto } from "./content-prices.service";
import entitlementsService from "./entitlements.service";
import batchesRepository, {
  type BatchRow,
  type BatchItemWithDetails,
  type CreateBatchInput,
  type UpdateBatchInput,
  type BatchesListParams,
} from "../repositories/batches.repository";
import booksRepository from "../repositories/books.repository";
import contentPricesRepository from "../repositories/content-prices.repository";
import coursesRepository from "../repositories/courses.repository";
import pagesRepository from "../repositories/pages.repository";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const BATCH_PAGE_SLUG_PREFIX = "batches/";
const ENTITLEMENT_FEATURE_KEY = "batches";
const BATCHES_ENABLED = "batches_enabled";
const BATCHES_COUNT = "batches_count";

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

export interface BatchResponse {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  coverImageUrl: string | null;
  previewUrl: string | null;
  webThumbnailKey: string | null;
  mobileThumbnailKey: string | null;
  learningOutcomes: string[];
  startDate: string;
  endDate: string | null;
  enrollmentOpenDate: string | null;
  enrollmentCloseDate: string | null;
  durationDays: number | null;
  validityDays: number | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  status: string;
  purchaseMode: string;
  sortOrder: number;
  totalEnrollments: number;
  itemCount: number;
  pageId?: string | null;
  pageSlug?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchDetailResponse extends BatchResponse {
  items: BatchItemResponse[];
  /** Multi-currency price book; attached on detail responses. */
  prices?: ContentPriceDto[];
}

export interface BatchItemResponse {
  id: string;
  tenantId: string;
  batchId: string;
  itemType: string;
  courseId: string | null;
  bookId: string | null;
  sortOrder: number;
  createdAt: string;
  courseTitle?: string | null;
  courseSlug?: string | null;
  courseThumbnailKey?: string | null;
  courseMode?: string | null;
  courseType?: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  bookThumbnailUrl?: string | null;
}

export interface BatchesListResponse {
  batches: BatchResponse[];
  total: number;
  page: number;
  limit: number;
}

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toBatchResponse(
  row: BatchRow,
  itemCount = 0,
  page?: { id: string; slug: string } | null
): BatchResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    coverImageUrl: row.cover_image_url,
    previewUrl: row.preview_url,
    webThumbnailKey: row.web_thumbnail_key,
    mobileThumbnailKey: row.mobile_thumbnail_key,
    learningOutcomes: Array.isArray(row.learning_outcomes)
      ? (row.learning_outcomes as string[])
      : [],
    startDate: toIso(row.start_date) ?? "",
    endDate: toIso(row.end_date),
    enrollmentOpenDate: toIso(row.enrollment_open_date),
    enrollmentCloseDate: toIso(row.enrollment_close_date),
    durationDays: row.duration_days === null ? null : Number(row.duration_days),
    validityDays: row.validity_days === null ? null : Number(row.validity_days),
    priceInr: row.price_inr,
    priceUsd: row.price_usd,
    discountInr: row.discount_inr,
    discountUsd: row.discount_usd,
    status: String(row.status),
    purchaseMode: String(row.purchase_mode ?? "PAID"),
    sortOrder: Number(row.sort_order ?? 0),
    totalEnrollments: Number(row.total_enrollments ?? 0),
    itemCount,
    pageId: page?.id ?? null,
    pageSlug: page?.slug ?? null,
    createdAt: toIso(row.created_at) ?? "",
    updatedAt: toIso(row.updated_at) ?? "",
  };
}

function toBatchItemResponse(row: BatchItemWithDetails): BatchItemResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    batchId: row.batch_id,
    itemType: String(row.item_type),
    courseId: row.course_id,
    bookId: row.book_id,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: toIso(row.created_at) ?? "",
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    courseThumbnailKey: row.course_thumbnail_key,
    courseMode: row.course_mode,
    courseType: row.course_type ? String(row.course_type) : null,
    bookTitle: row.book_title,
    bookSlug: row.book_slug,
    bookThumbnailUrl: row.book_thumbnail_url,
  };
}

/**
 * Strip a `batches/` prefix when the caller passes the page slug instead of the bare slug.
 */
function normalizeBatchSlug(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.trim();
  if (trimmed.startsWith(BATCH_PAGE_SLUG_PREFIX)) {
    const without = trimmed.replace(/^batches\/?/, "").trim();
    return without || trimmed;
  }
  return trimmed;
}

function pageSlugFor(batchSlug: string): string {
  return `${BATCH_PAGE_SLUG_PREFIX}${batchSlug}`;
}

function parseDateOrThrow(value: unknown, field: string): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" && value.length > 0) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestError(`${field} is not a valid date`);
    }
    return d;
  }
  throw new BadRequestError(`${field} is required`);
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestError(`${field} is not a valid date`);
    }
    return d;
  }
  throw new BadRequestError(`${field} must be a date string`);
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

class BatchesService {
  // ─────────────────────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────────────────────

  async getBatches(
    tenantId: string,
    params: BatchesListParams
  ): Promise<BatchesListResponse> {
    const result = await batchesRepository.findByTenantId(tenantId, params);
    const batchesWithCounts = await Promise.all(
      result.batches.map(async (batch) => {
        const itemCount = await batchesRepository.getItemCount(batch.id);
        return toBatchResponse(batch, itemCount);
      })
    );
    return {
      batches: batchesWithCounts,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getBatchById(
    batchId: string,
    tenantId: string
  ): Promise<BatchDetailResponse> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    const items = await batchesRepository.findItemsWithDetailsByBatchId(batchId);
    const page = await pagesRepository.findByTenantAndSlug(
      tenantId,
      pageSlugFor(batch.slug)
    );
    const baseResponse = toBatchResponse(
      batch,
      items.length,
      page ? { id: page.id, slug: page.slug } : null
    );

    return {
      ...baseResponse,
      items: items.map(toBatchItemResponse),
      prices: await contentPricesService.getEntityPrices(tenantId, "BATCH", batchId),
    };
  }

  async getBatchBySlug(
    tenantId: string,
    slugInput: string
  ): Promise<BatchDetailResponse | null> {
    const normalized = normalizeBatchSlug(slugInput);
    const batch = await batchesRepository.findByTenantAndSlug(tenantId, normalized);
    if (!batch) return null;
    return this.getBatchById(batch.id, tenantId);
  }

  async createBatch(
    tenantId: string,
    data: Omit<CreateBatchInput, "tenant_id" | "start_date"> & {
      start_date: unknown;
      end_date?: unknown;
      enrollment_open_date?: unknown;
      enrollment_close_date?: unknown;
    },
    userId?: string
  ): Promise<BatchResponse> {
    // Master gate: batches_enabled must be true on this tenant
    await entitlementsService.ensureBooleanEntitlement(
      tenantId,
      BATCHES_ENABLED,
      ENTITLEMENT_FEATURE_KEY,
      "Batches are not enabled on your plan. Upgrade to add batches."
    );

    const slug = normalizeBatchSlug(data.slug);
    if (!slug) {
      throw new BadRequestError("slug is required");
    }
    const slugExists = await batchesRepository.slugExistsForTenant(tenantId, slug);
    if (slugExists) {
      throw new ConflictError(`Batch with slug "${slug}" already exists`);
    }

    const startDate = parseDateOrThrow(data.start_date, "start_date");
    const endDate = parseOptionalDate(data.end_date, "end_date");
    if (endDate && endDate.getTime() < startDate.getTime()) {
      throw new BadRequestError("end_date must be on or after start_date");
    }
    const enrollmentOpenDate = parseOptionalDate(
      data.enrollment_open_date,
      "enrollment_open_date"
    );
    const enrollmentCloseDate = parseOptionalDate(
      data.enrollment_close_date,
      "enrollment_close_date"
    );
    if (
      enrollmentOpenDate &&
      enrollmentCloseDate &&
      enrollmentCloseDate.getTime() < enrollmentOpenDate.getTime()
    ) {
      throw new BadRequestError(
        "enrollment_close_date must be on or after enrollment_open_date"
      );
    }

    const { prices, ...createData } = data;
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BATCH",
      prices,
      { purchaseMode: (createData.purchase_mode as string) ?? "PAID" }
    );
    if (preparedPrices) {
      createData.price_inr = preparedPrices.legacy.price_inr;
      createData.price_usd = preparedPrices.legacy.price_usd;
      createData.discount_inr = preparedPrices.legacy.discount_inr;
      createData.discount_usd = preparedPrices.legacy.discount_usd;
    }

    // Single transaction: insert batches row + tenant_pages row at slug `batches/{slug}`.
    const created = await db.transaction().execute(async (trx) => {
      const batch = await batchesRepository.create(
        {
          ...createData,
          tenant_id: tenantId,
          slug,
          start_date: startDate,
          end_date: endDate,
          enrollment_open_date: enrollmentOpenDate,
          enrollment_close_date: enrollmentCloseDate,
        },
        trx
      );

      if (preparedPrices) {
        await contentPricesService.applyPrepared(tenantId, "BATCH", batch.id, preparedPrices, trx);
      } else {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BATCH",
          batch.id,
          {
            price_inr: createData.price_inr,
            price_usd: createData.price_usd,
            discount_inr: createData.discount_inr,
            discount_usd: createData.discount_usd,
          },
          trx
        );
      }

      const computedPageSlug = pageSlugFor(slug);
      const existingPage = await pagesRepository.findByTenantAndSlug(
        tenantId,
        computedPageSlug
      );
      if (!existingPage) {
        await pagesRepository.create(
          {
            tenant_id: tenantId,
            slug: computedPageSlug,
            title: data.title,
            sections: [],
            theme: {},
            seo: { title: data.title },
            is_published: false,
            created_by: userId,
          },
          trx
        );
      }

      return batch;
    });

    return toBatchResponse(created, 0);
  }

  async updateBatch(
    batchId: string,
    tenantId: string,
    data: UpdateBatchInput & {
      start_date?: unknown;
      end_date?: unknown;
      enrollment_open_date?: unknown;
      enrollment_close_date?: unknown;
    }
  ): Promise<BatchDetailResponse> {
    const existing = await batchesRepository.findById(batchId);
    if (!existing) {
      throw new NotFoundError("Batch not found");
    }
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    const startDate =
      data.start_date !== undefined
        ? parseDateOrThrow(data.start_date, "start_date")
        : undefined;
    const endDate =
      data.end_date !== undefined
        ? parseOptionalDate(data.end_date, "end_date")
        : undefined;
    const enrollmentOpenDate =
      data.enrollment_open_date !== undefined
        ? parseOptionalDate(data.enrollment_open_date, "enrollment_open_date")
        : undefined;
    const enrollmentCloseDate =
      data.enrollment_close_date !== undefined
        ? parseOptionalDate(data.enrollment_close_date, "enrollment_close_date")
        : undefined;

    const newSlug =
      data.slug !== undefined ? normalizeBatchSlug(data.slug) : undefined;
    if (newSlug !== undefined && newSlug !== existing.slug) {
      const slugExists = await batchesRepository.slugExistsForTenant(
        tenantId,
        newSlug,
        batchId
      );
      if (slugExists) {
        throw new ConflictError(`Batch with slug "${newSlug}" already exists`);
      }
    }

    const { prices, ...rest } = data;

    const effectivePurchaseMode =
      (data.purchase_mode as string | undefined) ?? String(existing.purchase_mode ?? "PAID");
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BATCH",
      prices,
      { purchaseMode: effectivePurchaseMode }
    );
    if (preparedPrices) {
      rest.price_inr = preparedPrices.legacy.price_inr;
      rest.price_usd = preparedPrices.legacy.price_usd;
      rest.discount_inr = preparedPrices.legacy.discount_inr;
      rest.discount_usd = preparedPrices.legacy.discount_usd;
    }
    const legacyPriceTouched =
      !preparedPrices &&
      (rest.price_inr !== undefined ||
        rest.price_usd !== undefined ||
        rest.discount_inr !== undefined ||
        rest.discount_usd !== undefined);
    const syncPrices = async (trx: Transaction<DB>) => {
      if (preparedPrices) {
        await contentPricesService.applyPrepared(tenantId, "BATCH", batchId, preparedPrices, trx);
      } else if (legacyPriceTouched) {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BATCH",
          batchId,
          {
            price_inr: rest.price_inr,
            price_usd: rest.price_usd,
            discount_inr: rest.discount_inr,
            discount_usd: rest.discount_usd,
          },
          trx
        );
      }
    };

    const updateData: UpdateBatchInput = {
      ...rest,
      ...(newSlug !== undefined && { slug: newSlug }),
      ...(startDate !== undefined && { start_date: startDate }),
      ...(endDate !== undefined && { end_date: endDate }),
      ...(enrollmentOpenDate !== undefined && {
        enrollment_open_date: enrollmentOpenDate,
      }),
      ...(enrollmentCloseDate !== undefined && {
        enrollment_close_date: enrollmentCloseDate,
      }),
    };

    await db.transaction().execute(async (trx) => {
      const updated = await batchesRepository.update(
        batchId,
        updateData,
        tenantId,
        trx
      );
      if (!updated) {
        throw new NotFoundError("Batch not found");
      }

      // Sync the linked tenant_pages row when slug or title changes.
      if (newSlug !== undefined && newSlug !== existing.slug) {
        const oldPageSlug = pageSlugFor(existing.slug);
        const oldPage = await pagesRepository.findByTenantAndSlug(
          tenantId,
          oldPageSlug
        );
        if (oldPage) {
          await pagesRepository.update(
            oldPage.id,
            { slug: pageSlugFor(newSlug) },
            trx,
            tenantId
          );
        }
      }
      if (data.title !== undefined && data.title !== existing.title) {
        const pageSlug = pageSlugFor(newSlug ?? existing.slug);
        const page = await pagesRepository.findByTenantAndSlug(
          tenantId,
          pageSlug
        );
        if (page) {
          await pagesRepository.update(
            page.id,
            { title: data.title },
            trx,
            tenantId
          );
        }
      }

      await syncPrices(trx);
    });

    return this.getBatchById(batchId, tenantId);
  }

  async togglePublish(
    batchId: string,
    tenantId: string,
    publish: boolean
  ): Promise<BatchDetailResponse> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    // Count slots move only on a real transition, so re-publishing an
    // already published batch (or unpublishing a draft) is a no-op for usage.
    const wasPublished = String(batch.status) === "PUBLISHED";
    const publishing = publish && !wasPublished;
    const unpublishing = !publish && wasPublished;

    if (publishing) {
      const itemCount = await batchesRepository.getItemCount(batchId);
      if (itemCount === 0) {
        throw new BadRequestError(
          "Cannot publish a batch with no items. Add at least one course or book."
        );
      }
      const capacity = await entitlementsService.checkCapacity(
        tenantId,
        BATCHES_COUNT,
        1
      );
      if (!capacity.allowed) {
        throw new BadRequestError(
          `Batch limit reached (${capacity.currentUsed}/${capacity.limit})`
        );
      }
    }

    const newStatus = publish ? "PUBLISHED" : "DRAFT";

    await db.transaction().execute(async (trx) => {
      const updated = await batchesRepository.update(
        batchId,
        { status: newStatus },
        tenantId,
        trx
      );
      if (!updated) {
        throw new NotFoundError("Batch not found");
      }

      // Sync page publish status.
      const pageSlug = pageSlugFor(batch.slug);
      const page = await pagesRepository.findByTenantAndSlug(tenantId, pageSlug);
      if (page) {
        await pagesRepository.update(
          page.id,
          { is_published: publish },
          trx,
          tenantId
        );
      }
    });

    if (publishing) {
      await entitlementsService.consume(tenantId, BATCHES_COUNT, 1);
    } else if (unpublishing) {
      await entitlementsService.release(tenantId, BATCHES_COUNT, 1);
    }

    return this.getBatchById(batchId, tenantId);
  }

  async deleteBatch(batchId: string, tenantId: string): Promise<void> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    const enrolled = await batchesRepository.getEnrollmentCount(batchId);
    if (enrolled > 0) {
      throw new BadRequestError(
        "Cannot delete a batch with active enrollments. Cancel or migrate enrollments first."
      );
    }

    const wasPublished = String(batch.status) === "PUBLISHED";

    await db.transaction().execute(async (trx) => {
      const pageSlug = pageSlugFor(batch.slug);
      const page = await pagesRepository.findByTenantAndSlug(tenantId, pageSlug);
      if (page) {
        await pagesRepository.delete(page.id, trx, tenantId);
      }

      await contentPricesRepository.deleteByEntity(tenantId, "BATCH", batchId, trx);

      const deleted = await batchesRepository.delete(batchId, tenantId, trx);
      if (!deleted) {
        throw new NotFoundError("Batch not found");
      }
    });

    if (wasPublished) {
      await entitlementsService.release(tenantId, BATCHES_COUNT, 1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Batch Items
  // ─────────────────────────────────────────────────────────────

  async getBatchItems(
    batchId: string,
    tenantId: string
  ): Promise<BatchItemResponse[]> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }
    const items = await batchesRepository.findItemsWithDetailsByBatchId(batchId);
    return items.map(toBatchItemResponse);
  }

  async addBatchItem(
    batchId: string,
    tenantId: string,
    data: { itemType: string; courseId?: string | null; bookId?: string | null }
  ): Promise<BatchItemResponse> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    if (data.itemType === "COURSE") {
      if (!data.courseId) {
        throw new BadRequestError("courseId is required for COURSE item type");
      }
      const course = await coursesRepository.findById(data.courseId);
      if (!course) {
        throw new NotFoundError("Course not found");
      }
      if (course.tenant_id !== tenantId) {
        throw new ForbiddenError("You do not have access to this course");
      }
    } else if (data.itemType === "BOOK") {
      if (!data.bookId) {
        throw new BadRequestError("bookId is required for BOOK item type");
      }
      const book = await booksRepository.findById(data.bookId);
      if (!book) {
        throw new NotFoundError("Book not found");
      }
      if (book.tenant_id !== tenantId) {
        throw new ForbiddenError("You do not have access to this book");
      }
    } else {
      throw new BadRequestError("itemType must be COURSE or BOOK");
    }

    const exists = await batchesRepository.itemExistsInBatch(
      batchId,
      data.itemType,
      data.courseId ?? null,
      data.bookId ?? null
    );
    if (exists) {
      throw new ConflictError(
        `This ${data.itemType.toLowerCase()} is already in the batch`
      );
    }

    const maxSortOrder = await batchesRepository.getMaxItemSortOrder(batchId);
    const item = await batchesRepository.createItem({
      tenant_id: tenantId,
      batch_id: batchId,
      item_type: data.itemType,
      course_id: data.itemType === "COURSE" ? data.courseId : null,
      book_id: data.itemType === "BOOK" ? data.bookId : null,
      sort_order: maxSortOrder + 1,
    });

    const itemsWithDetails = await batchesRepository.findItemsWithDetailsByBatchId(
      batchId
    );
    const created = itemsWithDetails.find((i) => i.id === item.id);
    if (!created) {
      return {
        id: item.id,
        tenantId: item.tenant_id,
        batchId: item.batch_id,
        itemType: String(item.item_type),
        courseId: item.course_id,
        bookId: item.book_id,
        sortOrder: Number(item.sort_order ?? 0),
        createdAt: toIso(item.created_at) ?? "",
      };
    }
    return toBatchItemResponse(created);
  }

  async removeBatchItem(
    batchId: string,
    itemId: string,
    tenantId: string
  ): Promise<void> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    const item = await batchesRepository.findItemById(itemId);
    if (!item) {
      throw new NotFoundError("Batch item not found");
    }
    if (item.batch_id !== batchId) {
      throw new BadRequestError("Item does not belong to this batch");
    }

    const deleted = await batchesRepository.deleteItem(itemId);
    if (!deleted) {
      throw new NotFoundError("Batch item not found");
    }
  }

  async reorderBatchItems(
    batchId: string,
    tenantId: string,
    itemIds: string[]
  ): Promise<BatchItemResponse[]> {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }

    const existingItems = await batchesRepository.findItemsByBatchId(batchId);
    const existingIds = new Set(existingItems.map((i) => i.id));
    for (const itemId of itemIds) {
      if (!existingIds.has(itemId)) {
        throw new BadRequestError(`Item ${itemId} does not belong to this batch`);
      }
    }

    await batchesRepository.reorderItems(batchId, itemIds);
    const items = await batchesRepository.findItemsWithDetailsByBatchId(batchId);
    return items.map(toBatchItemResponse);
  }

  // ─────────────────────────────────────────────────────────────
  // Enrollments (admin)
  // ─────────────────────────────────────────────────────────────

  async listEnrollments(
    batchId: string,
    tenantId: string,
    page = 1,
    limit = 20
  ) {
    const batch = await batchesRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError("Batch not found");
    }
    if (batch.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this batch");
    }
    return batchesRepository.listEnrollments(batchId, tenantId, page, limit);
  }
}

const batchesService = new BatchesService();
export default batchesService;

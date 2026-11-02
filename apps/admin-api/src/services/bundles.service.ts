import type { Transaction } from "kysely";
import { BadRequestError } from "../errors/bad-request.error";
import { ConflictError } from "../errors/conflict-custom.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import contentPricesService, { type ContentPriceDto } from "./content-prices.service";
import entitlementsService from "./entitlements.service";
import bundlesRepository, {
  type BundleRow,
  type BundleItemWithDetails,
  type CreateBundleInput,
  type UpdateBundleInput,
  type BundlesListParams,
} from "../repositories/bundles.repository";
import booksRepository from "../repositories/books.repository";
import contentPricesRepository from "../repositories/content-prices.repository";
import coursesRepository from "../repositories/courses.repository";
import testSeriesRepository from "../repositories/test-series.repository";

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────

export interface BundleResponse {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  status: string;
  purchaseMode: string;
  validityDays: number | null;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BundleDetailResponse extends BundleResponse {
  items: BundleItemResponse[];
  /** Multi-currency price book; attached on detail responses. */
  prices?: ContentPriceDto[];
}

export interface BundleItemResponse {
  id: string;
  tenantId: string;
  bundleId: string;
  itemType: string;
  courseId: string | null;
  bookId: string | null;
  testSeriesId: string | null;
  sortOrder: number;
  createdAt: string;
  // Joined details
  courseTitle?: string | null;
  courseSlug?: string | null;
  courseThumbnailKey?: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  bookThumbnailUrl?: string | null;
  testSeriesTitle?: string | null;
  testSeriesSlug?: string | null;
  testSeriesCoverImageKey?: string | null;
}

export interface BundlesListResponse {
  bundles: BundleResponse[];
  total: number;
  page: number;
  limit: number;
}

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function toBundleResponse(row: BundleRow, itemCount: number = 0): BundleResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    slug: row.slug,
    subtitle: row.subtitle,
    description: row.description,
    priceInr: row.price_inr,
    priceUsd: row.price_usd,
    discountInr: row.discount_inr,
    discountUsd: row.discount_usd,
    thumbnailUrl: row.thumbnail_url,
    previewUrl: row.preview_url,
    status: String(row.status),
    purchaseMode: String(row.purchase_mode ?? "PAID"),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    sortOrder: Number(row.sort_order ?? 0),
    itemCount,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function toBundleItemResponse(row: BundleItemWithDetails): BundleItemResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    bundleId: row.bundle_id,
    itemType: String(row.item_type),
    courseId: row.course_id,
    bookId: row.book_id,
    testSeriesId: row.test_series_id,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    courseThumbnailKey: row.course_thumbnail_key,
    bookTitle: row.book_title,
    bookSlug: row.book_slug,
    bookThumbnailUrl: row.book_thumbnail_url,
    testSeriesTitle: row.test_series_title,
    testSeriesSlug: row.test_series_slug,
    testSeriesCoverImageKey: row.test_series_cover_image_key,
  };
}

/**
 * Normalize bundle slug for storage: always store the direct slug (e.g. "full-stack-bundle").
 */
function normalizeBundleSlug(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.trim();
  if (trimmed.startsWith("bundles/")) {
    const without = trimmed.replace(/^bundles\/?/, "").trim();
    return without || trimmed;
  }
  return trimmed;
}

// ─────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────

class BundlesService {
  // ─────────────────────────────────────────────────────────────
  // Bundle CRUD
  // ─────────────────────────────────────────────────────────────

  async getBundles(
    tenantId: string,
    params: BundlesListParams
  ): Promise<BundlesListResponse> {
    const result = await bundlesRepository.findByTenantId(tenantId, params);

    // Get item counts for each bundle
    const bundlesWithCounts = await Promise.all(
      result.bundles.map(async (bundle) => {
        const itemCount = await bundlesRepository.getItemCount(bundle.id);
        return toBundleResponse(bundle, itemCount);
      })
    );

    return {
      bundles: bundlesWithCounts,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async getBundleById(
    bundleId: string,
    tenantId: string
  ): Promise<BundleDetailResponse> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    const baseResponse = toBundleResponse(bundle, items.length);

    return {
      ...baseResponse,
      items: items.map(toBundleItemResponse),
      prices: await contentPricesService.getEntityPrices(tenantId, "BUNDLE", bundleId),
    };
  }

  async getBundleBySlug(
    tenantId: string,
    slug: string
  ): Promise<BundleDetailResponse | null> {
    let bundle = await bundlesRepository.findByTenantAndSlug(tenantId, slug);
    if (!bundle && slug.startsWith("bundles/")) {
      const slugWithoutPrefix = slug.replace(/^bundles\/?/, "");
      if (slugWithoutPrefix) {
        bundle = await bundlesRepository.findByTenantAndSlug(
          tenantId,
          slugWithoutPrefix
        );
      }
    }
    if (!bundle) return null;

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundle.id);
    const baseResponse = toBundleResponse(bundle, items.length);

    return {
      ...baseResponse,
      items: items.map(toBundleItemResponse),
      prices: await contentPricesService.getEntityPrices(tenantId, "BUNDLE", bundle.id),
    };
  }

  async createBundle(
    tenantId: string,
    data: Omit<CreateBundleInput, "tenant_id">
  ): Promise<BundleResponse> {
    const slug = normalizeBundleSlug(data.slug);
    const slugExists = await bundlesRepository.slugExistsForTenant(tenantId, slug);
    if (slugExists) {
      throw new ConflictError(`Bundle with slug "${slug}" already exists`);
    }

    const { prices, ...createData } = data;
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BUNDLE",
      prices,
      { purchaseMode: (createData.purchase_mode as string) ?? "PAID" }
    );
    if (preparedPrices) {
      createData.price_inr = preparedPrices.legacy.price_inr;
      createData.price_usd = preparedPrices.legacy.price_usd;
      createData.discount_inr = preparedPrices.legacy.discount_inr;
      createData.discount_usd = preparedPrices.legacy.discount_usd;
    }

    const bundle = await db.transaction().execute(async (trx) => {
      const created = await bundlesRepository.create(
        {
          ...createData,
          slug,
          tenant_id: tenantId,
        },
        trx
      );

      if (preparedPrices) {
        await contentPricesService.applyPrepared(tenantId, "BUNDLE", created.id, preparedPrices, trx);
      } else {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BUNDLE",
          created.id,
          {
            price_inr: createData.price_inr,
            price_usd: createData.price_usd,
            discount_inr: createData.discount_inr,
            discount_usd: createData.discount_usd,
          },
          trx
        );
      }

      return created;
    });

    return toBundleResponse(bundle, 0);
  }

  async updateBundle(
    bundleId: string,
    tenantId: string,
    data: UpdateBundleInput
  ): Promise<BundleDetailResponse> {
    const existing = await bundlesRepository.findById(bundleId);
    if (!existing) {
      throw new NotFoundError("Bundle not found");
    }
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    const normalizedSlug =
      data.slug !== undefined ? normalizeBundleSlug(data.slug) : undefined;
    if (normalizedSlug !== undefined && normalizedSlug !== existing.slug) {
      const slugExists = await bundlesRepository.slugExistsForTenant(
        tenantId,
        normalizedSlug,
        bundleId
      );
      if (slugExists) {
        throw new ConflictError(
          `Bundle with slug "${normalizedSlug}" already exists`
        );
      }
    }

    const { prices, ...rest } = data;

    const effectivePurchaseMode =
      (data.purchase_mode as string | undefined) ?? String(existing.purchase_mode ?? "PAID");
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BUNDLE",
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
        await contentPricesService.applyPrepared(tenantId, "BUNDLE", bundleId, preparedPrices, trx);
      } else if (legacyPriceTouched) {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BUNDLE",
          bundleId,
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

    const updateData = {
      ...rest,
      ...(normalizedSlug !== undefined && { slug: normalizedSlug }),
    };

    const updated = await db.transaction().execute(async (trx) => {
      const result = await bundlesRepository.update(bundleId, updateData, tenantId, trx);
      if (!result) {
        throw new NotFoundError("Bundle not found");
      }
      await syncPrices(trx);
      return result;
    });

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    const baseResponse = toBundleResponse(updated, items.length);

    return {
      ...baseResponse,
      items: items.map(toBundleItemResponse),
    };
  }

  /**
   * Toggle publish state of a bundle.
   * DRAFT → PUBLISHED or PUBLISHED → DRAFT
   */
  async togglePublish(
    bundleId: string,
    tenantId: string,
    publish: boolean
  ): Promise<BundleDetailResponse> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    // Count slots move only on a real transition, so re-publishing an
    // already published bundle (or unpublishing a draft) is a no-op for usage.
    const wasPublished = String(bundle.status) === "PUBLISHED";
    const publishing = publish && !wasPublished;
    const unpublishing = !publish && wasPublished;

    // Optionally validate bundle has at least one item before publishing
    if (publishing) {
      const itemCount = await bundlesRepository.getItemCount(bundleId);
      if (itemCount === 0) {
        throw new BadRequestError(
          "Cannot publish a bundle with no items. Add at least one course or book."
        );
      }

      // Check entitlement capacity before publishing
      const capacity = await entitlementsService.checkCapacity(tenantId, "bundles_count", 1);
      if (!capacity.allowed) {
        throw new BadRequestError(`Bundle limit reached (${capacity.currentUsed}/${capacity.limit})`);
      }
    }

    const newStatus = publish ? "PUBLISHED" : "DRAFT";
    const updated = await bundlesRepository.update(bundleId, {
      status: newStatus,
    });
    if (!updated) {
      throw new NotFoundError("Bundle not found");
    }

    // Consume/release entitlement after successful DB update
    if (publishing) {
      await entitlementsService.consume(tenantId, "bundles_count", 1);
    } else if (unpublishing) {
      await entitlementsService.release(tenantId, "bundles_count", 1);
    }

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    const baseResponse = toBundleResponse(updated, items.length);

    return {
      ...baseResponse,
      items: items.map(toBundleItemResponse),
    };
  }

  async deleteBundle(bundleId: string, tenantId: string): Promise<void> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    const wasPublished = String(bundle.status) === "PUBLISHED";

    await db.transaction().execute(async (trx) => {
      await contentPricesRepository.deleteByEntity(tenantId, "BUNDLE", bundleId, trx);

      const deleted = await bundlesRepository.delete(bundleId, tenantId, trx);
      if (!deleted) {
        throw new NotFoundError("Bundle not found");
      }
    });

    if (wasPublished) {
      await entitlementsService.release(tenantId, "bundles_count", 1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Bundle Items
  // ─────────────────────────────────────────────────────────────

  async getBundleItems(
    bundleId: string,
    tenantId: string
  ): Promise<BundleItemResponse[]> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    return items.map(toBundleItemResponse);
  }

  async addBundleItem(
    bundleId: string,
    tenantId: string,
    data: {
      itemType: string;
      courseId?: string | null;
      bookId?: string | null;
      testSeriesId?: string | null;
    }
  ): Promise<BundleItemResponse> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    // Validate item_type and corresponding ID
    if (data.itemType === "COURSE") {
      if (!data.courseId) {
        throw new BadRequestError("courseId is required for COURSE item type");
      }
      // Verify course exists and belongs to tenant
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
      // Verify book exists and belongs to tenant
      const book = await booksRepository.findById(data.bookId);
      if (!book) {
        throw new NotFoundError("Book not found");
      }
      if (book.tenant_id !== tenantId) {
        throw new ForbiddenError("You do not have access to this book");
      }
    } else if (data.itemType === "TEST_SERIES") {
      if (!data.testSeriesId) {
        throw new BadRequestError(
          "testSeriesId is required for TEST_SERIES item type"
        );
      }
      // Verify test series exists and belongs to tenant
      const testSeries = await testSeriesRepository.findById(data.testSeriesId);
      if (!testSeries) {
        throw new NotFoundError("Test series not found");
      }
      if (testSeries.tenant_id !== tenantId) {
        throw new ForbiddenError("You do not have access to this test series");
      }
    } else {
      throw new BadRequestError("itemType must be COURSE, BOOK, or TEST_SERIES");
    }

    // Check if item already exists in bundle
    const exists = await bundlesRepository.itemExistsInBundle(
      bundleId,
      data.itemType,
      data.courseId ?? null,
      data.bookId ?? null,
      data.testSeriesId ?? null
    );
    if (exists) {
      throw new ConflictError(
        `This ${data.itemType.toLowerCase()} is already in the bundle`
      );
    }

    // Get next sort_order
    const maxSortOrder = await bundlesRepository.getMaxItemSortOrder(bundleId);
    const newSortOrder = maxSortOrder + 1;

    const item = await bundlesRepository.createItem({
      tenant_id: tenantId,
      bundle_id: bundleId,
      item_type: data.itemType,
      course_id: data.itemType === "COURSE" ? data.courseId : null,
      book_id: data.itemType === "BOOK" ? data.bookId : null,
      test_series_id: data.itemType === "TEST_SERIES" ? data.testSeriesId : null,
      sort_order: newSortOrder,
    });

    // Re-fetch with details
    const itemsWithDetails = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    const createdItem = itemsWithDetails.find((i) => i.id === item.id);
    if (!createdItem) {
      // Fallback without details
      return {
        id: item.id,
        tenantId: item.tenant_id,
        bundleId: item.bundle_id,
        itemType: String(item.item_type),
        courseId: item.course_id,
        bookId: item.book_id,
        testSeriesId: item.test_series_id,
        sortOrder: Number(item.sort_order ?? 0),
        createdAt:
          item.created_at instanceof Date
            ? item.created_at.toISOString()
            : String(item.created_at),
      };
    }
    return toBundleItemResponse(createdItem);
  }

  async removeBundleItem(
    bundleId: string,
    itemId: string,
    tenantId: string
  ): Promise<void> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    const item = await bundlesRepository.findItemById(itemId);
    if (!item) {
      throw new NotFoundError("Bundle item not found");
    }
    if (item.bundle_id !== bundleId) {
      throw new BadRequestError("Item does not belong to this bundle");
    }

    const deleted = await bundlesRepository.deleteItem(itemId);
    if (!deleted) {
      throw new NotFoundError("Bundle item not found");
    }
  }

  async reorderBundleItems(
    bundleId: string,
    tenantId: string,
    itemIds: string[]
  ): Promise<BundleItemResponse[]> {
    const bundle = await bundlesRepository.findById(bundleId);
    if (!bundle) {
      throw new NotFoundError("Bundle not found");
    }
    if (bundle.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this bundle");
    }

    // Validate all item IDs belong to this bundle
    const existingItems = await bundlesRepository.findItemsByBundleId(bundleId);
    const existingIds = new Set(existingItems.map((i) => i.id));
    for (const itemId of itemIds) {
      if (!existingIds.has(itemId)) {
        throw new BadRequestError(
          `Item ${itemId} does not belong to this bundle`
        );
      }
    }

    await bundlesRepository.reorderItems(bundleId, itemIds);

    const items = await bundlesRepository.findItemsWithDetailsByBundleId(bundleId);
    return items.map(toBundleItemResponse);
  }
}

const bundlesService = new BundlesService();
export default bundlesService;

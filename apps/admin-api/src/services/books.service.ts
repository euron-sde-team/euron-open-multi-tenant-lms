import type { Transaction } from "kysely";
import { BadRequestError } from "../errors/bad-request.error";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import type { DB } from "../db/types";
import {
  getCategoryIdsByBookId,
  getCategoryIdsByBookIds,
  setBookCategories,
} from "../repositories/book-categories.repository";
import {
  getAuthorIdsByBookId,
  getAuthorIdsByBookIds,
  setBookAuthors,
} from "../repositories/book-authors.repository";
import booksRepository, {
  type BookRow,
  type CreateBookInput,
  type UpdateBookInput,
  type BooksListParams,
} from "../repositories/books.repository";
import contentPricesRepository from "../repositories/content-prices.repository";
import pagesRepository from "../repositories/pages.repository";
import contentPricesService, { type ContentPriceDto } from "./content-prices.service";
import entitlementsService from "./entitlements.service";
import usageService from "./usage.service";
import { requireSlug, uniqueSlug } from "../utils/slug";

export interface BookResponse {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  author: string | null;
  description: string | null;
  summary: string | null;
  pages: number | null;
  url: string | null;
  pageImages: string[];
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  status: string;
  language: string[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  sortOrder: number;
  validityDays: number | null;
  rating: number | null;
  ratingTotalCount: number | null;
  fileFormat: "EPUB" | "PDF";
  authorIds: string[];
  categoryIds: string[];
  /** Multi-currency price book; attached on detail responses. */
  prices?: ContentPriceDto[];
  createdAt: string;
  updatedAt: string;
}

export type BookListItemResponse = BookResponse & {
  /** Bundles containing this book, drives the "Part of X" chip. */
  bundles?: Array<{ id: string; title: string; slug: string }>;
};

export interface BooksListResponse {
  books: BookListItemResponse[];
  total: number;
  page: number;
  limit: number;
}

function toBookResponse(
  row: BookRow,
  authorIds: string[] = [],
  categoryIds: string[] = []
): BookResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    slug: row.slug,
    author: row.author,
    description: row.description,
    summary: row.summary,
    pages: row.pages,
    url: row.url,
    pageImages: Array.isArray(row.page_images) ? row.page_images : [],
    priceInr: row.price_inr,
    priceUsd: row.price_usd,
    discountInr: row.discount_inr,
    discountUsd: row.discount_usd,
    purchaseMode: String(row.purchase_mode),
    status: String(row.status),
    language: Array.isArray(row.language) ? row.language : [],
    thumbnailUrl: row.thumbnail_url ?? null,
    previewUrl: row.preview_url ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    rating: row.rating != null ? parseFloat(String(row.rating)) : null,
    ratingTotalCount: row.rating_total_count != null ? Number(row.rating_total_count) : null,
    fileFormat: (String(row.file_format ?? "EPUB") === "PDF" ? "PDF" : "EPUB"),
    authorIds,
    categoryIds,
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

/**
 * Normalize book slug for storage: always store the direct slug (e.g. "python-book").
 */
function normalizeBookSlug(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.trim();
  if (trimmed.startsWith("books/")) {
    const without = trimmed.replace(/^books\/?/, "").trim();
    return without || trimmed;
  }
  return trimmed;
}

/** Another book uses the slug, or a page already sits at its address. */
async function bookSlugTaken(
  tenantId: string,
  slug: string,
  excludeBookId?: string
): Promise<boolean> {
  if (await booksRepository.slugExistsForTenant(tenantId, slug, excludeBookId)) {
    return true;
  }
  return Boolean(await pagesRepository.findByTenantAndSlug(tenantId, `books/${slug}`));
}

class BooksService {
  async getBooks(
    tenantId: string,
    params: BooksListParams
  ): Promise<BooksListResponse> {
    const result = await booksRepository.findByTenantId(tenantId, params);
    const bookIds = result.books.map((b) => b.id);
    const authorIdsMap = await getAuthorIdsByBookIds(tenantId, bookIds);
    const categoryIdsMap = await getCategoryIdsByBookIds(tenantId, bookIds);
    return {
      ...result,
      books: result.books.map((row) => ({
        ...toBookResponse(
          row,
          authorIdsMap.get(row.id) ?? [],
          categoryIdsMap.get(row.id) ?? []
        ),
        // toBookResponse maps field-by-field, so anything not named there is
        // dropped before it reaches the client.
        bundles: row.bundles ?? [],
      })),
    };
  }

  async getBookById(bookId: string, tenantId: string): Promise<BookResponse> {
    const book = await booksRepository.findById(bookId);
    if (!book) {
      throw new NotFoundError("Book not found");
    }
    if (book.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }
    const authorIds = await getAuthorIdsByBookId(tenantId, bookId);
    const categoryIds = await getCategoryIdsByBookId(tenantId, bookId);
    const base = toBookResponse(book, authorIds, categoryIds);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "BOOK", bookId);
    return base;
  }

  /**
   * Get book by tenant and slug.
   */
  async getBookBySlug(
    tenantId: string,
    slug: string
  ): Promise<BookResponse | null> {
    let book = await booksRepository.findByTenantAndSlug(tenantId, slug);
    if (!book && slug.startsWith("books/")) {
      const slugWithoutPrefix = slug.replace(/^books\/?/, "");
      if (slugWithoutPrefix) {
        book = await booksRepository.findByTenantAndSlug(
          tenantId,
          slugWithoutPrefix
        );
      }
    }
    if (!book) return null;
    const authorIds = await getAuthorIdsByBookId(tenantId, book.id);
    const categoryIds = await getCategoryIdsByBookId(tenantId, book.id);
    const base = toBookResponse(book, authorIds, categoryIds);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "BOOK", book.id);
    return base;
  }

  /**
   * Create a new book.
   * Checks books_enabled entitlement (consumption happens on publish).
   */
  async createBook(
    tenantId: string,
    data: Omit<CreateBookInput, "tenant_id">
  ): Promise<BookResponse> {
    // Check books_enabled entitlement
    await entitlementsService.ensureBooleanEntitlement(
      tenantId,
      "books_enabled",
      "books",
      "Books are not enabled on your plan. Upgrade to add books."
    );

    // Taken by another book: add a short code rather than refuse.
    const slug = await uniqueSlug(
      requireSlug(normalizeBookSlug(data.slug) || data.title),
      (candidate) => bookSlugTaken(tenantId, candidate)
    );

    const { prices, ...createData } = data;
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BOOK",
      prices,
      { purchaseMode: (createData.purchase_mode as string) ?? "PAID" }
    );
    if (preparedPrices) {
      createData.price_inr = preparedPrices.legacy.price_inr;
      createData.price_usd = preparedPrices.legacy.price_usd;
      createData.discount_inr = preparedPrices.legacy.discount_inr;
      createData.discount_usd = preparedPrices.legacy.discount_usd;
    }

    const book = await db.transaction().execute(async (trx) => {
      const created = await booksRepository.create(
        {
          ...createData,
          slug,
          tenant_id: tenantId,
        },
        trx
      );

      if (preparedPrices) {
        await contentPricesService.applyPrepared(tenantId, "BOOK", created.id, preparedPrices, trx);
      } else {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BOOK",
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


    return toBookResponse(book, [], []);
  }

  async updateBook(
    bookId: string,
    tenantId: string,
    data: UpdateBookInput
  ): Promise<BookResponse> {
    const existing = await booksRepository.findById(bookId);
    if (!existing) {
      throw new NotFoundError("Book not found");
    }
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }

    let normalizedSlug =
      data.slug !== undefined ? normalizeBookSlug(data.slug) : undefined;
    // A new slug is cleaned to URL form, and gets a short code only if another
    // book in the tenant already uses it. The current one stays as stored.
    if (normalizedSlug !== undefined && normalizedSlug !== existing.slug) {
      normalizedSlug = requireSlug(normalizedSlug);
      if (normalizedSlug !== existing.slug) {
        normalizedSlug = await uniqueSlug(normalizedSlug, (candidate) =>
          bookSlugTaken(tenantId, candidate, bookId)
        );
      }
    }
    const slugChanged =
      normalizedSlug !== undefined && normalizedSlug !== existing.slug;

    const { author_ids: authorIds, category_ids: categoryIds, prices, ...rest } = data;

    const effectivePurchaseMode =
      (data.purchase_mode as string | undefined) ?? String(existing.purchase_mode ?? "PAID");
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "BOOK",
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
        await contentPricesService.applyPrepared(tenantId, "BOOK", bookId, preparedPrices, trx);
      } else if (legacyPriceTouched) {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "BOOK",
          bookId,
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
      const result = await booksRepository.update(bookId, updateData, tenantId, trx);
      if (!result) {
        throw new NotFoundError("Book not found");
      }
      // A book with its own landing page keeps it at the new address.
      if (slugChanged) {
        const page = await pagesRepository.findByTenantAndSlug(
          tenantId,
          `books/${existing.slug}`,
          trx
        );
        if (page) {
          await pagesRepository.update(page.id, { slug: `books/${normalizedSlug}` }, trx, tenantId);
        }
      }
      await syncPrices(trx);
      return result;
    });

    // Update author associations
    if (authorIds !== undefined) {
      await setBookAuthors(tenantId, bookId, authorIds);
    }

    // Update category associations
    if (categoryIds !== undefined) {
      await setBookCategories(tenantId, bookId, categoryIds);
    }

    const finalAuthorIds =
      authorIds !== undefined
        ? authorIds
        : await getAuthorIdsByBookId(tenantId, bookId);
    const finalCategoryIds =
      categoryIds !== undefined
        ? categoryIds
        : await getCategoryIdsByBookId(tenantId, bookId);

    return toBookResponse(updated, finalAuthorIds, finalCategoryIds);
  }

  /**
   * Toggle publish state of a book. Handles entitlement consumption:
   *  - DRAFT → PUBLISHED: check capacity, consume
   *  - PUBLISHED → DRAFT: release
   */
  async togglePublish(
    bookId: string,
    tenantId: string,
    publish: boolean
  ): Promise<BookResponse> {
    const book = await booksRepository.findById(bookId);
    if (!book) {
      throw new NotFoundError("Book not found");
    }
    if (book.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }

    const wasPublished = String(book.status) === "PUBLISHED";

    if (publish && !wasPublished) {
      // PAID books require a price in the store default currency before
      // publish (merged view: price book row or enabled legacy INR/USD column).
      const purchaseMode = String(book.purchase_mode ?? "PAID");
      if (purchaseMode === "PAID") {
        const priceCheck = await contentPricesService.checkDefaultCurrencyPrice(
          tenantId,
          "BOOK",
          bookId,
          { price_inr: book.price_inr, price_usd: book.price_usd }
        );
        if (!priceCheck.ok) {
          throw new BadRequestError(
            `Cannot publish a paid book without valid pricing. Set a price greater than 0 in your store default currency (${priceCheck.defaultCurrency}).`
          );
        }
      }
      // Publishing: ensure feature is enabled and capacity is available, then consume
      await entitlementsService.ensureBooleanEntitlement(
        tenantId,
        "books_enabled",
        "books",
        "Books are not enabled on your plan. Upgrade to add books."
      );
      const capacity = await entitlementsService.checkCapacity(
        tenantId,
        "books_count",
        1
      );
      if (!capacity.allowed) {
        throw new EntitlementForbiddenError(
          "Book limit reached. Upgrade your plan to add more books.",
          {
            code: "ENTITLEMENT_LIMIT_REACHED",
            productCode: "books_count",
            featureKey: "books",
            currentUsed: capacity.currentUsed,
            limit: capacity.limit,
            isUnlimited: capacity.isUnlimited,
          }
        );
      }
      await usageService.consume(tenantId, "books_count", 1, {
        resourceType: "BOOK",
        resourceId: bookId,
      });
    } else if (!publish && wasPublished) {
      // Unpublishing: release the consumed slot
      await usageService.release(tenantId, "books_count", 1, {
        resourceType: "BOOK",
        resourceId: bookId,
      });
    }

    const newStatus = publish ? "PUBLISHED" : "DRAFT";
    const updated = await booksRepository.update(bookId, {
      status: newStatus,
    });
    if (!updated) {
      throw new NotFoundError("Book not found");
    }
    const authorIds = await getAuthorIdsByBookId(tenantId, bookId);
    const categoryIds = await getCategoryIdsByBookId(tenantId, bookId);
    return toBookResponse(updated, authorIds, categoryIds);
  }

  async deleteBook(bookId: string, tenantId: string): Promise<void> {
    const book = await booksRepository.findById(bookId);
    if (!book) {
      throw new NotFoundError("Book not found");
    }
    if (book.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }

    const wasPublished = String(book.status) === "PUBLISHED";

    await db.transaction().execute(async (trx) => {
      await contentPricesRepository.deleteByEntity(tenantId, "BOOK", bookId, trx);

      const deleted = await booksRepository.delete(bookId, tenantId, trx);
      if (!deleted) {
        throw new NotFoundError("Book not found");
      }
    });

    // Only release if the book was published
    if (wasPublished) {
      await usageService.release(tenantId, "books_count", 1, {
        resourceType: "BOOK",
        resourceId: bookId,
      });
    }

  }

  async getRecommendations(
    bookId: string,
    tenantId: string
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > {
    const book = await booksRepository.findById(bookId);
    if (!book) {
      throw new NotFoundError("Book not found");
    }
    if (book.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }
    return booksRepository.findRecommendationsByBookId(tenantId, bookId);
  }

  async syncRecommendations(
    bookId: string,
    tenantId: string,
    recommendedBookIds: string[]
  ): Promise<
    Array<{
      id: string;
      bookId: string;
      title: string;
      slug: string;
      thumbnailUrl: string | null;
      sortOrder: number;
    }>
  > {
    const book = await booksRepository.findById(bookId);
    if (!book) {
      throw new NotFoundError("Book not found");
    }
    if (book.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this book");
    }
    return booksRepository.syncBookRecommendations(
      tenantId,
      bookId,
      recommendedBookIds
    );
  }
}

const booksService = new BooksService();
export default booksService;

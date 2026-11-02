import { sql } from "kysely";
import { db } from "../db/connection";
import { enrollment_status } from "../db/enums";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import * as bookmarkService from "./bookmark.service";
import booksRepository from "../repositories/books.repository";
import userSubscriptionService from "./user-subscription.service";
import { getPriceMapsForEntities } from "../utils/price-resolver";
import { parseS3Url, getS3ObjectBuffer } from "../utils/s3";

/**
 * List published books for a tenant with pagination.
 * Used for landing page book showcase section.
 */
export async function listPublishedBooks(
  tenantId: string,
  options?: {
    page?: number;
    limit?: number;
    sortBy?: "created_at" | "title" | "sort_order";
    sortOrder?: "asc" | "desc";
    purchaseMode?: "FREE" | "PAID";
    categorySlug?: string;
    bookmarkedOnly?: boolean;
    ownedOnly?: boolean;
  },
  memberId?: string
) {
  if (options?.bookmarkedOnly && !memberId) {
    throw new UnauthorizedError("Authentication required to filter by bookmarks");
  }
  if (options?.ownedOnly && !memberId) {
    throw new UnauthorizedError("Authentication required to filter by owned books");
  }

  // Subscribers with ownedOnly: fetch ALL published books (they own everything)
  let subscriberOverride = false;
  if (options?.ownedOnly && memberId) {
    subscriberOverride = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
  }

  const repoOptions = {
    ...options,
    bookmarkedOnly: options?.bookmarkedOnly,
    ownedOnly: subscriberOverride ? false : options?.ownedOnly,
    allowArchived: !!options?.ownedOnly,
    memberId: options?.bookmarkedOnly || (options?.ownedOnly && !subscriberOverride) ? memberId : undefined,
  };
  const result = await booksRepository.findPublishedBooks(tenantId, repoOptions);

  // Per-currency price maps (additive alongside legacy priceInr/priceUsd fields)
  const priceMaps = await getPriceMapsForEntities(
    tenantId,
    "BOOK",
    result.books.map((b) => ({
      id: b.id,
      price_inr: b.priceInr,
      price_usd: b.priceUsd,
      discount_inr: b.discountInr,
      discount_usd: b.discountUsd,
    }))
  );

  let bookmarkIds = new Set<string>();
  if (memberId && result.books.length > 0) {
    const ids = await bookmarkService.getBookmarkIds(tenantId, memberId);
    bookmarkIds = new Set(ids.bookIds);
  }

  if (memberId && result.books.length > 0) {
    // Subscribers have access to ALL books
    const isSubscriber = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
    if (isSubscriber) {
      return {
        ...result,
        books: result.books.map((b) => ({
          ...b,
          prices: priceMaps.get(b.id) ?? {},
          has_access: true,
          is_bookmarked: bookmarkIds.has(b.id),
        })),
      };
    }

    const bookIds = result.books.map((b) => b.id);
    const access = await db
      .selectFrom("book_access")
      .select("book_id")
      .where("tenant_id", "=", tenantId)
      .where("tenant_member_id", "=", memberId)
      .where("book_id", "in", bookIds)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .execute();
    const ownedIds = new Set(access.map((a) => a.book_id));
    const allOwned = options?.ownedOnly === true;
    return {
      ...result,
      books: result.books.map((b) => ({
        ...b,
        prices: priceMaps.get(b.id) ?? {},
        has_access: allOwned || ownedIds.has(b.id),
        is_bookmarked: bookmarkIds.has(b.id),
      })),
    };
  }

  return {
    ...result,
    books: result.books.map((b) => ({
      ...b,
      prices: priceMaps.get(b.id) ?? {},
      has_access: false,
      is_bookmarked: false,
    })),
  };
}

/**
 * Get a published book by slug for the given tenant.
 * Used by the book reader and future reader-related features (bookmarks, last seen, etc.).
 *
 * NOTE: For EPUB books, we no longer expose the URL to protect the content.
 * The frontend should use the /books/:slug/content endpoint to stream the book.
 */
export async function getBookBySlug(tenantId: string, slug: string, memberId?: string) {
  const normalizedSlug = slug.startsWith("books/") ? slug.replace(/^books\/?/, "") : slug;
  if (!normalizedSlug) {
    throw new NotFoundError("Book slug is required");
  }

  let book = await booksRepository.findPublishedByTenantAndSlug(tenantId, normalizedSlug);
  let isArchived = false;

  if (!book && memberId) {
    // Try including ARCHIVED, only serve if user has access
    book = await booksRepository.findPublishedByTenantAndSlug(tenantId, normalizedSlug, { allowArchived: true });
    if (book && book.status === "ARCHIVED") {
      const access = await db
        .selectFrom("book_access")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("book_id", "=", book.id)
        .where("status", "=", enrollment_status.ACTIVE)
        .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
        .executeTakeFirst();
      if (!access) {
        throw new NotFoundError("Published book not found for this slug");
      }
      isArchived = true;
    }
  }

  if (!book) {
    throw new NotFoundError("Published book not found for this slug");
  }

  let hasAccess = false;
  if (memberId) {
    if (isArchived) {
      hasAccess = true; // Already verified above
    } else {
      const access = await db
        .selectFrom("book_access")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("book_id", "=", book.id)
        .where("status", "=", enrollment_status.ACTIVE)
        .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
        .executeTakeFirst();
      hasAccess = !!access;
      // Subscription fallback
      if (!hasAccess) {
        hasAccess = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
      }
    }
  }

  // Per-currency price map (additive alongside legacy priceInr/priceUsd fields)
  const priceMaps = await getPriceMapsForEntities(tenantId, "BOOK", [
    {
      id: book.id,
      price_inr: book.priceInr,
      price_usd: book.priceUsd,
      discount_inr: book.discountInr,
      discount_usd: book.discountUsd,
    },
  ]);
  const prices = priceMaps.get(book.id) ?? {};

  // Trust the file_format column. Fall back to URL extension for legacy rows
  // that pre-date the column (defaults to EPUB on the schema, so this is a
  // defensive belt-and-braces check).
  const recordedFormat = String((book as { file_format?: string }).file_format ?? "");
  const urlLower = book.url?.toLowerCase() ?? "";
  const isPdf =
    recordedFormat === "PDF" ||
    (recordedFormat !== "EPUB" && urlLower.endsWith(".pdf"));
  const isEpub = !isPdf;

  if (isEpub) {
    return {
      ...book,
      prices,
      url: null,
      file_format: "EPUB" as const,
      hasEpubContent: true,
      has_access: hasAccess,
      is_archived: isArchived,
    };
  }

  return {
    ...book,
    prices,
    url: null,
    file_format: "PDF" as const,
    hasPdfContent: true,
    has_access: hasAccess,
    is_archived: isArchived,
  };
}

/**
 * Verify the member has active access to the given book.
 * Mirrors ensureEnrolled in course.service.ts.
 */
export async function ensureBookAccess(
  tenantId: string,
  bookId: string,
  memberId: string
): Promise<void> {
  const access = await db
    .selectFrom("book_access")
    .select("id")
    .where("tenant_id", "=", tenantId)
    .where("book_id", "=", bookId)
    .where("tenant_member_id", "=", memberId)
    .where("status", "=", enrollment_status.ACTIVE)
    .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
    .executeTakeFirst();
  if (!access) {
    // Subscription fallback: active subscriber has access to all books
    const hasSubscription = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
    if (!hasSubscription) {
      throw new ForbiddenError(
        "You must have access to this book to view its content"
      );
    }
  }
}

/**
 * Get book content as a Buffer for secure streaming.
 * Requires an authenticated member with active book access.
 * The S3 URL is never exposed to the client.
 */
export async function getBookContent(tenantId: string, slug: string, memberId: string): Promise<Buffer> {
  const normalizedSlug = slug.startsWith("books/") ? slug.replace(/^books\/?/, "") : slug;
  if (!normalizedSlug) {
    throw new NotFoundError("Book slug is required");
  }

  const book = await booksRepository.findPublishedByTenantAndSlug(tenantId, normalizedSlug, { allowArchived: true });
  if (!book) {
    throw new NotFoundError("Published book not found for this slug");
  }

  await ensureBookAccess(tenantId, book.id, memberId);

  if (!book.url) {
    throw new NotFoundError("Book content not available");
  }

  const s3Info = parseS3Url(book.url);
  if (!s3Info) {
    throw new NotFoundError("Invalid book content URL");
  }

  const buffer = await getS3ObjectBuffer(s3Info.bucket, s3Info.key);

  return buffer;
}

/**
 * Get book sample for public preview (no auth required). Returns the full file
 * buffer; page limiting is enforced client-side (epubjs samplePages for EPUB,
 * a react-pdf page cap for PDF). Controlled by the sample_enabled flag.
 */
export async function getBookSample(tenantId: string, slug: string): Promise<Buffer> {
  const normalizedSlug = slug.startsWith("books/") ? slug.replace(/^books\/?/, "") : slug;
  if (!normalizedSlug) {
    throw new NotFoundError("Book slug is required");
  }

  const book = await booksRepository.findPublishedByTenantAndSlug(tenantId, normalizedSlug);
  if (!book) {
    throw new NotFoundError("Published book not found for this slug");
  }

  // Check sample is enabled (default to true if column doesn't exist yet)
  if ((book as { sample_enabled?: boolean }).sample_enabled === false) {
    throw new NotFoundError("Sample preview is not available for this book");
  }

  if (!book.url) {
    throw new NotFoundError("Book content not available");
  }

  const s3Info = parseS3Url(book.url);
  if (!s3Info) {
    throw new NotFoundError("Invalid book content URL");
  }

  return getS3ObjectBuffer(s3Info.bucket, s3Info.key);
}

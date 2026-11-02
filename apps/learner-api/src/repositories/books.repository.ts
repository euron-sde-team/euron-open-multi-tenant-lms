import { sql } from "kysely";
import config from "../config";
import { db } from "../db/connection";
import { book_status, enrollment_status } from "../db/enums";
import bundlesRepository from "./bundles.repository";

function resolveThumbnailUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:")) return v;
  const base = config.THUMBNAILS_BASE_URL;
  if (!base) return v;
  const key = v.startsWith("/") ? v.slice(1) : v;
  return `${base}/${key}`;
}

function resolveProfileUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (v.startsWith("http")) return v;
  const base = config.TENANT_DETAILS_BASE_URL;
  if (!base) return v;
  const key = v.startsWith("/") ? v.slice(1) : v;
  return `${base}/${key}`;
}

/**
 * Author info for book display
 */
export interface BookAuthor {
  id: string;
  name: string;
  bio: string | null;
  expertise: string | null;
  profileUrl: string | null;
  socials: {
    linkedinUrl: string | null;
    twitterUrl: string | null;
    githubUrl: string | null;
    youtubeUrl: string | null;
    websiteUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
  };
  experiences: Array<{
    company: string;
    companyLogo: string | null;
    years: number;
    details: string | null;
  }>;
}

/**
 * Category info for book display
 */
export interface BookCategory {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
}

/**
 * Full book record with resolved authors and categories
 */
export interface BookWithRelations {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
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
  /** NULL = lifetime access. Never coerce to a day count, the templates
   * branch on null to render "Lifetime access". */
  validityDays: number | null;
  rating: number | null;
  ratingTotalCount: number | null;
  createdAt: string;
  updatedAt: string;
  // Resolved relations
  authorIds: string[];
  categoryIds: string[];
  authors: BookAuthor[];
  categories: BookCategory[];
}

// --- Pagination types ---

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
  purchaseMode?: "FREE" | "PAID";
  categorySlug?: string;
  /** When true, only return books the member has bookmarked. Requires memberId. */
  bookmarkedOnly?: boolean;
  /** When true, only return books the member has access to. Requires memberId. */
  ownedOnly?: boolean;
  /** When true, include ARCHIVED books alongside PUBLISHED. */
  allowArchived?: boolean;
  memberId?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PublishedBookListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  pages: number | null;
  priceInr: string | null;
  priceUsd: string | null;
  discountInr: string | null;
  discountUsd: string | null;
  purchaseMode: string;
  status: string;
  language: string[];
  author: string | null;
  authors: { id: string; name: string }[];
  /**
   * PUBLISHED bundles that include this book, so the card can show
   * "Part of <Bundle>". Empty when it belongs to none.
   */
  bundles: Array<{ id: string; title: string; slug: string }>;
}

export interface PublishedBooksResult {
  books: PublishedBookListItem[];
  pagination: PaginationMeta;
}

class BooksRepository {
  /**
   * Find published books for a tenant with pagination.
   * Returns book list items with author info.
   */
  async findPublishedBooks(
    tenantId: string,
    options: PaginationOptions = {}
  ): Promise<PublishedBooksResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 8));
    const sortBy = options.sortBy || "sort_order";
    const sortOrder = options.sortOrder || "asc";
    const offset = (page - 1) * limit;
    const categorySlug = options.categorySlug;

    let categoryId: string | undefined;
    if (categorySlug) {
      const cat = await db
        .selectFrom("categories")
        .select("id")
        .where("tenant_id", "=", tenantId)
        .where("slug", "=", categorySlug)
        .where("is_active", "=", true)
        .executeTakeFirst();
      categoryId = cat?.id;
    }

    const statusFilter = options.allowArchived
      ? [book_status.PUBLISHED, book_status.ARCHIVED]
      : [book_status.PUBLISHED];

    let countQuery = db
      .selectFrom("books")
      .select(db.fn.countAll().as("count"))
      .where("books.tenant_id", "=", tenantId)
      .where("books.status", "in", statusFilter);

    let booksQuery = db
      .selectFrom("books")
      .select([
        "books.id",
        "books.title",
        "books.slug",
        "books.description",
        "books.thumbnail_url",
        "books.pages",
        "books.price_inr",
        "books.price_usd",
        "books.discount_inr",
        "books.discount_usd",
        "books.purchase_mode",
        "books.status",
        "books.language",
        "books.author",
      ])
      .where("books.tenant_id", "=", tenantId)
      .where("books.status", "in", statusFilter);

    if (categoryId) {
      countQuery = countQuery
        .innerJoin("book_categories", "book_categories.book_id", "books.id")
        .where("book_categories.tenant_id", "=", tenantId)
        .where("book_categories.category_id", "=", categoryId);
      booksQuery = booksQuery
        .innerJoin("book_categories", "book_categories.book_id", "books.id")
        .where("book_categories.tenant_id", "=", tenantId)
        .where("book_categories.category_id", "=", categoryId);
    }

    if (options.purchaseMode) {
      countQuery = countQuery.where("books.purchase_mode", "=", options.purchaseMode);
      booksQuery = booksQuery.where("books.purchase_mode", "=", options.purchaseMode);
    }

    const bookmarkedOnly = options.bookmarkedOnly && options.memberId;
    if (bookmarkedOnly) {
      countQuery = countQuery
        .innerJoin("member_bookmarks", "member_bookmarks.book_id", "books.id")
        .where("member_bookmarks.tenant_id", "=", tenantId)
        .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
        .where("member_bookmarks.bookmark_type", "=", "BOOK");
      booksQuery = booksQuery
        .innerJoin("member_bookmarks", "member_bookmarks.book_id", "books.id")
        .where("member_bookmarks.tenant_id", "=", tenantId)
        .where("member_bookmarks.tenant_member_id", "=", options.memberId!)
        .where("member_bookmarks.bookmark_type", "=", "BOOK");
    }

    let ownedBookIds: string[] | undefined;
    const ownedOnly = options.ownedOnly && options.memberId;
    if (ownedOnly) {
      const access = await db
        .selectFrom("book_access")
        .select("book_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", options.memberId!)
        .where("status", "=", enrollment_status.ACTIVE)
        .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
        .execute();
      ownedBookIds = access.map((a) => a.book_id);
      if (ownedBookIds.length === 0) {
        return {
          books: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasMore: false,
          },
        };
      }
      countQuery = countQuery.where("books.id", "in", ownedBookIds);
      booksQuery = booksQuery.where("books.id", "in", ownedBookIds);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);
    const totalPages = Math.ceil(total / limit);

    const booksRaw = await booksQuery
      .orderBy(`books.${sortBy}`, sortOrder)
      .offset(offset)
      .limit(limit)
      .execute();

    // Get authors for these books (handle both books.id and id from join)
    const bookIds = booksRaw.map((b) => (b as { id: string }).id);

    const authorMap: Map<string, { id: string; name: string }[]> = new Map();

    if (bookIds.length > 0) {
      const authors = await db
        .selectFrom("book_authors")
        .innerJoin("instructors", "instructors.id", "book_authors.instructor_id")
        .select([
          "book_authors.book_id",
          "instructors.id as instructor_id",
          "instructors.name",
        ])
        .where("book_authors.tenant_id", "=", tenantId)
        .where("book_authors.book_id", "in", bookIds)
        .orderBy("book_authors.sort_order", "asc")
        .execute();

      // Map authors to each book
      for (const auth of authors) {
        const existing = authorMap.get(auth.book_id) || [];
        existing.push({ id: auth.instructor_id, name: auth.name });
        authorMap.set(auth.book_id, existing);
      }
    }

    // One batched lookup for the whole page, see the note in
    // findBundlesForContent about why this isn't done per card.
    const bundleMap = await bundlesRepository.findBundlesForContent(tenantId, {
      bookIds,
    });

    const books: PublishedBookListItem[] = booksRaw.map((book) => {
      const b = book as {
        id: string;
        title: string;
        slug: string;
        description: string | null;
        thumbnail_url: string | null;
        pages: number | null;
        price_inr: string | null;
        price_usd: string | null;
        discount_inr: string | null;
        discount_usd: string | null;
        purchase_mode: string;
        status: string;
        language: string[];
        author: string | null;
      };
      return {
      id: b.id,
      title: b.title,
      slug: b.slug,
      description: b.description,
      thumbnailUrl: resolveThumbnailUrl(b.thumbnail_url) ?? b.thumbnail_url,
      pages: b.pages,
      priceInr: b.price_inr,
      priceUsd: b.price_usd,
      discountInr: b.discount_inr,
      discountUsd: b.discount_usd,
      purchaseMode: b.purchase_mode,
      status: b.status,
      language: b.language || [],
      author: b.author,
      authors: authorMap.get(b.id) || [],
      bundles: bundleMap.get(b.id) ?? [],
    };
    });

    return {
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Find a published book by tenant ID and slug
   */
  async findPublishedByTenantAndSlug(
    tenantId: string,
    slug: string,
    options?: { allowArchived?: boolean }
  ): Promise<BookWithRelations | undefined> {
    const statusFilter = options?.allowArchived
      ? [book_status.PUBLISHED, book_status.ARCHIVED]
      : [book_status.PUBLISHED];
    // Get the book
    const book = await db
      .selectFrom("books")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("slug", "=", slug)
      .where("status", "in", statusFilter)
      .executeTakeFirst();

    if (!book) return undefined;

    // Get author IDs, instructor details, and social links
    const bookAuthors = await db
      .selectFrom("book_authors")
      .innerJoin("instructors", "instructors.id", "book_authors.instructor_id")
      .leftJoin("instructor_socials", "instructor_socials.instructor_id", "book_authors.instructor_id")
      .select([
        "book_authors.instructor_id as id",
        "instructors.name as name",
        "instructors.bio as bio",
        "instructors.expertise as expertise",
        "instructors.profile_url as profileUrl",
        "instructor_socials.linkedin_url",
        "instructor_socials.twitter_url",
        "instructor_socials.github_url",
        "instructor_socials.youtube_url",
        "instructor_socials.website_url",
        "instructor_socials.facebook_url",
        "instructor_socials.instagram_url",
      ])
      .where("book_authors.tenant_id", "=", tenantId)
      .where("book_authors.book_id", "=", book.id)
      .orderBy("book_authors.sort_order", "asc")
      .execute();

    // Get experiences for all book authors via join
    const authorExperiences = await db
      .selectFrom("instructor_experiences")
      .innerJoin("book_authors", "book_authors.instructor_id", "instructor_experiences.instructor_id")
      .select([
        "instructor_experiences.instructor_id",
        "instructor_experiences.company",
        "instructor_experiences.company_logo",
        "instructor_experiences.years",
        "instructor_experiences.details",
        "instructor_experiences.sort_order",
      ])
      .where("book_authors.tenant_id", "=", tenantId)
      .where("book_authors.book_id", "=", book.id)
      .orderBy("instructor_experiences.sort_order", "asc")
      .orderBy("instructor_experiences.created_at", "desc")
      .execute();

    // Group experiences by instructor_id
    const expMap = new Map<string, Array<{ company: string; companyLogo: string | null; years: number; details: string | null }>>();
    for (const e of authorExperiences) {
      const arr = expMap.get(e.instructor_id) || [];
      arr.push({
        company: e.company,
        companyLogo: resolveProfileUrl(e.company_logo),
        years: e.years,
        details: e.details ?? null,
      });
      expMap.set(e.instructor_id, arr);
    }

    // Get category IDs and category details
    const bookCategories = await db
      .selectFrom("book_categories")
      .innerJoin("categories", "categories.id", "book_categories.category_id")
      .select([
        "categories.id as id",
        "categories.name as name",
        "categories.slug as slug",
        "categories.icon_url as iconUrl",
      ])
      .where("book_categories.tenant_id", "=", tenantId)
      .where("book_categories.book_id", "=", book.id)
      .execute();

    return {
      id: book.id,
      tenantId: book.tenant_id,
      slug: book.slug,
      title: book.title,
      author: book.author,
      description: book.description,
      summary: book.summary,
      pages: book.pages,
      url: book.url,
      pageImages: book.page_images || [],
      priceInr: book.price_inr,
      priceUsd: book.price_usd,
      discountInr: book.discount_inr,
      discountUsd: book.discount_usd,
      purchaseMode: book.purchase_mode,
      status: book.status,
      language: book.language || ["English"],
      thumbnailUrl: book.thumbnail_url,
      previewUrl: book.preview_url,
      sortOrder: book.sort_order,
      validityDays: book.validity_days == null ? null : Number(book.validity_days),
      rating: book.rating != null ? parseFloat(String(book.rating)) : null,
      ratingTotalCount: book.rating_total_count != null ? Number(book.rating_total_count) : null,
      createdAt: new Date(book.created_at as unknown as string).toISOString(),
      updatedAt: new Date(book.updated_at as unknown as string).toISOString(),
      authorIds: bookAuthors.map((a) => a.id),
      categoryIds: bookCategories.map((c) => c.id),
      authors: bookAuthors.map((a) => ({
        id: a.id,
        name: a.name,
        bio: a.bio,
        expertise: a.expertise ?? null,
        profileUrl: resolveProfileUrl(a.profileUrl),
        socials: {
          linkedinUrl: a.linkedin_url ?? null,
          twitterUrl: a.twitter_url ?? null,
          githubUrl: a.github_url ?? null,
          youtubeUrl: a.youtube_url ?? null,
          websiteUrl: a.website_url ?? null,
          facebookUrl: a.facebook_url ?? null,
          instagramUrl: a.instagram_url ?? null,
        },
        experiences: expMap.get(a.id) || [],
      })),
      categories: bookCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        iconUrl: c.iconUrl,
      })),
    };
  }

  /**
   * Find recommended books for a book (for "More books you might like" section)
   */
  async findRecommendationsByBookId(
    tenantId: string,
    bookId: string
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
    const rows = await db
      .selectFrom("book_recommendations")
      .innerJoin("books", "books.id", "book_recommendations.recommended_book_id")
      .select([
        "book_recommendations.id as id",
        "book_recommendations.recommended_book_id as bookId",
        "books.title as title",
        "books.slug as slug",
        "books.thumbnail_url as thumbnailUrl",
        "book_recommendations.sort_order as sortOrder",
      ])
      .where("book_recommendations.tenant_id", "=", tenantId)
      .where("book_recommendations.book_id", "=", bookId)
      .orderBy("book_recommendations.sort_order", "asc")
      .execute();

    return rows.map((r: { id: unknown; bookId: unknown; title: unknown; slug: unknown; thumbnailUrl: unknown; sortOrder: unknown }) => ({
      id: String(r.id),
      bookId: String(r.bookId),
      title: String(r.title),
      slug: String(r.slug),
      thumbnailUrl: (r.thumbnailUrl as string | null) ?? null,
      sortOrder: Number(r.sortOrder),
    }));
  }
}

export default new BooksRepository();

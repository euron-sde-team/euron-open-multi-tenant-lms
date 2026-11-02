import { customAlphabet } from "nanoid";
import { buildCoursePageSections } from "../lib/course-page-template";
import { BadRequestError } from "../errors/bad-request.error";
import { EntitlementForbiddenError } from "../errors/entitlement-forbidden.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { db } from "../db/connection";
import { course_status } from "../db/enums";
import pagesRepository from "../repositories/pages.repository";
import {
  getCategoryIdsByCourseId,
  getCategoryIdsByCourseIds,
  setCourseCategories,
} from "../repositories/course-categories.repository";
import { getCourseRatingSummary } from "../repositories/course-reviews.repository";
import coursesRepository, {
  type CourseRow,
  type CreateCourseInput,
  type UpdateCourseInput,
  type CoursesListParams,
} from "../repositories/courses.repository";
import type { Transaction } from "kysely";
import type { DB } from "../db/types";
import contentPricesRepository from "../repositories/content-prices.repository";
import uploadService from "./upload.service";
import contentPricesService, { type ContentPriceDto } from "./content-prices.service";
import entitlementsService from "./entitlements.service";
import logger from "../utils/logger";
import usageService from "./usage.service";
import { requireSlug, uniqueSlug } from "../utils/slug";

const course_mode = {
  SELF_PACED: "SELF_PACED",
  LIVE: "LIVE",
  HYBRID: "HYBRID",
} as const;

/** Short random suffix for slug uniqueness (e.g. "x3k9") */
const slugSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 4);

export interface CourseResponse {
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
  purchaseMode: string;
  status: string;
  mode: string;
  difficulty: string;
  courseType: string;
  language: string[];
  thumbnailUrl: string | null;
  secondaryThumbnailUrl: string | null;
  previewUrl: string | null;
  thumbnailKey: string | null;
  secondaryThumbnailKey: string | null;
  previewKey: string | null;
  duration: string | null;
  learningOutcomes: string[];
  prerequisites: string[];
  classTiming: string | null;
  startDate: string | null;
  sortOrder: number;
  validityDays: number | null;
  lmsTemplateId: string | null;
  lmsSettings: unknown | null;
  categoryIds: string[];
  /**
   * Landing page id (tenant_pages row with slug "courses/<slug>"). Set by the
   * list endpoint via correlated subquery; null when the page row is missing.
   * Single-fetch endpoints omit it.
   */
  pageId?: string | null;
  averageRating?: number;
  totalRatings?: number;
  /** Multi-currency price book; attached on detail responses. */
  prices?: ContentPriceDto[];
  createdAt: string;
  updatedAt: string;
}

/** A list row carries the extras the list endpoint adds on top of CourseResponse. */
export type CourseListItemResponse = CourseResponse & {
  pageId?: string | null;
  /** Bundles containing this course, drives the "Part of X" chip. */
  bundles?: Array<{ id: string; title: string; slug: string }>;
};

export interface CoursesListResponse {
  courses: CourseListItemResponse[];
  total: number;
  page: number;
  limit: number;
}

function toCourseResponse(row: CourseRow, categoryIds: string[] = []): CourseResponse {
  const thumbnailsBucket = uploadService.getThumbnailsBucket();
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
    purchaseMode: String(row.purchase_mode),
    status: String(row.status),
    mode: String(row.mode),
    difficulty: String(row.difficulty),
    courseType: String(row.course_type ?? "NORMAL"),
    language: Array.isArray(row.language) ? row.language : [],
    thumbnailUrl: uploadService.getPublicUrl(thumbnailsBucket, row.thumbnail_key),
    secondaryThumbnailUrl: uploadService.getPublicUrl(thumbnailsBucket, row.secondary_thumbnail_key),
    previewUrl: uploadService.getPublicUrl(thumbnailsBucket, row.preview_key),
    thumbnailKey: row.thumbnail_key ?? null,
    secondaryThumbnailKey: row.secondary_thumbnail_key ?? null,
    previewKey: row.preview_key ?? null,
    duration: row.duration,
    learningOutcomes: Array.isArray(row.learning_outcomes) ? row.learning_outcomes : [],
    prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites : [],
    classTiming: row.class_timing,
    startDate: row.start_date,
    sortOrder: Number(row.sort_order ?? 0),
    validityDays: row.validity_days == null ? null : Number(row.validity_days),
    lmsTemplateId: row.lms_template_id ?? null,
    lmsSettings: row.lms_settings ? (typeof row.lms_settings === "string" ? JSON.parse(row.lms_settings as string) : row.lms_settings) : null,
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
 * Normalize course slug for storage: always store the direct slug (e.g. "python-masterclass").
 * Convention: tenant_pages.slug = "courses/<slug>" (full path); courses.slug = "<slug>" only.
 * Lookup: by-slug receives "<slug>"; pages pass extractCourseSlug(page.slug) so page and DB stay consistent.
 */
function normalizeCourseSlug(slug: string): string {
  if (!slug || typeof slug !== "string") return slug;
  const trimmed = slug.trim();
  if (trimmed.startsWith("courses/")) {
    const without = trimmed.replace(/^courses\/?/, "").trim();
    return without || trimmed;
  }
  return trimmed;
}

/**
 * Entitlement product consumed per published course. Only self-paced courses
 * exist on this platform, so every course counts against one product.
 */
function productCodeForCourseCount(_mode: string, _courseType?: string): string {
  return "self_paced_courses_count";
}

/**
 * Ensure the feature is enabled and capacity remains; throws if not allowed.
 * Only self-paced courses are supported (live, hybrid and shorts are not part
 * of this platform).
 */
async function ensureCanCreateCourse(
  tenantId: string,
  mode: string,
  courseType?: string
): Promise<void> {
  if (mode !== course_mode.SELF_PACED) {
    throw new BadRequestError("Only self-paced courses are supported");
  }
  if (courseType === "SHORTS" || courseType === "WEBINAR") {
    throw new BadRequestError(`Course type ${courseType} is not supported`);
  }
  await entitlementsService.ensureSelfPacedCoursesEnabled(tenantId);
  const capacity = await entitlementsService.checkCapacity(
    tenantId,
    "self_paced_courses_count",
    1
  );
  if (!capacity.allowed) {
    throw new EntitlementForbiddenError(
      "Course limit reached. Upgrade your plan to add more courses.",
      {
        code: "ENTITLEMENT_LIMIT_REACHED",
        productCode: "self_paced_courses_count",
        featureKey: "self_paced_courses",
        currentUsed: capacity.currentUsed,
        limit: capacity.limit,
        isUnlimited: capacity.isUnlimited,
      }
    );
  }
}

class CoursesService {
  async getCourses(
    tenantId: string,
    params: CoursesListParams
  ): Promise<CoursesListResponse> {
    const result = await coursesRepository.findByTenantId(tenantId, params);
    const courseIds = result.courses.map((c) => c.id);
    const categoryIdsMap = await getCategoryIdsByCourseIds(tenantId, courseIds);
    return {
      ...result,
      courses: result.courses.map((row) => ({
        ...toCourseResponse(row, categoryIdsMap.get(row.id) ?? []),
        pageId: row.page_id ?? null,
        // toCourseResponse maps field-by-field, so anything not named here is
        // dropped before it reaches the client.
        bundles: row.bundles ?? [],
      })),
    };
  }

  async getCourseById(courseId: string, tenantId: string): Promise<CourseResponse> {
    const course = await coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    if (course.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this course");
    }
    const categoryIds = await getCategoryIdsByCourseId(tenantId, courseId);
    const base = toCourseResponse(course, categoryIds);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "COURSE", courseId);
    const ratingSummary = await getCourseRatingSummary(tenantId, courseId);
    if (ratingSummary.totalRatings > 0) {
      base.averageRating = ratingSummary.averageRating;
      base.totalRatings = ratingSummary.totalRatings;
    }
    return base;
  }

  /**
   * Get course by tenant and slug (e.g. for linking page slug to LMS course).
   * If slug starts with "courses/", also tries without that prefix so page slug "courses/python-mastery"
   * matches course row with slug "python-mastery".
   * Returns null if not found (caller can show default template).
   */
  async getCourseBySlug(
    tenantId: string,
    slug: string
  ): Promise<CourseResponse | null> {
    let course = await coursesRepository.findByTenantAndSlug(tenantId, slug);
    if (!course && slug.startsWith("courses/")) {
      const slugWithoutPrefix = slug.replace(/^courses\/?/, "");
      if (slugWithoutPrefix) {
        course = await coursesRepository.findByTenantAndSlug(
          tenantId,
          slugWithoutPrefix
        );
      }
    }
    if (!course) return null;
    const categoryIds = await getCategoryIdsByCourseId(tenantId, course.id);
    const base = toCourseResponse(course, categoryIds);
    base.prices = await contentPricesService.getEntityPrices(tenantId, "COURSE", course.id);
    const ratingSummary = await getCourseRatingSummary(tenantId, course.id);
    if (ratingSummary.totalRatings > 0) {
      base.averageRating = ratingSummary.averageRating;
      base.totalRatings = ratingSummary.totalRatings;
    }
    return base;
  }

  /**
   * Create a course and its associated tenant_page in a single transaction.
   * If the slug already exists, a short random suffix is appended for uniqueness.
   */
  async createCourse(
    tenantId: string,
    data: Omit<CreateCourseInput, "tenant_id">
  ): Promise<CourseResponse> {
    const mode = (data.mode as string) ?? course_mode.SELF_PACED;
    const courseType = data.course_type as string | undefined;
    // Only check feature-enabled + capacity (don't consume yet, consumption
    // happens on publish so draft courses don't count against limits).
    await ensureCanCreateCourse(tenantId, mode, courseType);

    const { prices, ...createData } = data;
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "COURSE",
      prices,
      { purchaseMode: (createData.purchase_mode as string) ?? "PAID" }
    );
    if (preparedPrices) {
      createData.price_inr = preparedPrices.legacy.price_inr;
      createData.price_usd = preparedPrices.legacy.price_usd;
      createData.discount_inr = preparedPrices.legacy.discount_inr;
      createData.discount_usd = preparedPrices.legacy.discount_usd;
    }

    let courseSlug = normalizeCourseSlug(data.slug);

    const course = await db.transaction().execute(async (trx) => {
      // Ensure course slug uniqueness, append suffix if needed
      const courseSlugTaken = await coursesRepository.slugExistsForTenant(
        tenantId,
        courseSlug,
        undefined,
        trx
      );
      if (courseSlugTaken) {
        courseSlug = `${courseSlug}-${slugSuffix()}`;
      }

      const pageSlug = `courses/${courseSlug}`;

      // Create course record
      const created = await coursesRepository.create(
        { ...createData, slug: courseSlug, tenant_id: tenantId },
        trx
      );

      if (preparedPrices) {
        await contentPricesService.applyPrepared(tenantId, "COURSE", created.id, preparedPrices, trx);
      } else {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "COURSE",
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

      // Create associated tenant_page record (skip if already exists, handles
      // orphaned pages from previous incomplete deletes)
      const existingPage = await pagesRepository.findByTenantAndSlug(
        tenantId,
        pageSlug,
        trx
      );
      if (!existingPage) {
        await pagesRepository.create(
          {
            tenant_id: tenantId,
            slug: pageSlug,
            title: data.title,
            // A real template, not an empty array. The admin UI used to fill
            // this in from the browser after the create returned, so a course
            // created by the API, or by the assistant, had a landing page
            // with nothing on it and 404'd on the storefront. See
            // lib/course-page-template.ts.
            sections: buildCoursePageSections({
              title: data.title as string,
              subtitle: (createData.subtitle as string | undefined) ?? null,
              description: (createData.description as string | undefined) ?? null,
              mode,
              difficulty: (createData.difficulty as string | undefined) ?? null,
              priceInr: (createData.price_inr as number | undefined) ?? null,
              priceUsd: (createData.price_usd as number | undefined) ?? null,
            }),
            theme: {},
            seo: { title: data.title },
            is_published: false,
          },
          trx
        );
      }

      return created;
    });


    return toCourseResponse(course, []);
  }

  /**
   * Update a course. When the slug changes, both the course slug and its
   * associated tenant_page slug are updated atomically in a transaction.
   */
  async updateCourse(
    courseId: string,
    tenantId: string,
    data: UpdateCourseInput
  ): Promise<CourseResponse> {
    const existing = await coursesRepository.findById(courseId);
    if (!existing) {
      throw new NotFoundError("Course not found");
    }
    if (existing.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this course");
    }

    const wasPublished = String(existing.status) === "PUBLISHED";
    let oldProductCode: string | undefined;
    let newProductCode: string | undefined;
    let needsEntitlementSwap = false;

    if (wasPublished) {
      const oldMode = String(existing.mode) || course_mode.SELF_PACED;
      const oldCourseType = String(existing.course_type ?? "NORMAL");
      oldProductCode = productCodeForCourseCount(oldMode, oldCourseType);

      const newMode = data.mode !== undefined ? String(data.mode) : oldMode;
      const newCourseType = data.course_type !== undefined ? String(data.course_type) : oldCourseType;
      newProductCode = productCodeForCourseCount(newMode, newCourseType);

      if (oldProductCode !== newProductCode) {
        needsEntitlementSwap = true;
        // Check capacity for the new product code before proceeding
        await ensureCanCreateCourse(tenantId, newMode, newCourseType);
      }
    }

    let normalizedSlug =
      data.slug !== undefined ? normalizeCourseSlug(data.slug) : undefined;
    // A new slug is cleaned to URL form; the current one stays exactly as stored.
    if (normalizedSlug !== undefined && normalizedSlug !== existing.slug) {
      normalizedSlug = requireSlug(normalizedSlug);
    }
    const slugChanged =
      normalizedSlug !== undefined && normalizedSlug !== existing.slug;

    const { category_ids: categoryIds, prices, ...rest } = data;

    const effectivePurchaseMode =
      (data.purchase_mode as string | undefined) ?? String(existing.purchase_mode ?? "PAID");
    const preparedPrices = await contentPricesService.prepareFromPayload(
      tenantId,
      "COURSE",
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
        await contentPricesService.applyPrepared(tenantId, "COURSE", courseId, preparedPrices, trx);
      } else if (legacyPriceTouched) {
        await contentPricesService.syncFromLegacyColumns(
          tenantId,
          "COURSE",
          courseId,
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

    let updated: CourseRow | null;

    if (slugChanged) {
      // Slug changed, update course + page slug atomically in a transaction
      updated = await db.transaction().execute(async (trx) => {
        // Taken by another course, or by a stray page at that address: add a
        // short code rather than refuse. Otherwise the slug is kept as asked.
        normalizedSlug = await uniqueSlug(normalizedSlug!, async (candidate) =>
          (await coursesRepository.slugExistsForTenant(tenantId, candidate, courseId, trx)) ||
          Boolean(await pagesRepository.findByTenantAndSlug(tenantId, `courses/${candidate}`, trx))
        );

        // Update course with new slug
        const updateData = { ...rest, slug: normalizedSlug };
        const result = await coursesRepository.update(courseId, updateData, trx);
        if (!result) {
          throw new NotFoundError("Course not found");
        }

        // Find and update associated page slug to stay in sync
        const oldPageSlug = `courses/${existing.slug}`;
        const newPageSlug = `courses/${normalizedSlug}`;
        const page = await pagesRepository.findByTenantAndSlug(
          tenantId,
          oldPageSlug,
          trx
        );
        if (page) {
          await pagesRepository.update(page.id, { slug: newPageSlug }, trx, tenantId);
        }

        await syncPrices(trx);

        return result;
      });
    } else {
      // No slug change, update course + price book atomically
      const updateData = {
        ...rest,
        ...(normalizedSlug !== undefined && { slug: normalizedSlug }),
      };
      updated = await db.transaction().execute(async (trx) => {
        const result = await coursesRepository.update(courseId, updateData, trx);
        if (!result) {
          throw new NotFoundError("Course not found");
        }
        await syncPrices(trx);
        return result;
      });
    }

    // Handle entitlement swap if needed
    if (needsEntitlementSwap && oldProductCode && newProductCode) {
      await usageService.consume(tenantId, newProductCode, 1, {
        resourceType: "COURSE",
        resourceId: courseId,
      });
      await usageService.release(tenantId, oldProductCode, 1, {
        resourceType: "COURSE",
        resourceId: courseId,
      });
    }

    if (categoryIds !== undefined) {
      await setCourseCategories(tenantId, courseId, categoryIds);
    }
    const finalCategoryIds =
      categoryIds !== undefined
        ? categoryIds
        : await getCategoryIdsByCourseId(tenantId, courseId);
    return toCourseResponse(updated, finalCategoryIds);
  }

  /**
   * Toggle publish state of a course. Handles entitlement consumption:
   *  - DRAFT → PUBLISHED: check capacity, consume
   *  - PUBLISHED → DRAFT: release
   */
  async togglePublish(
    courseId: string,
    tenantId: string,
    publish: boolean
  ): Promise<CourseResponse> {
    const course = await coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    if (course.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this course");
    }

    const mode = String(course.mode) || course_mode.SELF_PACED;
    const courseType = String(course.course_type ?? "NORMAL");
    const productCode = productCodeForCourseCount(mode, courseType);
    const wasPublished = String(course.status) === "PUBLISHED";

    if (publish && !wasPublished) {
      // PAID courses require a price in the store default currency before
      // publish (merged view: price book row or enabled legacy INR/USD column).
      const purchaseMode = String(course.purchase_mode ?? "PAID");
      if (purchaseMode === "PAID") {
        const priceCheck = await contentPricesService.checkDefaultCurrencyPrice(
          tenantId,
          "COURSE",
          courseId,
          { price_inr: course.price_inr, price_usd: course.price_usd }
        );
        if (!priceCheck.ok) {
          throw new BadRequestError(
            `Cannot publish a paid course without valid pricing. Set a price greater than 0 in your store default currency (${priceCheck.defaultCurrency}).`
          );
        }
      }
      // Publishing: ensure feature is enabled and capacity is available, then consume
      await ensureCanCreateCourse(tenantId, mode, courseType);
      await usageService.consume(tenantId, productCode, 1, {
        resourceType: "COURSE",
        resourceId: courseId,
      });
    } else if (!publish && wasPublished) {
      // Unpublishing: release the consumed slot
      await usageService.release(tenantId, productCode, 1, {
        resourceType: "COURSE",
        resourceId: courseId,
      });
    }

    const newStatus = publish ? course_status.PUBLISHED : course_status.DRAFT;
    const updated = await coursesRepository.update(courseId, {
      status: newStatus,
    });
    if (!updated) {
      throw new NotFoundError("Course not found");
    }

    // The landing page follows the course. A PUBLISHED course whose page is
    // still a draft is a course learners can be charged for but cannot see.
    // found live: an agent-launched course reached PUBLISHED while its
    // `courses/{slug}` page (9 finished sections) stayed dark, so the public
    // URL 404'd. Unpublish hides the page again for the same reason in
    // reverse. Best-effort: a missing page must not fail the status change
    // that already happened.
    try {
      const page = await pagesRepository.findByTenantAndSlug(
        tenantId,
        `courses/${updated.slug}`
      );
      if (page && Boolean(page.is_published) !== publish) {
        await pagesRepository.update(page.id, { is_published: publish }, undefined, tenantId);
      }
    } catch (err) {
      logger.warn(
        `togglePublish: course ${courseId} page sync failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    const categoryIds = await getCategoryIdsByCourseId(tenantId, courseId);
    return toCourseResponse(updated, categoryIds);
  }

  /**
   * Delete a course and its associated page in a transaction, then release
   * the course count. Videos live in EVS or at external URLs and are left
   * untouched.
   */
  async deleteCourse(courseId: string, tenantId: string): Promise<void> {
    const course = await coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError("Course not found");
    }
    if (course.tenant_id !== tenantId) {
      throw new ForbiddenError("You do not have access to this course");
    }

    const wasPublished = String(course.status) === "PUBLISHED";

    // Transaction: delete page + course atomically (cascade removes lectures).
    await db.transaction().execute(async (trx) => {
      const pageSlug = `courses/${course.slug}`;
      const page = await pagesRepository.findByTenantAndSlug(
        tenantId,
        pageSlug,
        trx
      );
      if (page) {
        await pagesRepository.delete(page.id, trx, tenantId);
      }

      await contentPricesRepository.deleteByEntity(tenantId, "COURSE", courseId, trx);

      // SEQUENTIAL COURSES: anything waiting on this course now waits on
      // nothing. There is no FK to cascade here (unlocks_after_id is a typed
      // pair, it can point at a course, a book or a test series), so the
      // chain has to be healed by hand.
      //
      // Heal it TOWARDS OPEN. Deleting B in A → B → C must not leave C
      // pointing at a course that no longer exists: C's learners would be
      // waiting forever on something they can never finish. C becomes a start
      // instead. (The read path also treats a dangling id as unlocked, so this
      // is defence in depth, but a stale row is a trap for the next person to
      // read the table.)
      await trx
        .updateTable("courses")
        .set({ unlocks_after_id: null, unlocks_after_type: null })
        .where("tenant_id", "=", tenantId)
        .where("unlocks_after_id", "=", courseId)
        .execute();

      const deleted = await coursesRepository.delete(courseId, trx, tenantId);
      if (!deleted) {
        throw new NotFoundError("Course not found");
      }
    });

    // Release course count if the course was published
    if (wasPublished) {
      const courseType = String(course.course_type ?? "NORMAL");
      const productCode = productCodeForCourseCount(String(course.mode), courseType);
      await usageService.release(tenantId, productCode, 1, {
        resourceType: "COURSE",
        resourceId: courseId,
      });
    }

  }
}

const coursesService = new CoursesService();
export default coursesService;

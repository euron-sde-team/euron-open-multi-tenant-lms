/**
 * Public course service, reads published course data (no auth required).
 * Serves the full LMS tree to the user-facing site.
 * Also handles course reviews and QnA (list + create with auth).
 */

import { sql } from "kysely";
import config from "../config";
import { db } from "../db/connection";
import { enrollment_status } from "../db/enums";
import { BadRequestError } from "../errors/bad-request.error";
import { ForbiddenError } from "../errors/forbidden.error";
import { NotFoundError } from "../errors/not-found.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import * as assignmentsRepo from "../repositories/assignments.repository";
import * as quizzesRepo from "../repositories/quizzes.repository";
import * as bookmarkService from "./bookmark.service";
import * as coursesRepo from "../repositories/courses.repository";
import * as s3Service from "./s3.service";
import * as progressRepo from "../repositories/progress.repository";
import pagesRepository from "../repositories/pages.repository";
import tenantRepository from "../repositories/tenant.repository";
import userSubscriptionService from "./user-subscription.service";
import courseUnlockService from "./course-unlock.service";
import type { LockState } from "./course-unlock.service";
import { getPriceMapsForEntities } from "../utils/price-resolver";
import { ulid } from "ulid";

interface CourseProgress {
  percent: number;
  completed: number;
  total: number;
}

/**
 * A member's progress per course: completed lectures, assignments and quizzes
 * over the course's total. The same rule My Learning's "Completed" filter uses.
 */
async function getProgressByCourse(
  tenantId: string,
  memberId: string,
  courseIds: string[]
): Promise<Map<string, CourseProgress>> {
  const progress = new Map<string, CourseProgress>();
  if (courseIds.length === 0) return progress;
  const [
    lectureCounts,
    assignmentLessonCounts,
    quizLessonCounts,
    lectureCompletedCounts,
    assignmentCompletedCounts,
    quizCompletedCounts,
  ] = await Promise.all([
    coursesRepo.getLectureCountsByCourseIds(tenantId, courseIds),
    coursesRepo.getAssignmentLessonCountsByCourseIds(tenantId, courseIds),
    coursesRepo.getQuizLessonCountsByCourseIds(tenantId, courseIds),
    progressRepo.getCompletedCountsByCourses(tenantId, memberId, courseIds),
    progressRepo.getAssignmentCompletedCountsByCourses(tenantId, memberId, courseIds),
    progressRepo.getQuizCompletedCountsByCourses(tenantId, memberId, courseIds),
  ]);
  for (const id of courseIds) {
    const total =
      (lectureCounts.get(id) ?? 0) +
      (assignmentLessonCounts.get(id) ?? 0) +
      (quizLessonCounts.get(id) ?? 0);
    const completed =
      (lectureCompletedCounts.get(id) ?? 0) +
      (assignmentCompletedCounts.get(id) ?? 0) +
      (quizCompletedCounts.get(id) ?? 0);
    progress.set(id, {
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
    });
  }
  return progress;
}

class CourseService {
  /**
   * List published courses for a tenant with pagination.
   * Used for landing page course cards section and course listing pages.
   * Optionally filter by course mode and/or course type.
   */
  async listPublishedCourses(
    tenantId: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: "created_at" | "title" | "sort_order";
      sortOrder?: "asc" | "desc";
      mode?: "SELF_PACED";
      courseType?: "NORMAL" | "PROJECT";
      categorySlug?: string;
      bookmarkedOnly?: boolean;
      enrolledOnly?: boolean;
      purchaseMode?: "FREE" | "PAID";
      completedOnly?: boolean;
      /**
       * Tenant-level "enrolled courses only" gate (set from req.tenant). When
       * true, learners on this tenant may ONLY ever see the courses they are
       * enrolled in, the public catalog is off. This forces enrolledOnly for
       * everyone (including subscribers) and cannot be relaxed by the caller.
       */
      enforceEnrolledOnly?: boolean;
    },
    memberId?: string
  ) {
    // Absolute tenant gate: when the tenant restricts learners to enrolled
    // courses, force enrolled-only listing regardless of what the caller asked
    // for, and disable the subscriber "see everything" bypass below. An
    // unauthenticated visitor gets nothing (no catalog to browse).
    const enforceEnrolledOnly = options?.enforceEnrolledOnly === true;
    if (enforceEnrolledOnly && !memberId) {
      return {
        courses: [],
        pagination: {
          page: options?.page ?? 1,
          limit: options?.limit ?? 8,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    }
    if (enforceEnrolledOnly) {
      options = { ...options, enrolledOnly: true };
    }

    if (options?.bookmarkedOnly && !memberId) {
      throw new UnauthorizedError("Authentication required to filter by bookmarks");
    }
    if (options?.enrolledOnly && !memberId) {
      throw new UnauthorizedError("Authentication required to filter by enrolled courses");
    }
    if (options?.completedOnly && !memberId) {
      throw new UnauthorizedError("Authentication required to filter by completed courses");
    }

    const repoOptions = {
      ...options,
      bookmarkedOnly: options?.bookmarkedOnly,
      enrolledOnly: options?.enrolledOnly,
      purchaseMode: options?.purchaseMode,
      allowArchived: !!options?.enrolledOnly, // Show archived courses in "my courses"
      memberId: options?.bookmarkedOnly || options?.enrolledOnly ? memberId : undefined,
    };
    let result = await coursesRepo.findPublishedCourses(tenantId, repoOptions);

    let bookmarkIds = new Set<string>();
    if (memberId && result.courses.length > 0) {
      const ids = await bookmarkService.getBookmarkIds(tenantId, memberId);
      bookmarkIds = new Set(ids.courseIds);
    }

    // Check subscriber status once (used for has_access enrichment and enrolledOnly)
    let isSubscriber = false;
    if (memberId) {
      isSubscriber = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
    }

    // When enrolledOnly: subscribers get ALL published courses, others get enrolled only.
    // EXCEPTION: when the tenant enforces enrolled-only, even subscribers stay
    // scoped to their enrollments, the "see everything" bypass is disabled.
    if (options?.enrolledOnly && memberId && !enforceEnrolledOnly) {
      if (isSubscriber && result.courses.length === 0) {
        // Subscriber with enrolledOnly: fetch ALL published courses instead
        const allResult = await coursesRepo.findPublishedCourses(tenantId, {
          ...options,
          enrolledOnly: false,
          memberId: undefined,
          allowArchived: true,
        });
        result = allResult;
      }
    }

    // Per-currency price maps (additive alongside legacy priceInr/priceUsd fields)
    const priceMaps = await getPriceMapsForEntities(
      tenantId,
      "COURSE",
      result.courses.map((c) => ({
        id: c.id,
        price_inr: c.priceInr,
        price_usd: c.priceUsd,
        discount_inr: c.discountInr,
        discount_usd: c.discountUsd,
      }))
    );

    // When enrolledOnly, add progress and optionally filter by completedOnly
    if (options?.enrolledOnly && memberId && result.courses.length > 0) {
      const progress = await getProgressByCourse(
        tenantId,
        memberId,
        result.courses.map((c) => c.id)
      );

      let courses = result.courses.map((c) => {
        const p = progress.get(c.id);
        return {
          ...c,
          prices: priceMaps.get(c.id) ?? {},
          has_access: true,
          is_bookmarked: bookmarkIds.has(c.id),
          progress_percent: p?.percent ?? 0,
          completed_lectures: p?.completed ?? 0,
          total_lectures: p?.total ?? 0,
        };
      });

      if (options?.completedOnly) {
        courses = courses.filter((c) => (c.progress_percent ?? 0) >= 100);
      }

      return {
        ...result,
        courses,
      };
    }

    if (memberId && result.courses.length > 0) {
      // Owned courses also carry the member's progress, so a card can say
      // Start, Continue Learning or Completed instead of always "Continue".
      // Subscribers have access to ALL courses
      if (isSubscriber) {
        const progress = await getProgressByCourse(
          tenantId,
          memberId,
          result.courses.map((c) => c.id)
        );
        return {
          ...result,
          courses: result.courses.map((c) => ({
            ...c,
            prices: priceMaps.get(c.id) ?? {},
            has_access: true,
            is_bookmarked: bookmarkIds.has(c.id),
            progress_percent: progress.get(c.id)?.percent ?? 0,
          })),
        };
      }

      const courseIds = result.courses.map((c) => c.id);
      const enrolled = await db
        .selectFrom("enrollments")
        .select("course_id")
        .where("tenant_id", "=", tenantId)
        .where("tenant_member_id", "=", memberId)
        .where("course_id", "in", courseIds)
        .where("status", "=", enrollment_status.ACTIVE)
        .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
        .execute();
      const ownedIds = new Set(enrolled.map((e) => e.course_id));
      const progress = await getProgressByCourse(tenantId, memberId, [...ownedIds]);
      return {
        ...result,
        courses: result.courses.map((c) => ({
          ...c,
          prices: priceMaps.get(c.id) ?? {},
          has_access: ownedIds.has(c.id),
          is_bookmarked: bookmarkIds.has(c.id),
          ...(ownedIds.has(c.id) && { progress_percent: progress.get(c.id)?.percent ?? 0 }),
        })),
      };
    }

    return {
      ...result,
      courses: result.courses.map((c) => ({
        ...c,
        prices: priceMaps.get(c.id) ?? {},
        has_access: false,
        is_bookmarked: false,
      })),
    };
  }

  /**
   * Get a published course's full LMS tree by slug.
   * Returns course metadata + sections with lessons and their lectures,
   * plus the page theme and tenant layout.
   */
  async getPublishedCourseBySlug(tenantId: string, slug: string, memberId?: string) {
    let course = await coursesRepo.findPublishedCourseBySlug(tenantId, slug);
    let isArchived = false;

    if (!course && memberId) {
      // Try including ARCHIVED, only serve if user is enrolled
      course = await coursesRepo.findPublishedCourseBySlug(tenantId, slug, { allowArchived: true });
      if (course && String(course.status) === "ARCHIVED") {
        const enrolled = await coursesRepo.checkEnrollment(tenantId, memberId, course.id);
        if (!enrolled) {
          throw new NotFoundError("Published course not found for this slug");
        }
        isArchived = true;
      }
    }

    if (!course) {
      throw new NotFoundError("Published course not found for this slug");
    }

    // Fetch homepage theme (brand theme) and tenant layout in parallel with course data.
    const parallelQueries: [
      Promise<Awaited<ReturnType<typeof coursesRepo.findSectionsByCourseId>>>,
      Promise<Awaited<ReturnType<typeof coursesRepo.findFaqsByCourseId>>>,
      Promise<Awaited<ReturnType<typeof coursesRepo.findLessonResourcesByCourseId>>>,
      ReturnType<typeof pagesRepository.findPublishedByTenantAndSlug>,
      ReturnType<typeof tenantRepository.getLayout>,
      Promise<{ owned: boolean; expiresAt: Date | null }>,
    ] = [
      coursesRepo.findSectionsByCourseId(tenantId, course.id),
      coursesRepo.findFaqsByCourseId(tenantId, course.id),
      coursesRepo.findLessonResourcesByCourseId(tenantId, course.id),
      pagesRepository.findPublishedByTenantAndSlug(tenantId, "home"),
      tenantRepository.getLayout(tenantId),
      memberId
        ? (async () => {
            const enrolled = await db
              .selectFrom("enrollments")
              .select(["id", "valid_till"])
              .where("tenant_id", "=", tenantId)
              .where("tenant_member_id", "=", memberId)
              .where("course_id", "=", course.id)
              .where("status", "=", enrollment_status.ACTIVE)
              .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
              .executeTakeFirst();
            // expiresAt: the enrollment's valid_till, shown as "Access till ..."
            // in the player. Null when there is nothing to count down to:
            // lifetime enrollments, subscription-based access (the subscription
            // has its own cycle, not a course-level expiry), or no access.
            if (enrolled) {
              return { owned: true, expiresAt: enrolled.valid_till ?? null };
            }
            const subscribed = await userSubscriptionService.hasActiveSubscription(
              tenantId,
              memberId
            );
            return { owned: subscribed, expiresAt: null };
          })()
        : Promise.resolve({ owned: false, expiresAt: null as Date | null }),
    ];

    const [sectionsRaw, faqs, lessonResources, homePage, layout, access] =
      await Promise.all(parallelQueries);
    const enrolled = access.owned;

    // SEQUENTIAL COURSES.
    //
    // `has_access` keeps meaning EXACTLY what it always meant: does this member
    // own the course (enrolled or subscribed)? It is NOT overloaded to mean
    // "can open it right now".
    //
    // That distinction is the whole point. This payload feeds the course LANDING
    // page, where has_access picks the CTA: true → "Continue learning", false →
    // "Buy now". A locked learner HAS bought the course. Folding the lock into
    // has_access would show them a Buy button for something they already own and
    // invite a second purchase, a worse bug than the one being fixed.
    //
    // So ownership and openness travel separately: `has_access` says they own it,
    // `blocked_by` says what they must finish first. The player gates on
    // blocked_by; the landing page can now say "You own this, finish X first"
    // instead of trying to sell it to them again.
    const hasAccess = enrolled;
    let blockedBy: LockState["blockedBy"] | undefined;
    if (enrolled && memberId) {
      const lock = await courseUnlockService.check(tenantId, course.id, memberId);
      if (lock.locked && lock.blockedBy) blockedBy = lock.blockedBy;
    }

    // Group lesson resources by lesson_id (already sorted by sort_order from the query).
    const resourcesByLesson = new Map<
      string,
      Array<{
        id: string;
        type: string;
        title: string;
        url: string | null;
        content: string | null;
        downloadable: boolean;
        sort_order: number;
      }>
    >();
    for (const r of lessonResources) {
      const list = resourcesByLesson.get(r.lesson_id) ?? [];
      list.push({
        id: r.id,
        type: r.type,
        title: r.title,
        url: r.url,
        content: r.content,
        downloadable: r.downloadable,
        sort_order: r.sort_order,
      });
      resourcesByLesson.set(r.lesson_id, list);
    }

    const sections = await Promise.all(
      sectionsRaw.map(async (section) => {
        const lessons = await coursesRepo.findLessonsBySectionId(
          tenantId,
          section.id
        );

        const lessonsWithContent = await Promise.all(
          lessons.map(async (lesson) => {
            let lecture = null;
            let assignment = null;
            let quiz = null;
            if (lesson.type === "LECTURE") {
              const lectureRow = await coursesRepo.findLectureByLessonId(
                tenantId,
                lesson.id
              );
              if (lectureRow) {
                if (hasAccess) {
                  lecture = lectureRow;
                } else {
                  // Strip everything that could be replayed by a non-enrolled
                  // user. Duration is kept so the sidebar still shows
                  // runtime for the buy-this-course CTA.
                  lecture = {
                    ...lectureRow,
                    video_key: null,
                    video_provider: null,
                    summary: null,
                    resource_links: [],
                  };
                }
              }
            } else if (lesson.type === "ASSIGNMENT") {
              const a = await assignmentsRepo.getAssignmentByLessonId(
                tenantId,
                lesson.id
              );
              if (a) {
                let pdf_url: string | null = null;
                if (hasAccess && a.pdf_key?.trim()) {
                  try {
                    pdf_url = await s3Service.getSignedGetUrl(a.pdf_key, 3600);
                  } catch {
                    // Log but don't fail
                  }
                }
                assignment = {
                  id: a.id,
                  title: a.title,
                  instructions: a.instructions,
                  content_type: a.content_type,
                  max_score: a.max_score,
                  due_date: a.due_date?.toISOString() ?? null,
                  pdf_url,
                };
              }
            } else if (lesson.type === "QUIZ") {
              const q = await quizzesRepo.getQuizByLessonId(
                tenantId,
                lesson.id
              );
              if (q) {
                quiz = {
                  id: q.id,
                  title: q.title,
                  instructions: q.instructions,
                  max_score: q.max_score,
                  pass_percentage: q.pass_percentage,
                  due_date: q.due_date?.toISOString() ?? null,
                  question_count: q.question_count,
                };
              }
            }
            // Resources mirror the lecture content gating: stripped to an
            // empty array for non-enrolled users so paid material doesn't leak.
            const resources = hasAccess
              ? resourcesByLesson.get(lesson.id) ?? []
              : [];
            return { lesson, lecture, assignment, quiz, resources };
          })
        );

        return { ...section, lessons: lessonsWithContent };
      })
    );

    // Use the homepage (tenant brand) theme
    const theme = homePage?.theme || null;

    // Parse lms_settings if it's a string
    const rawSettings = course.lms_settings;
    const lmsSettings = rawSettings
      ? typeof rawSettings === "string"
        ? JSON.parse(rawSettings)
        : rawSettings
      : null;

    // Resolve S3 thumbnail keys to full URLs (mirrors the list endpoint logic).
    const thumbnailBase = config.THUMBNAILS_BASE_URL ?? null;
    const resolveKey = (key: string | null | undefined): string | null => {
      const k = key?.trim();
      if (!k) return null;
      if (/^(https?:|data:)/i.test(k) || !thumbnailBase) return k;
      return `${thumbnailBase}/${k.startsWith("/") ? k.slice(1) : k}`;
    };
    const thumbnailUrl = resolveKey(course.thumbnail_key);
    const secondaryThumbnailUrl = resolveKey(course.secondary_thumbnail_key);

    // Per-currency price map (additive alongside legacy price_inr/price_usd columns)
    const priceMaps = await getPriceMapsForEntities(tenantId, "COURSE", [
      {
        id: course.id,
        price_inr: course.price_inr,
        price_usd: course.price_usd,
        discount_inr: course.discount_inr,
        discount_usd: course.discount_usd,
      },
    ]);

    return {
      course: {
        ...course,
        thumbnailUrl,
        secondaryThumbnailUrl,
        prices: priceMaps.get(course.id) ?? {},
      },
      sections,
      faqs,
      theme,
      layout,
      lms_template_id: course.lms_template_id || null,
      lms_settings: lmsSettings,
      has_access: hasAccess,
      // The enrollment's valid_till, for the player's "Access till <date>"
      // badge. Null when there is no course-level expiry to show (lifetime
      // enrollment, subscription access, or no access at all).
      access_expires_at: access.expiresAt ? new Date(access.expiresAt).toISOString() : null,
      // Present only when a prerequisite is what's blocking them. The player
      // needs it to say WHICH course to finish, "Locked" on its own is a dead
      // end, and they've already paid for this one.
      blocked_by: blockedBy,
      is_archived: isArchived,
    };
  }

  /** List reviews for a course (tenant + course must exist). */
  async listReviews(tenantId: string, courseId: string) {
    const course = await coursesRepo.findCourseById(tenantId, courseId);
    if (!course) throw new NotFoundError("Course not found");
    const reviews = await coursesRepo.findReviewsByCourseId(tenantId, courseId);
    const summary = this._reviewSummary(reviews);
    return { reviews, summary };
  }

  /**
   * Non-throwing access check used by the LMS player to re-validate on
   * lecture change / tab focus without re-fetching the curriculum.
   * Returns the same access decision that ensureEnrolled enforces, with
   * a coarse-grained reason so the UI can render the right message.
   */
  async getAccessStatus(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<{
    has_access: boolean;
    reason?: "NOT_ENROLLED" | "EXPIRED" | "REVOKED" | "LOCKED";
    /** Set only when reason === "LOCKED": what they must finish first. */
    blocked_by?: {
      id: string;
      title: string;
      slug: string;
      done: number;
      total: number;
    };
  }> {
    // SEQUENTIAL COURSES, checked BEFORE enrolment.
    //
    // A locked course is one they own but can't open yet, so the lock has to be
    // evaluated even for an enrolled member. It sits first because "you haven't
    // finished Python Basics" is the more useful thing to say than "you're
    // enrolled", and because a locked course must never report has_access.
    const lock = await courseUnlockService.check(tenantId, courseId, memberId);
    if (lock.locked && lock.blockedBy) {
      return {
        has_access: false,
        reason: "LOCKED",
        blocked_by: lock.blockedBy,
      };
    }

    const enrollment = await db
      .selectFrom("enrollments")
      .select(["id", "status", "valid_till"])
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .where("tenant_member_id", "=", memberId)
      .executeTakeFirst();
    if (enrollment) {
      const status = String(enrollment.status);
      if (
        status !== enrollment_status.ACTIVE &&
        status !== enrollment_status.COMPLETED
      ) {
        const hasSubscription =
          await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
        if (hasSubscription) return { has_access: true };
        return { has_access: false, reason: "REVOKED" };
      }
      if (
        enrollment.valid_till &&
        new Date(enrollment.valid_till as unknown as string) <= new Date()
      ) {
        const hasSubscription =
          await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
        if (hasSubscription) return { has_access: true };
        return { has_access: false, reason: "EXPIRED" };
      }
      return { has_access: true };
    }
    const hasSubscription = await userSubscriptionService.hasActiveSubscription(
      tenantId,
      memberId
    );
    if (hasSubscription) return { has_access: true };
    return { has_access: false, reason: "NOT_ENROLLED" };
  }

  /**
   * Ensure member is enrolled in course (ACTIVE, valid_till not expired) AND
   * that the course isn't locked behind a prerequisite.
   * Throws ForbiddenError if either check fails.
   *
   * THIS IS THE CHOKEPOINT. Every action that touches course content, writing
   * lecture/quiz/assignment progress, minting a video OTP, submitting an
   * assignment, comes through here. Enforcing sequential courses at this one
   * spot closes every bypass at once; enforcing it per-route would mean finding
   * and remembering all of them, forever.
   *
   * It also closes a hole that would otherwise make the grandfather clause
   * self-defeating. `courseUnlockService.hasStarted()` treats ANY lecture-
   * progress row as "already started, leave them alone". If a locked learner
   * could still POST progress, they would mint that row themselves and unlock
   * the course permanently, the gate would hand out the key to anyone who
   * knocked. With the lock enforced here, a locked learner cannot create the
   * row in the first place, so any row that exists necessarily predates the
   * lock. Which is precisely what "grandfathered" is supposed to mean.
   */
  async ensureEnrolled(
    tenantId: string,
    courseId: string,
    memberId: string
  ): Promise<void> {
    const enrollment = await db
      .selectFrom("enrollments")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("course_id", "=", courseId)
      .where("tenant_member_id", "=", memberId)
      .where("status", "=", enrollment_status.ACTIVE)
      .where(sql<boolean>`(valid_till is null or valid_till > ${new Date()})`)
      .executeTakeFirst();
    if (!enrollment) {
      // Subscription fallback: active subscriber has access to all courses
      const hasSubscription = await userSubscriptionService.hasActiveSubscription(tenantId, memberId);
      if (!hasSubscription) {
        throw new ForbiddenError(
          "You must be enrolled in this course to perform this action"
        );
      }
    }

    // Enrolled, but possibly still waiting on a prerequisite. Checked second so
    // a non-enrolled stranger gets "you must enrol" rather than a description of
    // the tenant's course chain.
    const lock = await courseUnlockService.check(tenantId, courseId, memberId);
    if (lock.locked && lock.blockedBy) {
      throw new ForbiddenError(
        `Finish "${lock.blockedBy.title}" before starting this course.`
      );
    }
  }

  /** Create a review (one per member per course). */
  async createReview(
    tenantId: string,
    courseId: string,
    tenantMemberId: string,
    payload: { rating: number; review_text?: string | null }
  ) {
    const course = await coursesRepo.findCourseById(tenantId, courseId);
    if (!course) throw new NotFoundError("Course not found");
    await this.ensureEnrolled(tenantId, courseId, tenantMemberId);
    const existing = await coursesRepo.findReviewByTenantMemberAndCourse(
      tenantId,
      tenantMemberId,
      courseId
    );
    if (existing) throw new BadRequestError("You have already reviewed this course");
    const now = new Date();
    const id = ulid();
    await coursesRepo.createReview({
      id,
      tenant_id: tenantId,
      tenant_member_id: tenantMemberId,
      course_id: courseId,
      rating: Math.min(5, Math.max(1, payload.rating)),
      review_text: payload.review_text ?? null,
      created_at: now,
      updated_at: now,
    });
    return (await coursesRepo.findReviewsByCourseId(tenantId, courseId)).find(
      (r) => r.id === id
    )!;
  }

  private _reviewSummary(
    reviews: { rating: number }[]
  ): { average: number; count: number } {
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((a, r) => a + r.rating, 0);
    return {
      average: Math.round((sum / reviews.length) * 10) / 10,
      count: reviews.length,
    };
  }
}

const courseService = new CourseService();
export default courseService;

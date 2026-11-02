/**
 * Direct-to-database fixtures for state that would be slow to build through the APIs
 * (operators, tenants, owners, learners, entitlement grants, curriculum rows). The
 * behaviour under test is always exercised over HTTP.
 *
 * Every fixture namespaces its rows with a fresh ULID-ish suffix, so specs never collide
 * with each other or with a previous run in the same database.
 */
import { randomBytes } from "node:crypto";

import jwt from "jsonwebtoken";
import type { Kysely } from "kysely";

import type { DB } from "../../../src/db/types";

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET must be set for integration tests");
  return s;
};

let counter = 0;
/** A sortable unique id (time + counter + random), shaped like the apps' ULIDs. */
export function uid(prefix = ""): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${randomBytes(5).toString("hex")}`.toUpperCase().slice(0, 26);
}

export const short = () => randomBytes(4).toString("hex");

export interface Operator {
  id: string;
  email: string;
  token: string;
}

/** A console operator holding the SUPERADMIN role (seeded by seed:roles). */
export async function createOperator(db: Kysely<DB>): Promise<Operator> {
  const id = uid("OP");
  const email = `operator-${short()}@example.com`;
  const now = new Date();
  await db.insertInto("admin_users").values({ id, email, name: "Test Operator", status: "ACTIVE", email_verified: true, created_at: now, updated_at: now }).execute();
  const role = await db.selectFrom("admin_roles").select("id").where("code", "=", "SUPERADMIN").executeTakeFirstOrThrow();
  await db.insertInto("admin_user_roles").values({ admin_user_id: id, role_id: role.id }).execute();
  return { id, email, token: jwt.sign({ id, email, type: "admin" }, secret(), { expiresIn: "1h" }) };
}

export interface Tenant {
  id: string;
  slug: string;
  host: string;
  ownerId: string;
  ownerEmail: string;
  /** tenant-admin JWT for the owner (send with X-Tenant-Id). */
  token: string;
}

/** An ACTIVE tenant with an owner (every permission) and no entitlements at all. */
export async function createTenant(db: Kysely<DB>, label = "t"): Promise<Tenant> {
  const now = new Date();
  const ownerId = uid("TU");
  const ownerEmail = `owner-${short()}@example.com`;
  const id = uid("TN");
  const slug = `${label}-${short()}`;
  await db.insertInto("tenant_users").values({ id: ownerId, email: ownerEmail, name: "Owner", status: "ACTIVE", email_verified: true, created_at: now, updated_at: now }).execute();
  await db.insertInto("tenants").values({ id, name: `Tenant ${slug}`, slug, owner_user_id: ownerId, status: "ACTIVE", updated_at: now }).execute();
  await db.insertInto("tenant_staff_memberships").values({ id: uid("SM"), tenant_id: id, user_id: ownerId, status: "ACTIVE", joined_at: now, created_at: now, updated_at: now }).execute();
  const root = process.env.ROOT_DOMAIN ?? "lvh.me";
  return {
    id,
    slug,
    host: `${slug}.${root}`,
    ownerId,
    ownerEmail,
    token: jwt.sign({ id: ownerId, email: ownerEmail, type: "tenant" }, secret(), { expiresIn: "1h" }),
  };
}

/**
 * Grants entitlements the way an ADMIN grant does: one active row per product code.
 * `true` = BOOLEAN on, a number = COUNT/LIMIT value, "unlimited" = no cap.
 */
export async function grant(db: Kysely<DB>, tenantId: string, grants: Record<string, true | number | "unlimited">): Promise<void> {
  const now = new Date();
  for (const [code, value] of Object.entries(grants)) {
    const product = await db
      .selectFrom("products")
      .innerJoin("features", "features.id", "products.feature_id")
      .innerJoin("applications", "applications.id", "features.application_id")
      .select(["products.id", "features.key as feature_key", "applications.code as application_code"])
      .where("products.code", "=", code)
      .executeTakeFirstOrThrow(() => new Error(`product ${code} is not seeded`));
    await db
      .insertInto("entitlements")
      .values({
        id: uid("EN"),
        tenant_id: tenantId,
        product_id: product.id,
        application_code: product.application_code,
        feature_key: product.feature_key,
        product_code: code,
        is_unlimited: value === "unlimited",
        limit_value: value === true ? 1 : value === "unlimited" ? 0 : value,
        source: "ADMIN",
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
}

export interface Learner {
  id: string;
  email: string;
  token: string;
}

/** A learner (tenant member) with a learner-api JWT. */
export async function createLearner(db: Kysely<DB>, tenantId: string): Promise<Learner> {
  const id = uid("MB");
  const email = `learner-${short()}@example.com`;
  const now = new Date();
  await db.insertInto("tenant_members").values({ id, tenant_id: tenantId, email, name: "Learner", status: "ACTIVE", email_verified: true, created_at: now, updated_at: now }).execute();
  // learner-api accepts only type "learner", signed with LEARNER_JWT_SECRET (JWT_SECRET outside production).
  const learnerSecret = process.env.LEARNER_JWT_SECRET || secret();
  return { id, email, token: jwt.sign({ id, tenantId, email, type: "learner" }, learnerSecret, { expiresIn: "1h" }) };
}

export async function enroll(db: Kysely<DB>, tenantId: string, memberId: string, courseId: string): Promise<void> {
  const now = new Date();
  await db
    .insertInto("enrollments")
    .values({ id: uid("ER"), tenant_id: tenantId, tenant_member_id: memberId, course_id: courseId, status: "ACTIVE", source: "FREE", created_at: now, updated_at: now })
    .execute();
}

/** The full content grant a tenant needs to exercise every admin-api content route. */
export const ALL_CONTENT = {
  self_paced_courses_enabled: true,
  self_paced_courses_count: "unlimited",
  books_enabled: true,
  books_count: "unlimited",
  bundles_count: "unlimited",
  batches_enabled: true,
  batches_count: "unlimited",
  testseries_enabled: true,
  testseries_count: "unlimited",
  quizzes_enabled: true,
  quiz_questions_per_quiz: 100,
  assignments_enabled: true,
  instructors_count: "unlimited",
} as const;

export interface SeededCourse {
  id: string;
  slug: string;
  lectureIds: string[];
}

/**
 * A PUBLISHED self-paced course with one section, and one lesson + lecture per video.
 * Prices land in the legacy columns, the way a pre-multi-currency course stores them.
 */
export async function seedCourse(
  db: Kysely<DB>,
  tenantId: string,
  opts: { purchaseMode?: "FREE" | "PAID"; priceInr?: number; priceUsd?: number; videos?: Array<{ provider: "EVS" | "HLS" | "MP4" | "YOUTUBE"; key: string }> } = {}
): Promise<SeededCourse> {
  const now = new Date();
  const id = uid("CO");
  const slug = `course-${short()}`;
  await db
    .insertInto("courses")
    .values({
      id,
      tenant_id: tenantId,
      title: `Course ${slug}`,
      slug,
      status: "PUBLISHED",
      mode: "SELF_PACED",
      purchase_mode: opts.purchaseMode ?? "FREE",
      price_inr: opts.priceInr ?? null,
      price_usd: opts.priceUsd ?? null,
      created_at: now,
      updated_at: now,
    })
    .execute();
  const sectionId = uid("SE");
  await db.insertInto("course_sections").values({ id: sectionId, tenant_id: tenantId, course_id: id, title: "Section 1", created_at: now, updated_at: now }).execute();
  const lectureIds: string[] = [];
  for (const [i, v] of (opts.videos ?? []).entries()) {
    const lessonId = uid("LS");
    const lectureId = uid("LC");
    await db
      .insertInto("course_lessons")
      .values({ id: lessonId, tenant_id: tenantId, course_id: id, section_id: sectionId, title: `Lesson ${i + 1}`, type: "LECTURE", sort_order: i, created_at: now, updated_at: now })
      .execute();
    await db
      .insertInto("lectures")
      .values({
        id: lectureId,
        tenant_id: tenantId,
        course_id: id,
        lesson_id: lessonId,
        title: `Lecture ${i + 1}`,
        processing_status: "PROCESSED",
        video_provider: v.provider,
        video_key: v.key,
        created_at: now,
        updated_at: now,
      })
      .execute();
    lectureIds.push(lectureId);
  }
  return { id, slug, lectureIds };
}

/** One row of every main content type for a tenant, inserted directly. */
export async function seedContent(db: Kysely<DB>, tenantId: string) {
  const now = new Date();
  const s = short();
  const course = await seedCourse(db, tenantId, { videos: [{ provider: "HLS", key: "https://video.example.com/a.m3u8" }] });
  const ids = {
    course: course.id,
    courseSlug: course.slug,
    lecture: course.lectureIds[0],
    book: uid("BK"),
    bundle: uid("BU"),
    batch: uid("BA"),
    testSeries: uid("TS"),
    quiz: uid("QZ"),
    assignment: uid("AS"),
    certificate: uid("CT"),
    coupon: uid("CP"),
    page: uid("PG"),
    member: uid("MB"),
  };
  await db.insertInto("books").values({ id: ids.book, tenant_id: tenantId, title: "Book", slug: `book-${s}`, created_at: now, updated_at: now }).execute();
  await db.insertInto("bundles").values({ id: ids.bundle, tenant_id: tenantId, title: "Bundle", slug: `bundle-${s}`, created_at: now, updated_at: now }).execute();
  await db.insertInto("batches").values({ id: ids.batch, tenant_id: tenantId, title: "Batch", slug: `batch-${s}`, start_date: now }).execute();
  await db.insertInto("test_series").values({ id: ids.testSeries, tenant_id: tenantId, title: "Series", slug: `series-${s}`, created_at: now, updated_at: now }).execute();
  await db.insertInto("quizzes").values({ id: ids.quiz, tenant_id: tenantId, course_id: course.id, title: "Quiz", created_at: now, updated_at: now }).execute();
  await db.insertInto("assignments").values({ id: ids.assignment, tenant_id: tenantId, course_id: course.id, title: "Assignment", created_at: now, updated_at: now }).execute();
  await db.insertInto("certificate_templates").values({ id: ids.certificate, tenant_id: tenantId, name: "Certificate", layout: JSON.stringify({ elements: [] }) }).execute();
  await db
    .insertInto("coupons")
    .values({ id: ids.coupon, tenant_id: tenantId, code: `SAVE${s}`.toUpperCase(), discount_type: "PERCENTAGE", discount_value: 10, created_at: now, updated_at: now })
    .execute();
  await db
    .insertInto("tenant_pages")
    .values({ id: ids.page, tenant_id: tenantId, slug: `about-${s}`, title: "About", sections: JSON.stringify([]), theme: JSON.stringify({}), seo: JSON.stringify({}), updated_at: now })
    .execute();
  await db
    .insertInto("tenant_members")
    .values({ id: ids.member, tenant_id: tenantId, email: `member-${s}@example.com`, name: "Member", status: "ACTIVE", created_at: now, updated_at: now })
    .execute();
  return ids;
}

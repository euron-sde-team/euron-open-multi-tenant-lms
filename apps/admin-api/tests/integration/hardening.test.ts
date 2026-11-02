/**
 * admin-api hardening: staff whose account is suspended lose access on the next request,
 * the public auth routes are rate limited, the public page route serves only published
 * fields, quiz/assignment entitlements are enforced (default deny), bundle and batch
 * publish toggles move count slots only on real transitions, and concurrent first
 * consumes of a LIFETIME counter share one row.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTenant, grant, seedCourse, uid, short, type Tenant } from "./support/fixtures";
import { call, startStack, type Stack } from "./support/stack";

let stack: Stack;

// Low limits for this file only: every app reads its config at import.
process.env.AUTH_RATE_LIMIT_PER_EMAIL = "3";
process.env.AUTH_RATE_LIMIT_PER_IP = "6";

beforeAll(async () => {
  stack = await startStack();
});
afterAll(() => stack?.stop());

const as = (t: Tenant) => ({ token: t.token, tenantId: t.id });

const counter = (tenantId: string, productCode: string) =>
  stack.db
    .selectFrom("tenant_usage_counters")
    .select(["current_value", "window_start"])
    .where("tenant_id", "=", tenantId)
    .where("product_code", "=", productCode)
    .execute();

const usage = async (tenantId: string, productCode: string) =>
  (await counter(tenantId, productCode)).reduce((n, r) => n + Number(r.current_value), 0);

async function lesson(tenantId: string, courseId: string, type: "QUIZ" | "ASSIGNMENT"): Promise<string> {
  const section = await stack.db.selectFrom("course_sections").select("id").where("course_id", "=", courseId).executeTakeFirstOrThrow();
  const id = uid("LS");
  const now = new Date();
  await stack.db
    .insertInto("course_lessons")
    .values({ id, tenant_id: tenantId, course_id: courseId, section_id: section.id, title: `${type} lesson`, type, sort_order: 0, created_at: now, updated_at: now })
    .execute();
  return id;
}

describe("staff auth", () => {
  it("rejects a valid staff token once the account is suspended", async () => {
    const tenant = await createTenant(stack.db, "suspend");
    expect((await call(stack.admin, "GET", "/tenant/auth/me", as(tenant))).status).toBe(200);
    await stack.db.updateTable("tenant_users").set({ status: "SUSPENDED" }).where("id", "=", tenant.ownerId).execute();
    expect((await call(stack.admin, "GET", "/tenant/auth/me", as(tenant))).status).toBe(401);
    expect((await call(stack.admin, "GET", "/tenant/courses", as(tenant))).status).toBe(401);
  });

  it("rate limits login and password reset per email, and per IP", async () => {
    const email = `nobody-${short()}@example.com`;
    const login = () => call(stack.admin, "POST", "/tenant/auth/login", { body: { email, password: "wrong-password" } });
    const logins: number[] = [];
    for (let i = 0; i < 4; i++) logins.push((await login()).status);
    expect(logins.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(logins[3]).toBe(429);

    const forgot = () => call(stack.admin, "POST", "/tenant/auth/forgot-password", { body: { email } });
    const forgots: number[] = [];
    for (let i = 0; i < 4; i++) forgots.push((await forgot()).status);
    expect(forgots.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(forgots[3]).toBe(429);

    // reset-password carries no email: the per-IP counter (6) catches it.
    const resets: number[] = [];
    for (let i = 0; i < 7; i++) resets.push((await call(stack.admin, "POST", "/tenant/auth/reset-password", { body: { token: "bogus", password: "new-password-1" } })).status);
    expect(resets.slice(0, 6).every((s) => s !== 429)).toBe(true);
    expect(resets[6]).toBe(429);

    // Signup attempts for one address are capped too.
    const signupEmail = `signup-${short()}@example.com`;
    const signups: number[] = [];
    for (let i = 0; i < 4; i++) signups.push((await call(stack.admin, "POST", "/tenant/auth/signup", { body: { email: signupEmail, password: "x" } })).status);
    expect(signups[3]).toBe(429);
  });
});

describe("public page route", () => {
  it("serves published fields only: no draft HTML, no staff ids", async () => {
    const tenant = await createTenant(stack.db, "page");
    const slug = `about-${short()}`;
    const now = new Date();
    await stack.db
      .insertInto("tenant_pages")
      .values({
        id: uid("PG"),
        tenant_id: tenant.id,
        slug,
        title: "About",
        sections: JSON.stringify([]),
        theme: JSON.stringify({}),
        seo: JSON.stringify({}),
        is_published: true,
        published_at: now,
        created_by: tenant.ownerId,
        updated_by: tenant.ownerId,
        render_mode: "CUSTOM_CODE",
        custom_code_kind: "SANITIZED_INLINE",
        custom_html: "<p>live</p>",
        custom_html_draft: "<p>secret draft</p>",
        created_at: now,
        updated_at: now,
      })
      .execute();
    const res = await call(stack.admin, "GET", `/pages/tenant/${tenant.id}/slug/${slug}`);
    expect(res.status, res.text).toBe(200);
    expect(res.body.data.customHtml).toBe("<p>live</p>");
    for (const key of ["customHtmlDraft", "createdBy", "updatedBy", "moderationStatus"]) {
      expect(res.body.data).not.toHaveProperty(key);
    }
    expect(res.text).not.toContain("secret draft");
    expect(res.text).not.toContain(tenant.ownerId);
  });
});

describe("quiz and assignment entitlements", () => {
  it("denies quizzes and assignments without their rows, and caps questions per quiz", async () => {
    const tenant = await createTenant(stack.db, "quiz");
    const course = await seedCourse(stack.db, tenant.id);
    const quizLesson = await lesson(tenant.id, course.id, "QUIZ");
    const assignmentLesson = await lesson(tenant.id, course.id, "ASSIGNMENT");
    const createQuiz = () => call(stack.admin, "POST", `/tenant/courses/${course.id}/lessons/${quizLesson}/quiz`, { ...as(tenant), body: { title: "Quiz" } });
    const createAssignment = () =>
      call(stack.admin, "POST", `/tenant/courses/${course.id}/lessons/${assignmentLesson}/assignment`, { ...as(tenant), body: { title: "Assignment" } });

    const deniedQuiz = await createQuiz();
    expect(deniedQuiz.status).toBe(403);
    expect(JSON.stringify(deniedQuiz.body)).toContain("ENTITLEMENT_FEATURE_DISABLED");
    const deniedAssignment = await createAssignment();
    expect(deniedAssignment.status).toBe(403);
    expect(JSON.stringify(deniedAssignment.body)).toContain("ENTITLEMENT_FEATURE_DISABLED");

    await grant(stack.db, tenant.id, { quizzes_enabled: true, assignments_enabled: true });
    expect((await createAssignment()).status).toBe(201);
    const quiz = await createQuiz();
    expect(quiz.status, quiz.text).toBe(201);
    const quizId = quiz.body.data.id as string;
    const addQuestion = (n: number) =>
      call(stack.admin, "POST", `/tenant/courses/${course.id}/quizzes/${quizId}/questions`, { ...as(tenant), body: { question: `Question ${n}?` } });

    // No quiz_questions_per_quiz row: default deny.
    const noRow = await addQuestion(1);
    expect(noRow.status).toBe(403);
    expect(JSON.stringify(noRow.body)).toContain("ENTITLEMENT_LIMIT_REACHED");

    await grant(stack.db, tenant.id, { quiz_questions_per_quiz: 2 });
    expect((await addQuestion(1)).status).toBe(201);
    expect((await addQuestion(2)).status).toBe(201);
    const over = await addQuestion(3);
    expect(over.status).toBe(403);
    expect(JSON.stringify(over.body)).toContain("ENTITLEMENT_LIMIT_REACHED");
    const rows = await stack.db.selectFrom("quiz_questions").select("id").where("quiz_id", "=", quizId).execute();
    expect(rows).toHaveLength(2);
  });
});

describe("bundle and batch publish", () => {
  it("consumes a slot only on DRAFT -> PUBLISHED and releases it only on PUBLISHED -> DRAFT", async () => {
    const tenant = await createTenant(stack.db, "toggle");
    await grant(stack.db, tenant.id, { bundles_count: 5, batches_enabled: true, batches_count: 5 });
    const course = await seedCourse(stack.db, tenant.id);
    const now = new Date();
    const bundleId = uid("BU");
    await stack.db.insertInto("bundles").values({ id: bundleId, tenant_id: tenant.id, title: "Bundle", slug: `bundle-${short()}`, created_at: now, updated_at: now }).execute();
    await stack.db.insertInto("bundle_items").values({ id: uid("BI"), tenant_id: tenant.id, bundle_id: bundleId, item_type: "COURSE", course_id: course.id }).execute();
    const batchId = uid("BA");
    await stack.db.insertInto("batches").values({ id: batchId, tenant_id: tenant.id, title: "Batch", slug: `batch-${short()}`, start_date: now }).execute();
    await stack.db.insertInto("batch_items").values({ id: uid("BT"), tenant_id: tenant.id, batch_id: batchId, item_type: "COURSE", course_id: course.id }).execute();

    for (const [kind, id, code] of [
      ["bundles", bundleId, "bundles_count"],
      ["batches", batchId, "batches_count"],
    ] as const) {
      const toggle = async (publish: boolean) => {
        const res = await call(stack.admin, "POST", `/tenant/${kind}/${id}/toggle-publish`, { ...as(tenant), body: { publish } });
        expect(res.status, `${kind} ${publish}: ${res.text}`).toBe(200);
      };
      await toggle(true);
      expect(await usage(tenant.id, code)).toBe(1);
      await toggle(true);
      await toggle(true);
      expect(await usage(tenant.id, code), `${kind} re-publish`).toBe(1);
      await toggle(false);
      expect(await usage(tenant.id, code)).toBe(0);
      await toggle(false);
      expect(await usage(tenant.id, code), `${kind} re-unpublish`).toBe(0);
      await toggle(true);
      expect(await usage(tenant.id, code)).toBe(1);
    }
  });
});

describe("usage counters", () => {
  it("concurrent first consumes of a LIFETIME counter land on one row", async () => {
    const tenant = await createTenant(stack.db, "race");
    await grant(stack.db, tenant.id, { self_paced_courses_enabled: true, self_paced_courses_count: "unlimited" });
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await call(stack.admin, "POST", "/tenant/courses", { ...as(tenant), body: { title: `Race ${i}`, slug: `race-${i}-${short()}`, purchase_mode: "FREE" } });
      expect(res.status, res.text).toBe(201);
      ids.push(res.body.data.id as string);
    }
    const results = await Promise.all(
      ids.map((id) => call(stack.admin, "POST", `/tenant/courses/${id}/toggle-publish`, { ...as(tenant), body: { publish: true } }))
    );
    for (const r of results) expect(r.status, r.text).toBe(200);

    const rows = await counter(tenant.id, "self_paced_courses_count");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].current_value)).toBe(6);
    expect(rows[0].window_start).not.toBeNull();
    expect(new Date(rows[0].window_start as Date).toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });
});

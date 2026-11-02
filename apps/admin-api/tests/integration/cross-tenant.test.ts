/**
 * Cross-tenant isolation on admin-api: with two tenants, every main content route
 * answers 403/404 when tenant B's staff address tenant A's ids, and nothing of A's
 * changes. A positive control (A reading its own row) proves each route works.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ALL_CONTENT, createTenant, grant, seedContent, type Tenant } from "./support/fixtures";
import { call, startStack, type Stack } from "./support/stack";

let stack: Stack;
let a: Tenant;
let b: Tenant;
let ids: Awaited<ReturnType<typeof seedContent>>;

beforeAll(async () => {
  stack = await startStack();
  a = await createTenant(stack.db, "iso-a");
  b = await createTenant(stack.db, "iso-b");
  await grant(stack.db, a.id, ALL_CONTENT);
  await grant(stack.db, b.id, ALL_CONTENT);
  ids = await seedContent(stack.db, a.id);
});
afterAll(() => stack?.stop());

type Route = { name: string; read: string; write?: { method: string; path: string; body: unknown }; remove?: string; table: string; id: () => string };

const routes = (): Route[] => [
  { name: "courses", table: "courses", id: () => ids.course, read: `/tenant/courses/${ids.course}`, write: { method: "PUT", path: `/tenant/courses/${ids.course}`, body: { title: "hijacked" } }, remove: `/tenant/courses/${ids.course}` },
  { name: "books", table: "books", id: () => ids.book, read: `/tenant/books/${ids.book}`, write: { method: "PUT", path: `/tenant/books/${ids.book}`, body: { title: "hijacked" } }, remove: `/tenant/books/${ids.book}` },
  { name: "bundles", table: "bundles", id: () => ids.bundle, read: `/tenant/bundles/${ids.bundle}`, write: { method: "PUT", path: `/tenant/bundles/${ids.bundle}`, body: { title: "hijacked" } }, remove: `/tenant/bundles/${ids.bundle}` },
  { name: "batches", table: "batches", id: () => ids.batch, read: `/tenant/batches/${ids.batch}`, write: { method: "PUT", path: `/tenant/batches/${ids.batch}`, body: { title: "hijacked" } }, remove: `/tenant/batches/${ids.batch}` },
  { name: "test series", table: "test_series", id: () => ids.testSeries, read: `/tenant/test-series/${ids.testSeries}`, write: { method: "PUT", path: `/tenant/test-series/${ids.testSeries}`, body: { title: "hijacked" } }, remove: `/tenant/test-series/${ids.testSeries}` },
  { name: "quizzes", table: "quizzes", id: () => ids.quiz, read: `/tenant/quizzes/${ids.quiz}`, write: { method: "PATCH", path: `/tenant/quizzes/${ids.quiz}`, body: { title: "hijacked" } }, remove: `/tenant/quizzes/${ids.quiz}` },
  { name: "assignments", table: "assignments", id: () => ids.assignment, read: `/tenant/assignments/${ids.assignment}`, write: { method: "PATCH", path: `/tenant/assignments/${ids.assignment}`, body: { title: "hijacked" } }, remove: `/tenant/assignments/${ids.assignment}` },
  { name: "certificates", table: "certificate_templates", id: () => ids.certificate, read: `/tenant/certificate-designer/${ids.certificate}`, write: { method: "PUT", path: `/tenant/certificate-designer/${ids.certificate}`, body: { name: "hijacked" } }, remove: `/tenant/certificate-designer/${ids.certificate}` },
  { name: "coupons", table: "coupons", id: () => ids.coupon, read: `/tenant/coupons/${ids.coupon}`, write: { method: "PUT", path: `/tenant/coupons/${ids.coupon}`, body: { code: "HIJACKED" } }, remove: `/tenant/coupons/${ids.coupon}` },
  { name: "members", table: "tenant_members", id: () => ids.member, read: `/tenant/members/${ids.member}` },
  { name: "pages", table: "tenant_pages", id: () => ids.page, read: `/pages/${ids.page}`, write: { method: "PUT", path: `/pages/${ids.page}`, body: { title: "hijacked" } }, remove: `/pages/${ids.page}` },
];

const denied = (status: number) => status === 403 || status === 404;

describe("cross-tenant isolation (admin-api)", () => {
  it("the owner of A can read each of its own rows (positive control)", async () => {
    for (const r of routes()) {
      const res = await call(stack.admin, "GET", r.read, { token: a.token, tenantId: a.id });
      expect(res.status, `${r.name}: ${res.text.slice(0, 200)}`).toBe(200);
    }
  });

  it("B's owner gets 403/404 reading, editing or deleting A's rows, and A's rows are untouched", async () => {
    const snapshot = async () => {
      const out: Record<string, unknown> = {};
      for (const r of routes()) {
        out[r.name] = await stack.db.selectFrom(r.table as "courses").selectAll().where("id", "=", r.id()).executeTakeFirst();
      }
      return out;
    };
    const before = await snapshot();

    for (const r of routes()) {
      const read = await call(stack.admin, "GET", r.read, { token: b.token, tenantId: b.id });
      expect(denied(read.status), `GET ${r.name} -> ${read.status} ${read.text.slice(0, 200)}`).toBe(true);
      if (r.write) {
        const write = await call(stack.admin, r.write.method, r.write.path, { token: b.token, tenantId: b.id, body: r.write.body });
        expect(denied(write.status), `${r.write.method} ${r.name} -> ${write.status} ${write.text.slice(0, 200)}`).toBe(true);
      }
      if (r.remove) {
        const del = await call(stack.admin, "DELETE", r.remove, { token: b.token, tenantId: b.id });
        expect(denied(del.status), `DELETE ${r.name} -> ${del.status} ${del.text.slice(0, 200)}`).toBe(true);
      }
    }

    expect(await snapshot()).toEqual(before);
  });

  it("B's owner cannot switch into A by sending A's X-Tenant-Id", async () => {
    const res = await call(stack.admin, "GET", "/tenant/courses", { token: b.token, tenantId: a.id });
    expect(res.status).toBe(403);
  });

  it("A's lists never contain B's rows and vice versa", async () => {
    const listB = await call(stack.admin, "GET", "/tenant/courses", { token: b.token, tenantId: b.id });
    expect(listB.status).toBe(200);
    expect(listB.text).not.toContain(ids.course);
    const membersB = await call(stack.admin, "GET", "/tenant/members", { token: b.token, tenantId: b.id });
    expect(membersB.status).toBe(200);
    expect(membersB.text).not.toContain(ids.member);
  });
});

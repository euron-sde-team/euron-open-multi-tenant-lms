/**
 * Builds a realistic demo across all three tiers: an operator, two tenants
 * (Northwind Academy on "scale", Acme Robotics on "starter"), their content,
 * learners, enrollments, progress, attempts and a paid order.
 *
 *   pnpm --filter @open-mtlms/console-api demo:seed            # once
 *   pnpm --filter @open-mtlms/console-api demo:seed --force    # wipe both demo tenants, rebuild
 *
 * It drives the real HTTP APIs (console-api, admin-api, learner-api must be
 * running) so the real business logic runs: entitlement snapshots, credential
 * sealing, enrollment, checkout. Direct Kysely writes are used only where no
 * API exists (the operator account, a few profile fields).
 *
 * Every account uses DEMO_PASSWORD, or a random password printed at the end.
 * Refuses to run with NODE_ENV=production.
 */
process.env.TZ = "UTC";

import crypto from "crypto";
import net from "net";
import bcrypt from "bcrypt";
import { ulid } from "ulid";
import { sql } from "kysely";
import { db, pool } from "./lib/db";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
  console.error("[demo-seed] refusing to run with NODE_ENV=production");
  process.exit(1);
}

const FORCE = process.argv.includes("--force");
const PASSWORD_FROM_ENV = Boolean(process.env.DEMO_PASSWORD);
const PASSWORD = process.env.DEMO_PASSWORD || `Demo-${crypto.randomBytes(9).toString("base64url")}`;

const CONSOLE_API = (process.env.CONSOLE_API_INTERNAL_URL || "http://localhost:5076").replace(/\/$/, "");
const ADMIN_API = (process.env.ADMIN_API_INTERNAL_URL || "http://localhost:5086").replace(/\/$/, "");
const LEARNER_API = (process.env.LEARNER_API_INTERNAL_URL || "http://localhost:5096").replace(/\/$/, "");
const STUBS_URL = (process.env.STUBS_URL || process.env.STRIPE_API_BASE || "http://localhost:5189").replace(/\/$/, "");
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || "lvh.me";
const CONSOLE_URL = process.env.CONSOLE_URL || "http://localhost:3600";
const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3610";
const WEB_PORT = process.env.WEB_PORT || "3620";

const STUB = {
  stripeSecret: process.env.STUB_TENANT_STRIPE_SECRET_KEY || "sk_test_stub_tenant",
  stripePublishable: process.env.STUB_TENANT_STRIPE_PUBLISHABLE_KEY || "pk_test_stub_tenant",
  stripeWebhookSecret: process.env.STUB_STRIPE_WEBHOOK_SECRET || "whsec_stub_local_only",
  razorpayKeyId: process.env.STUB_TENANT_RAZORPAY_KEY_ID || "rzp_test_stubtenant",
  razorpayKeySecret: process.env.STUB_TENANT_RAZORPAY_KEY_SECRET || "rzp_secret_stub_tenant",
  razorpayWebhookSecret: process.env.STUB_RAZORPAY_WEBHOOK_SECRET || "rzp_whsec_stub_local_only",
};

const OPERATOR_EMAIL = "root@example.com";
const HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const HLS_URL_2 = "https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8";
const MP4_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const EVS_STUB_VIDEO_ID = "evs_demo_intro_001";

interface DemoTenant {
  slug: string;
  name: string;
  plan: string;
  owner: { email: string; name: string };
}
const NORTHWIND: DemoTenant = {
  slug: "northwind",
  name: "Northwind Academy",
  plan: "scale",
  owner: { email: "maya@northwind.example.com", name: "Maya Fernandes" },
};
const ACME: DemoTenant = {
  slug: "acme",
  name: "Acme Robotics",
  plan: "starter",
  owner: { email: "arjun@acme.example.com", name: "Arjun Mehta" },
};
const LEARNERS = [
  { email: "lee@example.com", name: "Lee Chen" },
  { email: "priya@example.com", name: "Priya Sharma" },
  { email: "omar@example.com", name: "Omar Haddad" },
  { email: "sofia@example.com", name: "Sofia Rossi" },
  { email: "kenji@example.com", name: "Kenji Watanabe" },
  { email: "amara@example.com", name: "Amara Okafor" },
];

const storefront = (slug: string) => `http://${slug}.${ROOT_DOMAIN}:${WEB_PORT}`;
const tenantHost = (slug: string) => `${slug}.${ROOT_DOMAIN}`;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface CallOpts {
  token?: string;
  tenantId?: string;
  host?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Return null instead of throwing on these HTTP statuses. */
  allow?: number[];
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload: unknown
  ) {
    super(message);
  }
}

async function call<T = any>(base: string, method: string, path: string, opts: CallOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["X-Tenant-Id"] = opts.tenantId;
  if (opts.host) headers["X-Tenant-Host"] = opts.host;
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok || (json && json.success === false)) {
    if (opts.allow?.includes(res.status)) return null as T;
    const msg = json?.error?.message || json?.message || text.slice(0, 300);
    throw new ApiError(`${method} ${base}${path} -> ${res.status}: ${msg}`, res.status, json);
  }
  return (json && "data" in json ? json.data : json) as T;
}

const consoleApi = (method: string, path: string, opts?: CallOpts) => call(CONSOLE_API, method, path, opts);
const adminApi = (method: string, path: string, opts?: CallOpts) => call(ADMIN_API, method, path, opts);
const learnerApi = (method: string, path: string, opts?: CallOpts) => call(LEARNER_API, method, path, opts);

const step = (msg: string) => console.log(`[demo-seed] ${msg}`);
const warn = (msg: string) => console.warn(`[demo-seed] WARN ${msg}`);

/** Runs an optional step; a failure is reported and the seed carries on. */
async function soft<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    warn(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Preflight, wipe, operator
// ---------------------------------------------------------------------------

async function preflight() {
  for (const [name, base] of [
    ["console-api", CONSOLE_API],
    ["admin-api", ADMIN_API],
    ["learner-api", LEARNER_API],
  ] as const) {
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok && res.status >= 500) throw new Error(`status ${res.status}`);
    } catch (err) {
      throw new Error(
        `${name} is not reachable at ${base} (${err instanceof Error ? err.message : err}). Start the APIs first.`
      );
    }
  }
}

async function demoTenantIds(): Promise<string[]> {
  const rows = await db
    .selectFrom("tenants")
    .select(["id"])
    .where("slug", "in", [NORTHWIND.slug, ACME.slug])
    .execute();
  return rows.map((r) => r.id);
}

/**
 * Removes both demo tenants and every row scoped to them. Tables with a
 * tenant_id column are cleared in repeated passes (each delete in its own
 * savepoint), so FK order resolves itself without a hand-kept list; the
 * tenants row then cascades whatever is left. Demo accounts (tenant users)
 * are removed last.
 */
async function wipe() {
  const ids = await demoTenantIds();
  const ownerEmails = [NORTHWIND.owner.email, ACME.owner.email];
  if (ids.length) {
    const tables = await sql<{ table_name: string }>`
      select distinct c.table_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_name = c.table_name and t.table_schema = c.table_schema
      where c.table_schema = 'public' and c.column_name = 'tenant_id'
        and t.table_type = 'BASE TABLE' and c.table_name <> 'tenants'
    `.execute(db);
    let pending = tables.rows.map((r) => r.table_name);
    await db.transaction().execute(async (trx) => {
      for (let pass = 0; pass < 12 && pending.length; pass++) {
        const failed: string[] = [];
        for (const table of pending) {
          await sql`savepoint demo_wipe`.execute(trx);
          try {
            await sql`delete from ${sql.table(table)} where tenant_id in (${sql.join(ids)})`.execute(trx);
            await sql`release savepoint demo_wipe`.execute(trx);
          } catch {
            await sql`rollback to savepoint demo_wipe`.execute(trx);
            failed.push(table);
          }
        }
        if (failed.length === pending.length) break;
        pending = failed;
      }
      await trx.deleteFrom("tenants").where("id", "in", ids).execute();
    });
    await bustLearnerTenantCache(ids);
    step(`wiped ${ids.length} demo tenant(s)`);
  }
  const users = await db.selectFrom("tenant_users").select(["id"]).where("email", "in", ownerEmails).execute();
  if (users.length) {
    const userIds = users.map((u) => u.id);
    const fks = await sql<{ table_name: string; column_name: string }>`
      select cl.relname as table_name, a.attname as column_name
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
      where con.contype = 'f' and con.confrelid = 'tenant_users'::regclass and con.confdeltype <> 'c'
    `.execute(db);
    await db.transaction().execute(async (trx) => {
      for (const fk of fks.rows) {
        await sql`savepoint demo_users`.execute(trx);
        try {
          await sql`delete from ${sql.table(fk.table_name)} where ${sql.ref(fk.column_name)} in (${sql.join(userIds)})`.execute(trx);
          await sql`release savepoint demo_users`.execute(trx);
        } catch {
          await sql`rollback to savepoint demo_users`.execute(trx);
          await sql`update ${sql.table(fk.table_name)} set ${sql.ref(fk.column_name)} = null where ${sql.ref(fk.column_name)} in (${sql.join(userIds)})`
            .execute(trx)
            .catch(() => undefined);
        }
      }
      await trx.deleteFrom("tenant_users").where("id", "in", userIds).execute();
    });
  }
}

/**
 * learner-api caches host -> tenant for a minute. After a wipe the old tenant
 * ids would still resolve, so publish the same cache-bust message admin-api
 * sends on the shared channel (plain RESP over a socket; no client library).
 */
async function bustLearnerTenantCache(tenantIds: string[]) {
  const url = new URL(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6479"}`);
  const channel = `${process.env.CACHE_BUS_PREFIX ?? "lms:"}cache-bust:tenant-config`;
  const cmd = (...args: string[]) => `*${args.length}\r\n${args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join("")}`;
  let payload = "";
  const password = decodeURIComponent(url.password || process.env.REDIS_PASSWORD || "");
  if (password) payload += url.username ? cmd("AUTH", decodeURIComponent(url.username), password) : cmd("AUTH", password);
  for (const id of tenantIds) payload += cmd("PUBLISH", channel, JSON.stringify({ tenant_id: id }));
  payload += cmd("QUIT");
  await new Promise<void>((resolve) => {
    const sock = net.createConnection({ host: url.hostname, port: Number(url.port || 6379) }, () => sock.write(payload));
    sock.setTimeout(3000, () => sock.destroy());
    sock.on("data", () => undefined);
    sock.on("close", () => resolve());
    sock.on("error", (err) => {
      warn(`could not bust learner-api tenant cache (${err.message}); wait a minute before using the storefront`);
      resolve();
    });
  });
}

/** Same logic as scripts/bootstrap-operator.ts, with DEMO_PASSWORD. */
async function ensureOperator() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const t = new Date();
  const existing = await db
    .selectFrom("admin_users")
    .select(["id"])
    .where("email", "=", OPERATOR_EMAIL)
    .executeTakeFirst();
  if (existing) {
    // Keep the operator's login in step with this run's password.
    await db
      .updateTable("admin_users")
      .set({ password_hash: passwordHash, status: "ACTIVE", updated_at: t })
      .where("id", "=", existing.id)
      .execute();
    return;
  }
  await db.transaction().execute(async (trx) => {
    let role = await trx.selectFrom("admin_roles").select(["id"]).where("code", "=", "SUPERADMIN").executeTakeFirst();
    if (!role) {
      role = await trx
        .insertInto("admin_roles")
        .values({
          id: ulid(),
          code: "SUPERADMIN",
          name: "Super Administrator",
          description: "Full, unrestricted access to every feature and setting.",
          is_system: true,
          created_at: t,
          updated_at: t,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();
    }
    const userId = ulid();
    await trx
      .insertInto("admin_users")
      .values({
        id: userId,
        email: OPERATOR_EMAIL,
        name: "Root Operator",
        password_hash: passwordHash,
        status: "ACTIVE",
        email_verified: true,
        created_at: t,
        updated_at: t,
      })
      .execute();
    await trx.insertInto("admin_user_roles").values({ admin_user_id: userId, role_id: role.id, assigned_at: t }).execute();
  });
  step(`operator ${OPERATOR_EMAIL} created`);
}

// ---------------------------------------------------------------------------
// Tenants (console-api) and owner sessions (admin-api)
// ---------------------------------------------------------------------------

interface TenantCtx {
  def: DemoTenant;
  id: string;
  token: string; // owner's admin-api token
}

async function ownerLogin(email: string): Promise<string> {
  const r = await adminApi("POST", "/tenant/auth/login", { body: { email, password: PASSWORD } });
  return r.token ?? r.accessToken ?? r.access_token;
}

async function createTenant(opToken: string, def: DemoTenant): Promise<TenantCtx> {
  // 1. The owner signs up on the tenant admin like any new customer.
  await adminApi("POST", "/tenant/auth/signup", {
    body: { email: def.owner.email, password: PASSWORD, name: def.owner.name },
  });
  const owner = await db.selectFrom("tenant_users").select(["id"]).where("email", "=", def.owner.email).executeTakeFirstOrThrow();
  // Demo accounts are pre-verified (no inbox to read the OTP from).
  await db.updateTable("tenant_users").set({ email_verified: true }).where("id", "=", owner.id).execute();

  // 2. The operator creates the tenant with that owner, then assigns the plan,
  //    which snapshots the plan version into entitlements.
  const tenant = await consoleApi("POST", "/admin/tenants", {
    token: opToken,
    body: { name: def.name, slug: def.slug, owner_user_id: owner.id },
  });
  const version = await publishedPlanVersion(opToken, def.plan);
  await consoleApi("POST", `/admin/tenants/${tenant.id}/subscriptions`, {
    token: opToken,
    body: { plan_version_id: version, billing_cycle: "YEARLY", currency: "USD" },
  });
  step(`tenant ${def.name} (${def.slug}) on plan ${def.plan}`);
  return { def, id: tenant.id, token: await ownerLogin(def.owner.email) };
}

async function publishedPlanVersion(opToken: string, code: string): Promise<string> {
  const plans = await consoleApi("GET", "/admin/plans", { token: opToken });
  const list: any[] = Array.isArray(plans) ? plans : (plans.plans ?? plans.items ?? plans.data ?? []);
  const plan = list.find((p) => p.code === code);
  if (!plan) throw new Error(`plan '${code}' not found; run \`pnpm --filter @open-mtlms/console-api seed\` first`);
  const live = plan.active_version;
  if (!live?.id || !live.published_at) throw new Error(`plan '${code}' has no published version`);
  return live.id;
}

// ---------------------------------------------------------------------------
// Tenant content (admin-api)
// ---------------------------------------------------------------------------

const adminAs = (ctx: TenantCtx) => (method: string, path: string, body?: unknown) =>
  adminApi(method, path, { token: ctx.token, tenantId: ctx.id, body });

interface LectureDef {
  title: string;
  provider: "YOUTUBE" | "EVS" | "HLS" | "MP4";
  key: string;
  duration: string;
  preview?: boolean;
}
interface CourseDef {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  free?: boolean;
  prices?: { INR: number; USD: number };
  outcomes: string[];
  category: string;
  instructor: number;
  sections: { title: string; lectures: LectureDef[] }[];
}

interface CourseOut {
  id: string;
  slug: string;
  title: string;
  free: boolean;
  lectures: { id: string; lessonId: string; title: string; provider: string }[];
  sectionIds: string[];
}

const priceRows = (p?: { INR: number; USD: number }) =>
  p
    ? [
        { currency: "INR", amount: p.INR, discount: 0, discount_type: "PERCENTAGE" },
        { currency: "USD", amount: p.USD, discount: 0, discount_type: "PERCENTAGE" },
      ]
    : undefined;

async function createCourse(
  ctx: TenantCtx,
  def: CourseDef,
  refs: { categories: Record<string, string>; instructors: string[] }
): Promise<CourseOut> {
  const api = adminAs(ctx);
  const created = await api("POST", "/tenant/courses", {
    title: def.title,
    slug: def.slug,
    mode: "SELF_PACED",
    course_type: "NORMAL",
    difficulty: def.difficulty,
    language: ["English"],
    purchase_mode: def.free ? "FREE" : "PAID",
    prices: priceRows(def.prices),
    thumbnail_key: COVERS[def.slug] ?? null,
  });
  const courseId: string = created.id;
  await api("PUT", `/tenant/courses/${courseId}`, {
    subtitle: def.subtitle,
    description: def.description,
    learning_outcomes: def.outcomes,
    prerequisites: ["A laptop and curiosity"],
    validity_days: 365,
    category_ids: refs.categories[def.category] ? [refs.categories[def.category]] : [],
  });
  const instructorId = refs.instructors[def.instructor];
  if (instructorId) {
    await api("PUT", `/tenant/courses/${courseId}/instructors/sync`, { instructorIds: [instructorId] });
  }
  const out: CourseOut = { id: courseId, slug: created.slug ?? def.slug, title: def.title, free: !!def.free, lectures: [], sectionIds: [] };
  for (const [si, section] of def.sections.entries()) {
    const sec = await api("POST", `/tenant/courses/${courseId}/sections`, { title: section.title, sort_order: si });
    out.sectionIds.push(sec.id);
    for (const [li, lec] of section.lectures.entries()) {
      const lesson = await api("POST", `/tenant/courses/${courseId}/sections/${sec.id}/lessons`, {
        title: lec.title,
        type: "LECTURE",
        sort_order: li,
        is_preview: !!lec.preview,
      });
      const lecture = await api("POST", `/tenant/courses/${courseId}/lessons/${lesson.id}/lecture`, {
        title: lec.title,
        video_provider: lec.provider,
        video_key: lec.key,
        duration: lec.duration,
        summary: `${lec.title}, part of ${def.title}.`,
      });
      out.lectures.push({ id: lecture.id, lessonId: lesson.id, title: lec.title, provider: lec.provider });
    }
  }
  return out;
}

const publish = (ctx: TenantCtx, kind: "courses" | "books" | "bundles" | "batches", id: string) =>
  adminAs(ctx)("POST", `/tenant/${kind}/${id}/toggle-publish`, { publish: true });

// Cover images: Unsplash photos (free to use under the Unsplash License) that
// the page templates already reference. A real tenant uploads its own.
const cover = (id: string) => `https://images.unsplash.com/${id}?w=1200`;
const COVERS: Record<string, string> = {
  "python-for-data-analysis": cover("photo-1551288049-bebda4e38f71"),
  "machine-learning-foundations": cover("photo-1460925895917-afdab827c52f"),
  "modern-web-development": cover("photo-1555066931-4365d14bab8c"),
  "product-management-essentials": cover("photo-1552664730-d307ca884978"),
  "robotics-101": cover("photo-1524178232363-1fb2b075b655"),
  "data-analyst-field-guide": cover("photo-1554224155-6726b3ff858f"),
  "data-career-starter-pack": cover("photo-1522071820081-009f0129c71c"),
  "data-analyst-cohort-spring": cover("photo-1522202176988-66273c2fd55f"),
};

const NORTHWIND_COURSES: CourseDef[] = [
  {
    title: "Python for Data Analysis",
    slug: "python-for-data-analysis",
    subtitle: "From first script to clean, reproducible analysis",
    description:
      "A hands-on introduction to Python for analysts: data types, pandas, plotting and a small end-to-end project on real data.",
    difficulty: "BEGINNER",
    free: true,
    outcomes: ["Write clean Python scripts", "Load and reshape data with pandas", "Build charts that answer questions"],
    category: "data-science",
    instructor: 0,
    sections: [
      {
        title: "Getting started",
        lectures: [
          { title: "Welcome and course map", provider: "EVS", key: EVS_STUB_VIDEO_ID, duration: "00:06", preview: true },
          { title: "Installing Python and Jupyter", provider: "HLS", key: HLS_URL, duration: "10:34" },
        ],
      },
      {
        title: "Working with data",
        lectures: [
          { title: "Series and DataFrames", provider: "HLS", key: HLS_URL_2, duration: "10:34" },
          { title: "Cleaning messy columns", provider: "YOUTUBE", key: "rfscVS0vtbw", duration: "12:00" },
        ],
      },
    ],
  },
  {
    title: "Machine Learning Foundations",
    slug: "machine-learning-foundations",
    subtitle: "The models, the maths and the intuition behind them",
    description:
      "Regression, classification, evaluation and the habits that keep models honest. Every concept is paired with a short notebook.",
    difficulty: "INTERMEDIATE",
    prices: { INR: 3999, USD: 49 },
    outcomes: ["Train and evaluate supervised models", "Avoid leakage and overfitting", "Explain model results"],
    category: "data-science",
    instructor: 1,
    sections: [
      {
        title: "Supervised learning",
        lectures: [
          { title: "What a model learns", provider: "HLS", key: HLS_URL, duration: "10:34", preview: true },
          { title: "Linear regression from scratch", provider: "MP4", key: MP4_URL, duration: "09:56" },
        ],
      },
      {
        title: "Evaluation",
        lectures: [
          { title: "Train, validation and test splits", provider: "HLS", key: HLS_URL_2, duration: "10:34" },
          { title: "Metrics that matter", provider: "YOUTUBE", key: "aircAruvnKk", duration: "19:13" },
        ],
      },
    ],
  },
  {
    title: "Modern Web Development",
    slug: "modern-web-development",
    subtitle: "HTML, CSS and TypeScript for production sites",
    description: "Build accessible, fast pages and ship them. Covers layout, components, TypeScript and deployment basics.",
    difficulty: "BEGINNER",
    prices: { INR: 2499, USD: 29 },
    outcomes: ["Lay out responsive pages", "Write typed front-end code", "Deploy a site"],
    category: "web-development",
    instructor: 2,
    sections: [
      {
        title: "Foundations",
        lectures: [
          { title: "How the browser renders a page", provider: "HLS", key: HLS_URL, duration: "10:34", preview: true },
          { title: "Layout with flexbox and grid", provider: "YOUTUBE", key: "PkZNo7MFNFg", duration: "15:00" },
        ],
      },
      {
        title: "TypeScript",
        lectures: [{ title: "Types for everyday code", provider: "HLS", key: HLS_URL_2, duration: "10:34" }],
      },
    ],
  },
  {
    title: "Product Management Essentials",
    slug: "product-management-essentials",
    subtitle: "Discovery, prioritisation and shipping with a team",
    description: "A practical playbook for new product managers: interviews, roadmaps, metrics and working with engineering.",
    difficulty: "ADVANCED",
    prices: { INR: 4999, USD: 59 },
    outcomes: ["Run discovery interviews", "Prioritise with evidence", "Define success metrics"],
    category: "business",
    instructor: 1,
    sections: [
      {
        title: "Discovery",
        lectures: [
          { title: "Finding the real problem", provider: "HLS", key: HLS_URL, duration: "10:34", preview: true },
          { title: "Interviewing users", provider: "MP4", key: MP4_URL, duration: "09:56" },
        ],
      },
    ],
  },
];

interface NorthwindRefs {
  courses: CourseOut[];
  bookId?: string;
  bundleId?: string;
  batchId?: string;
  quizId?: string;
  testSeriesId?: string;
  testId?: string;
}

async function seedNorthwindCatalog(ctx: TenantCtx): Promise<NorthwindRefs> {
  const api = adminAs(ctx);

  await soft("subdomain", () => api("POST", "/tenant/domains/subdomain"));

  // Both currencies, INR default (prices below carry both).
  await api("PUT", "/tenant/currency-settings", {
    currencies: [
      { currency: "INR", is_default: true, countries: ["IN"] },
      { currency: "USD", is_default: false, countries: ["*"] },
    ],
  });

  const instructors: string[] = [];
  for (const ins of [
    { name: "Dr. Elena Park", email: "elena@northwind.example.com", bio: "Data scientist and former university lecturer.", expertise: "Data Science" },
    { name: "Rahul Iyer", email: "rahul@northwind.example.com", bio: "Machine learning engineer who has shipped models at scale.", expertise: "Machine Learning" },
    { name: "Grace Liu", email: "grace@northwind.example.com", bio: "Front-end lead and accessibility advocate.", expertise: "Web Development" },
  ]) {
    instructors.push((await api("POST", "/tenant/instructors", ins)).id);
  }

  const categories: Record<string, string> = {};
  for (const [i, c] of [
    { slug: "data-science", name: "Data Science", description: "Analysis, statistics and machine learning." },
    { slug: "web-development", name: "Web Development", description: "Front-end and full-stack engineering." },
    { slug: "business", name: "Business", description: "Product, strategy and leadership." },
  ].entries()) {
    categories[c.slug] = (await api("POST", "/tenant/categories", { ...c, sort_order: i, is_active: true })).id;
  }

  const courses: CourseOut[] = [];
  for (const def of NORTHWIND_COURSES) {
    const c = await createCourse(ctx, def, { categories, instructors });
    courses.push(c);
  }
  step(`northwind: ${courses.length} courses, ${courses.reduce((n, c) => n + c.lectures.length, 0)} lectures`);
  const refs: NorthwindRefs = { courses };

  const book = await api("POST", "/tenant/books", {
    title: "The Data Analyst's Field Guide",
    slug: "data-analyst-field-guide",
    thumbnail_url: COVERS["data-analyst-field-guide"],
    author: "Dr. Elena Park",
    description: "A compact reference for everyday analysis: cleaning, joining, summarising and presenting data.",
    purchase_mode: "PAID",
    prices: priceRows({ INR: 799, USD: 12 }),
    pages: 140,
  });
  refs.bookId = book.id;

  return refs;
}

async function publishNorthwind(ctx: TenantCtx, refs: NorthwindRefs) {
  const api = adminAs(ctx);
  for (const c of refs.courses) await publish(ctx, "courses", c.id);
  if (refs.bookId) await publish(ctx, "books", refs.bookId);

  const bundle = await api("POST", "/tenant/bundles", {
    title: "Data Career Starter Pack",
    slug: "data-career-starter-pack",
    thumbnail_url: COVERS["data-career-starter-pack"],
    subtitle: "Two courses and the field guide, together",
    description: "Machine Learning Foundations, Python for Data Analysis and the Data Analyst's Field Guide.",
    purchase_mode: "PAID",
    prices: priceRows({ INR: 5999, USD: 69 }),
    validity_days: 365,
  });
  refs.bundleId = bundle.id;
  await api("POST", `/tenant/bundles/${bundle.id}/items`, { item_type: "COURSE", course_id: refs.courses[1].id });
  await api("POST", `/tenant/bundles/${bundle.id}/items`, { item_type: "COURSE", course_id: refs.courses[0].id });
  if (refs.bookId) await api("POST", `/tenant/bundles/${bundle.id}/items`, { item_type: "BOOK", book_id: refs.bookId });
  await publish(ctx, "bundles", bundle.id);

  const start = new Date(Date.now() + 30 * 86400_000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const batch = await api("POST", "/tenant/batches", {
    title: "Data Analyst Cohort, Spring",
    slug: "data-analyst-cohort-spring",
    thumbnail_url: COVERS["data-analyst-cohort-spring"],
    cover_image_url: COVERS["data-analyst-cohort-spring"],
    description: "A twelve-week guided cohort with weekly milestones and peer review.",
    start_date: day(start),
    end_date: day(new Date(start.getTime() + 84 * 86400_000)),
    enrollment_open_date: day(new Date()),
    enrollment_close_date: day(new Date(start.getTime() - 86400_000)),
    purchase_mode: "PAID",
    prices: priceRows({ INR: 9999, USD: 129 }),
    learning_outcomes: ["Finish a portfolio project", "Present findings to a panel"],
  });
  refs.batchId = batch.id;
  await api("POST", `/tenant/batches/${batch.id}/items`, { item_type: "COURSE", course_id: refs.courses[0].id });
  await api("POST", `/tenant/batches/${batch.id}/items`, { item_type: "COURSE", course_id: refs.courses[1].id });
  await publish(ctx, "batches", batch.id);
  step("northwind: book, bundle and batch published");
}

interface QuizQ { q: string; options: string[]; correct: number }
const ML_QUIZ: QuizQ[] = [
  { q: "Which split is used to pick hyperparameters?", options: ["Training set", "Validation set", "Test set"], correct: 1 },
  { q: "A model that scores well on training data but poorly on new data is...", options: ["Underfitting", "Overfitting", "Regularised"], correct: 1 },
  { q: "Which metric suits an imbalanced binary classifier best?", options: ["Accuracy", "F1 score", "Mean squared error"], correct: 1 },
];

async function seedAssessments(ctx: TenantCtx, refs: NorthwindRefs) {
  const api = adminAs(ctx);
  const ml = refs.courses[1];

  // Quiz + assignment in a "Checkpoint" section of Machine Learning Foundations.
  const sec = await api("POST", `/tenant/courses/${ml.id}/sections`, { title: "Checkpoint", sort_order: 9 });
  const quizLesson = await api("POST", `/tenant/courses/${ml.id}/sections/${sec.id}/lessons`, {
    title: "Checkpoint quiz",
    type: "QUIZ",
    sort_order: 0,
  });
  const quiz = await api("POST", `/tenant/courses/${ml.id}/lessons/${quizLesson.id}/quiz`, { title: "Checkpoint quiz" });
  for (const [i, item] of ML_QUIZ.entries()) {
    const q = await api("POST", `/tenant/courses/${ml.id}/quizzes/${quiz.id}/questions`, {
      question: item.q,
      question_type: "MCQ",
      marks: 1,
      sort_order: i,
    });
    for (const [oi, text] of item.options.entries()) {
      await api("POST", `/tenant/courses/${ml.id}/questions/${q.id}/options`, {
        option_text: text,
        is_correct: oi === item.correct,
        sort_order: oi,
      });
    }
  }
  await api("POST", `/tenant/quizzes/${quiz.id}/publish`);
  refs.quizId = quiz.id;

  const asgLesson = await api("POST", `/tenant/courses/${ml.id}/sections/${sec.id}/lessons`, {
    title: "Project: predict house prices",
    type: "ASSIGNMENT",
    sort_order: 1,
  });
  const asg = await api("POST", `/tenant/courses/${ml.id}/lessons/${asgLesson.id}/assignment`, {
    title: "Project: predict house prices",
    instructions: "Train a regression model on the provided dataset, report RMSE on the test split and explain one source of error.",
    resource_links: ["https://example.com/datasets/house-prices.csv"],
  });
  await api("POST", `/tenant/assignments/${asg.id}/publish`);

  // Test series: bank -> questions -> test with two sections -> series.
  const bank = await api("POST", "/tenant/test-question-banks", { name: "Data Science Aptitude" });
  const qDefs = [
    { text: "What is the median of 3, 7, 9, 12, 20?", options: ["7", "9", "10.2", "12"], correct: "B" },
    { text: "Which pandas method removes duplicate rows?", options: ["dropna()", "drop_duplicates()", "unique()", "filter()"], correct: "B" },
    { text: "Which chart best shows a distribution?", options: ["Pie chart", "Histogram", "Line chart", "Gauge"], correct: "B" },
    { text: "SQL clause that filters grouped rows?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], correct: "B" },
    { text: "Standard deviation measures...", options: ["Central tendency", "Spread", "Skew", "Correlation"], correct: "B" },
    { text: "A p-value below 0.05 usually means...", options: ["Accept the null", "Reject the null", "No conclusion", "Bad data"], correct: "B" },
  ];
  const qIds: string[] = [];
  for (const d of qDefs) {
    const q = await api("POST", "/tenant/test-questions", {
      question_bank_id: bank.id,
      type: "MCQ_SINGLE",
      stem: { text: d.text, description: "" },
      options: d.options.map((label, i) => ({ id: "ABCD"[i], label })),
      correct_answer: d.correct,
      marks: 4,
      negative_marks: 1,
      difficulty: "EASY",
    });
    qIds.push(q.id);
  }
  const test = await api("POST", "/tenant/tests", { name: "Data Analyst Mock Test 1", duration_min: 30, show_solutions: "IMMEDIATE" });
  for (const [name, ids] of [
    ["Statistics", [qIds[0], qIds[4], qIds[5]]],
    ["Tools", [qIds[1], qIds[2], qIds[3]]],
  ] as const) {
    const ts = await api("POST", `/tenant/tests/${test.id}/sections`, { name });
    await api("POST", `/tenant/tests/${test.id}/sections/${ts.id}/questions`, { items: ids.map((id) => ({ question_id: id })) });
  }
  await api("POST", `/tenant/tests/${test.id}/publish`);
  const series = await api("POST", "/tenant/test-series", {
    title: "Data Analyst Interview Prep",
    pricing_type: "FREE",
    visibility: "PUBLIC",
    access_mode: "OPEN",
  });
  await api("POST", `/tenant/test-series/${series.id}/tests`, { test_id: test.id, order_index: 0 });
  await api("POST", `/tenant/test-series/${series.id}/publish`);
  refs.testSeriesId = series.id;
  refs.testId = test.id;

  // Certificates, coupons, testimonials.
  await api("PUT", "/tenant/certificate-templates/select", { templateId: "modern-blue", logoUrl: null });
  await api("POST", "/tenant/certificate-templates/publish", { isPublished: true });
  await soft("certificate tab", () => api("PUT", "/tenant/certificates-settings", { certificate_tab_enabled: true }));

  const today = new Date().toISOString().slice(0, 10);
  const later = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10);
  await api("POST", "/tenant/coupons", {
    code: "WELCOME20",
    discount_type: "PERCENTAGE",
    discount_value: 20,
    valid_from: today,
    valid_to: later,
    max_uses: 100,
    max_uses_per_user: 1,
    is_public: true,
    applicable_to_all: true,
  });
  await api("POST", "/tenant/coupons", {
    code: "FLAT500",
    discount_type: "FIXED",
    discount_value: 500,
    currency: "INR",
    valid_from: today,
    valid_to: later,
    applicable_to_all: true,
  });

  for (const t of [
    { name: "Priya S.", text: "The pandas section finally made data cleaning click for me. I use it at work every day.", rating: 5 },
    { name: "Omar H.", text: "Clear explanations and realistic projects. The checkpoint quizzes kept me honest.", rating: 5 },
    { name: "Sofia R.", text: "Good pace, great instructors. I would love even more exercises.", rating: 4 },
  ]) {
    await api("POST", "/tenant/testimonials", { ...t, image_url: null, status: "APPROVED" });
  }
  step("northwind: quiz, assignment, test series, certificate, coupons, testimonials");
}

async function seedSiteAndPayments(ctx: TenantCtx) {
  const api = adminAs(ctx);

  // Home page from the "data-science" JSON template, then a custom brand colour.
  const home = await soft("home page", async () => {
    const existing = await adminApi("GET", "/pages/homepage", { token: ctx.token, tenantId: ctx.id, allow: [404] });
    return existing?.id
      ? existing
      : api("POST", "/pages", { slug: "home", title: "Home", sections: [], theme: {}, isPublished: true });
  });
  if (home) {
    await soft("apply template", () =>
      api("POST", "/pages/templates/apply", {
        templateId: "data-science",
        themeId: "corporate-slate",
        pageId: home.id,
        confirmReplace: true,
      })
    );
    await soft("brand colour", () => api("POST", "/pages/templates/apply-theme", { family: "blue", pageId: home.id }));
    await soft("publish home", () => api("POST", `/pages/${home.id}/publish`, { isPublished: true }));
  }

  // The rest of the storefront: sign-in, profile and the usual company pages,
  // each from its JSON page template, in the same theme as the home page.
  const utilityPages: Array<[slug: string, title: string, templateId: string]> = [
    ["login", "Login", "login-minimal"],
    ["profile", "Profile", "profile-minimal"],
    ["about", "About Us", "about-us"],
    ["contact", "Contact", "contact-us"],
    ["faq", "FAQ", "faq-us"],
    ["privacy", "Privacy Policy", "privacy-us"],
    ["terms", "Terms of Service", "terms-us"],
  ];
  for (const [slug, title, templateId] of utilityPages) {
    await soft(`${slug} page`, async () => {
      const page = await api("POST", "/pages", { slug, title, sections: [], theme: {}, isPublished: true });
      await api("POST", "/pages/templates/apply", {
        templateId,
        themeId: "corporate-slate",
        pageId: page.id,
        confirmReplace: true,
      });
      await api("POST", "/pages/templates/apply-theme", { family: "blue", pageId: page.id });
      await api("POST", `/pages/${page.id}/publish`, { isPublished: true });
    });
  }

  // Gateways: Razorpay and Stripe on the stub keys; sealed at rest by admin-api.
  const providers: any[] = await api("GET", "/tenant/payment/providers");
  const providerId = (name: string) => providers.find((p) => p.name === name)?.id;
  await api("POST", "/tenant/payment/gateway-connections", {
    provider_id: providerId("RAZORPAY"),
    mode: "SELF_MANAGED",
    label: "Razorpay (stub)",
    is_active: true,
    credentials: { key_id: STUB.razorpayKeyId, key_secret: STUB.razorpayKeySecret, webhook_secret: STUB.razorpayWebhookSecret },
  });
  // Created last, so Stripe is the tenant's active gateway (one active at a time).
  await api("POST", "/tenant/payment/gateway-connections", {
    provider_id: providerId("STRIPE"),
    mode: "SELF_MANAGED",
    label: "Stripe (stub)",
    is_active: true,
    credentials: {
      secret_key: STUB.stripeSecret,
      publishable_key: STUB.stripePublishable,
      webhook_secret: STUB.stripeWebhookSecret,
    },
  });
  step("northwind: home page, theme, Stripe + Razorpay connections");
}

// ---------------------------------------------------------------------------
// Learners (learner-api) and enrollments (admin-api)
// ---------------------------------------------------------------------------

interface LearnerCtx {
  email: string;
  name: string;
  memberId: string;
  token: string;
}

async function seedLearners(ctx: TenantCtx): Promise<LearnerCtx[]> {
  const host = tenantHost(ctx.def.slug);
  const out: LearnerCtx[] = [];
  for (const l of LEARNERS) {
    const r = await learnerApi("POST", "/auth/signup", { host, body: { email: l.email, password: PASSWORD, name: l.name } });
    out.push({ ...l, memberId: r.member.id, token: r.accessToken });
  }
  // Demo inboxes are not real, so mark the addresses verified (as for owners).
  await db
    .updateTable("tenant_members")
    .set({ email_verified: true })
    .where("tenant_id", "=", ctx.id)
    .where("id", "in", out.map((l) => l.memberId))
    .execute();
  step(`northwind: ${out.length} learners signed up`);
  return out;
}

async function bulkEnroll(ctx: TenantCtx, type: string, id: string, members: LearnerCtx[]) {
  await adminAs(ctx)("POST", "/tenant/members/bulk-enroll", {
    target: { type, id, batchId: null },
    memberIds: members.map((m) => m.memberId),
    validTill: null,
  });
}

async function seedActivity(ctx: TenantCtx, refs: NorthwindRefs, learners: LearnerCtx[]) {
  const host = tenantHost(ctx.def.slug);
  const as = (l: LearnerCtx) => (method: string, path: string, body?: unknown) =>
    learnerApi(method, path, { host, token: l.token, body });
  const [python, ml, web] = refs.courses;
  const [lee, priya, omar, sofia, kenji] = learners;

  await bulkEnroll(ctx, "COURSE", python.id, learners);
  await bulkEnroll(ctx, "COURSE", ml.id, [lee, priya, omar]);
  await bulkEnroll(ctx, "COURSE", web.id, [sofia, kenji, lee]);
  if (refs.batchId) await soft("batch enroll", () => bulkEnroll(ctx, "BATCH", refs.batchId!, [priya, omar]));
  step("northwind: bulk enrollments done");

  // Lecture progress: completed lectures plus a watch session each, so
  // watch-time analytics have rows too.
  const progress: [LearnerCtx, CourseOut, number][] = [
    [lee, python, python.lectures.length],
    [lee, ml, 3],
    [priya, python, 3],
    [priya, ml, 1],
    [omar, python, 1],
    [sofia, web, 2],
    [kenji, python, 2],
  ];
  for (const [l, course, count] of progress) {
    for (const lec of course.lectures.slice(0, count)) {
      await soft(`watch ${l.email}`, async () => {
        const sessionId = `${ulid()}demo`;
        await as(l)("POST", `/courses/${course.id}/lectures/${lec.id}/watch/heartbeat`, {
          sessionId,
          currentPosition: 5,
          deltaSeconds: 5,
          isSessionStart: true,
          isProgressFlush: false,
          durationSeconds: 600,
        });
        await as(l)("POST", `/courses/${course.id}/lectures/${lec.id}/watch/end`, { sessionId, currentPosition: 5 });
      });
      await as(l)("POST", `/courses/${course.id}/progress`, { lecture_id: lec.id, completed: true, watched_duration: 300, last_position: 300 });
    }
  }
  step("northwind: lecture progress recorded");

  // Quiz attempt (Lee passes, Priya does not).
  if (refs.quizId) {
    for (const [l, right] of [
      [lee, true],
      [priya, false],
    ] as const) {
      await soft(`quiz ${l.email}`, async () => {
        const detail = await as(l)("GET", `/quizzes/${refs.quizId}`);
        const questions: any[] = detail.questions ?? detail.quiz?.questions ?? [];
        await as(l)("POST", `/quizzes/${refs.quizId}/start`);
        const answers = questions.map((q: any, i: number) => {
          const opts: any[] = q.options ?? [];
          const want = right || i === 0 ? ML_QUIZ[i]?.correct ?? 0 : 0;
          return { question_id: q.id, option_id: opts[want]?.id ?? opts[0]?.id };
        });
        await as(l)("POST", `/quizzes/${refs.quizId}/submit`, { answers, tab_switch_count: 0 });
      });
    }
  }

  // Test attempts on the free test series.
  if (refs.testId && refs.testSeriesId) {
    for (const [l, correct] of [
      [lee, 5],
      [priya, 3],
      [omar, 4],
    ] as const) {
      await soft(`test ${l.email}`, async () => {
        const att = await as(l)("POST", "/test-attempts/start", { test_id: refs.testId, series_id: refs.testSeriesId });
        const qs: any[] = att.questions ?? [];
        for (const [i, q] of qs.entries()) {
          const qid = q.question_id ?? q.id;
          await as(l)("PATCH", `/test-attempts/${att.attemptId}/answer`, {
            question_id: qid,
            answer: i < correct ? "B" : "A",
            time_spent_sec: 20 + i * 5,
            marked_for_review: false,
          });
        }
        await as(l)("POST", `/test-attempts/${att.attemptId}/submit`, { tab_switch_count: 0 });
      });
    }
  }
  step("northwind: quiz and test attempts submitted");

  // One paid order: Lee buys Product Management Essentials through checkout
  // (Stripe stub), the stub pays it and fires the signed webhook.
  await soft("paid order", async () => {
    const pm = refs.courses[3];
    const order = await as(lee)("POST", "/checkout/create-order", { order_type: "COURSE", item_id: pm.id, currency: "USD" });
    const sessionId = order.client_config?.session_id ?? order.gateway_order_id;
    const res = await fetch(`${STUBS_URL}/stripe/checkout/${sessionId}/pay`, { method: "POST", redirect: "manual" });
    if (res.status >= 400) throw new Error(`stub pay returned ${res.status}`);
    // Fallback fulfilment (idempotent) in case the webhook has not landed yet.
    await as(lee)("POST", "/checkout/verify-payment", {
      order_id: order.order_id,
      gateway_order_id: order.gateway_order_id,
      gateway_payment_id: sessionId,
      signature: "",
    }).catch(() => undefined);
    const status = await as(lee)("POST", "/checkout/order-status", { order_id: order.order_id });
    step(`northwind: paid order ${order.order_number ?? order.order_id} status ${status?.status ?? "unknown"}`);
  });
}

async function seedAcme(ctx: TenantCtx) {
  const api = adminAs(ctx);
  await soft("acme subdomain", () => api("POST", "/tenant/domains/subdomain"));
  const ins = await api("POST", "/tenant/instructors", {
    name: "Arjun Mehta",
    email: ACME.owner.email,
    bio: "Robotics engineer and founder of Acme Robotics.",
    expertise: "Robotics",
  });
  const course = await createCourse(
    ctx,
    {
      title: "Robotics 101: Build Your First Robot",
      slug: "robotics-101",
      subtitle: "Motors, sensors and a microcontroller, step by step",
      description: "Assemble a two-wheeled robot, wire its sensors and program it to follow a line.",
      difficulty: "BEGINNER",
      free: true,
      outcomes: ["Wire motors and sensors safely", "Program a microcontroller", "Tune a line follower"],
      category: "",
      instructor: 0,
      sections: [
        {
          title: "Hardware basics",
          lectures: [
            { title: "Meet the kit", provider: "HLS", key: HLS_URL, duration: "10:34", preview: true },
            { title: "Motors and drivers", provider: "YOUTUBE", key: "8ImoP9l_z9g", duration: "08:00" },
          ],
        },
      ],
    },
    { categories: {}, instructors: [ins.id] }
  );
  await publish(ctx, "courses", course.id);
  step("acme: 1 course published");
}

function printSummary() {
  const rows: [string, string, string][] = [
    ["Operator console", CONSOLE_URL, OPERATOR_EMAIL],
    ["Tenant admin (Northwind, plan scale)", ADMIN_URL, NORTHWIND.owner.email],
    ["Tenant admin (Acme, plan starter)", ADMIN_URL, ACME.owner.email],
    ["Storefront Northwind", storefront(NORTHWIND.slug), LEARNERS.map((l) => l.email).join(", ")],
    ["Storefront Acme", storefront(ACME.slug), "(sign up on the storefront)"],
  ];
  const w0 = Math.max(...rows.map((r) => r[0].length));
  const w1 = Math.max(...rows.map((r) => r[1].length));
  console.log("");
  console.log(`${"What".padEnd(w0)}  ${"URL".padEnd(w1)}  Login`);
  console.log(`${"-".repeat(w0)}  ${"-".repeat(w1)}  ${"-".repeat(5)}`);
  for (const [a, b, c] of rows) console.log(`${a.padEnd(w0)}  ${b.padEnd(w1)}  ${c}`);
  console.log("");
  console.log(
    PASSWORD_FROM_ENV
      ? `Password for every account (DEMO_PASSWORD): ${PASSWORD}`
      : `Password for every account (random, set DEMO_PASSWORD to choose one): ${PASSWORD}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await preflight();

  const existing = await demoTenantIds();
  if (existing.length && !FORCE) {
    console.log("[demo-seed] already seeded (run with --force to wipe the demo tenants and rebuild)");
    return;
  }
  if (FORCE) await wipe();

  await ensureOperator();
  const op = await consoleApi("POST", "/admin/auth/login", { body: { email: OPERATOR_EMAIL, password: PASSWORD } });
  const opToken: string = op.token;

  const northwind = await createTenant(opToken, NORTHWIND);
  const acme = await createTenant(opToken, ACME);
  const refs = await seedNorthwindCatalog(northwind);
  await seedAssessments(northwind, refs);
  await seedSiteAndPayments(northwind);
  await publishNorthwind(northwind, refs);
  await seedAcme(acme);
  const learners = await seedLearners(northwind);
  await seedActivity(northwind, refs, learners);
  printSummary();
}

main()
  .catch((err) => {
    console.error("[demo-seed] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

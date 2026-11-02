/**
 * Seeds the platform catalog a fresh install needs before any tenant can be
 * onboarded: the `lms` application, its features (with the nav_* fields that
 * feed the tenant storefront navigation), the products (entitlement codes the
 * runtime checks), three plans with one PUBLISHED version each, and the two
 * platform billing providers (RAZORPAY, STRIPE).
 *
 *   pnpm seed:catalog
 *
 * Idempotent: applications, features, products, plans and billing providers
 * are upserted by their unique code/key/name. A plan version is created and
 * published only when the plan has no published version yet; published
 * versions are immutable, so a re-run never edits one. To change limits on a
 * live plan, publish a new version from the console.
 */
process.env.TZ = "UTC";

import { ulid } from "ulid";
import { db, pool } from "./lib/db";

type ConstraintType = "BOOLEAN" | "COUNT" | "LIMIT";

interface ProductDef {
  code: string;
  title: string;
  constraint_type: ConstraintType;
  unit?: string;
}

interface FeatureDef {
  key: string;
  name: string;
  description: string;
  category: string;
  nav?: { label: string; route: string; icon: string; sort: number };
  products: ProductDef[];
}

const APPLICATION = {
  code: "lms",
  name: "Learning",
  description: "Courses, books, bundles, batches, test series, quizzes and assignments.",
};

// Nav icons must be in the admin-api sidebar VALID_ICON_NAMES set.
const FEATURES: FeatureDef[] = [
  {
    key: "all_courses",
    name: "All Courses",
    description: "Storefront listing of every published course.",
    category: "content",
    nav: { label: "All Courses", route: "/all-courses", icon: "layout-grid", sort: 10 },
    products: [],
  },
  {
    key: "self_paced_courses",
    name: "Self-paced Courses",
    description: "Video and text courses learners take at their own pace.",
    category: "content",
    nav: { label: "Courses", route: "/self-paced", icon: "graduation-cap", sort: 20 },
    products: [
      { code: "self_paced_courses_enabled", title: "Self-paced courses", constraint_type: "BOOLEAN" },
      { code: "self_paced_courses_count", title: "Published self-paced courses", constraint_type: "COUNT", unit: "courses" },
    ],
  },
  {
    key: "books",
    name: "Books",
    description: "Digital books with an in-browser reader.",
    category: "content",
    nav: { label: "Books", route: "/books", icon: "book-open", sort: 30 },
    products: [
      { code: "books_enabled", title: "Books", constraint_type: "BOOLEAN" },
      { code: "books_count", title: "Published books", constraint_type: "COUNT", unit: "books" },
    ],
  },
  {
    key: "bundles",
    name: "Bundles",
    description: "Sell several courses and books together.",
    category: "commerce",
    nav: { label: "Bundles", route: "/bundles", icon: "package", sort: 40 },
    products: [
      { code: "bundles_count", title: "Bundles", constraint_type: "COUNT", unit: "bundles" },
    ],
  },
  {
    key: "batches",
    name: "Batches",
    description: "Cohort-based programs with a schedule and a roster.",
    category: "content",
    nav: { label: "Batches", route: "/batches", icon: "layers", sort: 50 },
    products: [
      { code: "batches_enabled", title: "Batches", constraint_type: "BOOLEAN" },
      { code: "batches_count", title: "Published batches", constraint_type: "COUNT", unit: "batches" },
    ],
  },
  {
    key: "testseries",
    name: "Test Series",
    description: "Timed mock tests with ranks and analysis.",
    category: "assessment",
    nav: { label: "Test Series", route: "/test-series", icon: "trophy", sort: 60 },
    products: [
      { code: "testseries_enabled", title: "Test series", constraint_type: "BOOLEAN" },
      { code: "testseries_count", title: "Published test series", constraint_type: "COUNT", unit: "test series" },
    ],
  },
  {
    key: "quizzes",
    name: "Quizzes",
    description: "Quizzes inside course lessons.",
    category: "assessment",
    products: [
      { code: "quizzes_enabled", title: "Quizzes", constraint_type: "BOOLEAN" },
      { code: "quiz_questions_per_quiz", title: "Questions per quiz", constraint_type: "LIMIT", unit: "questions" },
    ],
  },
  {
    key: "assignments",
    name: "Assignments",
    description: "Graded assignments inside course lessons.",
    category: "assessment",
    products: [
      { code: "assignments_enabled", title: "Assignments", constraint_type: "BOOLEAN" },
    ],
  },
  {
    key: "instructors",
    name: "Instructors",
    description: "Instructor profiles shown on courses.",
    category: "people",
    products: [
      { code: "instructors_count", title: "Instructors", constraint_type: "COUNT", unit: "instructors" },
    ],
  },
  {
    key: "testimonials",
    name: "Testimonials",
    description: "Learner testimonials, moderated by the tenant.",
    category: "people",
    nav: { label: "Testimonials", route: "/testimonials", icon: "star", sort: 70 },
    products: [
      { code: "testimonials_enabled", title: "Testimonials", constraint_type: "BOOLEAN" },
    ],
  },
  {
    key: "ai_authoring",
    name: "AI Authoring",
    description: "Generate course outlines, quiz questions and tests with AI.",
    category: "ai",
    products: [
      { code: "ai_authoring_enabled", title: "AI authoring", constraint_type: "BOOLEAN" },
    ],
  },
];

/** Limit per product code; `null` = unlimited; product left out = not in plan. */
type Limits = Record<string, number | null>;

interface PlanDef {
  code: string;
  name: string;
  description: string;
  sort_order: number;
  purchase_mode: "FREE" | "PAID";
  prices: { monthly_inr: number; yearly_inr: number; monthly_usd: number; yearly_usd: number };
  limits: Limits;
}

const PLANS: PlanDef[] = [
  {
    code: "starter",
    name: "Starter",
    description: "Free plan to launch a small academy.",
    sort_order: 1,
    purchase_mode: "FREE",
    prices: { monthly_inr: 0, yearly_inr: 0, monthly_usd: 0, yearly_usd: 0 },
    limits: {
      self_paced_courses_enabled: 1,
      self_paced_courses_count: 3,
      books_enabled: 1,
      books_count: 1,
      bundles_count: 1,
      batches_enabled: 1,
      batches_count: 1,
      quizzes_enabled: 1,
      quiz_questions_per_quiz: 20,
      assignments_enabled: 1,
      instructors_count: 2,
      testimonials_enabled: 1,
    },
  },
  {
    code: "growth",
    name: "Growth",
    description: "For growing academies: more content, test series and AI authoring.",
    sort_order: 2,
    purchase_mode: "PAID",
    prices: { monthly_inr: 2499, yearly_inr: 24990, monthly_usd: 49, yearly_usd: 490 },
    limits: {
      self_paced_courses_enabled: 1,
      self_paced_courses_count: 25,
      books_enabled: 1,
      books_count: 10,
      bundles_count: 10,
      batches_enabled: 1,
      batches_count: 5,
      testseries_enabled: 1,
      testseries_count: 5,
      quizzes_enabled: 1,
      quiz_questions_per_quiz: 100,
      assignments_enabled: 1,
      instructors_count: 10,
      testimonials_enabled: 1,
      ai_authoring_enabled: 1,
    },
  },
  {
    code: "scale",
    name: "Scale",
    description: "Unlimited content for established institutes.",
    sort_order: 3,
    purchase_mode: "PAID",
    prices: { monthly_inr: 7999, yearly_inr: 79990, monthly_usd: 149, yearly_usd: 1490 },
    limits: {
      self_paced_courses_enabled: 1,
      self_paced_courses_count: null,
      books_enabled: 1,
      books_count: null,
      bundles_count: null,
      batches_enabled: 1,
      batches_count: null,
      testseries_enabled: 1,
      testseries_count: null,
      quizzes_enabled: 1,
      quiz_questions_per_quiz: null,
      assignments_enabled: 1,
      instructors_count: null,
      testimonials_enabled: 1,
      ai_authoring_enabled: 1,
    },
  },
];

interface CredentialField {
  key: string;
  label: string;
  type: "text" | "secret" | "select";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
}

const BILLING_PROVIDERS: { name: string; schema: CredentialField[] }[] = [
  {
    name: "RAZORPAY",
    schema: [
      { key: "key_id", type: "text", label: "Key ID", required: true, placeholder: "rzp_live_..." },
      { key: "key_secret", type: "secret", label: "Key Secret", required: true },
      {
        key: "webhook_secret",
        type: "secret",
        label: "Webhook Secret",
        required: true,
        description: "The secret set on the Razorpay webhook endpoint.",
      },
    ],
  },
  {
    name: "STRIPE",
    schema: [
      { key: "secret_key", type: "secret", label: "Secret Key", required: true, placeholder: "sk_live_..." },
      {
        key: "webhook_secret",
        type: "secret",
        label: "Webhook Signing Secret",
        required: true,
        placeholder: "whsec_...",
      },
      { key: "publishable_key", type: "text", label: "Publishable Key", required: false, placeholder: "pk_live_..." },
    ],
  },
];

async function upsertApplication(now: Date): Promise<string> {
  const row = await db
    .insertInto("applications")
    .values({
      id: ulid(),
      code: APPLICATION.code,
      name: APPLICATION.name,
      description: APPLICATION.description,
      is_active: true,
      is_public: true,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    })
    .onConflict((oc) =>
      oc.column("code").doUpdateSet({
        name: APPLICATION.name,
        description: APPLICATION.description,
        updated_at: now,
      })
    )
    .returning(["id"])
    .executeTakeFirstOrThrow();
  return row.id;
}

async function upsertFeatures(applicationId: string): Promise<Map<string, string>> {
  const productIdByCode = new Map<string, string>();
  let sort = 0;
  for (const f of FEATURES) {
    sort += 10;
    const nav = {
      is_navigable: Boolean(f.nav),
      nav_label: f.nav?.label ?? null,
      nav_route: f.nav?.route ?? null,
      nav_icon: f.nav?.icon ?? null,
      nav_sort_order: f.nav?.sort ?? 0,
    };
    const feature = await db
      .insertInto("features")
      .values({
        id: ulid(),
        application_id: applicationId,
        key: f.key,
        name: f.name,
        description: f.description,
        category: f.category,
        sort_order: sort,
        ...nav,
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          application_id: applicationId,
          name: f.name,
          description: f.description,
          category: f.category,
          sort_order: sort,
          ...nav,
        })
      )
      .returning(["id"])
      .executeTakeFirstOrThrow();

    for (const p of f.products) {
      const product = await db
        .insertInto("products")
        .values({
          id: ulid(),
          feature_id: feature.id,
          code: p.code,
          title: p.title,
          constraint_type: p.constraint_type,
          unit: p.unit ?? null,
          is_hard_limit: true,
          usage_scope: "TENANT",
          usage_window: "LIFETIME",
        })
        .onConflict((oc) =>
          oc.column("code").doUpdateSet({
            feature_id: feature.id,
            title: p.title,
            constraint_type: p.constraint_type,
            unit: p.unit ?? null,
          })
        )
        .returning(["id"])
        .executeTakeFirstOrThrow();
      productIdByCode.set(p.code, product.id);
    }
  }
  console.log(`  features: ${FEATURES.length}, products: ${productIdByCode.size}`);
  return productIdByCode;
}

async function upsertPlans(
  applicationId: string,
  productIdByCode: Map<string, string>,
  now: Date
): Promise<void> {
  for (const def of PLANS) {
    const unknown = Object.keys(def.limits).filter((c) => !productIdByCode.has(c));
    if (unknown.length) {
      throw new Error(`Plan ${def.code} references unknown products: ${unknown.join(", ")}`);
    }

    const plan = await db
      .insertInto("plans")
      .values({
        id: ulid(),
        code: def.code,
        name: def.name,
        description: def.description,
        plan_type: "SINGLE_APP",
        sort_order: def.sort_order,
        is_active: true,
        is_public: true,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.column("code").doUpdateSet({
          name: def.name,
          description: def.description,
          sort_order: def.sort_order,
          updated_at: now,
        })
      )
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await db
      .insertInto("plan_applications")
      .values({ id: ulid(), plan_id: plan.id, application_id: applicationId })
      .onConflict((oc) => oc.columns(["plan_id", "application_id"]).doNothing())
      .execute();

    const published = await db
      .selectFrom("plan_versions")
      .select(["id", "version"])
      .where("plan_id", "=", plan.id)
      .where("published_at", "is not", null)
      .executeTakeFirst();
    if (published) {
      console.log(`  plan ${def.code}: v${published.version} already published, left as is`);
      continue;
    }

    await db.transaction().execute(async (trx) => {
      const latest = await trx
        .selectFrom("plan_versions")
        .select((eb) => eb.fn.max("version").as("max"))
        .where("plan_id", "=", plan.id)
        .executeTakeFirst();
      const version = Number(latest?.max ?? 0) + 1;
      const versionId = ulid();
      await trx
        .insertInto("plan_versions")
        .values({
          id: versionId,
          plan_id: plan.id,
          version,
          price_monthly_inr: String(def.prices.monthly_inr),
          price_yearly_inr: String(def.prices.yearly_inr),
          price_monthly_usd: String(def.prices.monthly_usd),
          price_yearly_usd: String(def.prices.yearly_usd),
          pricing_frequency: "BOTH",
          purchase_mode: def.purchase_mode,
          is_active: true,
          published_at: now,
          created_at: now,
        })
        .execute();
      await trx
        .insertInto("plan_version_products")
        .values(
          Object.entries(def.limits).map(([code, limit]) => ({
            id: ulid(),
            plan_version_id: versionId,
            product_id: productIdByCode.get(code)!,
            limit_value: limit ?? 0,
            is_unlimited: limit === null,
          }))
        )
        .execute();
      console.log(`  plan ${def.code}: v${version} created and published`);
    });
  }
}

async function upsertBillingProviders(now: Date): Promise<void> {
  for (const p of BILLING_PROVIDERS) {
    await db
      .insertInto("billing_providers")
      .values({
        id: ulid(),
        name: p.name,
        is_active: true,
        is_visible_to_tenant: true,
        credential_schema: JSON.stringify(p.schema),
        created_at: now,
        updated_at: now,
      })
      // Visibility and activation are operator decisions; a re-run only
      // refreshes the credential form.
      .onConflict((oc) =>
        oc.column("name").doUpdateSet({
          credential_schema: JSON.stringify(p.schema),
          updated_at: now,
        })
      )
      .execute();
  }
  console.log(`  billing providers: ${BILLING_PROVIDERS.map((p) => p.name).join(", ")}`);
}

async function main() {
  const now = new Date();
  console.log("[seed-catalog] seeding platform catalog");
  const applicationId = await upsertApplication(now);
  const productIdByCode = await upsertFeatures(applicationId);
  await upsertPlans(applicationId, productIdByCode, now);
  await upsertBillingProviders(now);
  console.log("[seed-catalog] done");
}

main()
  .catch((err) => {
    console.error("[seed-catalog] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

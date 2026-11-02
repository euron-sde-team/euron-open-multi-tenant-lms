# Multi-tenancy and entitlements

How tenants are kept apart, how the operator's catalog becomes a plan, how a plan becomes
per-tenant entitlements, and how usage is counted against them. The decision is
[ADR 0003](../adr/0003-entitlements-first.md). Paths are relative to the repository root.

## 1. Tenancy

- One Postgres database and one schema. Every tenant-owned table carries `tenant_id` with a
  cascading foreign key to `tenants` ([data-model.md](data-model.md#conventions)).
- The tenant of a request comes from the credential or the host, never from a body field:

  | API | Tenant |
  | --- | --- |
  | console-api | None. Operators act on any tenant; the tenant id is a path parameter (`/admin/tenants/:tenantId/...`) behind operator permissions |
  | admin-api | `X-Tenant-Id`, accepted only when the signed-in staff user has an `ACTIVE` membership in that tenant (else 403 `You do not have access to this tenant`). Without the header, the user's first active membership |
  | learner-api | The host ([HLD.md](HLD.md#4-tenant-resolution)) |

- Repositories filter on `tenant_id`. Many admin-api services load a row by id and then
  compare its `tenant_id` with the request's before writing; a row of another tenant answers
  404 like a missing one.
- Tenant status is enforced per API: admin-api's `requireActiveTenant` on most `/tenant/*`
  routes (mounted before the router's authentication, it marks the request and
  `authenticateTenantUser` enforces the status once the tenant is known; suspended tenants
  keep reads and subscription routes, cancelled ones only subscription routes); learner-api's
  `tenantStatusGuard` (suspended tenants are read-only, others offline).

## 2. Catalog: applications, features, products

The operator builds the catalog in the console (`/api/v1/admin/applications`, `/features`,
`/products`):

```
applications ── features ── products (BOOLEAN | COUNT | LIMIT) ── plan_version_products ── plan_versions ── plans
```

| Constraint | Meaning | Example |
| --- | --- | --- |
| `BOOLEAN` | A feature switch; enabled when `limit_value >= 1` or unlimited | `books_enabled` |
| `COUNT` | How many of something may exist or be published | `self_paced_courses_count` |
| `LIMIT` | A ceiling on a size | `quiz_questions_per_quiz` |

Each product also has `usage_scope` (`TENANT` or `USER`) and `usage_window` (`LIFETIME`,
`MONTHLY`, `YEARLY`, `DAILY`) that decide how its counter is keyed.

The seed ([`apps/console-api/scripts/seed-catalog.ts`](../../apps/console-api/scripts/seed-catalog.ts))
creates application `lms`, its features, 15 products (all tenant-scoped, lifetime, hard
limits) and three plans:

| Product | Starter (free) | Growth | Scale |
| --- | --- | --- | --- |
| `self_paced_courses_enabled` / `_count` | yes / 3 | yes / 25 | yes / unlimited |
| `books_enabled` / `books_count` | yes / 1 | yes / 10 | yes / unlimited |
| `bundles_count` | 1 | 10 | unlimited |
| `batches_enabled` / `batches_count` | yes / 1 | yes / 5 | yes / unlimited |
| `testseries_enabled` / `testseries_count` | no | yes / 5 | yes / unlimited |
| `quizzes_enabled`, `quiz_questions_per_quiz` | yes, 20 | yes, 100 | yes, unlimited |
| `assignments_enabled` | yes | yes | yes |
| `instructors_count` | 2 | 10 | unlimited |
| `testimonials_enabled` | yes | yes | yes |
| `ai_authoring_enabled` | no | yes | yes |
| Price (INR / USD per month) | 0 | 2499 / 49 | 7999 / 149 |

## 3. Plans and immutable versions

A plan has versions. A version holds prices (INR and USD, monthly, yearly and two-yearly,
each with an optional discount), `purchase_mode`, `grace_period_days`, the product limits
and optional offer fields. There is no status column; state is derived:

| State | Columns |
| --- | --- |
| Draft | `published_at` null |
| Live | `is_active = true` |
| Retired | `retired_at` set |

Rules, in [`apps/console-api/src/services/plan.service.ts`](../../apps/console-api/src/services/plan.service.ts):

- A published or active version cannot be edited (`403 Cannot modify a published version.
  Published versions are immutable.`), and its products cannot be added or removed.
  A retired version cannot be edited either.
- Publishing a version, in one transaction, retires the plan's current live version and makes
  the new one live. So a plan has at most one live version.
- A retired version may be published again. This is offer cycling: keep a normal version and
  a promotional one, and switch between them. Nothing switches automatically on
  `offer_valid_from` or `offer_valid_to`.
- A plan with active subscriptions cannot be deactivated.

Immutability is enforced in the service, not in the database: there is no trigger.

Existing subscribers keep the version they bought. To give them a version's new limits
without moving their subscription, `POST /admin/plans/:planId/entitlement-sync/preview` and
`/apply` push additions (and, with `raise_existing_limits`, increases only) to up to 500
subscribers, one transaction per tenant.

## 4. The snapshot

Runtime code never reads plans. When a tenant gets a plan, its terms are copied:

```mermaid
sequenceDiagram
  autonumber
  participant O as Operator or billing webhook
  participant S as Service
  participant P as Postgres
  O->>S: assign plan version to tenant
  S->>P: BEGIN; pg_advisory_xact_lock(hashtext('tenant-entitlements:<tenant>'))
  S->>P: archive PLAN-sourced entitlements
  S->>P: cancel the previous ACTIVE or TRIALING subscription and its tenant_applications
  S->>P: insert subscriptions (plan code, name, version and price snapshots)
  S->>P: upsert tenant_applications (source SUBSCRIPTION)
  S->>P: insert one entitlements row per plan_version_products row (source PLAN)
  S->>P: COMMIT
```

There are two paths into this:

| Path | Code | When |
| --- | --- | --- |
| Operator assigns | `assignPlanToTenant` in [`apps/console-api/src/services/subscription.service.ts`](../../apps/console-api/src/services/subscription.service.ts), `POST /admin/tenants/:tenantId/subscriptions` | The operator picks a version, cycle, currency, optional trial or validity window. Conflicts with current usage are refused unless `force` is set |
| Tenant pays | `createSubscriptionFromWebhook` in [`apps/admin-api/src/services/billing/subscription-billing.service.ts`](../../apps/admin-api/src/services/billing/subscription-billing.service.ts), on `subscription.authenticated` or `subscription.activated` | The tenant bought a plan from the tenant admin ([payments-and-currency.md](payments-and-currency.md#7-platform-billing-tenants-paying-the-operator)) |

An existing active `ADMIN` or `ADDON` entitlement for a product is left alone rather than
duplicated. Once copied, entitlements are independent of the plan: editing or retiring the
plan later changes nothing for the tenant.

Other sources:

| Source | Written by |
| --- | --- |
| `PLAN` | The snapshot above |
| `ADDON` | `grantAddon` in console-api (`POST /admin/tenants/:tenantId/addons`) |
| `ADMIN` | `createAdminEntitlement`, `revokeAdminEntitlement` in console-api |
| `PROMO` | Defined in the enum; no code writes it yet |

Overrides (`POST /admin/tenants/:tenantId/entitlements/:id/override`) need a reason of at
least 10 characters, write an `entitlement_overrides` row with the old and new limit, and set
the new limit. An override always makes the entitlement limited (`is_unlimited = false`).
Usage resets and manual updates also require a reason and are written to
`tenant_usage_events`.

Cancelling a subscription immediately archives its `PLAN` entitlements, cancels its
applications and suspends the tenant. A scheduled cancellation only sets
`cancel_effective_at`; the billing workers in admin-api act on the platform subscription
lifecycle (grace periods, scheduled cancellations).

## 5. Checking: default deny

All checks are in admin-api,
[`services/entitlements.service.ts`](../../apps/admin-api/src/services/entitlements.service.ts)
and [`services/usage.service.ts`](../../apps/admin-api/src/services/usage.service.ts):

| Call | Answers |
| --- | --- |
| `ensureBooleanEntitlement(tenantId, code, featureKey, message)` | Throws `EntitlementForbiddenError` (`ENTITLEMENT_FEATURE_DISABLED`) unless an active entitlement exists with `limit_value >= 1` or unlimited |
| `checkCapacity(tenantId, code, amount)` | `{ allowed, currentUsed, limit, isUnlimited, remainingSlots, warning }`; no active entitlement means `allowed: false, limit: 0`; `warning` when two or fewer slots remain |
| `consume(tenantId, code, amount, opts)` | Increments the counter, refusing with `ENTITLEMENT_LIMIT_REACHED` past the limit |
| `release(tenantId, code, amount, opts)` | Decrements, never below zero |

A missing entitlement row is a denial. A tenant with no plan can sign in and see its admin,
but every gated action is refused, and the admin sidebar shows the module locked.

Where the gates are:

| Product | Checked at |
| --- | --- |
| `self_paced_courses_enabled`, `self_paced_courses_count` | Course create and publish; publish consumes, unpublish and delete-while-published release |
| `books_enabled`, `books_count` | Book create and publish, book pages; publish consumes, unpublish releases |
| `bundles_count` | Bundle publish and unpublish |
| `batches_enabled`, `batches_count` | Batch create; publish and unpublish |
| `testseries_enabled`, `testseries_count` | Test series create and publish; release on unpublish and delete |
| `instructors_count` | Instructor create (consume) and delete (release) |
| `testimonials_enabled` | Testimonial create |
| `quizzes_enabled` | Creating a quiz lesson, a standalone quiz, or a quiz generated from a transcript |
| `assignments_enabled` | Creating an assignment lesson or a standalone assignment |
| `quiz_questions_per_quiz` | Adding a question, importing questions (spreadsheet or the question library) and AI question generation; checked against the quiz's current count |
| `ai_authoring_enabled` | `requireAiAuthoring` on the AI routes ([ai-authoring.md](ai-authoring.md)) |

Coupons, certificates, currencies and gateways are not gated.

The admin sidebar mirrors the server: features resolved from the tenant's applications and
entitlements decide whether a navigation item is `active` or `locked`
([LLD.md](LLD.md#front-ends)). The server check is the one that counts.

## 6. Usage counters

`entitlements` holds limits; `tenant_usage_counters` holds consumption. A counter is keyed by:

| Field | Values |
| --- | --- |
| `tenant_id`, `product_code` | |
| `scope_type`, `scope_id` | `TENANT` and `__TENANT__` (default), or `USER` and a member id |
| `window_type`, `window_start` | `LIFETIME` (start `1970-01-01`, a fixed sentinel), `MONTHLY` (first of the month, UTC), `YEARLY` (1 January, UTC). `computeWindowStart` treats `DAILY` like lifetime |

Windows need no cron: a new window is simply a new counter row. `entitlements.used_value` is
deprecated; reads come from counters.

`consume`, in [`usage.service.ts`](../../apps/admin-api/src/services/usage.service.ts):

1. Make sure the counter row exists (insert, ignoring a unique violation from a concurrent
   insert, then re-read).
2. In a transaction: if an idempotency key was given and already used, stop; lock the counter
   with `SELECT ... FOR UPDATE`; refuse if `current_value + amount` exceeds the limit;
   update `current_value = current_value + amount`; insert a `CONSUME` row in
   `tenant_usage_events` with the resulting value.

The row lock is what keeps two cluster workers from both taking the last slot.
`release` subtracts with `GREATEST(0, current_value - amount)` and records a `RELEASE`.
`reconcile` recounts the real rows (published courses, books, bundles, instructors) and sets
the counter, recording a `RECONCILE`; the `usage-reconciliation` worker runs it with
auto-correct every 30 minutes, and operators can run it for one tenant
(`POST /admin/tenants/:tenantId/entitlements/reconcile`).

## 7. Limits of the model

- Publish and unpublish consume or release after the status update, outside its
  transaction, and pass no idempotency key. A crash between the two leaves the counter off by
  one until reconciliation. Batch and bundle publish toggles do not check the previous state,
  so a repeated publish consumes again; bundles are reconciled, batches are not.
- Lifetime counters use the `1970-01-01` sentinel rather than null so the unique key on
  `tenant_usage_counters` holds (Postgres treats nulls as distinct). Rows written with a null
  `window_start` before the sentinel are still matched as lifetime counters
  ([`usage-counters.repository.ts`](../../apps/admin-api/src/repositories/usage-counters.repository.ts)).
- Add-on and admin grants do not take the per-tenant advisory lock the plan paths take.
- The console API has no scheduler, so dates on operator-assigned subscriptions
  (`cancel_effective_at`, trial ends) are not acted on by it.

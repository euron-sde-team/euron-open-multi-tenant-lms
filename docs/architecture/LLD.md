# Low-level design (LLD)

The apps and packages in code: how a request moves through an API, what each API runs in the
background, and how the front ends are put together. The big picture is in
[HLD.md](HLD.md). Paths are relative to the repository root.

## Repository layout

| Path | What |
| --- | --- |
| `apps/console-api` | Tier 1 API (Express 5, Kysely), port 5076 |
| `apps/admin-api` | Tier 2 API, port 5086 |
| `apps/learner-api` | Tier 3 API, port 5096 |
| `apps/console` | Operator console (Next.js 14), port 3600 |
| `apps/admin` | Tenant admin (Next.js 14), port 3610 |
| `apps/web` | Learner storefront (Next.js 14, SSR), port 3620 |
| `apps/stubs` | Local stand-ins for Stripe, Razorpay, EVS and an OpenAI-compatible API, port 5189 |
| `packages/db` | `schema.prisma` and the generated Kysely types |
| `packages/shared` | Types, Zod schemas, constants (sections, currencies), money and asset helpers |
| `packages/ui-config` | Section registry, theme presets, layout templates, course themes |
| `packages/core` | Radix-based UI kit and the section components used by admin and web |
| `packages/lms-templates` | Page templates, the LMS player templates and the video player |
| `packages/course-templates`, `book-templates`, `certificate-templates` | Landing pages for courses and books, certificate designs |
| `packages/eslint-config` | Shared lint rules |
| `db/` | `migrate.ts` and the SQL migrations |
| `deploy/compose`, `infra/docker`, `infra/terraform` | Local stack, images, AWS |
| `e2e/` | Playwright specs (`e2e/tests/01` to `04`) and their harness |

## API layering

The three APIs share one shape:

```
src/
  index.ts          cluster primary and workers, job startup, graceful shutdown
  app.ts            middleware order, raw-body webhook mounts, routers, error handler
  config/index.ts   every environment variable, defaults, assertProductionConfig()
  db/               connection.ts (pg pool + Kysely), types.ts and enums.ts (generated)
  routes/           Router per domain: asyncHandler + auth + permission middleware
  controllers/      read req, call a service, sendSuccessResponse
  services/         business rules, transactions, entitlement checks; throw typed errors
  repositories/     Kysely queries, each taking an optional transaction
  middlewares/      auth, permissions, rate limits, tenant resolution, sanitizer, errors
  queues/           BullMQ queues and workers (admin-api, learner-api)
  errors/           BadRequestError, NotFoundError, ForbiddenError, ...
```

A request goes **route, controller, service, repository, Kysely**:

```ts
// routes/bundles.route.ts
router.use(asyncHandler(authenticateTenantUser));
router.post("/:id/publish", asyncHandler(requirePermission("bundles.publish")), asyncHandler(togglePublish));

// controllers: no business logic
export const togglePublish = async (req: Request, res: Response) => {
  const result = await bundlesService.togglePublish(req.tenantId!, req.params.id);
  sendSuccessResponse({ res, data: result, statusCode: HttpSuccessStatus.OK, message: "Bundle updated" });
};

// services: singletons (export default new BundlesService()), rules and transactions
// repositories: (trx || db).selectFrom("bundles").where("tenant_id", "=", tenantId)...
```

Conventions:

- Services and repositories are singletons. Repositories accept an optional Kysely
  transaction and use `(trx || db)`.
- Primary keys are ULIDs minted in code.
- Every handler is wrapped in `asyncHandler`; services throw typed errors and never return
  error objects.
- Responses are `{ success, data, message, statusCode }`. Errors are
  `{ success: false, error: { message }, message: "route: ..., errorMsg: ..., rayId: ...",
  statusCode }`; the 18-character `rayId` (nanoid) is in the log line too. Messages of
  unexpected errors are hidden in production.
- Postgres `timestamp` columns are read as UTC (`pg.types.setTypeParser(1114, ...)`) and
  every process sets `TZ=UTC` first.
- `bigint` columns arrive as strings and are parsed before arithmetic.

### Middleware order

| Step | console-api | admin-api | learner-api |
| --- | --- | --- | --- |
| Proxy | `trust proxy` = `TRUST_PROXY` hops (default 1; compose 0) | same | same |
| CORS | Allowlist from `CORS_ORIGINS` (default `http://localhost:3600`); requests with no `Origin` pass | Allowlist from `CORS_ORIGINS`; empty means any origin | `Access-Control-Allow-Origin: *` without credentials (storefront origins are open-ended; auth is a bearer header) |
| Raw-body mounts | none | `/api/v1/webhook` (platform billing) | `/api/v1/webhooks` (tenant gateways) |
| Body parsers | JSON and urlencoded, 10 MB | JSON and urlencoded, 10 MB | JSON and urlencoded 10 MB, `text/plain` 4 KB (watch beacons) |
| Helmet | CSP, frameguard deny | CSP, frameguard deny, CORP cross-origin | CSP, frameguard deny, CORP cross-origin |
| XSS sanitizer | Every request; `&amp;` restored to `&` afterwards | Every request, except `sections`, `customHtml`, `customHtmlDraft` under `/api/v1/pages` and lesson resource `content`; `&` restored | Every request; `&` restored |
| Before routers | Audit of admin mutations | `auditLog()` on `/tenant` and `/pages` | `/api/v1/internal` (internal key), `tenantResolverMiddleware`, `tenantStatusGuard` |
| Auth rate limits | On `POST /admin/auth/login`, in memory | On signup, login, password reset and email verification, in memory | On every credential route, in Redis ([security.md](security.md#1-authentication-per-tier)) |
| Health | `GET /api/v1/health` | `GET /api/v1/health` | `GET /api/v1/health` |

`/health` answers `{ status: "running", timestamp, timezone }` without touching the database
or Redis, so it shows that the process is up, not that it can serve.

### Authentication per API

| API | Middleware | Token | Then |
| --- | --- | --- | --- |
| console-api | `authenticateAdmin` ([`admin.auth.middleware.ts`](../../apps/console-api/src/middlewares/admin.auth.middleware.ts)) | `{ id, email, type: "admin" }`, `JWT_SECRET`, `JWT_EXPIRY` default `24h` | The operator is re-read and must be `ACTIVE`; roles and permissions loaded per request; `requirePermission("plans.manage")`, `requireRole`; `SUPERADMIN` passes every check |
| admin-api | `authenticateTenantUser` and a lenient variant ([`auth.middleware.ts`](../../apps/admin-api/src/middlewares/auth.middleware.ts)) | `{ id, email, type: "tenant" }`, `JWT_SECRET`, default `24h` | User must be `ACTIVE`; `X-Tenant-Id` must match an active staff membership (else the first active one); tenant status enforced when the route is behind `requireActiveTenant`; permissions from the team service; `requirePermission`, `requireAnyPermission`; feature gates |
| learner-api | `authenticateUser`, `optionalAuth` ([`auth.middleware.ts`](../../apps/learner-api/src/middlewares/auth.middleware.ts)) | `{ id, type: "learner", tenantId, email, sessionToken }`, `LEARNER_JWT_SECRET`, default `30d` | `tenantId` must equal the host's tenant; the session row in `tenant_member_sessions` must be active (one active session per member) and the member's status valid |

Details and gaps: [security.md](security.md).

## Process model

Each API's `index.ts` forks a Node cluster: one worker per CPU when
`NODE_ENV=production`, one otherwise. A dead worker is re-forked after one second. On
`SIGTERM` the primary disconnects every worker and kills them after 30 seconds; each worker
stops accepting connections, stops its queue workers, closes Redis and exits.
`assertProductionConfig()` runs before any worker starts ([security.md](security.md#5-production-configuration-guard)).

Each worker has its own `pg` pool (`PG_POOL_MAX` per worker), so the connection budget of
one task is `workers x PG_POOL_MAX`.

## Background work

### admin-api

Every cluster worker starts the job workers unless `RUN_JOB_WORKERS=false`. Recurring jobs
are registered with `upsertJobScheduler`, so several workers never create duplicate
schedules; each job runs once per tick on whichever worker takes it. Keys use
`BULLMQ_PREFIX` (default `bull`).

| Queue | Schedule | Does |
| --- | --- | --- |
| `fx-refresh` | every 24 h | Refresh stored exchange rates |
| `bulk-imports` | on demand | CSV and XLSX member onboarding |
| `analytics-export` | on demand | Build analytics exports |
| `domain-verification` | every 2 min | Verify storefront custom domains |
| `email-sending-domain-verification` | every 60 s | Verify tenant SES sending domains |
| `email-dlq-monitor` | every 5 min | Depth of the SES events dead-letter queue |
| `email-reputation-sweep` | every 10 min | Pause tenants whose bounce or complaint rates are too high |
| `email-domain-health` | daily 03:00 UTC | Fail a sending domain after 24 h of DNS failure |
| `email-account-health` | every 5 min | Account-wide sending brake |
| `grace-period-expiry` | hourly | Platform subscriptions past grace: archive entitlements, suspend the tenant |
| `subscription-poll-reconciliation` | every 2 min | Ask the billing provider about pending checkouts (webhook fallback) |
| `subscription-notification` | every 24 h | Dunning and suspension notices |
| `usage-reconciliation` | every 30 min | Recount usage and correct counter drift |
| `course-ai-generation`, `book-ai-generation`, `batch-ai-generation`, `test-ai-generation`, `test-series-ai-generation`, `page-plan-ai-generation`, `page-image-ai-generation` | on demand | AI authoring jobs ([ai-authoring.md](ai-authoring.md)) |
| `onboarding-finalize` | on demand | Finish provisioning a new academy |

Outside BullMQ: a footer sync loop every 5 minutes, and an SQS long-poll consumer for SES
events when `SES_EVENTS_QUEUE_URL` is set. admin-api also produces jobs on
`user-notification`, which learner-api consumes.

### learner-api

| Queue or task | Schedule | Does |
| --- | --- | --- |
| `webhook-fulfillment` | on demand, concurrency 5, 3 attempts, exponential backoff from 10 s | Grant access after a payment ([payments-and-currency.md](payments-and-currency.md)) |
| `user-notification` | on demand, concurrency 5 | Welcome, purchase, enrollment and subscription email |
| `subscription-lifecycle` | grace-period check hourly, dunning every 6 h, renewal reminder daily, grace warning every 6 h, pending verification every 2 min | Learner subscriptions |
| `watch-time-rollup` | rollup at minute 5 of each hour, sweeper every 5 min, archive daily 02:00 | Watch sessions to daily totals; close sessions with no heartbeat for 5 min; delete sessions older than 90 days |
| Cache-bust subscriber | Redis pub/sub | Drop cached tenant config on change |
| Search refresh | every 5 min on cluster worker 1, under an advisory lock | `REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_search_mv` |

### console-api

No queues and no timers. Nothing in console-api acts on dates by itself (for example a
subscription's `cancel_effective_at`); platform subscription lifecycles are driven by
admin-api's billing workers.

## Front ends

| App | State | Token | Talks to |
| --- | --- | --- | --- |
| `apps/console` | React Query v3, React Context | `localStorage.adminAuthToken` | `NEXT_PUBLIC_API_BASE_URL` (console-api) |
| `apps/admin` | TanStack Query v5, Zustand (`admin-auth-storage`, `lms-admin-tenant-store`, `lms-admin-editor-store`, ...) | `localStorage.admin_auth_token`, copied to a cookie of the same name for `middleware.ts` | `/api/proxy` rewritten to `API_PROXY_TARGET` (build arg), else `NEXT_PUBLIC_API_BASE_URL` (admin-api), with `X-Tenant-Id` |
| `apps/web` | TanStack Query v5, Zustand (`user-auth-storage`), `next-themes` | `localStorage.authToken` | `NEXT_PUBLIC_API_BASE_URL` from the browser, `API_INTERNAL_BASE_URL` from the server, always with `X-Tenant-Host` |

- **console:** client-side route guard (`ProtectedRoute`); sections for applications,
  features, products, plans and versions, add-ons, tenants and their users, members,
  subscriptions, billing providers, operator users and roles, and audit events.
- **admin:** `middleware.ts` sends visitors without the token cookie to `/login`. The sidebar
  comes from `navigation-registry.ts`; `feature-access-store.ts` marks each item `active`,
  `locked` or `coming_soon` from the tenant's features, and a locked item is drawn at half
  opacity with a lock and a link to `/dashboard/plans`. `FeatureGate` shows a "Feature
  Locked" page for direct visits. Route-level permissions are in `route-permissions.ts`.
  Editors: pages (`dashboard/pages/[id]/editor`), course landing pages
  (`dashboard/courses/[id]/editor`), course curriculum (`dashboard/courses/[id]/lms/editor`),
  books (`dashboard/books/[id]/editor`), custom-code pages.
- **web:** `middleware.ts` resolves the tenant through learner-api and forwards it as
  headers; every page uses the two-layer theming pattern
  ([templates-and-theming.md](templates-and-theming.md)).

In the course routes of the tenant admin, the `[id]` URL parameter is the id of the course's
landing page in `tenant_pages`, not the `courses` row: the editor resolves the course id from
the page slug before calling the LMS endpoints.

## Shared code that is copied

Some code exists once per API rather than in a package, because each API compiles on its own
([ADR 0001](../adr/0001-three-apis-one-schema.md)):

| Code | Copies |
| --- | --- |
| Generated `types.ts`, `enums.ts` | `apps/*-api/src/db/`; CI fails on drift (`pnpm db:types:check`) |
| Currency registry | `apps/{console,admin,learner}-api/src/utils/currency-registry.ts` and `packages/shared/src/constants/currencies.ts` |
| Credential sealing (`sealSecret`, `openSecret`) | `apps/admin-api/src/utils/crypto.ts`, `apps/learner-api/src/utils/crypto.ts` |
| Served question order and shuffle | admin-api and learner-api; a test in each pins the output |
| Config loading, errors, logger, response helpers | each API |

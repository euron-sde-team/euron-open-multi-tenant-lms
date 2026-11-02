# Security architecture

The controls Euron Open Multi-Tenant LMS relies on, where each lives in the code, and what
it does not cover yet. The STRIDE analysis is [threat-model.md](threat-model.md). Paths are
relative to the repository root.

This is an early release. Read the [known gaps](#known-gaps) before putting real learners
or real money on it.

## 1. Authentication per tier

| | Operators (console-api) | Tenant staff (admin-api) | Learners (learner-api) |
| --- | --- | --- | --- |
| Sign-in | `POST /api/v1/admin/auth/login`, email and password | `POST /api/v1/tenant/auth/login`, signup, forgot and reset password | `POST /api/v1/auth/login`, signup, Google, email one-time code, "easy checkout" |
| Password hashing | bcrypt, 12 rounds | bcrypt, 12 rounds | bcrypt, 12 rounds, minimum 6 characters |
| Token | HS256 JWT `{ id, email, type: "admin" }`, signed with `JWT_SECRET` | HS256 JWT `{ id, email, type: "tenant" }`, signed with `JWT_SECRET` | HS256 JWT `{ id, type: "learner", tenantId, email, sessionToken }`, signed with `LEARNER_JWT_SECRET` |
| Lifetime | `JWT_EXPIRY`, default `24h` | `JWT_EXPIRY`, default `24h` | `JWT_EXPIRY`, default `30d` |
| Checked per request | Signature, `type`; the operator is re-read and must be `ACTIVE`; roles and permissions reloaded | Signature, `type`; the user is re-read and must be `ACTIVE`, the staff membership for `X-Tenant-Id` must be `ACTIVE`; permissions reloaded | Signature with the learner secret, `type` `learner`, and `tenantId` equal to the tenant resolved from the host; then the session row must be active and the member's status valid |
| Sign-out | No effect on the token | No effect on the token | Deactivates the session row |
| Revocation | Suspending or deactivating the operator takes effect on the next request | Suspending the user or the membership takes effect on the next request | One active session per learner: a new sign-in ends the others; a password reset ends all |
| Second factor | None | None | None |

A staff or operator token never verifies on learner-api (another secret and another
`type`), and a learner token from one storefront is refused on another tenant's host
(`Token does not belong to this site`). In production learner-api refuses to start unless
`LEARNER_JWT_SECRET` is at least 32 characters and differs from `JWT_SECRET`; outside
production it falls back to `JWT_SECRET`.

**Rate limits on the public auth routes.**

| API | Routes | Limits (defaults) | Counters |
| --- | --- | --- | --- |
| console-api ([`rate-limit.middleware.ts`](../../apps/console-api/src/middlewares/rate-limit.middleware.ts)) | `POST /admin/auth/login` | 30 per IP and 10 per email per 15 minutes (`AUTH_RATE_LIMIT_PER_IP`, `AUTH_RATE_LIMIT_PER_EMAIL`, `AUTH_RATE_LIMIT_WINDOW_MS`); 429 with `Retry-After` | In process memory |
| admin-api ([`rate-limit.middleware.ts`](../../apps/admin-api/src/middlewares/rate-limit.middleware.ts), `express-rate-limit`) | Signup, login, forgot password, reset password, verify email, each with its own counters | Same variables and defaults; sending a verification code is also limited to 10 per IP per minute | In process memory |
| learner-api ([`utils/rate-limit.ts`](../../apps/learner-api/src/utils/rate-limit.ts), [`routes/auth.route.ts`](../../apps/learner-api/src/routes/auth.route.ts)) | Login (30 per IP, 10 per email), signup (20, 5), Google (30 per IP), code send (30, 5), code verify (30, 10), easy checkout (30, 5 per email and per phone), forgot password (20, 5), reset password (20 per IP), all per 10 minutes and keyed per tenant | Each budget is multiplied by `AUTH_RATE_LIMIT_SCALE` (default 1) | In Redis (`<CACHE_BUS_PREFIX>rl:<label>:<key>`), shared by every worker and task; per process when Redis is unreachable |

Every limiter keys on `req.ip`, which honours `TRUST_PROXY`, so a client cannot choose its
own key with `X-Forwarded-For`. The local compose stack raises the limits for repeated
demo and end-to-end runs (`MTLMS_AUTH_RATE_LIMIT_PER_EMAIL` 100, `_PER_IP` 300, `_SCALE`
10); production keeps the defaults.

One-time codes for learners are email only (`OTP_LENGTH` 6, valid `OTP_EXPIRY_MINUTES` 15,
`OTP_MAX_ATTEMPTS` 5, one resend per 60 seconds). Learner password reset tokens are random
UUIDs valid 15 minutes, and the reset link is built from the tenant's own domain, never from
the request. Forgot password does not reveal whether an account exists.

All three front ends keep the bearer token in `localStorage` (`adminAuthToken`,
`admin_auth_token`, `authToken`); the tenant admin also copies its token into a cookie of the
same name, set from JavaScript, so `middleware.ts` can redirect signed-out visitors. Any
script running in those origins can read the token.

## 2. Authorisation

**Operators.** Permissions such as `plans.manage`, `tenants.manage`,
`entitlements.override` are seeded by `apps/console-api/scripts/seed-admin-permissions.ts`
and grouped into roles by `seed-roles.ts` (`SUPERADMIN`, `ADMIN`, `OPS`, `FINANCE`).
`requirePermission` and `requireRole` let `SUPERADMIN` through every check. Role and
permission changes, and permission definitions, need `SUPERADMIN`.

**Tenant staff.** The tenant's owner (`tenants.owner_user_id`) holds every permission. Staff
with the `admin` role hold every permission except the owner-only ones (`gateway.configure`,
`roles.manage`, `staff.manage`, `settings.auth`). Other roles, including up to 10 custom roles
per tenant, hold what they are assigned, never the owner-only codes
([`services/team.service.ts`](../../apps/admin-api/src/services/team.service.ts)).
`requirePermission` answers 403 `Tenant context required` when no tenant was resolved. The
admin front end mirrors the permissions in `route-permissions.ts`, for convenience only.

**Entitlements** are a second gate on tenant features, after permissions
([multi-tenancy-and-entitlements.md](multi-tenancy-and-entitlements.md#5-checking-default-deny)).
A missing entitlement denies.

**Learners** reach only their own records: services take the member id from the token and
the tenant from the host. Course content and playback require an active enrollment
([video.md](video.md)).

## 3. Tenant isolation

- One schema, `tenant_id` on every tenant table, repositories filtering on it.
- admin-api takes the tenant from `X-Tenant-Id` only after checking an active membership.
- learner-api takes the tenant from the host and caches the lookup per worker for 60
  seconds; a learner token is accepted only on the host of the tenant that issued it.
- Tenant status: learner-api's `tenantStatusGuard` makes a `SUSPENDED` tenant read-only and
  takes other non-active tenants offline. admin-api's `requireActiveTenant` is mounted
  before each router's authentication, so it marks the request and `authenticateTenantUser`
  enforces the status once it has resolved the tenant (suspended: reads and subscription
  routes only; cancelled: subscription routes only; pending: refused).
- Webhooks look the order up across tenants by the gateway's order or session id, then verify
  the signature with that order's tenant's secret before acting.
- No row-level security exists behind the application code. A repository query that forgets
  `tenant_id` leaks data.

## 4. Secrets

| Secret | Used for | Where |
| --- | --- | --- |
| `JWT_SECRET` | Signs operator and staff tokens (and List-Unsubscribe tokens when `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` is unset) | `<name_prefix>/app` in Secrets Manager on AWS; `deploy/compose/.env` locally |
| `LEARNER_JWT_SECRET` | Signs learner tokens; read by learner-api only | Same |
| `CREDENTIALS_ENCRYPTION_KEY` | Seals tenant gateway credentials (AES-256-GCM, key `sha256(value)`, prefix `enc:v1:`); also console-api's application config (scrypt with `APP_CONFIG_SALT`) | Same |
| `INTERNAL_API_KEY` | Service-to-service calls (`x-internal-key`, for example learner-api `/api/v1/internal/*`) | Same |
| `PG_DATABASE_PASSWORD`, `REDIS_URL` | Database and cache | `<name_prefix>/database`, the cache module's secret |
| `PLATFORM_*`, `EVS_API_KEY`, `AI_API_KEY` | Operator accounts | `<name_prefix>/providers` |
| Tenant gateway keys | Learner checkout | `tenant_gateway_connections.credentials_encrypted`, sealed; never returned by the API |

On AWS, ECS injects secrets as environment variables; they never appear in a task
definition. Terraform generates the four application secrets and ignores later changes to
them, so rotation is done by hand ([operations.md](../guides/operations.md#rotating-secrets)).
admin-api's logger redacts known sensitive keys (`token`, `access_token`, keys and secrets)
from structured log data; every API's request-log helper drops passwords, tokens and
gateway `credentials` from logged bodies.

## 5. Production configuration guard

Each API calls `assertProductionConfig()` before it serves. With `NODE_ENV=production` it
refuses to start when:

| API | Refuses |
| --- | --- |
| console-api | `JWT_SECRET` or `CREDENTIALS_ENCRYPTION_KEY` is the development default or shorter than 32 characters; `INTERNAL_API_KEY` is set and shorter than 32; `APP_CONFIG_SALT` is the default |
| admin-api | `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` or `INTERNAL_API_KEY` is the default or shorter than 32; `CORS_ORIGINS` is empty |
| learner-api | `JWT_SECRET`, `LEARNER_JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` or `INTERNAL_API_KEY` is the default or shorter than 32; `LEARNER_JWT_SECRET` equals `JWT_SECRET` |

It does not check the database password, the provider keys or the URLs. Terraform's task
definitions set `NODE_ENV=production`; compose sets `development`. The guards are covered by
`apps/console-api/tests/integration/production-config.test.ts`.

## 6. Web and transport

- `trust proxy` is a hop count, `TRUST_PROXY` (default 1, the load balancer; compose sets 0
  because browsers reach the APIs directly). Never `true`, so `X-Forwarded-For` cannot be
  spoofed into `req.ip`.
- CORS: console-api allows only `CORS_ORIGINS` (requests without an `Origin` pass);
  admin-api reflects an allowed origin with credentials and allows any origin only when
  `CORS_ORIGINS` is empty (refused in production); learner-api answers `*` without
  credentials, because storefront origins are open-ended and auth is a bearer header, never
  a cookie.
- Helmet on every API: a restrictive CSP, `frame-ancestors` denied, no sniffing.
- An XSS sanitizer (`express-xss-sanitizer`) on request bodies, queries and parameters. It is
  kept because the storefront renders rich HTML; after it runs, `&amp;` is turned back into
  `&` so URLs with query strings round-trip
  ([`sanitize.middleware.ts`](../../apps/admin-api/src/middlewares/sanitize.middleware.ts),
  same in each API). admin-api exempts `sections`, `customHtml` and `customHtmlDraft` on
  `/api/v1/pages` (sections are plain text rendered as React text nodes; custom code runs in a
  sandbox) and lesson resource `content`.
- Tenant strings in the storefront's `<head>` are escaped: JSON-LD is serialised with `<`
  written as `\u003c` ([`lib/seo.tsx`](../../apps/web/src/lib/seo.tsx)), and theme values pass
  `safeCssValue` ([`lib/theme-css-value.ts`](../../apps/web/src/lib/theme-css-value.ts)),
  which keeps only plain colours, lengths, numbers and font lists and drops anything that
  could close a declaration, a rule or the `<style>` element.
- The public page endpoint (`GET /api/v1/pages/tenant/:tenantId/slug/:slug`) returns only the
  published content: no drafts, no staff user ids, and no custom code on a moderated page.
- Custom-code pages render in a sandboxed iframe without `allow-same-origin`
  ([templates-and-theming.md](templates-and-theming.md#6-custom-code-pages)).
- On AWS: TLS at the load balancer, a regional WAF (AWS common and known-bad-inputs rules,
  a 3000 per 5 minutes per-IP rate limit that exempts `/api/v1/webhook*`), private subnets,
  RDS with `rds.force_ssl` and `PGSSLMODE=verify-full` against the bundled RDS CA, Redis with
  TLS and an AUTH token (`REDIS_URL` with `rediss://`, honoured by admin-api and learner-api;
  console-api uses no Redis), a private, TLS-only, KMS-encrypted bucket, CloudFront reading
  only `public/`, read-only container root filesystems
  ([deploy-aws.md](../guides/deploy-aws.md)).
- Logs go to stdout only; `LOG_FILE` adds a file transport and `LOG_LEVEL` sets the level
  (console-api and admin-api default to `info` in production and `debug` otherwise;
  learner-api defaults to `debug`, and Terraform sets `LOG_LEVEL` for all three).

## 7. Payments

Webhook signatures are verified over the raw body with the tenant's secret before any state
changes; events are deduplicated by provider event id; fulfillment is idempotent
([payments-and-currency.md](payments-and-currency.md#idempotency-layers)). Every path that
marks an order paid binds the gateway's answer to the stored order
([`services/payment/order-match.ts`](../../apps/learner-api/src/services/payment/order-match.ts)):

- Verify always uses the order's stored `gateway_order_id`; a different id in the request is
  refused (`Payment does not belong to this order`). Razorpay returns are checked by the
  Checkout signature over that stored id; Stripe returns are confirmed by asking Stripe.
- The captured amount (in the currency's smallest unit) and currency must equal the order
  total, on the webhook, on verify (Stripe), on carts and in the Razorpay reconciliation. A
  mismatch leaves the order unpaid and is logged.
- Learners cannot refund. There is no learner refund endpoint; refunds are issued in the
  gateway's dashboard.

## Known gaps

Grouped by area. Each is a real behaviour of the current code.

**Sessions and accounts**

- Bearer tokens in `localStorage` in all three apps; an XSS in any of them steals sessions.
  No HttpOnly cookie sessions.
- Sign-out is client-only for operators and staff: the token stays valid until it expires
  (24 hours by default). Suspending the account or the membership does end it.
- No second factor for any tier.
- The sign-in limiters in console-api and admin-api count in process memory, per task and
  per cluster worker, so the effective limit is the configured value times the number of
  processes. learner-api's limiters fall back to the same when Redis is unreachable.
- The operator sign-in answers differently for an inactive account or an account without a
  password before checking the password, which reveals account state.
- Learner one-time codes come from `Math.random()` and are stored in plain text.
- learner-api skips the session and member-status checks for a learner token without a
  `sessionToken`. Every token it issues carries one, so only a token minted with the
  learner secret by other means would pass this way.

**Network and edge**

- `TRUST_PROXY` must match the real number of proxies; with more in front, or none, client
  IPs in logs and limiters are wrong. Login session IPs and the buyer-country snapshot read
  `cf-connecting-ip` or the first `X-Forwarded-For` value, which a client controls.
- learner-api trusts the client's `X-Tenant-Host` header, and its tenant cache has no size
  bound, so arbitrary host values fill it.
- `/health` does not check the database or Redis.

**Payments**

- Refunds made in a gateway dashboard are not seen by the platform: no refund webhook is
  handled, the order stays `PAID` and the learner keeps access until staff revoke it by hand
  through the member revoke routes (`DELETE /api/v1/tenant/members/:memberId/enrollments/:enrollmentId`
  and the book, batch and test series equivalents, `members.update`).
- Razorpay webhooks fall back to `key_secret` when a connection has no `webhook_secret`, and
  read the event id from the body with a time-based fallback. There is no outbox between
  recording a webhook and queuing fulfillment. Full list:
  [payments-and-currency.md](payments-and-currency.md#8-gaps).
- Stripe learner subscriptions are not implemented, and Stripe orders stuck in
  `PAYMENT_PENDING` have no reconciliation.

**Keys**

- One `CREDENTIALS_ENCRYPTION_KEY` for every tenant, with no key id, no rotation and no
  envelope encryption. `openSecret` accepts unprefixed values as plaintext.
- `INTERNAL_API_KEY` is compared with `!==`, not in constant time.

**Storefront rendering**

- Some components render tenant HTML without sanitising: the custom-HTML sidebar widget,
  book descriptions in the book templates, and test question HTML in the result and attempt
  views. Tenants are semi-trusted, but a compromised staff account can then script learners'
  sessions.
- `hover:bg-accent` remains in a few shared components (the web and core `Button` outline and
  ghost variants among them), which can make text unreadable under a vivid tenant accent.

**Tenant admin API**

- `/api/v1/pages`, `/upload`, `/tenants` and the certificate template, designer and
  assignment routes are not behind `requireActiveTenant`, so a suspended tenant can still
  edit pages, upload files and change certificate settings.
- `/api/v1/tenants/:id`, `/slug/:slug`, `/domain/:domain` and `/:id/layout` are public
  lookups (the storefront's tenant metadata and layout).
- EVS videos are not tenant-scoped: one platform key, and the list and lookup endpoints do
  not filter by tenant ([video.md](video.md#7-gaps)).
- Tenants can write `platform_commission_*` when they create or update a gateway connection.
- `GET /api/v1/tenant/subscriptions/current`, `/renewal` and `/current/invoice-url` need only
  authentication, by design (every staff screen shows the subscription banner), so any staff
  member can read the platform subscription and its invoice link.

**Operator API**

- Hard-deleting a tenant needs `tenants.manage`, not the seeded `tenants.delete`.

**Operations**

- No transactional outbox anywhere; side effects after a commit (queue jobs, emails, usage
  consumption) can be lost on a crash.
- The `bootstrap-operator` script prints a one-time password but nothing forces a change at
  first sign-in.

## Reporting a vulnerability

See `SECURITY.md` in the repository root. Do not open a public issue for a security problem.

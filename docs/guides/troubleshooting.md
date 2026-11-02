# Troubleshooting

Symptoms, causes and fixes, each traced to the code or configuration that produces it. Paths
are relative to the repository root.

Start with the logs: `make logs SERVICE=admin-api` locally, the CloudWatch group
`/open-mtlms/<name_prefix>/<service>` on AWS. Every API error carries a `rayId` in its
`message` (`route: ..., errorMsg: ..., rayId: ...`); search the log for it.

## Local stack

### A port is already in use

`make up` fails with `port is already allocated`. The stack binds 3600, 3610, 3620, 5076,
5086, 5096, 5542, 6479, 5189, 4647, 8096 and 1096 on `127.0.0.1`. Find the holder
(`lsof -i :5086`), stop it, or move the port in `deploy/compose/.env`, for example
`MTLMS_ADMIN_API_PORT=5087`, and run `make up` again: the apps' API URLs are compiled in at
build time. `make test-integration` reads `MTLMS_PG_PORT` and `MTLMS_REDIS_PORT` from the
shell, not from `.env`.

### Compose says "run `make env` first"

`deploy/compose/.env` is missing, or predates a key; compose requires `MTLMS_JWT_SECRET`,
`MTLMS_LEARNER_JWT_SECRET`, `MTLMS_CREDENTIALS_ENCRYPTION_KEY` and `MTLMS_INTERNAL_API_KEY`
from it. Run `make env` (`make up` does it for you): it adds missing keys to an existing
file without touching the others.

### A service never becomes healthy

`make ps` shows which one. Then:

- `terraform`: waits for Floci, then applies `infra/terraform/envs/local-floci`.
  `make logs SERVICE=terraform`. Its state lives in a volume beside the emulator's, so
  `make down` then `make up` starts both clean.
- `migrate`: a failing migration stops everything after it. `make logs SERVICE=migrate`.
  `changed after it was applied` means a migration file was edited after it ran: restore it
  and add a new file, or `make down` to start from an empty database locally.
- An API: the config guard or the database. In `development` the guard does not refuse;
  look for connection errors to `postgres` or `redis`.
- `web`, `admin`, `console`: a build error during `make up`. Next.js builds run lint; the
  admin build needs a large Node heap.

### The demo seed says `plan 'scale' not found`

The demo seed reads the plans through console-api; they come from the catalog seed.
`make demo` runs `pnpm --filter @open-mtlms/console-api seed` first, so this only happens
when `demo:seed` is run on its own against a database without the catalog. Run the seed
first:

```bash
pnpm --filter @open-mtlms/console-api seed
pnpm --filter @open-mtlms/console-api demo:seed
```

### `make demo` says `already seeded`

The demo tenants exist. `make demo FORCE=1` deletes them and their data and rebuilds them.

### I do not know the demo password

`grep MTLMS_DEMO_PASSWORD deploy/compose/.env`. The seed prints it at the end too.

### `<tenant>.lvh.me` does not load

- `lvh.me` resolves every subdomain to `127.0.0.1` through public DNS. Some routers and
  corporate resolvers drop answers that point at private addresses (DNS rebinding
  protection). Check with `dig northwind.lvh.me`; if it fails, use another resolver or add
  `127.0.0.1 northwind.lvh.me` to `/etc/hosts`.
- The storefront shows its 404 page: `apps/web/middleware.ts` asked learner-api
  `GET /tenant/info` with `X-Tenant-Host` and got no tenant. Check the slug
  (`tenants.slug`), that the tenant is not `CANCELLED`, and that the subdomain is not in
  `RESERVED_SUBDOMAINS`. Lookups are cached for 60 seconds (in both the web middleware and
  learner-api), including misses.
- `MTLMS_ROOT_DOMAIN` changed: it is compiled into the web image as
  `NEXT_PUBLIC_ROOT_DOMAIN`; rebuild with `make up`.

### The storefront renders in default colours, then switches

A page is missing one of the theming layers: the server `<style data-tenant-critical-theme>`
from `getCriticalThemeCss`, or the client `TenantThemeProvider`
([templates-and-theming.md](../architecture/templates-and-theming.md#4-rendering-on-the-storefront-tier-3-two-layers)).

### A published page change does not show

The page config is fetched with `revalidate: 5` and tenant config is cached for 60 seconds
per learner-api worker. Wait a minute, and check the page is published (`is_published`) and
that you edited the homepage when changing the theme: non-home pages use the homepage's
theme.

### No email arrives

Locally everything SES sends is in Mailpit (http://localhost:8096). If nothing is there:

- Base compose without the Floci overlay sends nothing: with no `AWS_SES_FROM_EMAIL`, mail is
  logged instead.
- console-api reads `AWS_SES_FROM_EMAIL` (or `SES_FROM_EMAIL`) and needs
  `AWS_SES_ACCESS_KEY` and `AWS_SES_SECRET_KEY`; with empty keys it skips sending.
- On AWS: the SES sandbox only delivers to verified addresses; check the suppression list and
  the SES events dead-letter queue alarm.

## Tenant admin

### `You do not have access to this tenant` (403)

The `X-Tenant-Id` header names a tenant where the signed-in user has no `ACTIVE` staff
membership. Pick the tenant again in the tenant switcher, or check
`tenant_staff_memberships` for that user.

### `Tenant context required` (403)

No tenant was resolved for the request (no header and no active membership). The user
needs a membership, usually by creating an organisation first.

### `ENTITLEMENT_FEATURE_DISABLED` or a module shows as locked

The tenant has no active entitlement for the feature's product: default deny
([multi-tenancy-and-entitlements.md](../architecture/multi-tenancy-and-entitlements.md#5-checking-default-deny)).
In the console, open the tenant's **Entitlements**: assign a plan that includes it, or add an
admin grant. A new product added to the catalog after the tenant's plan was assigned is not
in the snapshot: use the plan's entitlement sync, or a grant.

### `ENTITLEMENT_LIMIT_REACHED` on publish

The counter for the product is at its limit. Unpublish something, raise the limit (override
or plan change), or, if the count looks wrong, reconcile the tenant's usage in the console;
the `usage-reconciliation` job also corrects drift every 30 minutes.

### `Cannot modify a published version` (console)

Published plan versions are immutable. Create a new version, edit it, and publish it.

### Saving a gateway connection fails with `Invalid ... credentials`

The keys are checked against the provider before saving (`RAZORPAY_API_BASE`,
`STRIPE_API_BASE`). Locally these point at the stubs, which accept keys starting `sk_` or
`rk_` (Stripe) and `rzp_` (Razorpay). Against the real APIs, use keys of the matching mode
(test or live).

### AI authoring returns placeholder text

The offline engine is answering: `AI_PROVIDER` is `offline`, or it is `openai` without an
`AI_API_KEY`. Set both ([connect-real-providers.md](connect-real-providers.md#ai-authoring-openai-compatible)).
If real calls fail with a model error, set `AI_TEXT_MODEL` (empty means `gpt-4o-mini`) or a
per-purpose `AI_MODEL_<PURPOSE>` to a model your endpoint serves.

## Storefront and checkout

### An order stays `PAYMENT_PENDING`

- Look at the stub's webhook log (http://localhost:5189/__stubs/webhooks) or the gateway's
  webhook dashboard: the status and body learner-api answered.
- `Invalid webhook signature` or 400: the connection's `webhook_secret` does not match the
  one the gateway signs with. Locally the demo connections store the stubs' secrets
  (`whsec_stub_local_only`, `rzp_whsec_stub_local_only`).
- The webhook reached learner-api but fulfillment did not run: check the
  `webhook-fulfillment` queue and the learner-api log. The storefront's verify call, or
  `POST /api/v1/checkout/verify-and-fulfill`, fulfils a paid order without the webhook.
- Stripe orders stuck in `PAYMENT_PENDING` have no automatic reconciliation; the webhook or
  the return to `/payment-callback` must happen.

### `not available for purchase in the store's enabled currencies`

The item has no price in the requested currency, the tenant default, or any enabled
currency. Add a price in the tenant admin; the currency coverage report lists gaps.

### `ALREADY_HAS_ACCESS` (409)

The learner already holds an active enrollment or access row for the item.

### A lecture does not play

- 403 with no prerequisites message: the learner has no `ACTIVE` enrollment with `valid_till`
  in the future, and no active subscription.
- 403 `Finish X before starting this course`: a prerequisite course is not completed.
- 404 `This lecture has no video`: the lecture has no `video_key`.
- 503: EVS is not configured (`EVS_API_URL`, `EVS_API_KEY`) or answered with an error.
- The tenant is `SUSPENDED`: playback is a `POST`, which the status guard refuses.

### Learners are signed out unexpectedly

Each learner has one active session; signing in on another device ends the previous one. A
password reset ends all sessions. A learner token is valid only on the storefront of the
tenant that issued it (`Token does not belong to this site`), and only while
`LEARNER_JWT_SECRET` is unchanged.

### `Too many ... attempts` (429) on sign-in, signup or one-time codes

The auth rate limits tripped
([security.md](../architecture/security.md#1-authentication-per-tier)). learner-api counts in
Redis for 10 minutes per tenant, IP and email; console-api and admin-api count in memory
for `AUTH_RATE_LIMIT_WINDOW_MS` (15 minutes) and reset when the process restarts. Locally
compose already raises the limits (`MTLMS_AUTH_RATE_LIMIT_PER_EMAIL`, `_PER_IP`, `_SCALE` in
`deploy/compose/.env`). Behind a proxy, check `TRUST_PROXY`: a wrong hop count makes every
client share the proxy's IP.

## AWS

### Tasks die at start with `exec format error`

The images were built for a different CPU than `cpu_architecture`. `scripts/aws-deploy.sh`
refuses a mismatched `PLATFORM`; rebuild with the matching value.

### The migrate task fails

`scripts/aws-run-task.sh` prints the task's log. A checksum error means an applied migration
file changed in the image. Connection errors usually mean the task's security group or
`PGSSLMODE=verify-full` with a wrong CA; the images bundle the RDS CA at
`/app/certs/rds-global-bundle.pem`.

### The APIs refuse to start: `Refusing to start in production`

`assertProductionConfig()` found a development default or a short secret, (admin-api) an
empty `CORS_ORIGINS`, or (learner-api) a missing `LEARNER_JWT_SECRET` or one equal to
`JWT_SECRET`. The message lists each problem. A deployment whose `<name_prefix>/app`
secret was created before `LEARNER_JWT_SECRET` existed lacks the key, and `terraform apply`
will not add it (the secret value is `ignore_changes`): add a random value of 32 or more
characters to the secret JSON by hand, then roll the APIs.

### An API cannot reach Redis on AWS

The cache module injects only `REDIS_URL` (`rediss://`, with the AUTH token). admin-api and
learner-api read it first, and `rediss://` turns TLS on for every client. If you set
`REDIS_HOST` and `REDIS_PORT` through `api_extra_environment` instead, they are ignored
while `REDIS_URL` is set.

### A tenant's custom domain shows a certificate error

The load balancer has no certificate for it. Add a regional ACM certificate for the domain to
`custom_domain_certificate_arns` and apply.

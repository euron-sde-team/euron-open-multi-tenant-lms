# Testing

What tests exist, how to run each kind, and what CI runs. Paths are relative to the
repository root.

| Kind | Command | Needs | Config |
| --- | --- | --- | --- |
| Unit | `make test` (`pnpm test`, Turborepo across every package) | Node 22, pnpm 9 | each package's `test` script |
| Integration | `make test-integration` | Docker, or a Postgres 16 and Redis 7 you point at | [`vitest.integration.config.mts`](../../vitest.integration.config.mts) |
| End to end | `make e2e` (`make up`, `make demo`, then `pnpm e2e`) | Docker, Playwright browsers | [`e2e/playwright.config.ts`](../../e2e/playwright.config.ts) |
| Static | `make lint`, `make typecheck`, `pnpm db:types:check` | Node | `eslint.config.mjs`, `tsconfig.base.json` |
| Infrastructure | `make tf-validate`, `make tf-lint`, `make tf-security` | Docker (or a local `terraform`) | [`infra/terraform/.tflint.hcl`](../../infra/terraform/.tflint.hcl), [`.checkov.yaml`](../../infra/terraform/.checkov.yaml) |
| Publishing hygiene | `make sanitize` | bash, grep | [`scripts/check-sanitization.sh`](../../scripts/check-sanitization.sh), [`.gitleaks.toml`](../../.gitleaks.toml) |

## Unit tests

No database, no network. Each package uses its own runner:

| Package | Runner | Suites |
| --- | --- | --- |
| `apps/admin-api` | vitest (`tests/**`, integration excluded) | `authorization/` (account-scoped routes stay free of tenant permission gates, `requirePermission` without a tenant, owner and scoped-role behaviour, creating an organization over HTTP), `email-engine/` (category gate, DNS records, transient send errors, unsubscribe tokens), `routes/` (audit-log mounts, layout structure, homepage route ordering and legacy slugs), `services/` (attempt review order parity with learner-api, partial apply of AI course drafts, renewal quotes, renewal webhooks), `sanitize-middleware` (tags stripped, `&` restored so URLs round-trip) |
| `apps/learner-api` | `node --test` with tsx (`tests/*.test.ts`) | `config` (`REDIS_URL` and `rediss://` parsing, the production guard on `LEARNER_JWT_SECRET`), `evs-client` (request shape, EVS error mapped to 503), `payment-adapters` (Razorpay webhook and checkout signatures, smallest-unit conversion for 0, 2 and 3 decimal currencies, gateway currency support), `served-question-order` (test question order and the shuffle shared with admin-api) |
| `apps/console` | vitest | `src/lib/__tests__/utils.test.ts` (`decodeHtmlEntities`, `cn`) |
| `apps/stubs` | vitest (`test/*.test.ts`) | signature helpers, form and AI parsing, every stub flow end to end over HTTP |
| `apps/console-api` | none | its `test` script prints that there are no unit tests; its checks are integration tests |

Run one package:

```bash
pnpm --filter @open-mtlms/admin-api test
pnpm --filter @open-mtlms/learner-api test
pnpm --filter @open-mtlms/stubs test
```

Two tests pin behaviour shared across APIs: the attempt review order in admin-api and the
served question order in learner-api use the same seeded shuffle (attempt id plus section
id). Change one and the other fails until both agree.

## Integration tests

`make test-integration` does four things:

1. [`scripts/test-db.sh`](../../scripts/test-db.sh) checks that something answers on
   `MTLMS_PG_PORT` (5542) and `MTLMS_REDIS_PORT` (6479). If not, it starts the compose
   `postgres` and `redis` services. It then drops and recreates the test database
   (`open_mtlms_test` by default, `TEST_DB` to change it). It refuses any name that does
   not end in `_test`.
2. `pnpm db:migrate` applies [`db/migrations`](../../db/migrations) to it.
3. `pnpm --filter @open-mtlms/console-api seed` seeds the operator permissions, roles and the
   plan catalog. No demo data: every spec creates its own tenants.
4. `pnpm test:integration` runs vitest over
   `apps/{console-api,admin-api,learner-api}/tests/integration/**/*.test.ts`, one file at a
   time (the files share one database and one Redis), with `NODE_ENV=test` and `TZ=UTC`.
   `passWithNoTests` is off.

The APIs run in-process on ephemeral ports, against the provider stubs, through the shared
harness in `apps/admin-api/tests/integration/support` (`stack.ts`, `fixtures.ts`,
`flows.ts`). Redis is logical DB `IT_REDIS_DB` (5) with the BullMQ prefix `IT_PREFIX`
(`mtlms-it`) and a private cache-bus prefix, so a run never touches or steals jobs from a dev
stack on the same Redis. The secrets are throwaway values from the vitest config.

13 files, 71 tests:

| API | File | Covers |
| --- | --- | --- |
| console-api | `operator-auth` | A suspended operator's token stops working at once; tenant-analytics routes check permissions; operator login is rate limited per IP and per email |
| | `plan-versions` | Published plan versions refuse edits to pricing and products; drafts stay editable |
| | `production-config` | `assertProductionConfig()` of each API refuses the development secrets and passes strong ones |
| admin-api | `cross-tenant` | Every main content route answers 403 or 404 to another tenant's staff, and nothing changes |
| | `entitlements` | A missing row denies; a plan assignment snapshots every product; publish consumes and unpublish releases |
| | `gateway-credentials` | Stripe and Razorpay credentials are sealed (`enc:v1:`) and never returned |
| | `hardening` | Suspended staff lose access; auth routes are rate limited; the public page route serves only published fields; quiz and assignment entitlements deny by default; bundle and batch publish toggles move slots only on real transitions |
| | `platform-billing-webhooks` | Stripe and Razorpay activation events create the subscription and snapshot entitlements; replays and bad signatures change nothing |
| | `tenant-status` | `requireActiveTenant` after authentication: suspended tenants read but cannot write, cancelled tenants cannot read content |
| learner-api | `checkout` | A paid course end to end through the stubs, by webhook and by the verify fallback |
| | `multi-currency` | Currency context by country, checkout in the requested currency, fallback to the default once a currency is disabled |
| | `playback-and-isolation` | Enrolled playback (EVS session or external URL), refusals without enrollment, learner-side tenant isolation |
| | `security` | Verify bound to the stored gateway order; amount or currency mismatches leave orders unpaid; no learner refund endpoint; learner tokens (own secret, type, tenant); auth rate limits |

The connection comes from `PG_DATABASE_*`, `REDIS_HOST`, `REDIS_PORT` and `REDIS_DB`, set
by the Makefile from the `MTLMS_PG_*` and `MTLMS_REDIS_PORT` variables in your shell (not
from `deploy/compose/.env`); `REDIS_URL` is cleared so it cannot win. To use another server,
or to run two suites at once (parallel worktrees), give each its own database, Redis DB and
prefix:

```bash
MTLMS_PG_PORT=5432 MTLMS_PG_USER=postgres MTLMS_PG_PASSWORD=postgres make test-integration
TEST_DB=feature_x_test IT_REDIS_DB=6 IT_PREFIX=mtlms-it-x make test-integration
```

## End-to-end tests

Playwright with Chromium at 1440 by 900, against a running local stack. `make e2e` brings
the stack up, runs `make demo` and then `pnpm e2e`. Specs run one file at a time against the
seeded demo tenants:

| Spec | Checks |
| --- | --- |
| [`e2e/tests/01-console.spec.ts`](../../e2e/tests/01-console.spec.ts) | An operator sees every tenant with its plan; the catalogue lists the three published plans |
| [`e2e/tests/02-admin.spec.ts`](../../e2e/tests/02-admin.spec.ts) | The owner sees the published courses and a new draft appears; a Starter tenant cannot open test series or AI authoring |
| [`e2e/tests/03-storefront.spec.ts`](../../e2e/tests/03-storefront.spec.ts) | The home page renders in the tenant's brand with its courses; an enrolled learner gets a playable lecture; learner-api refuses a course from another tenant's host |
| [`e2e/tests/04-accessibility.spec.ts`](../../e2e/tests/04-accessibility.spec.ts) | axe on console, tenant admin and storefront pages, the last two in light and dark mode; serious and critical violations fail. |

Supporting files:

- [`e2e/global-setup.ts`](../../e2e/global-setup.ts) waits up to 120 seconds for the three
  APIs' `/health`, the three apps (the storefront on the demo tenant's host) and the stubs,
  then signs each demo account in once and stores the sessions in a file, so the sign-in
  rate limits do not trip during a run (compose also relaxes them).
- [`e2e/helpers.ts`](../../e2e/helpers.ts) holds the URLs and accounts. Every URL can be
  overridden:

  | Variable | Default |
  | --- | --- |
  | `E2E_CONSOLE_URL`, `E2E_CONSOLE_API_URL` | `http://localhost:3600`, `http://localhost:5076/api/v1` |
  | `E2E_ADMIN_URL`, `E2E_ADMIN_API_URL` | `http://localhost:3610`, `http://localhost:5086/api/v1` |
  | `E2E_WEB_URL`, `E2E_LEARNER_API_URL` | `http://<E2E_TENANT>.<E2E_ROOT_DOMAIN>:3620`, `http://localhost:5096/api/v1` |
  | `E2E_TENANT`, `E2E_ROOT_DOMAIN` | `northwind`, `lvh.me` |
  | `E2E_MAILPIT_URL`, `E2E_STUBS_URL` | `http://localhost:8096`, `http://localhost:5189` |
  | `E2E_DEMO_PASSWORD` | `MTLMS_DEMO_PASSWORD` from `deploy/compose/.env` |
  | `E2E_OPERATOR_EMAIL`, `E2E_TENANT_OWNER_EMAIL`, `E2E_LEARNER_EMAIL` | see `helpers.ts` |
  | `E2E_WORKERS`, `E2E_HEADED` | `1`, headless |

- Retries: one in CI, none locally. Traces on first retry in CI, kept on failure locally.
  Reports in `e2e/.report`, artefacts in `e2e/.results` (`make clean` removes both).

```bash
pnpm exec playwright install chromium     # once
make up && make demo
pnpm e2e
E2E_HEADED=1 pnpm e2e e2e/tests/03-storefront.spec.ts
```

Because Stripe, Razorpay, EVS and the AI endpoint are the stubs and AI authoring runs
offline, runs are reproducible. The stubs keep state in memory; restart them
(`docker compose -p open-mtlms restart stubs`) for a clean slate.

## CI

[`.github/workflows/checks.yml`](../../.github/workflows/checks.yml) runs on pushes to
`main` and on pull requests:

| Job | Steps |
| --- | --- |
| `checks` | `pnpm install --frozen-lockfile`, `pnpm db:types:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (with a 6 GB Node heap), `scripts/check-sanitization.sh` |
| `integration` | Postgres 16 and Redis 7 service containers, throwaway `JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` and `INTERNAL_API_KEY`, then `make test-integration` |
| `terraform` | `terraform fmt -check -recursive`, then `init -backend=false` and `validate` for `local-floci`, `aws-dev` and `aws-prod` |

The full pipeline is kept in [`.github/workflows-full`](../../.github/workflows-full/README.md)
so it does not run upstream. Move the files into `.github/workflows/` in a fork to enable
them:

| Workflow | Runs |
| --- | --- |
| `ci.yml` | The same as `checks` plus integration (keep one of the two) |
| `security.yml` | gitleaks over the full history, CodeQL, `pnpm audit --prod --audit-level=high` |
| `terraform.yml` | fmt, validate, tflint, checkov |
| `docker.yml` | Multi-arch builds of the six app images and the stubs, pushed to GHCR on tags |
| `e2e.yml` | `make up`, `make demo`, health smoke calls across the tiers, then `pnpm e2e`; stack logs on failure |

## Sanitization

`make sanitize` scans exactly the files git would commit (tracked plus untracked and not
ignored) for cloud credentials, private keys, real-looking gateway and model keys, account
and resource ids, internal host and bucket names, real email addresses, public IP
addresses, em dashes and committed env files. A private denylist of extra terms can be
passed with `--denylist <file>` or `SANITIZE_DENYLIST=<file>`; keep that file outside the
repository. Use `example.com` addresses in fixtures and docs.

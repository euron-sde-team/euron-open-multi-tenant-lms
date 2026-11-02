# Quickstart: run the LMS locally

Start all three tiers of Euron Open Multi-Tenant LMS on your machine, seed an operator and
two demo tenants, and sign in to each tier. No cloud account, no payment account and no AI
key are needed. Paths are relative to the repository root.

What runs ([`deploy/compose`](../../deploy/compose)): Postgres 16, Redis 7, the Floci AWS
emulator (S3, SES, SQS, SNS, KMS) provisioned by the production Terraform modules, Mailpit
(catches every email SES sends), the provider `stubs` (Stripe, Razorpay, EVS, an
OpenAI-compatible API), a one-shot `migrate`, the three APIs and the three Next.js apps.

## Prerequisites

- Docker with Compose v2 (Docker Desktop, OrbStack, Colima or Docker Engine).
- `make`, `bash` and `openssl` (used by [`scripts/gen-local-env.sh`](../../scripts/gen-local-env.sh)).
- For tests and for running apps outside Docker: Node 22 ([`.nvmrc`](../../.nvmrc)) and
  pnpm 9 (`packageManager` in [`package.json`](../../package.json); `corepack enable`), then
  `pnpm install`.

`make up` itself only needs Docker; the images install their own dependencies.

## Start the stack

```bash
make up
```

`make up` first runs `make env`, which writes `deploy/compose/.env` with five random,
local-only values: `MTLMS_JWT_SECRET`, `MTLMS_LEARNER_JWT_SECRET`,
`MTLMS_CREDENTIALS_ENCRYPTION_KEY`, `MTLMS_INTERNAL_API_KEY` and `MTLMS_DEMO_PASSWORD`. It never overwrites a value and never
prints one; an existing file only gains keys added since. Delete the file to regenerate it.

Then it builds the images, starts Floci and Mailpit, runs the `terraform` one-shot that
applies [`infra/terraform/envs/local-floci`](../../infra/terraform/envs/local-floci/main.tf)
to the emulator, runs the migrations, starts the APIs, the apps and the stubs, and waits
until every service is healthy (`docker compose up -d --build --wait`). The first build takes
several minutes. It prints:

```
  Tier 1  console      http://localhost:3600   (operator console)
          console-api  http://localhost:5076/api/v1/health
  Tier 2  admin        http://localhost:3610   (tenant admin)
          admin-api    http://localhost:5086/api/v1/health
  Tier 3  web          http://northwind.lvh.me:3620   (a tenant storefront: <tenant>.lvh.me)
          learner-api  http://localhost:5096/api/v1/health
  stubs    http://localhost:5189   (Stripe, Razorpay, EVS, AI; webhook log at /__stubs/webhooks)
  mail     http://localhost:8096   (everything SES sends)
  aws      http://localhost:4647   (Floci: S3, SES, SQS, SNS, KMS)
```

`make urls` prints this again at any time.

## Seed the demo

```bash
make demo
```

This runs two scripts in the `tools` container, one after the other:
`pnpm --filter @open-mtlms/console-api seed` (operator permissions and roles, tenant
permissions and system roles, and the plan catalog; safe to re-run) and then
`pnpm --filter @open-mtlms/console-api demo:seed`
([`apps/console-api/scripts/demo-seed.ts`](../../apps/console-api/scripts/demo-seed.ts)). The
demo seed drives the real HTTP APIs, so entitlement snapshots, credential sealing,
enrollment and checkout run through their normal code. It refuses `NODE_ENV=production`.

| What | Created |
| --- | --- |
| Operator | `root@example.com`, role `SUPERADMIN` |
| Northwind Academy (`northwind`, plan **Scale**) | Owner `maya@northwind.example.com`; four courses with EVS, HLS, MP4 and YouTube lectures (preview lessons included), three instructors, a book, a bundle, a batch, a quiz, an assignment, a test series, a certificate template, coupons `WELCOME20` (20%) and `FLAT500` (INR 500), testimonials, a published home page with a theme plus published login, profile, about, contact, FAQ, privacy and terms pages from the utility page templates, Stripe and Razorpay connections pointing at the stubs |
| Northwind learners | `lee@example.com`, `priya@example.com`, `omar@example.com`, `sofia@example.com`, `kenji@example.com`, `amara@example.com`, with enrollments, lecture progress, quiz and test attempts, and a paid order |
| Acme Robotics (`acme`, plan **Starter**) | Owner `arjun@acme.example.com`; one published course. Starter has no test series and no AI authoring, so those modules show as locked |

Every account signs in with `MTLMS_DEMO_PASSWORD` from `deploy/compose/.env`:

```bash
grep MTLMS_DEMO_PASSWORD deploy/compose/.env
```

Run `make demo` again and it reports `already seeded`. `make demo FORCE=1` deletes the two
demo tenants and their data and rebuilds them.

## Sign in

| Tier | URL | Account |
| --- | --- | --- |
| Operator console | http://localhost:3600 | `root@example.com` |
| Tenant admin | http://localhost:3610 | `maya@northwind.example.com` (Northwind) or `arjun@acme.example.com` (Acme) |
| Storefront | http://northwind.lvh.me:3620 | `lee@example.com` or any other Northwind learner |
| Storefront | http://acme.lvh.me:3620 | Sign up on the page |
| Mail | http://localhost:8096 | Invites, one-time codes, purchase emails |
| Webhook log | http://localhost:5189/__stubs/webhooks | The last 100 deliveries from the stubs |

`lvh.me` and every subdomain of it resolve to `127.0.0.1`, so `<tenant>.lvh.me` works with no
hosts file. The learner API resolves the tenant from that host
([HLD.md](../architecture/HLD.md#4-tenant-resolution)). If your DNS resolver refuses
`lvh.me` (some routers block names that resolve to a private address), see
[troubleshooting.md](troubleshooting.md#tenantlvhme-does-not-load).

Buying something on the storefront goes through the stubs: Stripe shows a hosted page with
**Pay** and **Cancel**, Razorpay a popup with **Pay**, **Fail** and **Cancel**. Either way the
stub sends a signed webhook to learner-api, so the full fulfillment path runs. The full tour
is in [walkthrough.md](walkthrough.md).

## Ports

Every host port binds to `127.0.0.1` and can be moved in `deploy/compose/.env` (or your shell):

| Service | Host port | Variable |
| --- | --- | --- |
| console | 3600 | `MTLMS_CONSOLE_PORT` |
| admin | 3610 | `MTLMS_ADMIN_PORT` |
| web | 3620 | `MTLMS_WEB_PORT` |
| console-api | 5076 | `MTLMS_CONSOLE_API_PORT` |
| admin-api | 5086 | `MTLMS_ADMIN_API_PORT` |
| learner-api | 5096 | `MTLMS_LEARNER_API_PORT` |
| postgres | 5542 | `MTLMS_PG_PORT` |
| redis | 6479 | `MTLMS_REDIS_PORT` |
| stubs | 5189 | `MTLMS_STUBS_PORT` |
| floci | 4647 | `MTLMS_FLOCI_PORT` |
| mailpit UI, SMTP | 8096, 1096 | `MTLMS_MAILPIT_PORT`, `MTLMS_MAILPIT_SMTP_PORT` |

The apps' API URLs are compiled into their images, so run `make up` again after moving a port.

## Everyday commands

| Command | Does |
| --- | --- |
| `make ps` | Status of every service |
| `make logs SERVICE=admin-api` | Follow one service's log (`console-api`, `admin-api`, `learner-api`, `console`, `admin`, `web`, `stubs`, `migrate`, `floci`, `terraform`) |
| `make urls` | Print the URLs |
| `make down` | Stop everything and delete the volumes (database, Redis, emulator state) |
| `make up-aws` | The same containers against real AWS resources (needs `deploy/compose/.env.aws`, see [deploy-aws.md](deploy-aws.md)) |
| `make help` | Every target |

## Running an app outside Docker

Stop the container that holds its port first (`docker compose -p open-mtlms stop admin-api`),
then:

```bash
pnpm --filter @open-mtlms/admin-api dev       # tsx watch
pnpm --filter @open-mtlms/admin dev           # next dev on 3610
```

An API run on the host reads its environment from the shell or a `.env` file in its folder
(dotenv). Point it at the compose services on their host ports: `PG_DATABASE_HOST=127.0.0.1`,
`PG_DATABASE_PORT=5542`, `PG_DATABASE_USER=mtlms`, `PG_DATABASE_PASSWORD=mtlms`,
`PG_DATABASE=mtlms`, `REDIS_URL=redis://127.0.0.1:6479`, `TRUST_PROXY=0`, and the same
`JWT_SECRET`, `LEARNER_JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY` and `INTERNAL_API_KEY` as the
containers (the `MTLMS_*` values in `deploy/compose/.env`). Every variable: [configuration.md](configuration.md).

## Without the emulator

`docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d` runs the
base file alone: files are written to local disk (`LOCAL_STORAGE_DIR`) and mail is logged
instead of sent, because no `AWS_SES_FROM_EMAIL` is set.

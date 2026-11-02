# Contributing

Thanks for helping improve Euron Open Multi-Tenant LMS. This guide covers the workflow, the
bar a change has to clear, and the conventions the codebase follows.

## Ground rules

- **Open an issue first** for anything larger than a bug fix or a docs tweak, so we can
  agree on the approach before you invest time.
- **One concern per pull request.** A refactor and a feature are two PRs.
- **Security issues go through private reporting**, never a public issue. See
  [SECURITY.md](SECURITY.md).
- By contributing you agree your work is released under the [MIT License](LICENSE).

## Development setup

Requirements: Docker, Node 22+, pnpm 9 (`corepack enable`).

```bash
pnpm install
make up          # Postgres, Redis, the AWS emulator, the provider stubs, migrations,
                 # the three APIs and the three apps
make demo        # the plan catalogue, an operator and two fictional academies
make test        # unit tests across every package (no database)
```

The operator console is at http://localhost:3600, the tenant admin at http://localhost:3610
and the Northwind storefront at http://northwind.lvh.me:3620. No provider account is needed:
Stripe, Razorpay, the video service and AI are local stubs, and email goes to Mailpit.
[docs/guides/quickstart-local.md](docs/guides/quickstart-local.md) lists every port and how to
run the apps outside Docker.

## Before you open a pull request

Each of these must pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:types:check                    # the APIs' Kysely types match the schema
make test-integration                  # the three APIs against a migrated Postgres
make e2e                               # when you touched an app (needs make up && make demo)
make tf-validate tf-lint tf-security   # when you touched infra/terraform
make sanitize                          # no credentials, account ids, real emails or IPs
```

[docs/guides/testing.md](docs/guides/testing.md) explains each test layer.

## Conventions

**Three tiers, three APIs.** Operator features go in `apps/console-api`, academy staff
features in `apps/admin-api`, learner features in `apps/learner-api`. Each API follows routes,
controllers, services and repositories (Kysely); services and repositories are singletons and
repositories accept an optional transaction ([LLD.md](docs/architecture/LLD.md)).

**Every tenant query carries `tenant_id`.** A record from another academy is a 404. A new
endpoint that returns academy data gets an integration test proving another academy cannot
read it.

**Entitlements first.** Runtime code reads entitlements and usage counters, never plans. A
missing entitlement is a denial; counts are consumed and released through the usage service
([multi-tenancy-and-entitlements.md](docs/architecture/multi-tenancy-and-entitlements.md)).

**Credentials are write-only.** Gateway credentials are sealed with `CREDENTIALS_ENCRYPTION_KEY`
and never appear in a response, a log line or an audit payload.

**Pages are data.** A new storefront section is a type and default content in
`packages/shared` and `packages/ui-config`, a component in `packages/core`, and a renderer
entry in both apps ([add-a-template.md](docs/guides/add-a-template.md)).

**Money.** Prices are per currency; gateway amounts are converted with `toSmallestUnit`, never
`* 100` ([payments-and-currency.md](docs/architecture/payments-and-currency.md)).

**Configuration lives in one file per app** (`src/config/index.ts`), documented in
[docs/guides/configuration.md](docs/guides/configuration.md) in the same PR; security-relevant
values are enforced at boot by `assertProductionConfig`.

**Database changes are new migrations.** Change `packages/db/prisma/schema.prisma`, run
`pnpm db:types` to regenerate the Kysely types for the three APIs, and add
`db/migrations/NNNN_description.sql` with the matching SQL. Prisma never touches a database.
Never edit an applied migration: the runner refuses to start when a checksum changes.

**Comments explain why.** The code says what it does. Comments are for the constraint, the
incident, or the trade-off that made it this way.

**Style.** ESLint settles formatting. TypeScript strict mode everywhere.

## Commit messages

Imperative mood with an optional scope: `learner-api: bind verify-payment to the stored order`,
`admin: show the plan limit on the courses page`. Explain the *why* in the body when it is not
obvious.

## Architecture decisions

A change that alters a documented decision (three APIs over one schema, SQL migrations,
entitlements first, JSON page templates, the video service, bring-your-own gateways) needs a
new or updated ADR in [docs/adr/](docs/adr/README.md) explaining the trade-off, linked from the
pull request.

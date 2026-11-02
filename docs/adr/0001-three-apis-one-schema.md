# ADR 0001: Three APIs over one schema

## Status

Accepted.

## Context

The product has three audiences with little in common beyond the data:

| Tier | Who | Does |
| --- | --- | --- |
| 1 | Operator staff | Build the catalog (applications, features, products), sell plans, onboard tenants, adjust entitlements |
| 2 | Tenant staff | Build courses, books, bundles, batches, test series, pages and themes; connect payment gateways; manage learners |
| 3 | Learners | Browse a tenant's storefront, buy, learn, take tests, earn certificates |

They differ in traffic (learner traffic dominates and spikes at launches), in trust (an
operator token reaches every tenant; a learner token reaches one learner's view of one
tenant), in how the tenant is found (none, a header, the host name), and in background work
(tenant admin has most of the jobs, the operator plane has none).

The code these apps came from was already three Express services over one mirrored Prisma
schema. The open-source version could have merged them into one API with three route trees,
or kept them apart.

## Decision

- Three Express 5 APIs, each its own app and image, all reading and writing one Postgres
  database:

  | App | Tier | Port | Prefix |
  | --- | --- | --- | --- |
  | [`apps/console-api`](../../apps/console-api) | 1 | 5076 | `/api/v1/admin/*` |
  | [`apps/admin-api`](../../apps/admin-api) | 2 | 5086 | `/api/v1/tenant/*`, `/api/v1/pages`, `/api/v1/tenants`, `/api/v1/upload`, and the platform billing webhooks under `/api/v1/webhook` |
  | [`apps/learner-api`](../../apps/learner-api) | 3 | 5096 | `/api/v1/*`, tenant from the host |

- One schema, in [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma),
  applied by one migration runner ([ADR 0002](0002-kysely-and-sql-migrations.md)). The
  generated Kysely types are copied into each API so each compiles on its own.
- Each API has its own authentication middleware. console-api accepts only tokens with
  `type: "admin"`, admin-api only `type: "tenant"`, and learner-api only `type: "learner"`
  tokens signed with its own `LEARNER_JWT_SECRET` and issued for the tenant of the request's
  host ([security.md](../architecture/security.md#1-authentication-per-tier)).
- One Next.js app per tier (`apps/console`, `apps/admin`, `apps/web`), each talking to its
  own API. The tenant admin is also built with the learner API's address
  (`NEXT_PUBLIC_LEARNER_API_BASE_URL`).
- APIs call each other only for a few service-to-service operations (for example
  learner-api's `/api/v1/internal/*`), authenticated with a shared `INTERNAL_API_KEY` in the
  `x-internal-key` header.

## Consequences

Positive:

- Each tier scales on its own: on AWS each API is its own ECS service with its own task
  count range.
- The operator plane is a different process with a different token type, so a tenant or
  learner token does not open it; learner tokens also have a different signing key.
- Background jobs live where their data is written; the learner API runs only the jobs
  learner traffic needs.
- The code moved in close to how it was, which was the fastest route to a working product.

Trade-offs:

- Shared code is copied rather than shared: config loaders, error classes, the logger, the
  currency registry and parts of the entitlement logic exist in more than one API, and can
  drift. The generated types are checked for drift in CI; the rest is not.
- One database is still one failure domain and one noisy neighbour for all three tiers.
- Three images, three task definitions and three sets of environment variables to keep
  aligned ([configuration.md](../guides/configuration.md)).
- A change to a table used by several tiers must be checked against all three APIs.

## Alternatives considered

- **One API with three route trees** (the approach of the sibling CRM project). Simpler to
  deploy, but the learner tier's scaling and the operator tier's blast radius become one
  service's concern, and merging three existing codebases would have cost more than it
  saved.
- **A database per tier.** Rejected: entitlements written by the operator tier are read on
  every tenant admin request, and orders written by the learner tier are read by the tenant
  admin. Splitting the data would need synchronisation for no gain.

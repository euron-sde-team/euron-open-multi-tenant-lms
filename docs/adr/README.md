# Architecture decision records

Short records of the decisions that shape Euron Open Multi-Tenant LMS: the context, what was
decided, and what it costs. The system as built is described in
[architecture/HLD.md](../architecture/HLD.md) and
[architecture/LLD.md](../architecture/LLD.md).

| ADR | Decision |
| --- | --- |
| [0001](0001-three-apis-one-schema.md) | Three Express APIs, one per tier, over one Postgres schema |
| [0002](0002-kysely-and-sql-migrations.md) | Kysely for every runtime query, plain SQL migrations with a small runner, Prisma only to generate types |
| [0003](0003-entitlements-first.md) | Plans are snapshotted into per-tenant entitlements; the runtime reads only entitlements, and a missing entitlement denies |
| [0004](0004-json-page-templates.md) | Storefront pages are JSON section lists rendered by a shared section registry, not tenant-authored code |
| [0005](0005-evs-for-video.md) | Video is delegated to euron-video-system (or an external URL); the LMS stores a reference, not media |
| [0006](0006-floci-for-local-aws.md) | Floci emulates AWS locally and is provisioned by the production Terraform |
| [0007](0007-byo-gateway-per-tenant.md) | Each tenant connects its own Stripe or Razorpay account; credentials are sealed at rest |

A new record takes the next number, uses the same headings (Status, Context, Decision,
Consequences, Alternatives considered), and is never rewritten after it is accepted: a
changed decision gets a new record that supersedes the old one.

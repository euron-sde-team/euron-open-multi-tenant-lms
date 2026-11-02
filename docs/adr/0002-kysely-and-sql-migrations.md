# ADR 0002: Kysely for queries, plain SQL migrations, Prisma only for types

## Status

Accepted.

## Context

Three APIs share one Postgres schema of 167 tables and 108 enums
([ADR 0001](0001-three-apis-one-schema.md)). The code they were built from already wrote
every runtime query in Kysely and used a Prisma schema as the description of the tables.

Prisma Migrate wants a shadow database for `migrate dev`, keeps its own history table, and
cannot express some things the schema needs: the partial unique index that allows exactly
one default currency per tenant, the `pg_trgm` and `unaccent` extensions, and the
materialized search view with its full-text and trigram indexes. Prisma Client would add a
second query layer next to Kysely, with a generated engine in every image.

## Decision

- **One schema file.** [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma)
  is the single description of the tables.
- **Prisma generates types only.** Its one generator is `prisma-kysely`, writing
  `packages/db/generated/types.ts` and `enums.ts`. `pnpm db:types` regenerates them and
  [`packages/db/scripts/sync-types.mjs`](../../packages/db/scripts/sync-types.mjs) copies both
  files into `apps/{console,admin,learner}-api/src/db/`, so each API compiles on its own
  (they do not share a module system). `pnpm db:types:check` fails when a copy has drifted.
  No Prisma Client exists and nothing calls Prisma at runtime.
- **Migrations are plain SQL.** Files `db/migrations/NNNN_name.sql`, applied in filename
  order by [`db/migrate.ts`](../../db/migrate.ts). `0001_init.sql` was produced offline with
  `pnpm --filter @open-mtlms/db migration:diff` (`prisma migrate diff --from-empty`);
  `0002_indexes.sql` adds the extensions, the partial unique index and read-path indexes;
  `0003_search.sql` adds the search view.
- **The runner is small and strict.** It takes `pg_advisory_lock(727101)` so concurrent runs
  serialise, records each file with its SHA-256 in `schema_migrations`, applies each file in
  its own transaction, and refuses to continue when an applied file's checksum has changed
  (`changed after it was applied; add a new migration instead`). `--status` lists applied
  and pending files without changing anything.
- **Runtime queries are Kysely.** Repositories build queries with Kysely over a `pg` pool
  (`src/db/connection.ts` in each API), with optional transaction arguments.

## Consequences

Positive:

- Anything Postgres can do is available in a migration, with no tool in the way.
- The runner is about a hundred lines with one dependency (`pg`). Every API image carries
  it as `db/migrate.js`, so the same image runs the one-off migrate task on ECS.
- Types are checked against the schema in CI (`db:types:check`), so a column rename breaks
  the build of every API that uses it.

Trade-offs:

- Two descriptions of the schema must agree: `schema.prisma` and the SQL. A new migration
  is written by hand, or generated with `prisma migrate diff` against the previous schema
  and then reviewed. Nothing checks that the SQL and the Prisma file produce the same
  database.
- Forward-only: there are no down migrations. Reverting a release leaves its migration
  applied, so migrations must be backward compatible with the release before them.
- A migration that cannot run in a transaction (`CREATE INDEX CONCURRENTLY`) needs its own
  handling; the runner wraps every file in `BEGIN`/`COMMIT`.
- Three copies of the generated types live in the tree. They are generated, and CI fails on
  drift, but a reader can be surprised.

## Alternatives considered

- **Prisma Migrate.** Rejected for the shadow database, its own history format, and the
  objects it cannot express.
- **Prisma Client at runtime.** Rejected: a second query layer next to Kysely, and an engine
  binary in every image.
- **A migration framework (node-pg-migrate, Knex, Atlas).** Each works; none was needed for
  forward-only SQL files with checksums and a lock.

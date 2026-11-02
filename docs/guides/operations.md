# Operations

Running a deployment day to day: migrations, backups, background jobs, scaling, logs,
secrets. Deploying is in [deploy-aws.md](deploy-aws.md). Paths are relative to the
repository root.

## Migrations

Plain SQL in [`db/migrations`](../../db/migrations), applied by [`db/migrate.ts`](../../db/migrate.ts)
([ADR 0002](../adr/0002-kysely-and-sql-migrations.md)).

| Where | Apply | Status |
| --- | --- | --- |
| Local stack | Automatic: the `migrate` one-shot runs before the APIs start | `docker compose -p open-mtlms run --rm migrate node db/migrate.js --status` |
| Host | `pnpm db:migrate` (reads `DATABASE_URL` or `PG_DATABASE_*`) | `pnpm db:migrate --status` |
| AWS | `make aws-migrate ENV=aws-prod` (one-off ECS task; `make aws-deploy` runs it before rolling the services) | `scripts/aws-run-task.sh aws-prod migrate --status` |

The runner holds `pg_advisory_lock(727101)`, applies each pending file in its own
transaction, records it with its SHA-256 in `schema_migrations`, and refuses to run if an
applied file was edited.

Writing a migration:

1. Change [`packages/db/prisma/schema.prisma`](../../packages/db/prisma/schema.prisma).
2. Regenerate types: `pnpm db:types` (copies them into the three APIs).
3. Write `db/migrations/NNNN_short_name.sql` by hand, or start from
   `prisma migrate diff --from-schema-datamodel <previous schema> --to-schema-datamodel prisma/schema.prisma --script`
   and review it. Add partial indexes and extensions Prisma cannot express in the SQL.
4. Make it compatible with the release before it: add nullable columns, backfill, then
   tighten in a later migration. There are no down migrations, and the new schema is live
   while old tasks still run during a rolling deploy.
5. `CREATE INDEX CONCURRENTLY` cannot run inside the runner's transaction; on large tables
   create such indexes by hand first and use `IF NOT EXISTS` in the migration.

Never run `prisma migrate` or `prisma db push` against a real database.

## Seeds and first accounts

| Command | Does | Where |
| --- | --- | --- |
| `pnpm --filter @open-mtlms/console-api seed` | Operator permissions, operator roles, tenant RBAC, the plan catalog (idempotent) | Any environment |
| `pnpm --filter @open-mtlms/console-api seed:catalog` | Only the catalog: application `lms`, features, products, plans Starter, Growth, Scale, billing providers | Any |
| `make aws-operator ENV=... EMAIL=you@example.com` | First operator with a one-time password | AWS |
| `pnpm --filter @open-mtlms/console-api bootstrap:operator --email you@example.com` | The same, run directly | Any |
| `make demo` | `seed`, then the demo seed: demo operator, tenants, content, storefront pages, learners | Local only; the demo seed refuses production |

The catalog seed creates a version only for plans that have no published version yet, so
re-running it never changes a live plan.

## Backups and recovery

| Data | Protection |
| --- | --- |
| Postgres (RDS) | Automated backups (3 days on aws-dev, 14 on aws-prod), point-in-time restore, Multi-AZ on aws-prod, deletion protection and a final snapshot on aws-prod |
| Redis (ElastiCache) | Snapshots (1 day, 7 days); Redis holds queues and caches, not records of truth. A lost queue loses pending jobs: payments are still recoverable through the verify fallback and the platform poll reconciliation |
| S3 assets bucket | Versioning; non-current versions expire after `storage_noncurrent_version_days` |
| Secrets | Secrets Manager with a recovery window (30 days on aws-prod) |
| Terraform state | Your state bucket; it contains generated secrets |

Restoring Postgres creates a new instance: point the services at it (`PG_DATABASE_HOST`) or
swap it into Terraform, then roll the services. `CREDENTIALS_ENCRYPTION_KEY` must be the one
that sealed the restored rows, or tenants' gateway credentials cannot be opened.

Locally, `make down` deletes every volume. To keep a copy first:

```bash
docker compose -p open-mtlms exec postgres pg_dump -U mtlms mtlms > mtlms.sql
```

## Background jobs

Jobs run inside the API processes; there is no worker service
([LLD.md](../architecture/LLD.md#background-work)).

- **admin-api** runs its job workers on every cluster worker unless `RUN_JOB_WORKERS=false`.
  To move them off the request path, run a second admin-api service with
  `RUN_JOB_WORKERS=true` and set `false` on the one behind the load balancer (add it with
  `api_extra_environment`; the Terraform does not define a separate worker service).
- Recurring jobs are BullMQ job schedulers, so several processes never duplicate a schedule.
- **learner-api** runs fulfillment, notifications, learner subscription lifecycle and watch
  time rollups in every worker, and refreshes the search view every 5 minutes on cluster
  worker 1. If worker 1 is ever replaced, the replacement has a new id and the refresh stops
  until the task restarts; newly published content then stops appearing in search.
- Redis must use `maxmemory-policy noeviction` (the cache module sets it): an evicted job key
  is a lost job.
- A failed job is logged with `job` and `failed:`; on AWS a metric filter on the admin-api
  log group feeds the `<name_prefix>-failed-jobs` alarm.

Useful checks:

```bash
# Queue depths (locally)
docker compose -p open-mtlms exec redis redis-cli --scan --pattern 'bull:*:wait' | head
# Orders paid but not fulfilled
psql ... -c "select id, status, metadata->>'fulfilled' from payment_orders where status = 'PAID' and coalesce(metadata->>'fulfilled','false') <> 'true';"
```

A paid order left unfulfilled can be re-queued by the learner's storefront
(`POST /api/v1/checkout/verify-and-fulfill`), which uses the event id `fallback-<orderId>`.

## Usage counters

`usage-reconciliation` recounts real rows and corrects counters every 30 minutes. For one
tenant, an operator can run **Reconcile** on the tenant's entitlements in the console
(`POST /api/v1/admin/tenants/:tenantId/entitlements/reconcile`); usage resets and manual
updates need a reason and are written to `tenant_usage_events`.

## Scaling

| Lever | Where |
| --- | --- |
| Tasks per service | `api_min_count`, `api_max_count`, `web_min_count`, `web_max_count`; CPU target tracking at 60% |
| Task size | `api_cpu`, `api_memory`, `web_cpu`, `web_memory` |
| Workers per task | One Node worker per vCPU (`os.cpus()`) in production |
| Database connections | `PG_POOL_MAX` per worker; total is tasks x workers x pool for each API. Keep it under the RDS `max_connections` |
| Database size | `db_instance_class`, storage autoscaling up to `db_max_allocated_storage` |
| Redis | `cache_node_type`, `cache_node_count` |

console-api's and admin-api's sign-in limiters count per process, so their effective limit
grows with tasks times workers; learner-api's limiters are shared through Redis.

learner-api takes the storefront traffic and usually needs the most tasks. The tenant lookup
and the page config are cached for 60 and 5 seconds, so most storefront reads are cheap.

## Logs and monitoring

| Where | What |
| --- | --- |
| Local | `make logs SERVICE=<name>` |
| AWS | CloudWatch log group `/open-mtlms/<name_prefix>/<service>` per service, KMS-encrypted, 14 or 365 days |
| Alarms | SNS topic `<name_prefix>-alarms` (email if `alarm_email` is set): per-service 5xx and unhealthy targets, CPU and memory, the database, failed jobs, SES dead-letter queues, Redis |
| Dashboard | One CloudWatch dashboard per deployment |

Every error response carries a `rayId` in its `message`
(`route: ..., errorMsg: ..., rayId: ...`); search the log group for it to find the full line.
admin-api redacts known sensitive keys from structured log data, and every API drops
passwords, tokens and gateway credentials from logged request bodies.

The APIs log to stdout only, at `LOG_LEVEL` (Terraform's `log_level`, default `info`). Set
`LOG_FILE` to add a file transport; on ECS the root filesystem is read-only, so leave it
unset there.

`/api/v1/health` only proves the process answers; it does not touch the database or Redis.
Watch the 5xx alarms and the target health together.

## Rotating secrets

| Secret | Effect of rotating | How |
| --- | --- | --- |
| `JWT_SECRET` | Every operator and staff session ends | Put a new value in `<name_prefix>/app`, force a new deployment of the three APIs |
| `LEARNER_JWT_SECRET` | Every learner session ends | Same; it must stay different from `JWT_SECRET` |
| `INTERNAL_API_KEY` | Service-to-service calls fail until all three APIs have it | Same, all three together |
| `CREDENTIALS_ENCRYPTION_KEY` | Every stored tenant gateway credential becomes unreadable | No re-encryption tool exists: rotate only with a plan to have tenants re-enter credentials, or write a one-off script that opens with the old key and seals with the new one |
| `PG_DATABASE_PASSWORD` | | Change it in RDS and in `<name_prefix>/database`, roll the services |
| Provider keys | | Rotate at the provider, update `<name_prefix>/providers`, roll the services |

Terraform ignores changes to secret values after creation, so a rotation is never reverted
by the next `apply`.

## Tenants

- **Suspend** a tenant in the console: the storefront becomes read-only, the tenant admin's
  `requireActiveTenant` routes refuse changes (pages, uploads and certificate settings are
  not behind it yet, see [security.md](../architecture/security.md#known-gaps)).
- **Refunds** are made in the tenant's gateway dashboard; the order stays `PAID` and the
  learner keeps access until tenant staff revoke it under the member's enrollments.
- **Cancel** a platform subscription immediately: `PLAN` entitlements are archived and the
  tenant is suspended.
- **Delete** a tenant (`DELETE /api/v1/admin/tenants/:id`): rows cascade from `tenants`.
  Objects in S3 and videos in EVS are not deleted.

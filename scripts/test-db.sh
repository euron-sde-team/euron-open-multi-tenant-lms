#!/usr/bin/env bash
# Make sure a disposable Postgres and Redis are reachable for the integration tests,
# then drop and recreate the test database (default open_mtlms_test) so the run starts
# from an empty schema. `make test-integration` migrates it and seeds the platform
# catalog next; every spec creates its own tenants.
#
#   scripts/test-db.sh [database]      the name must end in _test
#
# Host ports follow MTLMS_PG_PORT (5542) and MTLMS_REDIS_PORT (6479). When something
# already answers on both (the compose stack, or any Postgres that accepts
# MTLMS_PG_USER / MTLMS_PG_PASSWORD, default mtlms/mtlms),
# nothing is started; otherwise the compose postgres and redis services are.
set -euo pipefail
cd "$(dirname "$0")/.."
db="${1:-open_mtlms_test}"
pg_port="${MTLMS_PG_PORT:-5542}"
redis_port="${MTLMS_REDIS_PORT:-6479}"
pg_user="${MTLMS_PG_USER:-mtlms}"
pg_password="${MTLMS_PG_PASSWORD:-mtlms}"

[[ "$db" =~ ^[a-z0-9_]+_test$ ]] || { echo "refusing to recreate '$db': the name must end in _test"; exit 2; }

listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

if ! { listening "$pg_port" && listening "$redis_port"; }; then
  scripts/gen-local-env.sh >/dev/null # creates .env, or adds keys an older one lacks
  docker compose --env-file deploy/compose/.env -f deploy/compose/compose.yaml up -d --wait postgres redis >/dev/null
fi

# pg comes from the root devDependencies (pnpm install).
PGPORT="$pg_port" PGUSER="$pg_user" PGPASSWORD="$pg_password" TEST_DB="$db" node -e '
  const { Client } = require("pg");
  const db = process.env.TEST_DB;
  const c = new Client({ host: "127.0.0.1", port: Number(process.env.PGPORT), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: "postgres" });
  (async () => {
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${db}"`);
    await c.end();
    console.log(`recreated ${db} on 127.0.0.1:${process.env.PGPORT}`);
  })().catch((e) => { console.error(`test database: ${e.message}`); process.exit(1); });
'

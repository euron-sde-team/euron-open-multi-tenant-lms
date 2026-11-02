/**
 * Shared DB handle for CLI scripts. Reads the same env as the API
 * (PG_DATABASE_HOST/PORT/USER/PASSWORD/PG_DATABASE) via src/config.
 */
process.env.TZ = "UTC";

export { db, pool } from "../../src/db/connection";

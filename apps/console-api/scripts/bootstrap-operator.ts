/**
 * Creates the first operator (SUPERADMIN admin user) on a fresh deployment.
 * Prints a generated password once; the operator signs in to the console with
 * it, changes it, and then creates plans and onboards tenants.
 *
 *   pnpm bootstrap:operator --email ops@example.com [--name "Ops Lead"]
 *
 * Refuses when that email already exists, so it is safe to run twice.
 */
process.env.TZ = "UTC";

import crypto from "crypto";
import bcrypt from "bcrypt";
import { ulid } from "ulid";
import { db, pool } from "./lib/db";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const SUPERADMIN = "SUPERADMIN";

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const name = (arg("name") ?? "Platform Operator").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('usage: bootstrap-operator --email ops@example.com [--name "Ops Lead"]');
  }

  const existing = await db
    .selectFrom("admin_users")
    .select(["id"])
    .where("email", "=", email)
    .executeTakeFirst();
  if (existing) {
    console.log(`[bootstrap] operator ${email} already exists; nothing changed`);
    return;
  }

  const password = crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const t = new Date();

  await db.transaction().execute(async (trx) => {
    let role = await trx
      .selectFrom("admin_roles")
      .select(["id"])
      .where("code", "=", SUPERADMIN)
      .executeTakeFirst();
    if (!role) {
      role = await trx
        .insertInto("admin_roles")
        .values({
          id: ulid(),
          code: SUPERADMIN,
          name: "Super Administrator",
          description: "Full, unrestricted access to every feature and setting.",
          is_system: true,
          created_at: t,
          updated_at: t,
        })
        .returning(["id"])
        .executeTakeFirstOrThrow();
    }

    const userId = ulid();
    await trx
      .insertInto("admin_users")
      .values({
        id: userId,
        email,
        name,
        password_hash: passwordHash,
        status: "ACTIVE",
        email_verified: true,
        created_at: t,
        updated_at: t,
      })
      .execute();

    await trx
      .insertInto("admin_user_roles")
      .values({ admin_user_id: userId, role_id: role.id, assigned_at: t })
      .execute();
  });

  console.log(`[bootstrap] SUPERADMIN ${email} created`);
  console.log(`[bootstrap] one-time password: ${password}`);
  console.log("[bootstrap] sign in to the operator console and change it.");
}

main()
  .catch((err) => {
    console.error("[bootstrap] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

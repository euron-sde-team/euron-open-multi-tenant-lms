/**
 * assertProductionConfig() in each API refuses NODE_ENV=production with the local
 * defaults (or short values) for JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY and
 * INTERNAL_API_KEY, and passes once every secret is strong. Each case re-imports the
 * config module under a fresh environment, so the real defaults are what is checked.
 */
import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

const strong = () => randomBytes(32).toString("hex");

type Api = "console-api" | "admin-api" | "learner-api";
const loaders: Record<Api, () => Promise<{ assertProductionConfig: () => void }>> = {
  "console-api": () => import("../../src/config"),
  "admin-api": () => import("../../../admin-api/src/config"),
  "learner-api": () => import("../../../learner-api/src/config"),
};

/** Everything each API needs to boot in production, all strong. */
const strongEnv = (): Record<string, string> => ({
  NODE_ENV: "production",
  JWT_SECRET: strong(),
  // learner-api signs learner tokens with its own secret (never JWT_SECRET).
  LEARNER_JWT_SECRET: strong(),
  CREDENTIALS_ENCRYPTION_KEY: strong(),
  INTERNAL_API_KEY: strong(),
  APP_CONFIG_SALT: strong(),
  CORS_ORIGINS: "https://admin.example.com",
});

const SECRETS = ["JWT_SECRET", "CREDENTIALS_ENCRYPTION_KEY", "INTERNAL_API_KEY"] as const;
const saved = { ...process.env };

async function guardWith(api: Api, env: Record<string, string | undefined>): Promise<() => void> {
  vi.resetModules();
  for (const k of [...SECRETS, "APP_CONFIG_SALT", "CORS_ORIGINS", "NODE_ENV"]) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  const mod = await loaders[api]();
  return () => mod.assertProductionConfig();
}

afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
  vi.resetModules();
});

describe.each<Api>(["console-api", "admin-api", "learner-api"])("%s assertProductionConfig", (api) => {
  it("throws in production when no secret is set (the built-in defaults)", async () => {
    const guard = await guardWith(api, { NODE_ENV: "production" });
    expect(guard).toThrow(/Refusing to start in production/);
    expect(guard).toThrow(/JWT_SECRET/);
    expect(guard).toThrow(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it.each(SECRETS)("throws when only %s is weak", async (name) => {
    const env = { ...strongEnv(), [name]: "short-secret" };
    const guard = await guardWith(api, env);
    // console-api treats an unset INTERNAL_API_KEY as "not used"; a short one still fails.
    expect(guard).toThrow(new RegExp(name));
  });

  it("passes with strong secrets", async () => {
    const guard = await guardWith(api, strongEnv());
    expect(guard).not.toThrow();
  });

  it("is a no-op outside production", async () => {
    const guard = await guardWith(api, { NODE_ENV: "development" });
    expect(guard).not.toThrow();
  });
});

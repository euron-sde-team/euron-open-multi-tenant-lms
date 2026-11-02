/**
 * Config: REDIS_URL parsing (AWS injects only a rediss:// URL) and the production
 * guard on LEARNER_JWT_SECRET. Each case loads the config in a fresh process so the
 * environment it reads at import is exactly the one given.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(__dirname, "..");
const strong = () => randomBytes(32).toString("hex");

function load(env: Record<string, string>, expr: string): string {
  const script = `const m = require("./src/config"); const c = m.default; ${expr}`;
  return execFileSync(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: root,
    env: { PATH: process.env.PATH ?? "", DOTENV_CONFIG_QUIET: "true", ...env },
    encoding: "utf8",
  }).trim().split("\n").at(-1) ?? "";
}

const redisOf = (env: Record<string, string>) =>
  JSON.parse(
    load(env, "console.log(JSON.stringify([c.REDIS_HOST, c.REDIS_PORT, c.REDIS_USERNAME, c.REDIS_PASSWORD, c.REDIS_DB, c.REDIS_TLS, c.BULLMQ_PREFIX]))")
  );

describe("redis config", () => {
  it("parses a rediss:// REDIS_URL (host, port, user, password, db, tls)", () => {
    assert.deepEqual(
      redisOf({ REDIS_URL: "rediss://default:p%40ss@cache.example.com:6380/3", REDIS_HOST: "ignored" }),
      ["cache.example.com", "6380", "default", "p@ss", 3, true, "bull"]
    );
  });

  it("falls back to REDIS_HOST / REDIS_PORT / REDIS_DB / BULLMQ_PREFIX", () => {
    assert.deepEqual(
      redisOf({ REDIS_HOST: "redis", REDIS_PORT: "6479", REDIS_DB: "6", BULLMQ_PREFIX: "it" }),
      ["redis", "6479", "", "", 6, false, "it"]
    );
  });
});

describe("LEARNER_JWT_SECRET in production", () => {
  const guard = (env: Record<string, string>) =>
    load(
      { NODE_ENV: "production", CREDENTIALS_ENCRYPTION_KEY: strong(), INTERNAL_API_KEY: strong(), ...env },
      "try { m.assertProductionConfig(); console.log('ok'); } catch (e) { console.log(JSON.stringify(e.message)); }"
    );

  it("is required", () => {
    assert.match(guard({ JWT_SECRET: strong() }), /LEARNER_JWT_SECRET must be set/);
  });

  it("must differ from JWT_SECRET", () => {
    const same = strong();
    assert.match(guard({ JWT_SECRET: same, LEARNER_JWT_SECRET: same }), /must differ from JWT_SECRET/);
  });

  it("passes when set, strong and distinct", () => {
    assert.equal(guard({ JWT_SECRET: strong(), LEARNER_JWT_SECRET: strong() }), "ok");
  });
});

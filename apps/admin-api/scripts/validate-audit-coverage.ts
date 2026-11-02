/**
 * CI guard: nothing a person can DO goes unrecorded.
 *
 * WHY: it is very easy to ship an audit log that looks complete, the mechanism
 * works, the entries you tested show up, while most of the app writes nothing.
 * An owner filtering by "Books" then sees an empty list and concludes nobody
 * touched their books. A silent gap in an audit log is worse than no audit log,
 * because it is trusted.
 *
 * This resolves the REAL url of every write route (mount path from v1.route.ts +
 * the leaf path) and asks the same function the middleware asks: would this be
 * logged?
 *
 * Three outcomes:
 *   LOGGED, an entry will be written.
 *   sub-resource, deliberately quiet. "/courses/:id/sections" is part of
 *                  editing that course; logging each one turned a single
 *                  "created a course" into eight lines of noise.
 *   ALLOWED-QUIET, on the list below. Auth, upload plumbing, AI drafts.
 *
 * Anything else FAILS THE BUILD. Add it to DOMAINS/AUDIT_ACTIONS, or justify it
 * by adding it here, a deliberate, reviewable decision either way.
 *
 * Run: pnpm validate:audit
 */
import fs from "node:fs";
import path from "node:path";

import { lookupAuditAction } from "../src/services/audit-actions";

/**
 * Routes that must NOT be logged, and why. Each is a decision, not an oversight.
 */
const ALLOWED_QUIET: [RegExp, string][] = [
  [/^\/auth\//, "authentication, not a tenant action, and the bodies carry OTPs and passwords"],
  [/^\/dashboard\//, "reads and exports"],
  [
    /^\/audit-logs\/denied-view$/,
    "writes its own BLOCKED entry for a page the role doesn't include; the middleware must not add a second, successful one",
  ],
  [/^\/onboarding\//, "dismissing a checklist"],
  [/^\/test-taxonomy\/availability$/, "read-only availability count; POST only to carry the blueprint filter body"],
];

const ROUTES_DIR = path.join(__dirname, "..", "src", "routes");

interface Route {
  method: string;
  url: string;
  file: string;
}

/** Every write route, with the URL the middleware will actually see. */
function writeRoutes(): Route[] {
  const v1 = fs.readFileSync(path.join(ROUTES_DIR, "v1.route.ts"), "utf8");

  const mounts = new Map<string, string>(); // routerVar -> mount path
  for (const m of v1.matchAll(
    /v1Router\.use\(\s*"\/tenant\/([^"]+)"[\s\S]{0,80}?(\w+Router)\s*\)/g
  )) {
    mounts.set(m[2], m[1]);
  }

  const imports = new Map<string, string>(); // routerVar -> file
  for (const m of v1.matchAll(/import\s+(\w+)\s+from\s+"\.\/([\w.-]+)"/g)) {
    imports.set(m[1], m[2]);
  }

  const routes: Route[] = [];
  for (const [varName, mount] of mounts) {
    const file = imports.get(varName);
    if (!file) continue;
    const p = path.join(ROUTES_DIR, file + ".ts");
    if (!fs.existsSync(p)) continue;

    const src = fs.readFileSync(p, "utf8");
    for (const m of src.matchAll(
      /\w+Router\.(post|put|patch|delete)\(\s*["'`]([^"'`]*)["'`]/g
    )) {
      const leaf = m[2] === "/" ? "" : m[2];
      routes.push({
        method: m[1].toUpperCase(),
        url: `/${mount}${leaf}`,
        file,
      });
    }
  }
  return routes;
}

/** "/courses/:id/sections", an id followed by a noun. Part of editing a record. */
function isSubResource(url: string): boolean {
  return /\/:[a-zA-Z]+\/[a-z]/.test(url);
}

function main(): void {
  const routes = writeRoutes();

  const logged: Route[] = [];
  const sub: Route[] = [];
  const allowed: Route[] = [];
  const gaps: Route[] = [];

  for (const r of routes) {
    if (lookupAuditAction(r.method, r.url)) logged.push(r);
    else if (isSubResource(r.url)) sub.push(r);
    else if (ALLOWED_QUIET.some(([re]) => re.test(r.url))) allowed.push(r);
    else gaps.push(r);
  }

  console.log(`write routes          : ${routes.length}`);
  console.log(`  logged              : ${logged.length}`);
  console.log(`  sub-resources (quiet): ${sub.length}  (part of editing their parent)`);
  console.log(`  allowed quiet        : ${allowed.length}  (auth, uploads, AI drafts)`);
  console.log(`  UNEXPLAINED GAPS     : ${gaps.length}`);

  if (gaps.length) {
    console.error(
      `\n✗ ${gaps.length} write route(s) leave NO trace and are not justified:`
    );
    for (const g of gaps.slice(0, 25)) {
      console.error(`  - ${g.method.padEnd(6)} ${g.url}   (${g.file})`);
    }
    if (gaps.length > 25) console.error(`  … and ${gaps.length - 25} more`);
    console.error(
      `\n  Add the domain to DOMAINS (or a hand-written AUDIT_ACTIONS entry),\n` +
        `  or add it to ALLOWED_QUIET here with a reason. Silence must be a\n` +
        `  decision someone made, not an oversight.`
    );
    process.exit(1);
  }

  console.log("\n✓ every action a person can take leaves a trace, or is explicitly excused");
}

main();

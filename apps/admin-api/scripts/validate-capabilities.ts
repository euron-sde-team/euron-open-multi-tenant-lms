/**
 * CI guard: every permission code a route ENFORCES must be granted by some
 * capability, and every code a capability grants must actually be enforced.
 *
 * WHY: permission codes are declared inline in the route files
 * (`requirePermission("tests.publish")`), but the catalogue used to be
 * hand-maintained in a seed script in ANOTHER repo. People forgot. The result:
 * 25 codes that routes enforced but no checkbox existed for, so a non-admin
 * could never be granted Batches, Tests, Code Judge, Email Sending… and nobody
 * noticed, because the owner/admin bypass hid it.
 *
 * With this check, a developer who adds `requirePermission("newthing.do")`
 * without declaring a capability for it FAILS THE BUILD. The drift becomes
 * structurally impossible rather than merely discouraged.
 *
 * Run: pnpm validate:capabilities
 */
import fs from "node:fs";
import path from "node:path";

import { ALL_CAPABILITIES } from "../src/capabilities";

const ROUTES_DIR = path.join(__dirname, "..", "src", "routes");

/** Every code referenced by requirePermission()/requireAnyPermission() in the routes. */
function codesEnforcedByRoutes(): Set<string> {
  const codes = new Set<string>();
  const re = /require(?:Any)?Permission\(\s*((?:"[^"]+"\s*,?\s*)+)\)/g;

  for (const file of fs.readdirSync(ROUTES_DIR)) {
    if (!file.endsWith(".route.ts")) continue;
    const src = fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      for (const quoted of m[1].match(/"[^"]+"/g) ?? []) {
        codes.add(quoted.slice(1, -1));
      }
    }
  }
  return codes;
}

function main(): void {
  const enforced = codesEnforcedByRoutes();

  const granted = new Set<string>();
  for (const cap of ALL_CAPABILITIES) {
    for (const code of cap.grants) granted.add(code);
  }

  // 1. Enforced but no capability grants it → ungrantable. This is the bug.
  const ungrantable = [...enforced].filter((c) => !granted.has(c)).sort();

  // 2. Granted but never enforced → dead code in a manifest. Not fatal (a code
  //    may be enforced in another service), but worth surfacing.
  const unused = [...granted].filter((c) => !enforced.has(c)).sort();

  // 3. Duplicate capability ids would silently shadow one another.
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const cap of ALL_CAPABILITIES) {
    if (seen.has(cap.id)) duplicates.push(cap.id);
    seen.add(cap.id);
  }

  console.log(`routes enforce      : ${enforced.size} codes`);
  console.log(`capabilities grant  : ${granted.size} codes`);
  console.log(`capabilities        : ${ALL_CAPABILITIES.length}`);

  if (unused.length) {
    console.log(
      `\nnote: ${unused.length} granted code(s) are not enforced by any route in this service:`
    );
    for (const c of unused) console.log(`  - ${c}`);
  }

  let failed = false;

  if (duplicates.length) {
    failed = true;
    console.error(`\n✗ duplicate capability id(s): ${duplicates.join(", ")}`);
  }

  if (ungrantable.length) {
    failed = true;
    console.error(
      `\n✗ ${ungrantable.length} permission code(s) are enforced by a route but no capability grants them.`
    );
    console.error(
      `  Nobody could ever be given these, add them to a capability in src/capabilities/manifests.ts:`
    );
    for (const c of ungrantable) console.error(`  - ${c}`);
  }

  if (failed) process.exit(1);
  console.log("\n✓ every enforced permission is grantable through a capability");
}

main();

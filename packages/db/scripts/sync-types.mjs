// Copies the generated Kysely types into each API's src/db so every API
// compiles on its own (they use different module systems). With --check it
// fails when an API's copy has drifted from the schema instead of writing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const apis = ["console-api", "admin-api", "learner-api"];
const files = ["types.ts", "enums.ts"];
const check = process.argv.includes("--check");
let drift = 0;

for (const file of files) {
  const fresh = readFileSync(join(root, "packages/db/generated", file), "utf8");
  for (const api of apis) {
    const target = join(root, "apps", api, "src/db", file);
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current === fresh) continue;
    if (check) {
      console.error(`drift: apps/${api}/src/db/${file} differs from the schema`);
      drift++;
    } else {
      writeFileSync(target, fresh);
      console.log(`wrote apps/${api}/src/db/${file}`);
    }
  }
}
if (drift) process.exit(1);

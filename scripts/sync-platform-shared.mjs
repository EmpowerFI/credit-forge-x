// Copies the shared TypeScript the Edge Functions need into
// platform/supabase/functions/_shared/, since functions cannot import from
// outside platform/. The copies are byte-identical to their sources and a
// vitest check (packages/audit-commitments/src/vendored.test.ts) fails when
// they drift, so the browser and Deno always run the same code.
//   npm run platform:sync-shared
import { cpSync, mkdirSync, rmSync } from "node:fs";

const targets = [
  ["packages/audit-commitments/src/index.ts", "platform/supabase/functions/_shared/audit-commitments/index.ts"],
  ["packages/audit-client/src/generated", "platform/supabase/functions/_shared/audit-client"],
];

for (const [from, to] of targets) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to.replace(/\/[^/]+\.ts$/, ""), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`${from} -> ${to}`);
}

// Type-checks every Edge Function in the runtime that runs it.
//
// `deno test` covers _shared/ only, so the functions themselves were never
// checked — and on 19 Sep that let `settlement_route` reach devnet missing
// from anchor-reconcile's HOLDER map. The map is a Record<AnchorKind, ...>:
// the compiler knew, nothing asked it. The four route proofs came back
// `mismatch` while the same drawer said VERIFIED.
//
// Both workdirs: platform/ is the hackathon platform, supabase/ is the site's
// transactional e-mail.
//
// Each function has its own deno.json, and Deno resolves that from the working
// directory, so each is checked from inside its own folder rather than all at
// once from the root.
//   npm run test:deno-check
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOTS = ["platform/supabase/functions", "supabase/functions"];

// Deno is not always on PATH (it installs to ~/.deno/bin).
const deno = [process.env.DENO, "deno", join(homedir(), ".deno/bin/deno")]
  .filter(Boolean)
  .find((bin) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0);
if (!deno) {
  console.error("deno not found — install it, or set DENO to its path");
  process.exit(1);
}

let total = 0;
let failed = 0;
for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "_shared" && existsSync(join(root, e.name, "index.ts")))
    .map((e) => e.name)
    .sort();

  console.log(`\n${root}`);
  for (const name of dirs) {
    total++;
    const { status, stdout, stderr } = spawnSync(deno, ["check", "index.ts"], {
      cwd: join(root, name),
      encoding: "utf8",
    });
    if (status === 0) {
      console.log(`  ok   ${name}`);
    } else {
      failed++;
      console.log(`  FAIL ${name}`);
      process.stdout.write(`${stdout}${stderr}`);
    }
  }
}

console.log(`\n${total - failed}/${total} functions type-check`);
process.exit(failed ? 1 : 0);

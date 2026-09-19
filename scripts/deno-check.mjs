// Type-checks every platform Edge Function in the runtime that runs it.
//
// `deno test` covers _shared/ only, so the functions themselves were never
// checked — and on 19 Sep that let `settlement_route` reach devnet missing
// from anchor-reconcile's HOLDER map. The map is a Record<AnchorKind, ...>:
// the compiler knew, nothing asked it. The four route proofs came back
// `mismatch` while the same drawer said VERIFIED.
//
// Each function has its own deno.json, and Deno resolves that from the working
// directory, so each is checked from inside its own folder rather than all at
// once from the root.
//
// platform/ only. The other workdir's functions are the site's e-mail queue,
// and process-email-queue does not type-check today: its generated Database
// types do not know the move_to_dlq RPC, so .rpc() narrows to never. A check
// that is red on the day it lands is a check people learn to ignore.
//   npm run test:deno-check
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = "platform/supabase/functions";

// Deno is not always on PATH (it installs to ~/.deno/bin).
const deno = [process.env.DENO, "deno", join(homedir(), ".deno/bin/deno")]
  .filter(Boolean)
  .find((bin) => spawnSync(bin, ["--version"], { stdio: "ignore" }).status === 0);
if (!deno) {
  console.error("deno not found — install it, or set DENO to its path");
  process.exit(1);
}

const dirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "_shared" && existsSync(join(ROOT, e.name, "index.ts")))
  .map((e) => e.name)
  .sort();

let failed = 0;
for (const name of dirs) {
  const { status, stdout, stderr } = spawnSync(deno, ["check", "index.ts"], {
    cwd: join(ROOT, name),
    encoding: "utf8",
  });
  if (status === 0) {
    console.log(`ok   ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}`);
    process.stdout.write(`${stdout}${stderr}`);
  }
}

console.log(`\n${dirs.length - failed}/${dirs.length} functions type-check`);
process.exit(failed ? 1 : 0);

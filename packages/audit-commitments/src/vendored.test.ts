// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Edge Functions run copies of these packages (they cannot import from
// outside platform/). If a copy differs from its source, the browser and Deno
// would hash differently — so fail here instead. Fix: npm run platform:sync-shared
const pairs: [string, string][] = [
  ["packages/audit-commitments/src/index.ts", "platform/supabase/functions/_shared/audit-commitments/index.ts"],
  ["packages/audit-client/src/generated", "platform/supabase/functions/_shared/audit-client"],
  ["packages/readiness-engine/src/index.ts", "platform/supabase/functions/_shared/readiness-engine/index.ts"],
];

const files = (path: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => files(join(path, name)).map((f) => join(name, f)))
    : [""];

describe("vendored copies for the Edge Functions", () => {
  for (const [source, copy] of pairs) {
    it(`${copy} matches ${source}`, () => {
      const sourceFiles = files(source).sort();
      expect(files(copy).sort()).toEqual(sourceFiles);
      for (const f of sourceFiles) {
        expect(readFileSync(join(copy, f), "utf8"), f || copy).toBe(readFileSync(join(source, f), "utf8"));
      }
    });
  }
});

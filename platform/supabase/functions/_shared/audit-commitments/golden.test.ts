// The golden vectors, run by Deno against the copy the Edge Functions import.
// vitest runs the same vectors against the source in Node; both must pass for
// the browser and the anchoring pipeline to agree on every hash.
//   npx deno test --allow-read platform/supabase/functions/_shared/
import { assertEquals } from "jsr:@std/assert@1";
import golden from "../../../../../packages/audit-commitments/vectors/golden.json" with { type: "json" };
import { type CanonicalObject, canonicalize, commit, type Domain, fromHex, hashBorrowerRef, toHex } from "./index.ts";

for (const v of golden.commitments) {
  Deno.test(`canonical form: ${v.name}`, () => {
    assertEquals(canonicalize(v.payload as CanonicalObject), v.canonical);
  });
  Deno.test(`commitment: ${v.name}`, async () => {
    assertEquals(toHex(await commit(v.domain as Domain, v.payload as CanonicalObject)), v.commitment);
  });
}

for (const v of golden.borrower_ref_hashes) {
  Deno.test(`borrower ref hash: ${v.name}`, async () => {
    assertEquals(toHex(await hashBorrowerRef(fromHex(v.borrower_ref))), v.hash);
  });
}

// Writes the daily form's Flow JSON from the code that reads its answers.
//
//   npx tsx scripts/whatsapp/build-diario-flow.mts
//
// The output is what gets pasted into Meta's Flow Builder. A Deno test fails
// if the file and journalFlow() ever disagree, so run this after any change
// to the form in platform/supabase/functions/_shared/journal.ts.
import { writeFileSync } from "node:fs";
import { journalFlow } from "../../platform/supabase/functions/_shared/journal.ts";

const out = "docs/whatsapp/diario-flow.pt-BR.json";
writeFileSync(out, JSON.stringify(journalFlow(), null, 2) + "\n");
console.log(`wrote ${out}`);

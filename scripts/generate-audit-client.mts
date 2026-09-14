// Regenerates the TypeScript client for the empowerfi_audit program from its
// IDL. Run after every `anchor build` that changes an instruction or account:
//   npm run audit-client:generate
//
// The client is shared by the browser (audit screen) and Deno (Edge
// Functions), hence: imports from @solana/kit only, explicit .ts extensions,
// and no TypeScript-only syntax such as enums.
import { rootNodeFromAnchor, type AnchorIdl } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";
import { readFileSync } from "node:fs";

const idl = JSON.parse(
  readFileSync("packages/audit-client/idl/empowerfi_audit.json", "utf8"),
) as AnchorIdl;

await createFromRoot(rootNodeFromAnchor(idl)).accept(
  renderVisitor("packages/audit-client", {
    generatedFolder: "src/generated",
    erasableSyntax: true,
    importExtension: "ts",
    kitImportStrategy: "rootOnly",
    syncPackageJson: false,
  }),
);

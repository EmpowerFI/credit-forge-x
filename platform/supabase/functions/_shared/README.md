# `_shared/` — vendored copies, do not edit

`audit-commitments/` and `audit-client/` are byte-identical copies of
`packages/audit-commitments/src/index.ts` and `packages/audit-client/src/generated/`.
Edge Functions cannot import from outside `platform/`, so the sources are copied here.

Edit the originals, then run `npm run platform:sync-shared`. A vitest check fails
if a copy drifts from its source.

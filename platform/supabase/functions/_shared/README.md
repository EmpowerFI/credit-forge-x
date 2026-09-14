# `_shared/` — vendored copies, do not edit

`audit-commitments/`, `audit-client/` and `readiness-engine/` are byte-identical copies of
`packages/audit-commitments/src/index.ts`, `packages/audit-client/src/generated/` and
`packages/readiness-engine/src/index.ts`.
Edge Functions cannot import from outside `platform/`, so the sources are copied here.

Edit the originals, then run `npm run platform:sync-shared`. A vitest check fails
if a copy drifts from its source.

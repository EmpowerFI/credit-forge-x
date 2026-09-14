# `_shared/` — vendored copies, do not edit

`audit-commitments/`, `audit-client/`, `readiness-engine/` and `eligibility-engine/` are byte-identical
copies of their sources in `packages/` (`src/index.ts`; the client's `src/generated/`).
Edge Functions cannot import from outside `platform/`, so the sources are copied here.

Edit the originals, then run `npm run platform:sync-shared`. A vitest check fails
if a copy drifts from its source.

# Work plan

**Written for:** the founder, and whoever picks up a piece of it. One place for what the four studies each sequenced separately, because their orders interleave and the dependencies cross between them.

Sources: [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) · [STUDY-SPLIT.md](STUDY-SPLIT.md) · [STUDY-CONTRACTS.md](STUDY-CONTRACTS.md) · [STUDY-ACCESS.md](STUDY-ACCESS.md). Each keeps the reasoning; this keeps the order.

---

## The gate

One rule decides what can start today:

> **Anything that changes what a judge sees, or what the live attestations mean, waits for the submission to close. Everything else does not.**

Concretely, frozen until then:

| frozen | why |
|---|---|
| `programs/empowerfi-audit` | the program ID is in the submission |
| the readiness and eligibility engines | their output is anchored; a change bumps `model_version` |
| `vite.config.ts` package aliases | they are the build; a published-package swap changes it |
| the demo database and its seed | `seed-demo.mts` opens with `reset_demo_data()`, which would destroy the live Zcash testnet payments |
| deployed Edge Functions | source may change in the repo; **deploying is a separate, explicit act** |
| the deployed frontend | Vercel builds `main` |

Not frozen: CI, docs, tests, scripts, contracts and commercial terms, and anything in a repository that does not exist yet.

---

## Phase 0 — now, while frozen

| | what | state |
|---|---|---|
| 0.1 | **CI**, three jobs: typecheck + lint + tests + build; Edge Function type-check; the program in LiteSVM | **done** — `.github/workflows/ci.yml` |
| 0.2 | `anchor-reconcile`'s `HOLDER` map excluded `capital_route` deliberately but typed as total, so the file did not type-check | **done** — fixed; not deployed |
| 0.3 | **The tier-2 clause** into the sponsorship template, from the seven points in [STUDY-ACCESS §8.2](STUDY-ACCESS.md#82-what-a-sponsor-actually-buys) | **not started** — an afternoon, plus a lawyer on the wording. Free today, a renegotiation after the first signature |
| 0.4 | **Measure the organic base** — the share of records in no sponsored programme, derivable from `program_communities` and the programme dates with no schema change | **not started** — meaningless against simulated data, so it waits for real records, but the query can be written now |
| 0.5 | **Meta onboarding** — business portfolio, verification, a dedicated number not already on WhatsApp | **not started** — days of someone else's queue, blocks the pilot and nothing in the build |
| 0.6 | **The check-in Flow, the templates and the consent wording** | **done** — `docs/whatsapp/` |

0.3 is the only item here with a deadline attached to someone else's calendar.

### What CI covers, and what it does not

Three jobs: `tsc --noEmit` clean, ESLint 0 errors, 304 unit tests in 26 files, 19/19 Edge Functions type-check, 28 LiteSVM tests, production build.

One of them failed on its first run, and the reason is worth keeping. The program tests load the compiled program with `include_bytes!("../../../target/deploy/empowerfi_audit.so")`. That file is a build artefact and gitignored, so it exists on a machine that has run `anchor build` and never on a clean checkout. Running the command locally proved nothing, because the local machine already had the artefact — **the check that mattered was running it from a state CI would actually be in**, which is what the fixed job does: install the pinned Solana toolchain, `cargo-build-sbf` into the path the test hardcodes, then test.

Deliberately not in it yet, each for a reason rather than an oversight:

- **pgTAP** needs a database. It becomes the private repo's gate when `platform/` moves ([STUDY-SPLIT §9](STUDY-SPLIT.md)), and it is the one with `rbac.test.sql` in it, which matters more with real data than it ever did with simulated.
- **The browser checks** (`verify-*`, `ux-paths`) need a dev server and a seeded database. Worth doing on a schedule rather than per push.
- **Deploys.** Nothing in CI deploys anything, on purpose. A pipeline that can deploy is a pipeline that can deploy by accident during a submission window.

---

## Phase 1 — the fortnight after the freeze lifts

Foundations. Nothing in phase 2 can start cleanly before these, and they are the items that get more expensive the longer they wait.

| | what | depends on | size |
|---|---|---|---|
| 1.1 | **Publish the packages** — `audit-commitments`, `audit-client`, the engine versions in production. Replace the vite aliases with real dependencies and delete the duplicated engine under `_shared/` | freeze | ~3 days |
| 1.2 | **The engine revision** — see below: the engine itself is written and pinned; the rest waits | freeze, 1.1 | ~2 weeks, **part done** |
| 1.3 | **The private repo**, with `platform/` moved using `git filter-repo` rather than copied — a credit model's history is the record of how it evolved | 1.1 | ~1 day |
| 1.4 | **pgTAP in CI** on the private repo, and the published-version check on both | 1.3 | ~2 days |
| 1.5 | **Compile the demo doors out**, apply the credit migrations into the mobile app's existing environments, and deploy a second `empowerfi_audit` so showroom proofs and real ones are separable by program ID | 1.3 | ~3 days — **no new project, see below** |

### 1.2, broken out — what is already done

The engine is written and under test **but wired into nothing**: `packages/readiness-engine/src/v2.ts`, imported only by its own vectors. `index.ts` is untouched, byte-for-byte, which is what keeps the copy under `_shared/` in sync and the live attestations meaning what they meant. Written during the freeze because CI exists now, and CI is what makes it safe to work inside that package at all.

| | | |
|---|---|---|
| ✅ | the three routes — core, reviewed community programme, demonstrated competency | `v2.ts` |
| ✅ | `PREPARATION_NOT_EVIDENCED` replacing `CORE_EDUCATION_INCOMPLETE` | |
| ✅ | `preparation_evidence` in the result, naming the strongest route held | |
| ✅ | 18 vectors, including one that holds v2 identical to v1 wherever preparation is not the question | `v2.test.ts` |
| ⬜ | the database supplying `equivalent_modules_total/completed` to the engine | a migration |
| ⬜ | marking a community programme core-equivalent: the column, and the review before it is set | schema + admin |
| ⬜ | wiring — the Edge Function, the alias, the audit screen's re-run, the Models page | bumps `model_version` |
| ⬜ | the vendored Deno copy of v2 | `platform:sync-shared` |
| ⬜ | the wording on every screen that explains readiness | *preparation* → *evidence of preparation* |

The demonstration route's bar is set deliberately above the `RECORD_KEEPING` requirement it would otherwise overlap: the full six-month window unbroken, every sale recorded in every month of it, and no figure contradicting another. It stands in for a whole taught programme, so it should be hard.

**1.2 is what a partner is waiting on**, and it is the long pole of the phase.

**1.5's surprise has been looked for and is not there.** All **116 migrations apply from zero with no failures**, and the schema they produce is identical to the one that grew incrementally over twenty-five days — 1,382 objects against 1,381, the single difference being a function from a migration the local database has not applied yet. Two scripts, both re-runnable:

- `scripts/platform/check-fresh-install.mts` — static, no database, safe anywhere: object ordering between files, and enum values used in the transaction that added them. Clean.
- `scripts/platform/fresh-install-run.sh` — the real thing, into a throwaway database on the local cluster, destroying nothing. It builds a base that looks like a new Supabase project (the platform schemas present, `public` and `private` empty), applies all 116 in order one transaction each, then diffs every table, column, view, function, enum, policy and index against the live schema.

Two things it does not prove, both worth knowing before the migrations are applied anywhere real. **`pg_cron` is stubbed**, because Postgres installs it only into the database named in `cron.database_name` and a real Supabase project *is* that database — so the migrations' own `create extension if not exists pg_cron` works there and cannot in a scratch database. And **plpgsql bodies are not resolved at creation**, so a function calling something that does not exist still creates cleanly; what is proven is DDL ordering, not that every body resolves.

### 1.5, revised — the production database already exists

The plan said *create* a production Supabase project. It should not. The mobile app on Google Play already has **dev, staging and production**, the entrepreneurs are registered in it, and it is where they already are. Measured against the local `empowerfi-prod` stack:

| | |
|---|---|
| the app's tables | 29, across 91 migrations |
| the credit platform's | 58 |
| collisions — tables, functions, enum types | **none, in any of the three** |
| **the 116 credit migrations applied onto a copy of the app's schema** | **0 failed, 29 tables → 87** |
| **app objects altered by them** | **none** — every column, policy and function definition identical afterwards |

So the two schemas share one `public` without renaming anything, and it is proven rather than argued: `scripts/platform/merge-check.sh` copies the app's schema into a scratch database on its own cluster, applies all 116, and diffs every column, policy and function definition from before. It changes nothing but the scratch database and reads the source only. And the join is free, because both key a person to the same place:

```
app:       users.id     → auth.users(id)
platform:  profiles.id  → auth.users(id)   ← entrepreneurs.profile_id
```

One database, one auth, one person. An app user who joins a credit programme gets a `profiles` row and an `entrepreneurs` row under the auth id she already has. **Nobody re-registers, and nothing is migrated** — which was item 2.5's whole problem and most of 2.2's.

What `public.users` already carries that the credit side was about to ask for again: **`phone`** (which [STUDY-ACCESS §2](STUDY-ACCESS.md) found nowhere in the platform schema and treated as new surface), `city`, `state`, `bairro`, `self_declared_woman` and `self_declared_at`, `has_cnpj`, `terms_accepted_at`, `privacy_accepted_at`, `notification_consent`, and a `solana_pubkey`. There is also a `credit_intent` table, so demand has been asked about already.

Three consequences, in order of how much they change:

- **There is no financial history to preserve.** The app has identity, business profile and credit intent, and no check-ins, no revenue, no costs. `months_reported` starts at zero for everyone whichever database is used. The thing that carries over is who she is, not what her business did — so [STUDY-ACCESS §7](STUDY-ACCESS.md)'s "the history carries over and it is the valuable half" is **wrong for these users** and right only for anyone who later reports through WhatsApp. The consent still has to be fresh, for the same reason as before.
- **`reset_demo_data()` must not exist in that database.** It deletes unconditionally — `delete from … where true` across 31 tables, not filtered by `is_simulated` — and its only guard is a confirmation phrase hardcoded in a public migration. In a database holding real credit records that is a loaded gun. The fix that survives one shared migration set: make it refuse unless a database-level setting marks the database as a demo, and set that only on the hackathon project.
- **Three tables now hold a name and a city.** `users`, `profiles` and `entrepreneurs`. Decide which owns identity before the first real row: the app's tables own who she is and what her business is, and the credit side either reads them or keeps a deliberate snapshot taken at assessment time — there is an argument for the snapshot, since an assessment should record the business as it was, but it has to be a decision rather than a drift.

The upside beyond the saved project: **dev and staging already exist**, so the credit migrations get tested in two environments before production, which a brand-new project would not have had.

1.1 and 1.2 can run in parallel by different hands; 1.2 only needs 1.1 for where the engine finally lives.

---

## Phase 2 — the build

The product change the whole thing is for. [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) sizes the layer at 8–9 weeks; these are its parts plus the access work that belongs with them.

| | what | depends on | size |
|---|---|---|---|
| 2.1 | **Community consent defaults and the WhatsApp consent channel** — a community narrows, never widens | 1.3 | ~3 days |
| 2.2 | **Phone identity and the pull-a-link access flow**, with phone numbers added to the PII scan's search set *before* the first real one is stored | 1.3 | ~1.5 weeks |
| 2.3 | **The WhatsApp layer** — sign-up, the fortnightly contact against the monthly record, the consolidation, the AI report | 1.3, 2.2, **1.5** | 7–8 weeks |
| 2.4 | **Community-vouched recovery**, as a re-bind permission that never grants read access | 2.2 | ~1 week |
| 2.5 | **Enrolling the eighteen** — in-app invitation and one fresh consent. No migration: they are already in the database, under the auth id the credit side will use | 2.1, 2.2 | ~2 days |
| 2.6 | **The bot** — retrieval tools only, answers but never offers | 2.3 | within 2.3 |
| 2.7 | **Account approval and real auth** for the two organisational dashboards. The entrepreneur is not one of them: she stays on WhatsApp plus a signed link | 1.5 | ~1 week |

2.1 is three days and it unblocks a commercial conversation, so it goes first even though it is the smallest thing here.

### The two things that gate collecting a real figure

**A place for the data has to exist before the data does.** Real revenue and household figures cannot land in the hackathon project — its password is published on purpose, one click switches a visitor to any persona, and `seed-demo.mts` opens with `reset_demo_data()`. So **2.3 depends on 1.5**, not only on the private repo, and that dependency is added above. The production project and its clean migration run are the gate on collection, and 1.5 is also the item most likely to surprise us, which argues for pulling it earlier rather than later.

**Meta's queue is the other one, and it is not code.** Business verification reportedly takes days, and it needs a CNPJ and a dedicated number that is not already on WhatsApp. It can start today, in parallel with everything, and it blocks nothing in the build: getting started creates a test account and test number with no paperwork. Verification is what the pilot waits on — and even there the unverified cap of roughly 250 unique customers per rolling 24 hours in business-initiated conversations sits far above a first cohort.

**And 2.3 came down by about a week.** The endpoint and encryption key pair the study budgeted are not needed: a Flow with no data endpoint generates its own routing and returns everything she typed in the completion webhook. The form is written — `docs/whatsapp/checkin-flow.pt-BR.json` — with the templates and the consent wording beside it in `docs/whatsapp/`.

---

## Phase 3 — the products

| | what | depends on | size |
|---|---|---|---|
| 3.1 | **The provenance view** — each record resolved to *may contribute to tier 2 / may not* | 0.3, 1.3 | ~2 days |
| 3.2 | **The disclosure rules** — minimum cell, programme dominance, the p% rule, all evaluated on the intersection requested | 3.1 | ~1 week |
| 3.3 | **The API**, fixed cuts only, each response carrying the commitment set it was computed over and the sample's shape | 3.2 | ~2 weeks |
| 3.4 | **MCP**, as a wrapper over 3.3 and not a second surface | 3.3 | ~3 days |
| 3.5 | **The corporate area** — ESG sponsor and community partner dashboards behind approved credentials. No investor, pending regulation | 2.7 | mostly exists |

**3.3 does not open until a cut passes 3.2 and is worth buying**, which is the higher bar. An indicator over thirty businesses is an anecdote.

---

## The real contract

Separate track, no date, and it starts when there is a real deployment to point it at. [STUDY-CONTRACTS.md](STUDY-CONTRACTS.md) carries the full list; the three that cannot be fixed afterwards:

1. `operator` and `treasurer` as separate keys, the treasurer behind a multisig, with a destination allowlist and an amount cap.
2. `set_authority`, two-step.
3. A `close` instruction for the rent deposit, and the per-record-versus-batched decision — both irreversible once accounts exist.

Then an external audit before real money moves through `vault_transfer`.

---

## The critical path

```
freeze lifts → publish packages (3d) → private repo (1d) → phone identity (1.5w) → WhatsApp layer (8–9w)
                     └→ engine revision (2w, parallel)
                     └→ demo doors out + prod project + 2nd program (3d, parallel)
```

**About eleven to twelve weeks from the freeze to a WhatsApp pilot running on real records**, with the engine revision and the production split absorbed in parallel rather than added to it.

Two things sit off the path and should not wait for it: the tier-2 clause (0.3), which is free now and expensive after the first signature, and the consent defaults (2.1), which are three days and unblock a partner conversation.

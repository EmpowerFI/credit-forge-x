# EmpowerFI — Solana Hackathon 2026 Work Plan

**Hackathon:** Colosseum — **Crypto World's Fair**, online. Solana track supported by the Solana Foundation.
**Window:** Mon 14 Sep 2026 → Mon 12 Oct 2026 (29 days, 4 full Mon–Sun weeks + submission day)
**Source of scope:** `EmpowerFI_Backlog_Tecnico_Hackathon_Solana_2026_v1.docx` (the backlog is the *what*; this file is the *how, in what order, and what gets cut*)
**Repository:** this one (`credit-forge-x`) — Anchor program, restricted dashboard area, credit engine, hackathon backend
**Written in English** per the project-wide documentation convention (`CLAUDE.md` → "Project Language"), and because judges are international.

---

## 0. What this plan changes relative to the backlog

The backlog is sound. Four things need a decision it does not make, and they change the schedule materially. Each is written up in §2 with a recommendation.

1. **Where the entrepreneur check-in UI lives** — mobile app repo vs. the web restricted area. This is the single largest schedule lever in the whole project.
2. **Which database the hackathon runs on** — production has 23 real users and LGPD-sensitive data; the backlog assumes a greenfield schema.
3. **Whether there is a Node API service at all** — the backlog says "Node/TypeScript REST"; both existing repos are Supabase Edge Functions and have no Node service to speak of.
4. **Whether the repo goes public** — hackathons usually require it, and this repo has `.env` in its git history.

And two things the backlog omits that will bite during the demo, added here as first-class work: **judges must be able to log in** (§5.3), and **the "recompute this proof" screen is the demo's money shot** and must be a real endpoint, not a slide (§6.4).

---

## 1. Ground truth as of 2026-09-08

Verified on this machine, not assumed:

| Thing | State |
|---|---|
| Rust / Cargo | 1.95.0 ✅ |
| Solana CLI | 3.1.13 (Agave) ✅ |
| Anchor CLI | 1.0.0, via avm 0.31.1 ✅ |
| Node / pnpm | v24.10.0 / 10.11.0 ✅ |
| Docker | 28.5.1 ✅ (needed for `supabase start`) |
| Devnet reachable | ✅ cluster 4.3.0-beta.3 |
| Devnet wallet | `4qQbMCTknaYS7EwUMM42h2RfQjYRYT7RwtkbvCa3FBRW`, **26.8 SOL** — no airdrop pressure |
| This repo | Vite 5 + React 18 SPA, shadcn/ui, TanStack Query, Zod, react-router 6. **No auth, no Rust, no monorepo.** |
| Supabase in this repo | pgmq + pg_cron + pg_net + Vault + DLQ already wired for the email queue — **the anchoring pipeline is the same pattern** (§7) |
| Repo visibility | **PRIVATE**, `github.com/EmpowerFI/credit-forge-x` |
| Website backend | **Cutover to `xifczvaiedmokdpjevsf` is COMPLETE** — verified 2026-09-08 (§12) |
| `.env` in git history | **Purged 2026-09-08** — history rewritten and force-pushed, `9a80e20` → `8b97a0b`. See §11.1. |

The toolchain being already installed removes the most common Week-1 sinkhole. Treat that as a day gained, not as slack.

**Previously flagged as an open blocker, now closed:** the `xifczvaiedmokdpjevsf` cutover was in fact already finished. Verified read-only on 2026-09-08 — all 5 migrations applied, the 3 email Edge Functions deployed, `RESEND_API_KEY` set, the Vault secret `email_queue_service_role_key` present, the `process-email-queue` cron active on a 5-second schedule, `investor_waitlist` existing with 1 signup, and the live bundle at `www.empowerfi.io` built against that project ref. **The waitlist form works.** Nothing to push.

One tail left: the old `yczodofprsgjsffemkac` project may still run its own `process-email-queue` cron. It no longer receives new messages, so duplicate sends are unlikely, but the job should be unscheduled (§12).

---

## 2. Decisions to lock before Mon 14 Sep

**All of these were decided on 2026-09-08.** Each heading carries its outcome; the reasoning is kept because it is what makes the decision revisitable.

### D1 — Where does the entrepreneur check-in live? → ✅ **DECIDED: the web restricted area, in this repo**

The backlog's Week-2 deliverable is a check-in that produces a financial snapshot. The obvious home is the existing mobile app. Against that:

- The mobile repo's `phase-2` branch is mid-flight with its own release gate (`main` deploys the website *and* is what store builds are cut from). Cutting a hackathon feature through that gate costs device testing on two platforms.
- Play Store review is 1–7 days. Nothing in the hackathon deliverable requires a store build — the deliverable is a **video and a live devnet demo**.
- The demo script (§19 of the backlog) gives the check-in 50 seconds. It needs to *look* like a phone, not *be* an APK.

Build the check-in as a mobile-first web route (`/app/checkin`, 380px-first, the app's visual language) inside the restricted area. Demo it in a phone-shaped browser frame or an actual phone browser. Port to Capacitor after 12 Oct, when the schema has stopped moving.

**If you choose mobile instead:** add ~4 days (Capacitor sync, device build, two-platform testing, env plumbing to a new Supabase project) and drop AI Insights (E7) and the selective-disclosure PoC (E6 partial) to pay for it.

### D2 — Which database? → ✅ **DECIDED: a new dedicated Supabase project `empowerfi-hackathon` (São Paulo)**

Not production. Three reasons, in order of weight:

1. Metric §23 requires **demo reset in under 5 minutes**, which means destructive seeds. You cannot run those next to 23 real users.
2. The hackathon schema (`communities`, `checkins`, `financial_snapshots`, `scores`, `loans`, `chain_anchors`) is a *different system of record* from the marketplace schema. Grafting it onto prod couples two roadmaps that should stay independent.
3. During a sprint with daily migrations, blast radius matters more than elegance. A bad migration at 2am should not take down the live app or the website's email queue.

**Created 2026-09-08: ref `yuxrujoghizcfdmbkqfg`** (`https://yuxrujoghizcfdmbkqfg.supabase.co`).

Consequence: the SPA holds **two Supabase clients** — the existing marketing/waitlist one, and `VITE_HACKATHON_SUPABASE_*` for `/app/*`. That is roughly twenty lines and worth it.

*Alternative if you want one project:* a separate `platform` schema in the existing project, with seeds scoped to never truncate outside it. Cleaner ops, worse blast radius. Not recommended during the sprint.

### D3 — Is there a Node API service? → ✅ **DECIDED: no. Supabase Edge Functions + Postgres RPC + RLS**

The backlog's §8 endpoint table is a good *interface* specification and should be honoured as such. But standing up a Node/Hono service means a new deploy target, a CORS surface, a second env-var regime and an auth hop — the exact reasons Phase 0 removed its Node orchestrator (`BLUEPRINT_PHASE_00.md` §2.1). Map the endpoints onto Edge Functions and RPCs one-for-one. Idempotency keys still apply.

### D4 — Repo layout → ✅ **DECIDED: directories + tsconfig path aliases, not a package-manager workspace**

```
credit-forge-x/
├─ src/                        # existing marketing site — untouched
│  └─ app/                     # NEW restricted area (auth, dashboards, check-in)
├─ packages/
│  ├─ audit-commitments/       # canonical JSON + SHA-256 + domain separation
│  ├─ credit-engine/           # pure, deterministic, versioned
│  └─ shared-types/
├─ programs/empowerfi-audit/   # Anchor
├─ tests/                      # Anchor integration tests (ts-mocha)
├─ supabase/{migrations,functions,seeds}/
├─ Anchor.toml
└─ PLAN_HACKATHON.md
```

Converting to pnpm workspaces mid-sprint is churn with no payoff — this repo carries both `package-lock.json` and `bun.lock` already. Edge Functions import the packages by relative path (Supabase bundles them); the browser imports them via `@/packages/*` aliases.

⚠️ **The drift trap:** the same credit-engine code running in the browser and in a Deno Edge Function is exactly the failure the mobile repo hit with `premium_monthly` and the account-id hash. Mitigation is the one they landed on: **a golden-vector test pinned on both sides**, so the two cannot silently diverge.

### D5 — Hash & canonicalization → **as the backlog says.** SHA-256, domain separation (`EMPOWERFI:CHECKIN:v1 || canonical_payload`), cents as integers, ISO-8601 UTC, sorted keys, null-stripping. No deviation.

### D6 — `borrower_ref` → **random 32 bytes generated server-side, stored off-chain, never derived from anything.**

The backlog says "não reversível por dicionário". The only way to guarantee that is for it to be random rather than a hash of anything a dictionary could contain. A hash of an email is reversible by dictionary; random bytes are not.

### D7 — Program ID discipline → **generate the program keypair once, in Week 0, and never regenerate it.**

If the program ID changes mid-sprint, every `chain_anchors.program_id` already written goes stale and the reconciliation job reports MISMATCH on data that is actually fine. `anchor keys sync`, commit `Anchor.toml`, keep `target/deploy/empowerfi_audit-keypair.json` **out of git and backed up outside the repo**. Redeploys use `anchor upgrade`, never a fresh deploy.

**Generated 2026-09-08**, kept in `~/empowerfi-hackathon-keys/` (mode 700, files 600), outside the repo:

| Key | Address | Role |
|---|---|---|
| `empowerfi_audit-keypair.json` | `4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR` | the program ID, fixed for the whole hackathon |
| `operator-keypair.json` | `2gHyXDj9q4vzQh4xeniLejhGedF9vfTq99yPv3R2PRQa` | signs anchoring txs; goes into Supabase Vault, never the browser |
| (existing CLI key) | `4qQbMCTknaYS7EwUMM42h2RfQjYRYT7RwtkbvCa3FBRW` | deployer / payer, 26.8 devnet SOL |

On day 1: copy the program keypair to `target/deploy/`, run `anchor keys sync`, commit `Anchor.toml`, and fund the operator with ~0.5 devnet SOL for fees.

### D8 — Public repo and pre-existing code → ⚠️ **REVISED 2026-09-08, after reading Colosseum's actual rules**

The first answer to this was taken on a premise that turned out to be wrong. Colosseum's published rules say:

- **Private repositories are acceptable**, provided access is granted to `hackathon@colosseum.com`. Open source is encouraged, not required.
- **Projects need not be brand new.** Teams may begin development before the hackathon. But "products are judged only on the work completed between the competition's start and end dates", and entrants must **disclose all relevant past development work in the submission form** — misrepresentation risks disqualification or a ban.

So the revised decision:

- **The repo may stay private.** Grant access to `hackathon@colosseum.com` at submission. Keep it private through the sprint; publishing is a separate choice that can wait until after 12 Oct.
- **Pre-window code is permitted, but it does not count for judging.** That inverts the earlier constraint into a question of *where the hours pay off*: anything built before 14 Sep is invisible to the judges. Week 0 should therefore go into **scaffolding that removes Week 1 friction but is not itself the differentiator** — repo layout, empty Anchor project that compiles, CI, Supabase bootstrap — and the substance (program logic, credit engine, dashboards) should land inside the window where it is credited.
- **The existing EmpowerFI product is pre-existing work and must be disclosed.** The live Play Store app, the website, the 23 real users and the Sebrae programmes all predate the hackathon. Disclosing them is mandatory — and it is an asset, not a liability: Traction is one of the judging criteria (§3, Submission requirements).

**The `.env` history purge was still the right call**, even though it was done under a mistaken premise: reviewers get repository access either way, so the history was always going to be read by someone outside the company.

**Net effect on the schedule:** the "Week 1 starts from zero lines of code" risk flagged earlier is **lifted**. Week 0 can now scaffold.

---

## 3. Scope

### Ships (P0)
E1 Community & eligibility foundation · E2 Check-in · E3 Credit Engine v0 · E4 Loan lifecycle · E5 Three dashboards · E6 Privacy & audit · E8 Demo & observability.

### Ships if the schedule holds (P1)
E7 AI Insights (with the deterministic fallback built **first**, so the LLM is an upgrade and never a dependency).

### Explicitly does not ship
Real funding · real Pix · paid KYC · self-custody wallet · ML scoring · full ZK · Confidential Balances beyond a documented spike · multi-community/multi-cohort · mobile store release · anything touching the live marketplace's data.

### Submission requirements (Colosseum, Crypto World's Fair)

Per Colosseum's published rules. **Confirm each against the submission form itself before Week 4** — these are the general hackathon rules, not necessarily World's Fair-specific.

| Artifact | Note |
|---|---|
| Product name + description | |
| Blockchain and tool integrations | Solana track: the integration must be substantive, not decorative |
| Team members, backgrounds, location | Solo entries allowed; teams encouraged. One project per builder. |
| Product logo or graphic | |
| GitHub repository link | Private is fine — grant access to `hackathon@colosseum.com` |
| **Presentation video, 2–3 min** | the *why* — thesis, market, founder |
| **Product-demo video, max 3 min** | the *how* — technical, specific to implementation, and specifically how it leverages Solana |
| Go-to-market, demand validation, distribution | business, not engineering — needs its own preparation time |
| Disclosure of all prior development work | mandatory; see D8 |

⚠️ **Two videos, not one — and the backlog's §19 script does not fit either.** That script is a single five-minute walkthrough. It has to be cut into a ≤3 min pitch and a ≤3 min technical demo, with different arguments. The technical demo is where the Solana content belongs: commitments, the recompute-the-proof screen, the privacy boundary.

**Judging criteria:** Founder + Market Fit · Insight · Product + Execution · Potential Market Size · Founder Communication · Viability · Traction. Several evaluation rounds, then a panel; selected teams get a 15-minute interview.

Read that list again against this plan: **it is majority non-engineering.** A technically perfect demo with no go-to-market story scores badly. Budget real time for the business artifacts — they are not a Week 4 afterthought.

**Prizes:** $100,000 across the top 10 Solana-integrating submissions (Solana Foundation). Winners overall are admitted to Colosseum's accelerator with $250,000 in funding.

---

## 4. The boundary that the whole thesis rests on

> Postgres is the operational system of record. Solana is the proof layer. Nothing is duplicated on-chain.

Concretely, what goes on-chain is **32-byte commitments, enum states, versions and timestamps** — and nothing else. Never a name, an email, a CPF, a phone number, a personal wallet, or a currency amount.

This is not a nice-to-have; it is the differentiator judges will test. §23 sets **PII on-chain = 0**, and §17 asks for a scan. Implement that as an automated test that fetches every program account on devnet and regex-scans the raw bytes for CPF/CNPJ/email/phone patterns, asserting zero hits. It is cheap, it is a regression test for a guarantee rather than a feature, and it is worth showing on screen during the demo.

---

## 5. The restricted area

### 5.1 Routes

`/app` is a new authenticated shell in this SPA, separate from the marketing site, sharing the design system.

| Route | Role |
|---|---|
| `/app/login` | public |
| `/app/checkin` | entrepreneur |
| `/app/me` | entrepreneur — own report, insight, eligibility |
| `/app/community` `/app/community/new` | community leader (create + manage) |
| `/app/dashboards/community` | community leader |
| `/app/dashboards/esg` | ESG sponsor |
| `/app/dashboards/investor` | capital provider |
| `/app/audit/:entityType/:id` | auditor — commitment, tx, recomputation |
| `/app/admin` | operator/admin — verify community, transition loan |

### 5.2 Auth & RBAC

Supabase Auth on the hackathon project. `profiles(user_id, role, entrepreneur_id, community_id)`, RLS on every table from the first migration — the roles in backlog §14 map one-to-one onto policies. RBAC is enforced in **RLS**, not in the router; the route guard is UX only.

### 5.3 Judges must be able to log in — and this is not a detail

Magic-link auth requires inbox access that judges do not have. Seed **demo accounts with fixed passwords**, list them in the README, and enable email+password on the hackathon project alongside magic link:

```
leader@demo.empowerfi.io      Community Leader
investor@demo.empowerfi.io    Capital Provider
esg@demo.empowerfi.io         ESG Sponsor
auditor@demo.empowerfi.io     Auditor
maria@demo.empowerfi.io       Entrepreneur
```

Plus a **read-only fallback**: if auth breaks during judging, `/app/dashboards/*?demo=1` renders the seeded dataset without a session. Backlog §17 asks for demo resilience; this is the cheapest form of it.

Every screen carries a visible "Demo data — Solana Devnet" marker. All figures are synthetic and must be unmistakably labelled as such, so nobody believes they are looking at real entrepreneurs' finances.

---

## 6. On-chain design

Accounts, seeds and instructions are specified in backlog §3 and §4 and are adopted unchanged. Notes that matter for building them:

### 6.1 Sequencing
The eleven instructions are individually small — most write a 32-byte hash plus two enums. The cost is not the instructions; it is the tests, the TS client and the indexer. So they land in three waves matching the weekly plan: config/community/borrower (W1) → checkin/score/eligibility (W2) → loan/payment/transitions (W3).

### 6.2 State machine
Backlog §5 in `transition_loan`, enforced on-chain **and** in Postgres. Two enforcement points is deliberate: the DB stops bad UI, the program stops a bad DB.

### 6.3 Idempotency
`anchor_checkin` unique per `(borrower_ref_hash, period)`; `anchor_payment` unique per `(loan_hash, installment_no)`. PDA seeds give this for free — a second init fails. Surface that as a clean error, not a 500.

### 6.4 The audit screen is the money shot
Demo minutes 2:00–2:40 are "show the commitment and recompute it without revealing the data". That screen must genuinely: fetch the canonical payload from Postgres → recompute SHA-256 in the browser → fetch the on-chain account → compare → render **VERIFIED** with the tx signature, slot and an Explorer link. Built as a real endpoint (`GET /audit/:entityType/:id`), never a mock. Budget a full day for it in W3, not an hour in W4.

---

## 7. The anchoring pipeline — reuse, don't rebuild

This repo already runs a durable queue with retry, DLQ, a Vault-held service-role key and a `pg_cron` + `pg_net` dispatcher, built for transactional email (`20260428212516_email_infra.sql`). The anchoring pipeline is the same shape:

```
write to Postgres
  → enqueue_anchor(entity_type, entity_id, payload_hash)   [pgmq]
  → pg_cron every 10s → pg_net → anchor-submit Edge Function
       operator keypair from Vault → build tx → send → confirm
  → chain_anchors(entity_type, entity_id, hash, signature, slot, status)
  → anchor-reconcile (cron, 1 min): local vs chain → VERIFIED | MISSING | MISMATCH
  → failures → DLQ, retried idempotently
```

Cloning the email queue rather than inventing one is worth roughly two days, and it inherits retry semantics that have already been debugged in production.

⚠️ One trap carried over from that migration: **the dispatcher hardcodes the project URL inside the cron job body**. Copy it to a new project without editing that URL and every job POSTs to the wrong project — silently, forever, with jobs stuck at `pending`. Check it the day the hackathon project is created.

The operator keypair signs everything on devnet. It is a demo authority, held in Vault, never in the browser, never in git.

---

## 8. Week-by-week

Each week ends with a **Friday gate**: a thing that must be demonstrable live, not described. If a gate slips, the cut line (§9) fires the same day rather than the following week.

### Week 0 — Tue 8 → Sun 13 Sep · Decisions and accounts, no feature code
Locks D1–D8. Creates the Supabase project, the program keypair, the branch. Confirms the hackathon rules on public repos and on code written before the window. Resolves the pending `db push` (§12). **No program code and no migrations if the rules forbid pre-window code.**
**Gate (Sun 13):** every decision in §2 has an answer written into this file.

### Week 1 — Mon 14 → Sun 20 Sep · Foundation, and a thin end-to-end spine
DB migrations + RLS + roles · Supabase Auth + `/app` shell + route guards · community create/verify/membership · Anchor program wave 1 (`initialize_platform`, `register_community`, `set_community_verification`, `register_borrower_ref`) deployed to devnet · `packages/audit-commitments` with canonical JSON + hash + golden vectors · anchoring queue cloned from the email pattern · seed script v1.

Prioritise **depth over breadth**: one path all the way through beats four paths half-built. By Friday, a real login must produce a real PDA.

**Gate (Fri 18):** log in as the leader → create a community → verify it → the `CommunityAudit` PDA is visible on Solana Explorer, and the audit screen recomputes its hash.

### Week 2 — Mon 21 → Sun 27 Sep · Data becomes intelligence
Check-in UI (2–4 min completion, backlog §10 payload) · financial snapshot computation · feature snapshot + commitment · `packages/credit-engine` v0.1.0 with reason codes, affordability, confidence · `attest_score` on-chain · unit tests on the formulas and every reason-code branch · deterministic insight templates (E7 fallback, **before** any LLM).

**Gate (Fri 25):** a check-in produces a cash-flow view, a risk band with reason codes, and a score attestation whose commitment verifies on-chain.

### Week 3 — Mon 28 Sep → Sun 4 Oct · Credit becomes capital
Eligibility policy + `attest_eligibility` · loan state machine (DB + program) · `create_loan`, `transition_loan`, `anchor_payment` · the three dashboards against real APIs with empty/loading/error states · the audit/recompute screen (§6.4) · CTS and cost-to-deploy instrumentation · reconciliation job.

**Record rough cuts of BOTH videos this week, while the flow works.** The most common way a hackathon submission fails is leaving the video to the last 48 hours and discovering the flow breaks on camera. Two videos double that exposure.

**Gate (Fri 2 Oct):** an originator sees a demo loan move DRAFT → ELIGIBLE → APPROVED → DISBURSED → ACTIVE → PAID, with each transition anchored and reconciled, and all three dashboards showing the same operation under different permissions.

### Week 4 — Mon 5 → Thu 8 Oct · Privacy, resilience, hardening
Selective-disclosure PoC · the on-chain PII scan test (§4) · reconciliation edge cases (RPC timeout, pending, failed, retry) · role-access tests · error states · Confidential Balances **spike written up as documentation, timeboxed to one day, cut without hesitation if it resists** · seed/reset under 5 minutes · health checks.

In parallel, and not by the founder's spare evenings: **the go-to-market, demand-validation and distribution write-ups**, plus the prior-work disclosure. These are graded artifacts (§3) and they compete for the same week as hardening.

**FEATURE FREEZE — Thu 8 Oct, end of day.** Nothing new after this. Bugs only.

### Submission — Fri 9 → Mon 12 Oct
End-to-end run on a clean seed · README + architecture doc + privacy doc · **both final videos (pitch ≤3 min, technical demo ≤3 min)** · logo/graphic · devnet deploy verified from a machine that is not yours · repository access granted to `hackathon@colosseum.com` · submission form.

**Submit on Sun 11, not Mon 12.** Submission portals fall over on deadline day, and the last hour is not when you want to discover a required field you have not prepared.

---

## 9. The cut line, as dated gates

Backlog §18 gives the order. It only works if it fires on a date rather than on a feeling:

| If this gate slips | Cut, that same day |
|---|---|
| Fri 25 Sep (score) | AI Insights → deterministic templates only |
| Fri 2 Oct (loan + dashboards) | Confidential Balances spike → one paragraph in the README |
| Mon 5 Oct | Advanced charts → KPI cards only |
| Wed 7 Oct | Payment-amount privacy → commitment + status only |
| Thu 8 Oct | Multiple communities → one deeply instrumented demo community |

**Never cut:** the audit trail, score versioning, the privacy boundary, the end-to-end flow. Those four *are* the thesis. A demo that shows three of them completely beats one that shows eight partially.

---

## 10. Effort, honestly

Summed bottom-up, the P0 scope is roughly **30 working days** against **29 calendar days**, solo, with agent leverage. That is not comfortable, and it assumes nothing goes badly wrong.

Two consequences worth internalising now:

- **The cut line is not a contingency, it is part of the plan.** Expect to use it at least twice.
- **The demo is a deliverable with its own budget**, not a byproduct of the code. Seed script, video, README and architecture doc are ~4 of those 30 days. Judges score what they can see and reproduce.

---

## 11. Risks the backlog does not cover

### 11.1 `.env` in git history — ✅ RESOLVED 2026-09-08

`.env` had been committed in `2b0c5fd` (2026-04-28) and was present in 61 of 121 commits. It was never tracked in the working tree (it is gitignored), so this was purely a history problem — and D8 turned it into a blocker, since the repo must be published.

**What was done:** the whole history was rewritten with `git filter-branch --index-filter` on a mirror clone, verified, then force-pushed.

| Check | Result |
|---|---|
| Commits containing `.env` | 61 → **0** |
| Reachable `.env` objects | **0** |
| `.env.example` | preserved |
| Commits | 121, none lost |
| HEAD tree | **byte-identical** (`9ddd19e`) — no content changed, only SHAs |
| HEAD | `9a80e20` → `8b97a0b` |

`.env` still exists on disk locally, untracked and ignored, for local testing.

**Backup:** `~/credit-forge-x-PRE-REWRITE-20260908.bundle` (3.9 MB, `git bundle verify` clean). It is the **only remaining copy of the historical `.env`**. Two things follow:

1. **It is outside the repo and must stay there.** Never commit it, never move it into the working tree.
2. **If you ever want to know what that April file contained** — to decide whether any key deserves rotating — the bundle is the last place it exists. The file was never read during this operation, so that question is still open. Given the repo was private throughout and the documented shape (`.env.example`) is all public-safe `VITE_` values, the risk is low; rotation is hygiene, not urgency.

**Still open — do before publishing:** this repo was generated by Lovable, and `gpt-engineer-app[bot]` authored 97 of the 121 commits. **If that integration is still connected and holds its own copy, a future sync could reintroduce the old history.** Disconnect it before flipping the repo to public. Also note GitHub may serve old commits by direct SHA for a while until its own GC runs — irrelevant while the repo is private, worth knowing before it is not.

### 11.2 Devnet is not reliable, and the demo depends on it
Devnet has outages and degraded periods. Mitigations, all cheap: a preloaded fallback dataset that renders every dashboard with no RPC; cached tx signatures and slots in `chain_anchors` so the audit screen works read-only; a locally recorded screen capture of the on-chain steps as a last resort. Backlog §17 asks for this — build it in Week 4, not on the day.

### 11.3 Two implementations of the credit engine will drift
Browser and Edge Function. Mitigation in D4: golden-vector tests pinned on both sides. This is not hypothetical — the mobile repo shipped a broken account-id link for exactly this reason.

### 11.4 The `/investors` page already promises this
The live site tells investors a "Public Investor Dashboard" and a "Devnet Investor App" are coming. The hackathon builds precisely those. Two consequences: the narrative continuity is free and worth using in the pitch, and after 12 Oct the site should link to the demo. Keep the site's disclosure language intact — the waitlist is still non-binding interest, and a working devnet dashboard does not change that.

### 11.5 Scope creep from the marketplace
The mobile app's Communities/Events pivot (`CLAUDE.md` → BUSINESS MODEL PIVOT, 2026-08-26) uses the word "community" for a different thing than this hackathon does. They are not the same entity and must not be unified during the sprint. Note the collision, keep the schemas separate, resolve it afterwards.

### 11.6 The engagement/score invariant applies here too
The mobile repo's non-negotiable — *engagement data never reaches the score* — is a commitment this project has already made in writing. The credit engine's inputs are business signals: revenue, margin, cash-flow proxy, check-in completeness, education progress, community verification. Not opens, not clicks, not session counts, not "did she upgrade". Available time is not creditworthiness, and using it as a proxy would penalise exactly the users this exists to serve.

---

## 12. Week 0 checklist — this week

- [x] Confirm the hackathon rules — **Colosseum Crypto World's Fair**; private repo allowed with access to `hackathon@colosseum.com`; pre-existing work allowed but judged only on in-window progress and must be disclosed; **two videos** required (§3, D8)
- [ ] Confirm the above against the actual submission form, and record the exact deadline with timezone
- [x] Answer D1–D8 and write the answers into §2 of this file — done 2026-09-08
- [x] `.env` purged from git history and force-pushed (§11.1) — rotation still optional, see §11.1
- [x] Disconnect the Lovable / `gpt-engineer-app` integration — done 2026-09-08
- [x] Create the `empowerfi-hackathon` Supabase project — ref **`yuxrujoghizcfdmbkqfg`**
- [x] `db push` on `xifczvaiedmokdpjevsf` — **was already done**; full cutover verified 2026-09-08 (§1)
- [ ] Unschedule `process-email-queue` on the old `yczodofprsgjsffemkac` project
- [x] Generate the program keypair and back it up outside the repo (§D7) — done 2026-09-08. **Generate only — do not commit `Anchor.toml` before 14 Sep**; a keypair is a credential, not code, but a committed config file is a repo artifact created outside the window. `anchor keys sync` and the commit happen on day 1.
- [x] Create the working branch (`hackathon`), cut from `main` — done 2026-09-08
- [ ] Draft the demo script from backlog §19 — knowing the last frame shapes the first commit

---

## 13. Definition of Done

Adopted verbatim from backlog §1 and §23. Restated as the checklist to run on Fri 9 Oct:

- [ ] Leader creates a community; a member belongs to a verified community; education status is available
- [ ] An entrepreneur submits a check-in; indicators are computed; a snapshot is persisted
- [ ] The canonical payload produces a commitment; tx signature and slot are persisted; an auditor can recompute it
- [ ] Score v0 is explainable, with confidence, affordability, eligibility and reason codes
- [ ] A demo loan is created, approved, disbursed (simulated), receives payment events and closes
- [ ] All three dashboards load real data from the database, not screenshots
- [ ] **Zero PII and zero raw financial values in the program's accounts** — asserted by an automated scan
- [ ] Seed builds the scenario in under 5 minutes; the video shows the flow in 3–5 minutes; the local fallback works
- [ ] Every anchored entity reconciles VERIFIED in the demo scenario

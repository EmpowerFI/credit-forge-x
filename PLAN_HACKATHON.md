# EmpowerFI — Solana Hackathon Work Plan · v2

**Hackathon:** Colosseum — **Crypto World's Fair**, online. Solana track supported by the Solana Foundation.
**Window:** Mon 14 Sep 2026 → Mon 12 Oct 2026 (official). **Internal deadline: Sat 10 Oct, 23:59 BRT** — founder decision 2026-09-13, two days inside the official close.
**Repository:** this one (`credit-forge-x`), branch `hackathon`.
**Sources of scope:** `EmpowerFI_Piloto_Modelo_Negocios_2026_v1.pdf` (business model, Sept 2026) and the Product & Architecture Update spec, which supersede the original technical backlog wherever they disagree.
**Written in English** per the project documentation convention; judges are international.

---

## v2 — what changed and why

v1 planned against the original technical backlog: community → check-in → score → eligibility → loan → dashboards. The business model has since sharpened, and the change is not cosmetic. Three things are genuinely new, and they are the *thesis*, not decoration:

1. **Readiness is separated from eligibility, and both are separated from lender approval.** Three distinct judgements, three distinct owners. v1 collapsed them into one "Credit Engine".
2. **Credit intent is an explicit, separate act.** `CREDIT_READY` with no credit intent is a valid and successful outcome. The platform must be able to *not* push debt.
3. **The Qualified Credit Opportunity is a first-class entity** — it is the commercial product (Product 2), not an intermediate step between eligibility and a loan.

Everything else in this plan follows from those three.

**The decisions taken in Week 0 (D1–D8) survive unchanged.** The new model changes what is built, not where it is built, which database backs it, or what Colosseum requires. They are restated in §2 in condensed form.

---

## A · CURRENT STATE

### A.1 The spec assumes an MVP that does not exist

The Product & Architecture Update is written as a refactor: "refactor the current hackathon MVP", "do not rewrite working functionality", "inspect existing Anchor programs, dashboards, seed data". **Verified on 2026-09-11: none of that exists.**

| Expected by the spec | Actual |
|---|---|
| `programs/` (Anchor) | absent |
| `packages/` (engines) | absent |
| `tests/` | absent |
| `src/app/` (restricted area) | absent |
| `Anchor.toml` / `Cargo.toml` | absent |
| Domain migrations | absent — the 5 migrations present are the website's email stack and investor waitlist |

This is **good news, and it should be read as such**: there is no wrong-model implementation to unwind, no migration from a collapsed readiness/eligibility concept, no naming debt. The spec's instruction to prefer refactoring over rewrites has an empty set on the hackathon side.

It also means the honest framing of §B is not "what do we change" but **"what fits in 27 days"**.

### A.2 What exists and is reusable

| Asset | Reuse |
|---|---|
| Vite 5 + React 18 + shadcn/ui + Tailwind design system | the whole `/app` restricted area inherits it — zero design cost |
| `src/components/Seo.tsx`, routing, `ScrollToTop` | reusable as-is |
| Supabase client pattern + generated types | pattern reused for the second (hackathon) client |
| **pgmq + pg_cron + pg_net + Vault + DLQ email queue** | **the anchoring pipeline is this same pattern** — worth ~2 days (§F.4) |
| Playwright + Vitest configured | test harness exists |
| Marketing site (public narrative) | needs a narrative update (§K) — not hackathon code |

### A.3 Infrastructure already provisioned (Week 0)

Supabase `yuxrujoghizcfdmbkqfg` · Program ID `4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR` · operator `2gHyXDj9q4vzQh4xeniLejhGedF9vfTq99yPv3R2PRQa` · deployer with 26.8 devnet SOL · Rust 1.95 / Solana CLI 3.1.13 / Anchor 1.0.0 · branch `hackathon` · keys backed up in 1Password.

---

## B · GAP ANALYSIS

### B.1 Model delta — original backlog → new spec

| Domain | Backlog v1 | New spec | Delta |
|---|---|---|---|
| Readiness | did not exist; folded into the score | own deterministic engine, versioned, emits `missing_requirements[]` | **NEW · M** |
| Credit intent | an input field to the score | own entity and lifecycle; `READY` without intent is a valid terminal state | **NEW · S** |
| Qualified Credit Opportunity | did not exist (eligibility → loan) | first-class entity; *this is Product 2* | **NEW · M** |
| Partner | a `provider_id` column | entity with types, ticket ranges, accepted purposes, decision method | **NEW · M** |
| Partner decision | conflated with eligibility | separate by design, stored separately | **NEW · S** |
| Education | a loose table | product layer with explicit states | expanded · S |
| CTS | "instrumentation" | 13 stages, `cost_events`, 9 required metrics | expanded · M |
| Productive outcomes | an EVC proxy on one card | entity + EVC/EVM + on-chain commitment | expanded · M |
| Dashboards | 3 (leader, ESG, investor) | 4; **Credit Partner enters P0, ESG drops to P1** | substitution + **L** |
| On-chain accounts | 8 | 11 (+Readiness, +Opportunity, +Outcome) | +3 · M |
| Instructions | 11 | 13 | +3 · M |
| Capital Route | did not exist | rail-comparison abstraction | NEW · P1 · M |
| Funnel states | 8 (loan only) | 21 (participant lifecycle) | expanded · S |

### B.2 The arithmetic, stated plainly

v1 already estimated **~30 working days of P0 against 29 calendar days**, solo. The new P0 adds, bottom-up:

readiness engine (2) · credit intent (0.5) · opportunity entity + referral (2) · partners + decision (2) · education programs/progress (1.5) · CTS expansion (1.5) · outcomes + EVC/EVM (1) · 3 extra PDAs, instructions and tests (1.5) · credit-partner dashboard (2.5) · richer seed with 9 distinct cases (1) ≈ **+15.5 days**.

**≈ 45 working days of P0 into 27 calendar days. A ratio of about 1.7×.**

That is not a gap you close by working harder; at that ratio, effort is not the variable. It has to be closed by architecture, or the demo will be wide and broken instead of narrow and true. §C.1 is how.

### B.3 What the new model makes *cheaper*

Worth noting, because it is not all cost:

- **The eligibility engine shrinks.** Once readiness carries data quality, education and regularity, the eligibility engine only has to answer affordability and risk for a *specific requested amount*. It is a smaller, sharper function than the v1 "Credit Engine" that had to do both jobs.
- **`ScoreAttestation` becomes redundant** for a rules-based v0 (§F.2).
- **The ESG dashboard stops being a separate build** — it is the Community dashboard with a cohort filter and two cost metrics (§G.3).

---

## C · PROPOSED ARCHITECTURE

### C.1 The three moves that make 45 days fit in 27

**Move 1 — Seeded breadth, live depth.** The demo needs a 100-participant funnel (§22 of the spec). It does **not** need 100 live journeys.

- **One entrepreneur walks the full path live** during the demo, computed in real time, with real commitments anchored on devnet: check-in → readiness → intent → eligibility → opportunity → referral → partner decision → loan → payment → outcome.
- **The other 99 are deterministic seed**, occupying every other funnel state, including all nine cases the spec requires. Their commitments are anchored once in a batch pre-run and stored with real signatures and slots, so the audit screen works on any of them.

This buys the full funnel visualisation, rich dashboards and the nine cases at a fraction of the build. It is also honest: every seeded figure is labelled SIMULATED, which the spec requires anyway. **Worth ~10 days.**

**Move 2 — Engines deep, UI thin.** The readiness and eligibility engines are pure, deterministic, versioned TypeScript with golden-vector tests. They are cheap to build, cheap to test, and they are the *intellectual* core a judge will probe. UI is the expensive part. So: engines get full treatment and real test coverage; screens get one honest path each and no polish budget.

**Move 3 — Anchor nine account types live, not eleven.** §F.2. Fold `ScoreAttestation` into `EligibilityAttestation`; defer `OutcomeCommitment` to P1.

### C.2 The boundary, unchanged and non-negotiable

> PostgreSQL is the operational system of record. Solana is the proof layer.

On-chain: 32-byte commitments, enum states, versions, timestamps. Never a name, CPF, phone, email, bank detail, Pix data, raw revenue, raw expense, raw check-in or raw score. `borrower_ref` is **random 32 bytes generated server-side**, never derived from anything — a hash of an email is reversible by dictionary; random bytes are not.

Enforced by an automated test that fetches every program account on devnet and regex-scans raw bytes for CPF/CNPJ/email/phone patterns, asserting zero hits (§H.4).

### C.3 Layout

```
credit-forge-x/
├─ src/
│  ├─ (marketing site — narrative update in §K)
│  └─ app/                       # restricted area: auth, check-in, dashboards, audit
├─ packages/
│  ├─ audit-commitments/         # canonical JSON + SHA-256 + domain separation
│  ├─ readiness-engine/          # deterministic, versioned
│  ├─ eligibility-engine/        # deterministic, versioned
│  ├─ cts/                       # cost events → CTS metrics
│  └─ shared-types/
├─ programs/empowerfi-audit/     # Anchor
├─ supabase/{migrations,functions,seeds}/
└─ tests/
```

⚠️ **The drift trap.** Both engines run in the browser *and* inside Deno Edge Functions. That is exactly the failure the mobile repo hit twice. Mitigation: **golden-vector tests pinned on both sides**, so the two cannot silently diverge.

---

## D · DATABASE MIGRATION PLAN

Greenfield on `yuxrujoghizcfdmbkqfg` — additive migrations only, RLS on every table from the first one.

**M1 · identity & community** — `users`(profile+role), `communities`, `community_memberships`, `entrepreneurs`(with `borrower_ref`), `partners`
**M2 · education** — `education_programs`, `education_modules`, `education_progress`
**M3 · business data** — `checkins`, `financial_snapshots`, `feature_snapshots`
**M4 · readiness & intent** — `readiness_assessments`, `credit_intents`
**M5 · eligibility & opportunity** — `eligibility_assessments`, `qualified_credit_opportunities`, `partner_decisions`
**M6 · servicing** — `loans`, `payments`, `servicing_events`, `productive_outcomes`
**M7 · instrumentation** — `cost_events`, `chain_anchors`, `ai_insights`
**M8 · anchoring pipeline** — pgmq queue, DLQ, cron dispatcher, Vault secret (clone of the email stack)

Two structural constraints, both from the thesis rather than from convenience:

- **`readiness_assessments` and `eligibility_assessments` are separate tables**, never one table with a `kind` column. They answer different questions, are produced by different engines with independent `model_version`s, and are read by different roles. Merging them is the exact conceptual collapse the new model exists to correct.
- **`partner_decisions` is separate from `eligibility_assessments`.** EmpowerFI eligibility and partner approval are different facts with different owners. A schema that cannot represent "eligible but rejected by the partner" cannot represent the business model.

---

## E · API CHANGES

Per D3, the spec's REST endpoints map one-for-one onto Supabase Edge Functions and Postgres RPCs. No Node service.

| Spec endpoint | Implementation |
|---|---|
| `POST /communities`, `/members` | RPC + RLS |
| `POST /education/:id/progress` | RPC |
| `POST /entrepreneurs/:id/checkins` | Edge Fn — validate, snapshot, enqueue anchor |
| `POST /readiness/:id/evaluate` | Edge Fn — readiness engine, persist, enqueue attestation |
| `GET /readiness/:id` | RPC + RLS |
| `POST /credit-intents` | RPC |
| `POST /eligibility/:id/evaluate` | Edge Fn — eligibility engine, persist, enqueue attestation |
| `POST /opportunities`, `/refer`, `/partner-decision` | Edge Fn (state machine + idempotency) |
| `POST /loans`, `/transition`, `/payments`, `/outcomes` | Edge Fn |
| `GET /dashboards/{community,esg,credit-partner,capital}/:id` | RPC over views, role-filtered |
| `GET /audit/:entityType/:id` | Edge Fn — canonical payload + local hash + on-chain hash + verdict |

Idempotency keys on every state-changing call; `{ data, error }` return shape throughout.

---

## F · SOLANA / ANCHOR CHANGES

### F.1 Accounts — P0

`PlatformConfig` · `CommunityAudit` · `BorrowerAudit` · `CheckinCommitment` · **`ReadinessAttestation`** · `EligibilityAttestation` · **`OpportunityCommitment`** · `LoanAccount` · `PaymentCommitment` — nine.

**P1:** `OutcomeCommitment`.

### F.2 `ScoreAttestation` is folded into `EligibilityAttestation`

The spec lists both. For a rules-based v0 they carry the same payload: `risk_band` and `confidence` are *produced by* the eligibility evaluation and have no independent lifecycle. Two accounts would mean two writes, two anchor jobs and two reconciliation paths for one fact.

Keep the two attestations that *are* distinct — **readiness** and **eligibility** — and record the split of score-from-eligibility as a documented future change, due when an ML model gains a release cadence of its own. Worth stating in the README: it is a deliberate simplification with a named trigger, not an omission.

### F.3 Instructions — P0

`initialize_platform` · `register_community` · `verify_community` · `register_borrower_ref` · `anchor_checkin` · `attest_readiness` · `attest_eligibility` · `anchor_opportunity` · `create_loan` · `transition_loan` · `anchor_payment`. **P1:** `anchor_outcome`.

Domain separation: `EMPOWERFI:CHECKIN:v1`, `EMPOWERFI:READINESS:v1`, `EMPOWERFI:ELIGIBILITY:v1`, `EMPOWERFI:OPPORTUNITY:v1`, `EMPOWERFI:OUTCOME:v1`.

Idempotency comes free from PDA seeds: `anchor_checkin` unique per `(borrower_ref_hash, period)`, `anchor_payment` per `(loan_hash, installment_no)`. A second init fails — surface that as a clean error, not a 500.

The loan state machine is enforced **on-chain and in Postgres**. Two enforcement points is deliberate: the DB stops bad UI, the program stops a bad DB.

### F.4 The anchoring pipeline — clone, don't invent

```
write to Postgres
  → enqueue_anchor(entity_type, entity_id, payload_hash)      [pgmq]
  → pg_cron 10s → pg_net → anchor-submit Edge Function
       operator keypair from Vault → build tx → send → confirm
  → chain_anchors(entity_type, entity_id, hash, sig, slot, status)
  → anchor-reconcile (1 min): local vs chain → VERIFIED | MISSING | MISMATCH
  → failures → DLQ, retried idempotently
```

⚠️ The email dispatcher **hardcodes the project URL inside the cron job body**. Copy it without editing that URL and every job POSTs to the wrong project, silently, forever. Check it on day one.

### F.5 Program ID discipline

`4rqhx…` is fixed for the whole hackathon. If it changes mid-sprint, every `chain_anchors.program_id` already written goes stale and reconciliation reports MISMATCH on data that is fine. `anchor keys sync`, commit `Anchor.toml` on day 1, redeploy with `anchor upgrade` — never a fresh deploy.

---

## G · FRONTEND CHANGES

### G.1 Restricted area

`/app/login` (public) · `/app/checkin` · `/app/me` · `/app/community`, `/app/community/new` · `/app/dashboards/{community,credit-partner,capital}` · `/app/dashboards/esg` (P1) · `/app/opportunities/:id` (partner view) · `/app/audit/:entityType/:id` · `/app/admin`

Mobile-first at 380px for the entrepreneur routes (D1: the check-in is web, styled as the app, ported to Capacitor after 12 Oct).

### G.2 Judges must be able to log in — still true, still first-class

Magic links need an inbox judges do not have. Seed **demo accounts with fixed passwords**, listed in the README: `maria@`, `leader@`, `partner@`, `investor@`, `auditor@demo.empowerfi.io`. Plus a read-only fallback at `?demo=1` that renders seeded dashboards with no session, for when auth breaks during judging.

Every screen carries a visible **"Demo data · Solana Devnet · SIMULATED"** marker.

### G.3 ESG dashboard is derived, not built

It is the Community dashboard with a cohort filter plus cost-per-participant and cost-per-ready-participant. Building it as a fourth screen would cost ~1.5 days for a view the spec itself rates P1.

### G.4 The audit screen is the technical demo's money shot

It must genuinely: fetch the canonical payload from Postgres → recompute SHA-256 in the browser → fetch the on-chain account → compare → render **VERIFIED** with signature, slot and an Explorer link. A real endpoint, never a mock. Budget a full day in Week 3.

---

## H · TEST PLAN

| Layer | Cases |
|---|---|
| **Unit (vitest)** | canonical hash + golden vectors (browser and Deno); financial formulas; **readiness engine incl. every `missing_requirements` branch**; **eligibility engine incl. every reason code**; CTS aggregation; funnel state transitions |
| **Anchor (ts-mocha)** | authority checks; duplicate period rejected; invalid loan transition rejected; PDA seed derivation; payment idempotency; readiness-before-eligibility ordering |
| **Integration** | check-in → snapshot → readiness → attestation; readiness → intent → eligibility → opportunity; opportunity → referral → partner decision → loan; payment → dashboard |
| **Privacy (H.4)** | fetch all program accounts, regex-scan for CPF/CNPJ/email/phone → **assert zero**; `borrower_ref` not derivable; per-role access matrix |
| **Reconciliation** | tx pending / failed / retry; RPC timeout; slot confirmation |
| **Thesis regression** | **a participant who is `CREDIT_READY` with no credit intent stays `CREDIT_READY`** and never appears in the partner pipeline. This is a test for a *principle*, and it is the one that must never go red. |
| **Demo resilience** | RPC failure fallback; seed reset under 5 min; preloaded scenario |

---

## I · DEMO PLAN

⚠️ **Scripting and producing the videos is out of this plan's scope (founder decision, 2026-09-13).** They remain **required submission artifacts** — Colosseum asks for a 2–3 minute presentation video and a product demo of at most three minutes — and are owned by the founder, outside the engineering backlog.

What this plan still owes them is the thing only the build can provide: **a flow that survives being filmed.** That is what §I.1 and the Friday gates are for. What the videos should contain, if it helps whoever writes them:

**Pitch — the *why*.** Problem is unit economics, not "women can't get credit". Prepare before credit. Three product layers. Traction that already exists: live Play Store app, real users, Sebrae PIER. The beat is §I.1.

**Technical demo — the *how*.** The funnel spine running live, the readiness/eligibility separation in the data, a commitment recomputed on screen, the zero-PII scan, the partner dashboard, the audit trail.

### I.1 The beat that makes the pitch memorable

Almost every lending demo pushes debt. This one should show a participant who reaches `CREDIT_READY` **and is not offered credit, because she did not ask for it** — and a second who is ready but whose data says *wait*.

That is the clearest possible statement of the thesis, it maps directly onto Colosseum's "Insight" criterion, and it costs nothing extra to demo because the seed already contains both cases.

---

## J · PRIORITISED BACKLOG

### P0 — the demo does not exist without these

| # | Item | Size |
|---|---|---|
| 1 | Schema M1–M8 + RLS + role matrix | L |
| 2 | Supabase Auth + `/app` shell + route guards + demo accounts | M |
| 3 | Communities, memberships, verification | M |
| 4 | Education programs + progress | S |
| 5 | Check-in UI + financial snapshot + feature snapshot | M |
| 6 | `packages/audit-commitments` + golden vectors | M |
| 7 | **`packages/readiness-engine` v0** | M |
| 8 | Credit intent entity + UI | S |
| 9 | **`packages/eligibility-engine` v0** | M |
| 10 | **QualifiedCreditOpportunity + referral + partner decision** | M |
| 11 | Partners entity + seeded partners | S |
| 12 | Loan lifecycle + payments + servicing events | M |
| 13 | Anchor program: 9 accounts, 11 instructions, tests | L |
| 14 | Anchoring queue + reconciliation (clone of email stack) | M |
| 15 | `cost_events` + CTS metrics | M |
| 16 | Community dashboard | M |
| 17 | **Credit Partner dashboard** | L |
| 18 | Capital dashboard (seeded) | M |
| 19 | Audit / recompute screen | M |
| 20 | Deterministic seed: 100 participants, 9 cases | M |
| 21 | Zero-PII on-chain scan test | S |
| 22 | README + architecture + privacy docs | M |
| 23 | Submission artifacts — repo access, logo, disclosures, forms *(videos excluded: founder-owned, §I)* | M |

### P1 — ships if the schedule holds

ESG view (derived, S) · productive outcomes + EVC/EVM (M) · `OutcomeCommitment` + `anchor_outcome` (S) · Capital Route simulator (M, timeboxed 1 day) · AI insights over the deterministic fallback (M) · report export (S) · devnet token demonstration (M)

### P2 — explicitly not this month

Real Pix · real Open Finance · real on/off-ramp · real P2P capital · production stablecoins · ML credit model · confidential transfers · multi-country · mobile store release · anything touching the live marketplace's data

---

## K · WEBSITE NARRATIVE

The new business model contradicts the live site in ways that matter, and the contradictions are not cosmetic. Full list in §5.

---

# EXECUTION

## 1 · Decisions

D1–D8 were taken in Week 0 and **survive the model change unchanged**, condensed here:

| | Decision |
|---|---|
| **D1** | Check-in lives in the web restricted area (`/app/checkin`), mobile-first, ported to Capacitor after 12 Oct |
| **D2** | Dedicated Supabase project `yuxrujoghizcfdmbkqfg` — destructive seeds, isolated blast radius |
| **D3** | No Node service — Edge Functions + Postgres RPC + RLS |
| **D4** | `packages/` + path aliases, not a package-manager workspace |
| **D5** | SHA-256, canonical JSON, domain separation |
| **D6** | `borrower_ref` = random 32 bytes, never derived |
| **D7** | Program ID `4rqhx…` fixed for the whole hackathon |
| **D8** | Private repo with access to `hackathon@colosseum.com`; pre-existing work allowed but judged only on in-window progress, and must be disclosed |

Two new decisions follow from the model change:

### D9 — Seeded breadth, live depth ✅

One entrepreneur walks the funnel live during the demo with real devnet commitments; 99 others are deterministic seed occupying every other state, including all nine cases the spec requires. Their anchors are real, written once in a batch pre-run.

**Why:** the funnel visualisation is the demo's centrepiece and it needs 100 people. Building 100 live journeys is not a demo, it is a product launch. This is the difference between a plan that fits in 27 days and one that does not (§B.2).

### D10 — `ScoreAttestation` folds into `EligibilityAttestation` ✅

For a rules-based v0 they carry the same payload with no independent lifecycle. **Trigger for revisiting:** the first ML model with its own release cadence. Documented in the README as a deliberate simplification with a named trigger — not an omission, because a judge who knows the domain will ask.

---

## 2 · Schedule and gates

Each week ends with a **Friday gate**: something demonstrable live, not described. A slipped gate fires the cut line the same day (§3).

### Week 0 · Fri 11 → Sun 13 Sep — website narrative, no hackathon code
D8 forbids product code before the window. It does **not** touch the marketing site, which is pre-existing product — and the site is exactly what feeds the pitch and three of Colosseum's judging criteria. So the pre-window days go to §5.

### Week 1 · Mon 14 → Sun 20 Sep — foundation and the spine
Schema M1–M8 + RLS + roles · Auth + `/app` shell + demo accounts · communities, membership, verification · education programs and progress · `packages/audit-commitments` with golden vectors · Anchor wave 1 (config, community, borrower) deployed to devnet · anchoring queue cloned from the email stack · seed v1.

**Depth over breadth: one path all the way through beats four half-built.**

**Gate · Fri 18:** log in as the leader → create a community → verify it → register a borrower ref → the PDA is visible on Solana Explorer → the audit screen recomputes its hash and says VERIFIED.

### Week 2 · Mon 21 → Sun 27 Sep — data becomes readiness
Check-in UI (2–4 min) + financial snapshot + feature snapshot · **readiness engine v0** + `readiness_assessments` + `attest_readiness` · credit intent entity and UI · deterministic insight templates (the AI fallback, built *first*).

**Gate · Fri 25:** a check-in produces a cash-flow view and a readiness assessment with real `missing_requirements`; one participant reaches `CREDIT_READY` and declares intent; **a second reaches `CREDIT_READY` and declares none, and the system leaves her alone.** The readiness commitment verifies on-chain.

That second half of the gate is the thesis. If it does not work, nothing else in the demo means what it claims.

### Week 3 · Mon 28 Sep → Sun 4 Oct — readiness becomes capital
Eligibility engine v0 · QualifiedCreditOpportunity + referral + partner decision · partners entity · loan lifecycle + payments · Community and Credit Partner dashboards · CTS cost events across stages · the audit screen (a full day, §G.4).

The flow is filmable from this gate onwards, which is the earliest the videos can be recorded against something real. Production is founder-owned (§I); what this week owes is a demo path that does not break on camera.

**Gate · Fri 2 Oct:** a partner opens a qualified opportunity in its own dashboard, approves it, a loan is created and moves DRAFT → … → ACTIVE, a payment is recorded, and both dashboards show the same operation under different permissions.

### Week 4 · Mon 5 → Thu 8 Oct — capital, privacy, hardening
Capital dashboard (seeded) · productive outcomes + EVC/EVM, labelled simulated · Capital Route simulator (P1, timeboxed to one day, cut without hesitation) · zero-PII scan · reconciliation edge cases · RBAC tests · error states · seed reset under 5 min.

In parallel, and not in spare evenings: **go-to-market, demand validation, distribution and the prior-work disclosure.** These are graded artifacts and they compete for this same week.

**FEATURE FREEZE — Thu 8 Oct, end of day.** Bugs only.

### Submission · Fri 9 → Sat 10 Oct · deadline 23:59 BRT
Clean-seed end-to-end run · README + architecture + privacy docs · logo · devnet deploy verified from a machine that is not yours · repository access granted to `hackathon@colosseum.com` · both videos (founder-owned, §I) · **submit by Saturday 10, 23:59 BRT.**

Sunday 11 and Monday 12 are margin for a failure, not working time. The build loses nothing to the earlier date — feature freeze stays Thursday 8 — but the submission window shrinks from three days to two, so nothing that belongs to Week 4 may slide into it.

The internal deadline is safe whatever timezone Colosseum's official close turns out to use: even an Oct 12 00:00 UTC close falls on Oct 11 at 21:00 BRT, a full day after ours.

---

## 3 · The cut line, as dated gates

| If this slips | Cut, that day |
|---|---|
| Fri 25 Sep (readiness) | AI insights → deterministic templates only; Capital Route simulator |
| Fri 2 Oct (opportunity + partner) | Productive outcomes / EVC; `OutcomeCommitment` stays off-chain |
| Mon 5 Oct | Capital dashboard becomes a static seeded view; advanced charts → KPI cards |
| Wed 7 Oct | ESG view; report export |
| Thu 8 Oct | Second community, second partner — one of each, deeply instrumented |

**Never cut:** the funnel spine (community → education → check-in → readiness → intent → eligibility → opportunity → partner decision → loan → payment); the readiness / eligibility / partner-approval separation; the privacy boundary; the recompute-a-proof screen; CTS measured from the top of the funnel.

Those five *are* the thesis. A demo that shows three of them completely beats one that gestures at twelve.

---

## 4 · Risks

**4.1 · Scope is 1.6× the window.** §B.2. The three moves in §C.1 are what close it. If any of them is abandoned mid-sprint, the cut line must fire immediately rather than at the next gate — this is the risk most likely to end in a wide, broken demo.

**4.2 · Two engines running in two runtimes will drift.** Browser and Deno. Golden vectors pinned on both sides, or it happens again.

**4.3 · Devnet is not reliable.** Preloaded fallback dataset; cached signatures and slots in `chain_anchors` so the audit screen works read-only; a recorded capture of the on-chain steps as last resort.

**4.4 · Colosseum's judging is majority non-engineering.** Founder + Market Fit, Insight, Product + Execution, Market Size, Communication, Viability, Traction. The traction exists — live Play Store app, real users, Sebrae PIER — and must be foregrounded, not left implicit.

**4.5 · The readiness/eligibility distinction is invisible unless demonstrated.** It is the intellectual core, and on a dashboard it looks like two columns. §I.1 is how it becomes legible: show the system declining to push debt.

**4.6 · Marketplace vocabulary collision.** The mobile app's Communities/Events pivot uses "community" for a different entity. Keep the schemas separate; resolve after 12 Oct.

**4.7 · The engagement/score invariant still binds.** Engagement data never reaches readiness or eligibility. Opens, clicks, session counts and "did she upgrade" are not creditworthiness — using them would penalise the users with the least available time, which is the opposite of the product's purpose. Readiness inputs are business signals only.

---

## 5 · Website narrative — what the new model changes

The live site was written for the previous thesis. The business-model document (p. 25, 28) sets explicit positioning rules that the current site breaks in three places.

| # | Where | Change | Priority |
|---|---|---|---|
| 1 | `ProblemSectionEn` | "Small businesses lack access to capital" → **the unit-economics problem** (World Bank WPS8252, median US$14 opex per US$100 of portfolio). Specific, sourced, and it is the problem EmpowerFI actually solves | **High** |
| 2 | `HowItWorksSectionEn` | "Three participants, one chain of capital" → **the funnel that starts before the credit request** (conventional flow vs EmpowerFI flow, p. 7) | **High** |
| 3 | *new section* | **The three product layers** and who pays for each (p. 13). The largest hole in the current site: it never says how the business earns money in a form an investor can hold | **High** |
| 4 | `CreditIntelligenceSectionEn` | → **readiness ≠ eligibility ≠ lender approval**. Remove anything implying score quality; the avoid-list forbids "our score reduces default" before evidence | **High** |
| 5 | *new section* | **Market evidence** — 9.96M women-led businesses, 39.7%, 2.6% vs 4.6% formal-loan access, US$15.8bn gap, Crediamigo 3.89M disbursements at R$3,101 average. The site has no numbers today because none were sourced. Now they are | **High** |
| 6 | `WhySolanaSectionEn` + `ProductiveCapitalSectionEn` | **Merge and demote.** p. 12: "optimize the economics of credit — not the blockchain", and Pix may be the better domestic rail. p. 25: do not position the differentiator as blockchain. Two prominent sections become one, later on the page, framed as the future capital rail | **Medium-high** |
| 7 | `/investors` → `InvestorThesis` | Three revenue layers, asset-light framing, "partner today, capital platform tomorrow" regulatory roadmap | Medium |
| 8 | *new page* | **Sources / due diligence** — the ten official references on p. 30. Real value for an investor doing diligence | Medium |
| 9 | `FirstMarketSectionEn` | Keep, but ensure Brazil and women read as *first market*, never as identity (p. 25) | Low |
| 10 | whole site | **Enforce the avoid-list**: no "97.4% of women are denied credit"; no "blockchain is cheaper"; no score-quality claim; no "we are a P2P" before the regulatory structure | **High** |
| 11 | PT site | The entrepreneur page gains the readiness framing and must continue to promise no credit | Medium |

**Item 6 will feel like a demotion, and it is.** It is also what the document says, and it is the more credible position: a credit-infrastructure company that claims blockchain is always cheaper invites exactly the question it cannot answer. Saying Pix may win domestically is what makes the stablecoin argument believable where it does apply — cross-border capital.

**Recommended timing: now, in the pre-window days.** The marketing site is pre-existing product, so D8 does not bind it, and it feeds the pitch video and three judging criteria directly.

---

## 6 · Week 0 remaining

- [x] §5 — website narrative update — done 2026-09-13 (all 11 items, plus a public `/sources` page; every figure on the site now traces to the verified documentation)
- [ ] Confirm the submission form: exact deadline with timezone, required artifacts, World's Fair specifics
- [x] Decisions D1–D10 recorded
- [x] Infrastructure provisioned, keys backed up, branch cut

---

## 6b · Progress log

**Mon 14 Sep — Week 1 and Week 2 gates both met on day one of the window.** Every item below was walked in a browser against the hackathon project, with real devnet proofs.

| Gate | Result |
|---|---|
| Fri 18 · foundation and the spine | ✅ Leader logs in → creates a community → admin verifies it → leader enrolls an entrepreneur → all three proofs confirm on devnet (~7 s each) → the audit screen recomputes in the browser and says VERIFIED; editing the record in the database turns it to MISMATCH |
| Fri 25 · data becomes readiness | ✅ Maria's live check-in turns NEEDS_MORE_DATA into CREDIT_READY and she asks for capital; Jaqueline is CREDIT_READY with no request and never enters the credit pipeline; the readiness attestation audits VERIFIED, including a re-run of the engine in the browser |

What exists: program waves 1–2 (5 account types, 7 instructions, 15 LiteSVM tests) upgraded in place at `4rqhx…`; `platform/` Supabase workdir (M1, M2, M3, M4, M7-anchors, M8) with 105 pgTAP tests passing locally and on the remote, the thesis regression among them; `packages/audit-commitments` (golden vectors from an independent Python implementation, pinned in Node and Deno), `packages/readiness-engine` (13 hand-reasoned scenarios), a Codama-generated client; Edge Functions `anchor-submit` and `readiness-evaluate`; the `/app` area (login with demo accounts, communities, review queue, My business, check-in, credit intent, audit); a deterministic seed (100 participants, 6 months of history, 700 devnet proofs in ~9 min).

Deliberate deviations from this plan, each for a reason found in the build:

- **The work queue is `chain_anchors` itself**, not a pgmq clone: one row per fact with status, attempts, backoff and a `depends_on` link (verification waits for registration, enrollment for verification). Same cron → pg_net → Edge Function shape, one moving part fewer.
- **One anchor worker at a time** (a lease in the database). Parallel runs drew 164 `429 Too Many Requests` from the public devnet RPC on the first seed.
- **Helius devnet RPC** for the anchoring function (key held as a function secret, never in the repo or the browser): 700 proofs in 9 min, all on the first attempt, against 16.5 min and 173 rate-limited retries on the public RPC.
- **`set_operator`**, an instruction not in §F.3, so a leaked server key can be rotated without a new program ID.
- **Feature snapshots live inside `readiness_assessments.features`** rather than a separate table: the snapshot is the engine's input and is only ever read with its assessment.

Found by the tests before reaching the remote: a null access check that let an outsider call the audit function (PL/pgSQL `if not null` passes); `pg-safeupdate` rejecting whole-table deletes in API sessions; `@solana/kit` reading `process.env` in the browser, which blanked `/app`.

**Mon 14 Sep (evening) — Week 3 gate met.**

| Gate | Result |
|---|---|
| Fri 2 Oct · readiness becomes capital | ✅ In the browser: the partner opens P-67B282 (fashion, Grajaú) in its desk, approves it, marks the loan disbursed, starts repayment and records instalment 1; the leader's funnel moves from 3 approved / 2 under way to 4 / 3. All five new proofs (eligibility, opportunity, loan, loan transition, payment) confirm on devnet and audit VERIFIED as auditor — eligibility including a re-run of the engine, the transition decoded from its transaction |

What was added: `packages/eligibility-engine` (9 hand-reasoned scenarios, run in Node and Deno); program wave 3 (4 account types, 5 instructions, 19 LiteSVM tests), upgraded in place; migrations M5 (eligibility, opportunities, partner decisions, loans, payments) and M6 (cost to serve: rates, one cost event per fact, `cts_summary`), 142 pgTAP tests; Edge Function `eligibility-evaluate`; the partner desk, credit progress on the participant's page, the community funnel with cost to serve, the manual-review queue, audits for the five new kinds. The seed now runs every request through eligibility and the partner (9 approved, 2 declined, 3 awaiting, 1 held for manual review; loans approved, disbursed and repaying).

Deviations:

- **Partners see a pseudonym, not a name.** `partner_pipeline()` returns a code (`P-XXXXXX`), the sector, the verified community and indicators rounded to R$ 100; entrepreneurs' rows stay invisible to partners under RLS. The decision is the partner's alone: only the partner's own users can call `partner_decide`, and only on opportunities referred to it.
- **Eligibility runs only for ready participants who asked.** `private.credit_pipeline()` is the single gate; a ready participant without a request never gets an eligibility assessment (tested).
- **Cost to serve is written by triggers**, one event per fact at pilot rates (R$ 30/h), so no code path can forget to record it. Seeded Grajaú: R$ 55 per participant, R$ 1,102 per loan, R$ 27.54 per R$ 100 lent — the unit-economics problem, measured from the top of the funnel.

## 7 · Definition of Done

Run this on Fri 9 Oct:

- [ ] A leader creates a community; a member belongs to a verified community; education progress is visible
- [ ] An entrepreneur submits a check-in; indicators are computed; a snapshot is persisted
- [ ] The readiness engine produces a status, a band, `missing_requirements` and reason codes — deterministic and versioned
- [ ] **A participant reaches `CREDIT_READY` without credit intent and is never referred to a partner**
- [ ] Credit intent is a separate, explicit act
- [ ] The eligibility engine produces affordability, ticket range, risk band, confidence and reason codes for a *requested amount*
- [ ] A Qualified Credit Opportunity is created, referred, and receives a **partner decision stored separately from eligibility**
- [ ] A demo loan moves DRAFT → PARTNER_APPROVED → DISBURSED → ACTIVE → PAID, with payments recorded
- [ ] CTS is measured from the top of the funnel, not from disbursement
- [ ] Community, Credit Partner and Capital dashboards load real data under different permissions
- [ ] Canonical payloads produce commitments; signature and slot persisted; an auditor recomputes and gets VERIFIED
- [ ] **Zero PII and zero raw financial values in program accounts** — asserted by an automated scan
- [ ] Every anchored entity reconciles VERIFIED in the demo scenario
- [ ] Seed builds the scenario in under 5 minutes and the local fallback works
- [ ] The demo path runs end to end without breaking — the precondition the videos depend on (production itself is founder-owned, §I)
- [ ] Every simulated figure is visibly labelled SIMULATED

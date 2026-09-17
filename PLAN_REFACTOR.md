# Site + hackathon MVP refactor — gap analysis and plan

**Source:** *EmpowerFI — Site + Hackathon MVP Refactor Specification — 2026* (founder, 16 Sep 2026).
**Work:** on `hackathon`. Migrations, reseeds and the merge to `main` happen only after the founder approves.
**Founder decisions, 16 Sep:**
- **PT homepage:** `/pt` tells the same seven-section story. The entrepreneur content moves to `/pt/empreendedoras`, linked from "Apoio empreendedoras".
- **Demo switching:** for demo accounts only, the story bar signs in as that story's demo persona in one click.

**Status, 17 Sep (morning):** P0 built, migrations `20260923000000`–`20260923000300` pushed to the hackathon database, hackathon reseeded and merged to `main` (6d2ecb2).
- **Built:**
  - navigation in three stories plus Operations, with one-click demo switching;
  - the proof drawer;
  - Impact Intelligence (sponsor role, programs, `impact_intelligence()`, report export);
  - the Credit & Capital Engine in two runs, with a deep link from the sponsor;
  - the Investor Console (mandates, fit filter, affordability and proof status, outstanding);
  - outcome measurement by the desk;
  - the seven-section home in EN and PT, with `/pt/empreendedoras`; pilot roadmap and readiness moved to `/investors`, market evidence to `/sources`;
  - docs (DEMO.md in 14 steps, ARCHITECTURE, README, PRIVACY, I18N).
- **Changed from the plan:**
  - No `record_capital_use` and no new anchor kind. The seed leaves one July loan unmeasured, and the desk runs the existing `measure_outcome` in step 12.
  - A fourth migration lets sponsors read `capital_overview()`.
- **Checks:** pgTAP 452, Vitest 143, build, no new lint problems, and screenshots of every new screen at 1440 px and 390 px with no overflow or console errors.

**Rules kept:**
- Do not rebuild from scratch, and do not hard-code engine decisions.
- Label every simulated, test or devnet financial step.
- Put nothing personal on chain.

## Revision of 17 Sep: §2A and §3A

The spec's second version adds §2A (cost to serve without weaker credit), §3A (View platform as) and, in §13, a route map per role. The rest is unchanged.

**Status:** built on `hackathon` and verified locally. Checks: pgTAP 468, Vitest 149, build, no new lint problems, and screenshots at 1440 px and 390 px with no overflow or console errors. **Waiting on the founder:** push migration `20260924000000_operating_economics`, then merge. No reseed is needed.

**§2A · Operating economics.** No new tables. The facts were already recorded: cost events per stage, timestamps on every step, and the engines' reason codes and loan states.
- `operating_economics(program?)` is readable by the desk, auditors and admins over everything, and by a sponsor over its own program. It returns four pairs:
  - cost to serve (all-in, and credit only, per R$ 100 lent) with eligibility discipline;
  - time to decision with affordability checks;
  - scalability with follow-up;
  - capital access with portfolio quality.
- `/app/capital/economics` is linked from the engine and from Impact Intelligence ("Cost to serve"). It is labelled a hypothesis: the rates are assumptions, the data is simulated, and the World Bank benchmark is a reference, not a comparison.
- **Home page:** the Problem section is headed by the spec's question, followed by the four-row measurement table and "A hypothesis, not a result". The benchmark now reads "per US$100 of loans outstanding", as the source says, where before it said "lent".
- **What the local data shows:** all-in R$ 26.75 per R$ 100 lent, but credit alone R$ 2.62. Preparation for 100 participants dominates, and in the model the sponsored program funds it. The page shows both figures side by side.

**§3A · View platform as.** `lib/views.ts` defines five views, each with its value, its persona, and primary and secondary tools.
- The public entry `/app/login?as=` and the signed-in landing `/app/start?as=` show the chosen view.
- The header selector (beside the story bar, and in the mobile menu) leads to that landing.
- RBAC is unchanged: tools are only routes the view's own role opens (tested), demo accounts switch persona, and other accounts see only their own view.
- The desk now starts at the engine, its story.

### Route map by role (P primary · S secondary · — hidden)

| Route | Sponsor | Investor | Operator (desk) | Community | Entrepreneur | Admin / auditor |
|---|---|---|---|---|---|---|
| `/app/start` (view landing) | P | P | P | P | P | P |
| `/app/impact` | P | — | — | — | — | S |
| `/app/capital` (engine, replay, assumptions) | S | S | P | — | — | S |
| `/app/capital/economics` | S (own program) | — | P | — | — | S |
| `/app/investor` (overview, mandate) | — | P | — | — | — | S |
| `/app/investor/opportunities`, `/:id` | — | P | — | — | — | S |
| `/app/investor/portfolio`, `/positions/:id` | — | P | — | — | — | S |
| `/app/investor/settlement` | — | P | — | — | — | S |
| `/app/investor/audit` | — | P (proofs) | — | — | — | S |
| `/app/partner` (pipeline), `/reviews` | — | — | S | — | — | S |
| `/app/partner/decisions` | — | — | P (proofs) | — | — | S |
| `/app/partner/portfolio`, `/servicing`, `/loans/:id` | — | — | S | — | — | S |
| `/app/community/:id` (overview) | — | — | — | S | — | S |
| `…/cohorts`, `…/participants`, `…/readiness` | — | — | — | P | — | S |
| `…/participants/:id`, `…/pipeline`, `…/impact` | — | — | — | S | — | S |
| `/app/community`, `/app/community/new` | — | — | — | S | — | S |
| `/app/me`, `/app/check-in`, `/app/consent` | — | — | — | — | P | — |
| `/app/admin` | — | — | — | — | — | P (admin) |
| `/app/audit/*` | — | — | — | — | — | P (auditor) |
| `/app/audit/:kind/:id` (deep link from the proof drawer) | S | S | S | S | S | S |
| `/app/report/:token` (shared report, public) | S | S | S | S | S | S |

Hidden means a route is not in that view's navigation. The route stays behind RBAC as before, and no route was removed.

## 1 · Current-state map

### Platform (`/app`): six role workspaces, each with its own navigation

| Today | Role | What it already does | Target story |
|---|---|---|---|
| **Community Intelligence** (`/app/community/:id`: overview, cohorts, participants, readiness, pipeline, impact) | community_leader | 8-stage funnel, capital demand, funded amounts and coverage, cohort health, cohorts by intake month, outcomes (sales up, capital use, EVC, withheld by consent), cost to serve | Becomes **Community operations** (secondary). Its aggregates feed **Impact Intelligence**. |
| **P2P Capital Console** (`/app/investor/*`: overview, opportunities, portfolio, position, settlement, audit trail) | capital_provider | Wallet sign-in (SIWS), demo without a wallet, real devnet USDC deposit, simulated domestic BRL allocation, positions, payouts, capital path, MoneyGram sandbox quote, mock Pix | **Investor Console** (P0) |
| **Credit engine** (`/app/capital`) | investor, desk, admin, auditor | Live run: Engine 1 (credit) → Engine 2 (pools) → decision, replay, drawer, three seeded cases | **Credit & Capital Engine** (P0) |
| **P2P desk** (`/app/partner/*`) | partner | Formalise and disburse (mock Pix), servicing, record instalments, portfolio with outcomes | **Operations** (secondary) |
| **Audit** (`/app/audit/*`, `/app/audit/:kind/:id`) | auditor | Attestations, events, models (re-run), consents, Zcash, system, shared reports; per-record verification | Proofs move into drawers. The console stays for the auditor under Operations. |
| **My business** (`/app/me`, check-in, consent) | entrepreneur | Check-ins, readiness, credit request, eligibility, consent | Secondary: reached from the story |
| **Admin** (`/app/admin`) | admin | Verify communities, open opportunities to investors | Operations |

- **Login:** six demo personas, one click each. There is no sponsor persona.
- **Proof components that already exist:** `VerifyOnSolana`, `ProofLine`, `ProofStatus`, `ExplorerLink`, and the `audit()` verifier inside `AuditPage.tsx`.

### Data model

- **Exists:**
  - communities and memberships
  - education
  - check-ins (participation and monthly business data)
  - readiness and eligibility assessments
  - credit intents and qualified opportunities
  - funding pools with pool-level mandates (purposes, risk bands, ticket, impact mandate)
  - investments (USDC, domestic, Zcash)
  - loans, payments, settlement legs (mock Pix), productive outcomes (measured from check-ins)
  - consents
  - chain anchors for 14 event kinds
  - cost to serve
- **Missing:**
  1. **Sponsors and programs.** Nothing records who funds a cohort or how much. Cohorts are derived from the month a member joined.
  2. **Per-investor mandates.** Investors have no type (individual or impact fund) and no mandate of their own.
  3. **An outcome event at loan time.** `measure_outcome` needs two reported months on each side of the loan, so a loan disbursed during the demo cannot show an outcome.
  4. **Sponsor access.** A sponsor cannot read the aggregates. `community_overview` and `community_cohorts` are for leaders, auditors and admins only.

### Corporate site

- **EN homepage:** 14 sections — Hero, Problem, Solution, How it works, Readiness, Business model, Market evidence, First market, Traction, Capital, Impact, Pilot roadmap, For entrepreneurs, For partners.
  - The word "sponsor" never appears.
  - The business model sells "Community Intelligence" to NGOs, communities and ESG programmes.
  - It uses a four-partner taxonomy.
  - The full 12-month roadmap with its gates is on the homepage.
- **PT homepage:** written for the entrepreneur (7 sections). It has no business model, sponsor or capital story.
- **Other pages:** `/investors` and `/pt/investidores` still mention Community Intelligence in the revenue pillar. `/sources` exists in EN only.

## 2 · Gaps against the specification

| § | Requirement | Gap |
|---|---|---|
| 3 | Three primary stories, the rest under secondary navigation | Navigation is per role, and nothing shows the three stories together. **Needed:** a story switcher and an Operations menu. Audit leaves the primary navigation. |
| 4 | Impact Intelligence for sponsors | Nothing is built: no sponsor role, program data or program-level aggregate read. The community aggregates cover about 70% of the KPIs, funnel and outcomes. |
| 5 | Credit & Capital Engine: two runs, three cases, drawer, replay | Mostly built. **Needed:** separate **RUN CREDIT ENGINE** and **RUN CAPITAL ALLOCATION** steps, the name "Credit & Capital Engine", a deep link from Impact Intelligence (`?opportunity=`), and access for sponsors. "Run" is already separate from persistence: the database allocates at listing. |
| 6 | Investor Console, mandate-based impact investor | **Needed:** investor type and mandate, mandate filters and match chips, affordability and proof status on cards, outstanding amount on positions, "Investor Console" naming. Devnet USDC, the capital path and demo mode already exist. |
| 7 | Proof drawer beside critical events | The standalone Audit trail and full-page verification exist, but there is no drawer. **Needed:** extract `audit()` into `lib/verify.ts` and add a `ProofDrawer` that opens from every Verify link. |
| 8 | Homepage in seven sections | **EN:** rewrite and move the rest off the homepage. **PT:** needs a founder decision (§6). |
| 9 | Messaging hierarchy | Communities appear as a customer; "Community Intelligence" is the product name. |
| 11 | End-to-end demo in 14 steps | **Missing:** steps 1–3 (sponsor), 12 (outcome event at loan time) and 13 (sponsor metrics update). The rest exists across investor, desk and engine. |
| 13 | One opportunity traced from cohort to outcome | The links exist per role. A single trace view reachable from the sponsor story does not. |

## 3 · Proposed route and component changes

- **Navigation (`AppLayout`):**
  - A **story bar** with *Impact Intelligence · Credit & Capital Engine · Investor Console*, plus an **Operations** menu: My business, Community operations, P2P desk, Admin, Audit console.
  - For demo accounts (`@demo.empowerfi.io`), choosing a story you lack the role for signs in as that story's demo persona in one click and keeps the language. Real accounts see only the stories their role allows.
  - The workspace title follows the story, not the role.
- **`/app/impact`** (new, lazy): Impact Intelligence for sponsor, admin and auditor. If a sponsor has several programs, a program selector.
  - Header: program, sponsor, operator communities, reporting period, proof status.
  - The eight hero KPIs.
  - Funnel: Sponsored → Engaged → Reporting → Prepared → Credit ready → Requested capital → Funded → Performing.
  - Segments: readiness, data quality, sector, community city/state (groups under 5 suppressed), credit intent, purpose.
  - Capital mobilisation.
  - Outcomes, labelled "observed association, not causal impact".
  - Evidence panel.
  - Opportunities list: pseudonymous codes that deep-link to the engine.
  - "Generate auditable sponsor report": a printable, program-scoped report. It is a real JSON and print export, not a simulated one.
- **`/app/capital`:**
  - Two-step run.
  - Title *Credit & Capital Engine*.
  - `?opportunity=CODE` preselects an opportunity.
  - Roles gain sponsor, limited to the sponsor's program.
- **`/app/investor/*`:**
  - Workspace *Investor Console*.
  - Mandate panel on Overview.
  - Opportunities: mandate filters (population, geography, purpose, ticket, risk appetite, impact mandate), a "matches your mandate" chip, and affordability and proof status on each card.
  - Position: outstanding amount.
  - Audit trail leaves the navigation; the route stays, and proofs open in the drawer.
- **Proofs:**
  - `ProofDrawer` (Sheet) contents: pseudonymous id, event type, model and engine version, timestamp, commitment, selected route when an allocation exists, devnet signature, explorer link, and a VERIFIED / MISMATCH / MISSING / PENDING verdict computed in the browser.
  - `ProofLine`, `ProofStatus` and the Verify links open the drawer. `/app/audit/:kind/:id` stays as a deep link using the same verifier.
- **Desk loan page:** new action **Record productive outcome**. It records the declared use of the capital now; the measured change in sales follows once two months are reported.
- **Login:** a sponsor persona, and personas ordered by story.

## 4 · Database and API changes (platform project)

1. `app_role` gains `sponsor`. This is its own migration, because a new enum value cannot be used in the same transaction.
2. New tables `sponsors` (name, kind: company, foundation or impact fund; `is_simulated`), `programs` (sponsor, name, period, funding committed and deployed in cents, `is_simulated`) and `program_communities`. Profiles gain `sponsor_id`. RLS: a sponsor reads only their own sponsor and programs.
3. `impact_intelligence(p_program_id)` returns jsonb built from `private.community_state` over the program's communities:
   - Every figure is an aggregate. Geography groups under 5 are suppressed.
   - Outcomes count only businesses with the `impact` consent; the rest are reported as withheld.
   - Opportunities are listed only with the `investors` consent, using Q- codes.
   - Proof counts are by kind and status.
4. `engine_opportunities()` gains a sponsor gate, limited to the program's communities.
5. `investor_mandates` (investor, kind individual or impact fund, label, `states[]`, `purposes[]`, `sectors[]`, ticket min/max, `risk_bands[]`, impact mandate) with `my_mandate()` and `set_mandate()`. Matching runs in the browser in `lib/mandate.ts` (pure, tested) against fields investors already see. Nothing new about a business is exposed.
6. `record_capital_use(p_loan_id, p_capital_use)` for the loan's desk or an admin writes a `capital_use` outcome declaration and queues an `outcome` anchor. `measure_outcome` stays unchanged and runs when the history exists.
7. pgTAP covers roles, the sponsor's scope, suppression, consent and privacy (no private keys in any payload), mandates and the capital-use declaration.
8. **Seed:**
   - A fictional sponsor ("Patrocinador de impacto (demo)") funding one program over the four communities, with a simulated budget.
   - `sponsor@demo.empowerfi.io`.
   - Irene becomes the manager of a demo impact fund with a mandate.
   - The three engine cases stay natural.
   - This needs a reseed of the hackathon environment, with approval.

## 5 · Reused unchanged

- The readiness, eligibility and capital-allocation packages and their SQL twins.
- The Solana program and anchor pipeline.
- The investing, settlement, Zcash and consent flows.
- `community_overview`, `community_cohorts` and `cts_summary`, read by the new RPC.
- The engine page's parts: Snapshot, CreditEngine, PoolBranch, Decision, CapitalPath, Replay, Assumptions.
- `VerifyOnSolana`, `ExplorerLink`, `DataLegend`, `PrivacyBoundaries`.
- The desk actions, SIWS, i18n and `LaunchAppButton`.

## 6 · Homepage (EN and PT, same story; entrepreneur page at `/pt/empreendedoras`)

1. **Hero:** "Turn impact programs into investable businesses." CTAs: Explore the platform, Partner with us.
2. **Problem:** three short cards — sponsors, small businesses, investors.
3. **How it works:** one diagram, Sponsor → Program/Community → Evidence Layer → Credit Engine → Qualified Opportunity → Domestic/Global Capital → Pix → Business → Repayment/Outcome → Evidence.
4. **Two revenue engines:**
   - **Impact Intelligence:** the sponsor pays for measurement, auditability, reporting and integration.
   - **Credit Infrastructure:** in the pilot, service fees paid by the partner; in P2P, origination, transaction and servicing economics under the regulated structure.
   - "The same data that proves impact helps qualify capital."
5. **Capital:** domestic BRL/Pix and global USDC/Solana → regulated off-ramp → Pix. Global capital competes on availability, mandate, risk appetite and economics.
6. **Auditability:** private data → derived intelligence → cryptographic proof. "Evidence without financial surveillance."
7. **Traction + CTA:** real traction and pilot status only, with one simulation notice near the prototype CTA. CTAs: I fund impact programs, I deploy capital, I support entrepreneurs.

**Moves off the homepage:**
- The pilot roadmap and gates go to `/investors`.
- Market evidence and its caveats go to `/sources`, renamed "Evidence & sources".
- The readiness, eligibility and funding explanation and the regulatory detail go to `/investors`, with a short line and link on the homepage.
- The four-partner taxonomy is replaced by the three CTAs, which feed the contact form with an interest.
- "Community Intelligence" becomes "Impact Intelligence" in the investor copy.

## 7 · Implementation sequence

1. Navigation (story bar, Operations, workspace names) and the proof drawer. Frontend only.
2. Credit & Capital Engine: two-step run, rename, deep link.
3. Database: sponsor role, programs, `impact_intelligence`, mandates, `record_capital_use`, pgTAP, types, local seed.
4. Impact Intelligence page.
5. Investor Console: mandate panel, filters and chips, card fields, outstanding.
6. Desk: record productive outcome. Loop links: sponsor → engine → investor → desk → sponsor.
7. Homepage in seven sections (EN, then PT per decision); investors, sources and investor-copy alignment.
8. Docs (DEMO.md with 14 steps, ARCHITECTURE, README, PRIVACY, I18N glossary), then Vitest, pgTAP, build, lint, and screenshots at 1440 and 390 px in EN and PT.
9. With approval: push migrations, reseed hackathon, merge.

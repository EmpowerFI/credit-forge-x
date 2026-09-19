# BRL-denominated settlement — gap analysis and plan

**Source:** *EmpowerFI — Hackathon MVP Addendum: BRL-Denominated On-Chain Settlement & Stablecoin Routing Experiment* (founder, 17 Sep 2026), complementing the *Site + Hackathon MVP Refactor Specification — 2026*.
**Work:** on `hackathon`. Migrations, reseeds and the merge to `main` happen only after the founder approves.
**Status, 18 Sep — complete.** Founder approved the four decisions in §8. **All eight steps done, and live.**  — the model (`packages/settlement-route`, 23 Vitest cases), the database (`20260925000000`, `20260925000100`, 30 pgTAP cases), the read paths the console needs, the engine's settlement card, the investor console in reais, the three seeded cases and the documentation. Step 3 changed shape once its real cost was known: see §4.9, and §8.4 is a decision waiting on the founder.

**Rules kept from the refactor plan:** do not rebuild, do not hard-code engine decisions, label every simulated, test or devnet step, put nothing personal on chain — and, added by this addendum, **never display a BRS transaction that did not happen**.

---

## 1 · Current-state map — what the addendum touches

| What exists | Where | What it does today |
| --- | --- | --- |
| Capital Allocation Engine | `packages/capital-allocation` (TS, versioned, vector-tested) and its SQL twin `private.allocate_funding` (`20260921000000`) | Chooses **domestic** or **global** per opportunity: feasibility (risk, ticket, mandate, liquidity) then her all-in annual cost. Persisted on `qualified_credit_opportunities.allocation` by the `private.open_for_funding` trigger. |
| Engine page | `src/app/pages/capital/AllocationEngine.tsx` + `engine/*` | Re-runs both engines **in the browser, analysis only** — "nothing is written". `PoolBranch` shows each check, `Decision` the chosen route, `CapitalPath` the hops with real/simulated labels. |
| Settlement | `20260919000300_settlement.sql`, `settlement_legs`, `vault_transfers`, `vault-settle` | Four leg kinds: `release` (vault → ramp, real devnet), `pix_payout` (mock), `pix_in` (mock), `payout` (real devnet). Legs are derived from facts already recorded. |
| Ramp economics | `private.ramp_bps()` = **50 bps**; `funding_pools.ramp_bps` = **100 bps** and `fx_hedge_bps` = **500** for global; `private.demo_brl_per_usdc_milli()` = **5400** | Two different ramp assumptions already coexist: one prices her loan, one prices settlement. |
| Real ramp quote | `platform/supabase/functions/ramp-quote` + `src/app/lib/ramp.ts` | MoneyGram Ramps **sandbox**, USDC cash-out in Brazil, **US$2–US$200 only**. Priced, never executed. |
| Proof | `chain_anchors`, `private.anchor_payload`, `ANCHOR_DOMAINS` in `packages/audit-commitments` | Every new fact kind gets an enum value, a domain tag and a canonical payload; the browser recomputes it in Verify. |

**The finding that shapes this plan.** `private.settle_on_disbursal` writes the `pix_payout` leg as `amount_cents = loan.principal_cents`. The demo therefore shows her receiving **100% of the contracted principal**, and the cost of getting USDC into reais appears only inside her annual rate (`fx_hedge_bps` + `ramp_bps_year`). There is today no figure anywhere for "reais that actually arrive per dollar released", which is exactly the figure the addendum asks to make comparable and auditable.

---

## 2 · Gaps against the addendum

| Addendum | Today | Gap |
| --- | --- | --- |
| §5 Settlement Route Comparator after allocation, before Pix | Allocation stops at the pool. One implicit settlement route. | The whole comparator: quotes, feasibility, decision, reason codes, persistence. |
| §6 Deterministic inputs (`gross_usdc` … `sandbox_or_simulated`) | `ramp_bps` and a fixed FX constant. | A rate card per provider and a quote record with a timestamp and a TTL. |
| §7 Decision order and reason codes | Reason codes exist for pools only. | A second, smaller reason-code vocabulary for sub-routes. |
| §8.1 Settlement Route card on the engine | `Decision` ends at the pool. | A card revealed only when global wins. |
| §8.2 Investor console in BRL with USD equivalent + lifecycle line | Positions are in USDC; BRL appears as an aside. | Denominate the obligation in BRL, keep funding in USDC. |
| §8.3 Proof drawer fields | Anchors cover allocation, loan, payment. | `settlement_route` anchor kind and payload. |
| §9 Cases A/B/C | Seed has three allocation cases, no settlement cases. | Three seeded settlement cases. |
| §12 "Works unchanged when the experiment is disabled" | — | A switch. |

---

## 3 · The model — Settlement Route Comparator

Built exactly like the allocation engine, because that pattern already earns its keep here: one TypeScript package the browser runs, one SQL twin the database runs, one vectors file holding both to the same answer.

- **`packages/settlement-route`**, `SETTLEMENT_ROUTE_MODEL_VERSION = "settlement-route-v1.0.0"`, integers only (micro-USDC, centavos, basis points, seconds), no clock and no I/O — the caller passes `now`.
- **`private.settle_route(...)`** in SQL, same rules.
- **`packages/settlement-route/vectors/scenarios.json`**, asserted by both Vitest and pgTAP.

### 3.1 Inputs (§6), one rate card per provider

```ts
interface RouteQuote {
  route: "direct_usdc_pix" | "brl_stable_pix";
  provider: string;                 // "moneygram_sandbox" | "hodle_brs" | …
  gross_micro_usdc: number;
  fx_rate_milli: number;            // milli-reais per USDC, 5400 = R$5.40
  fx_spread_bps: number;            // where the FX is struck differs by route
  provider_fee_cents: number;
  network_fee_cents: number;        // explicit even when the provider sponsors it
  net_brl_cents: number;            // what reaches her Pix after everything
  execution_eta_sec: number;
  quote_ttl_sec: number;
  quoted_at: string;                // ISO
  liquidity_ok: boolean;
  reality: "sandbox" | "devnet" | "simulated";   // reuses lib/settlement.ts's vocabulary
}
```

The two routes differ in **where the FX is struck**, not only in how many hops they have:

- **Direct** — USDC → (FX spread + payout fee at the moment of payout) → Pix. The BRL amount is only known at disbursement.
- **BRL stable** — USDC → BRS (FX spread struck **at allocation**) → BRS → Pix **1:1, no FX on the payout leg** (Hodle documents this), plus the extra conversion's own fee. The BRL amount is locked earlier and the payout leg carries no FX risk.

### 3.2 Decision (§7)

Order: feasibility → net BRL → total cost → fewest conversions → execution time.

**One deviation from §7, deliberate.** The addendum orders the last two the other way round: execution time, then operational complexity. Built as written, two routes with identical economics would settle through the stablecoin because it is minutes faster — which is the thing §7's own bullet forbids ("do not route through a BRL stablecoin merely to increase on-chain activity"). Minutes of settlement do not buy a second counterparty to reconcile, so on equal reais *and* equal cost the shorter route wins, and speed breaks whatever is left. Scenario E in the vectors pins this: the stablecoin route is 10 minutes faster and still loses a tie.

```
feasible(route) = provider enabled ∧ liquidity_ok ∧ ticket within policy
                  ∧ (fx struck at allocation ∨ quote not expired at `now`)
```

**A rate already struck cannot expire.** Found while looking at the card on real data, where the stablecoin route read *cannot settle* on every seeded opportunity: its rate was struck at allocation, days ago, and a TTL was being applied to it. A quote expires because it is a price someone will hold for a while, and FX execution risk is the risk of it running out before the money moves. Where the reais were bought at allocation there is nothing left to execute, however old that is. The gate now applies only to a route that quotes at payout — which is exactly where that risk lives. Vector B3 pins it.

Reason codes, in the allocation engine's style:

`DIRECT_LOWEST_COST` · `DIRECT_FEWEST_STEPS` · `BRL_STABLE_BETTER_NET_BRL` · `BRL_STABLE_LOCKS_PRINCIPAL_EARLIER` · `BRL_STABLE_NO_FX_ON_PAYOUT` · `EXTRA_CONVERSION_ADDS_COST` · `ROUTE_QUOTE_EXPIRED` · `ROUTE_NO_LIQUIDITY` · `ROUTE_TICKET_OUTSIDE_POLICY` · `ROUTE_PROVIDER_UNAVAILABLE` · `NO_ROUTE_AVAILABLE`

Ties go to **Direct**, as the fewest-conversions route.

A comparative code (`DIRECT_LOWEST_COST`, `BRL_STABLE_BETTER_NET_BRL`) is raised only when both routes could actually have settled the ticket. When only one could, the other's own block code is the whole reason, which is what §9's case C asks for: *Direct; reason = route infeasible*. `BRL_STABLE_NO_FX_ON_PAYOUT` and `BRL_STABLE_LOCKS_PRINCIPAL_EARLIER` are structural: the first holds whenever the rate was struck at allocation, the second only when that quote really is the older one.

### 3.3 The figure the two routes are compared on

Her loan is contracted in reais and **she receives the full principal either way** — a loan of R$ 1.500 disburses R$ 1.500. So "net BRL" cannot be the ranking figure as written, or it would be the same number on both routes. The comparator therefore reports two, and ranks on the first:

1. **`net_brl_cents` for a fixed gross of US$ 100** — reais delivered per dollar released. This is what ranks the routes and what the UI shows side by side.
2. **`gross_micro_usdc_for_principal`** — the USDC the vault must release for her contracted principal to arrive. This is the operator's figure, and the difference between the two routes is the saving or the extra cost, in reais, on this loan.

Nothing is deducted from her disbursement, and no existing leg amount changes.

---

## 4 · Database and API changes (platform project)

One migration, `20260925000000_settlement_route.sql`, plus a second for the anchor enum value (a new enum value cannot be used in the same transaction).

1. **`create type public.settlement_route as enum ('direct_usdc_pix', 'brl_stable_pix');`**
2. **`public.settlement_providers`** — the rate card, so the seeded economics are data and a third provider needs no code:
   `route`, `provider` (pk), `name`, `asset` (`USDC`/`BRS`), `fx_spread_bps`, `provider_fee_bps`, `provider_fee_fixed_cents`, `network_fee_cents`, `execution_eta_sec`, `quote_ttl_sec`, `min_ticket_cents`, `max_ticket_cents`, `liquidity_cents`, `reality`, `enabled`, `source_url`, `updated_at`. RLS: readable by desk, sponsor, auditor and admin; written by no one but a migration.
3. **`public.settlement_quotes`** — one row per route per loan, written together: `loan_id`, `route`, `provider`, every §6 variable, `is_feasible`, `reason_codes text[]`, `quoted_at`, `expires_at`. Immutable.
4. **`public.settlement_decisions`** — `loan_id` unique, `selected_route`, `selected_quote_id`, `model_version`, `reason_codes text[]`, `compared jsonb` (both quotes as the model saw them), `decided_at`.
5. **`settlement_legs`** gains `route public.settlement_route` and `quote_id`, both nullable — a leg written before the experiment, or with it off, keeps a null and reads exactly as it does today.
6. **`private.settlement_experiment()`** — `returns boolean`, the switch of §12. Off ⇒ no quotes, no decision, no route on the legs, and every existing path byte for byte as now.
7. **`private.settle_route(...)`** and its caller inside `private.settle_on_disbursal`: on a **global** loan, quote both routes from the rate card, write both, decide, stamp the `pix_payout` leg. Domestic loans are untouched — there is no USDC leg to route.
8. **`public.settlement_route_preview(p_opportunity_id uuid)`** — read-only, writes nothing, for the engine page's card and for the desk before it formalises. This is this codebase's equivalent of the addendum's "inspect both quotes before Confirm Allocation": the engine is already analysis-only, and persistence already happens at disbursement.
9. **An anchor kind after all.** This shipped first as a recorded decision, because every kind in this system is one-to-one with an instruction of the `empowerfi_audit` program — 13 kinds, 13 instructions — each with its own account type in `state.rs`, its own `fetchMaybe*` in the generated client, its own branch in `anchor-submit` and its own branch in `verify.ts`. **Two** Edge Functions, not one: `anchor-reconcile` re-checks every confirmed proof against the record and the chain, and needs its own entry in that function's `HOLDER` map — which account type the proof lives in and which field holds the commitment — as well as a deploy of its own. Missing that entry cost an afternoon on 19 Sep: the browser said VERIFIED and the reconciliation roll-up said `mismatch` on the same drawer, which is the worst way for a proof system to be wrong. `HOLDER` is a `Record<AnchorKind, …>`, so the type checker was ready to catch it — but `deno check` never runs over `platform/supabase/functions/`, only the Deno tests do. A new proof kind therefore meant changing the Rust program and upgrading it on devnet, in the week of the hackathon. The founder asked for the proof anyway (§8.4), and it is now the fourteenth:

   - **`SettlementRouteCommitment`**, seeded `["settlement_route", loan]`, holding the loan, the selected route, the commitment, when it was decided, the schema version and the bump. `init` refuses a second, so a decision on chain is never rewritten, and the program refuses one at all before the loan reaches `Disbursed`.
   - **The route is public, deliberately.** A proof that hid which way the money went would prove nothing worth proving, and the chain already holds the loan and its status. Both quotes, their costs, the fees, the provider and the reasons stay inside the commitment. Reviewed as such in `privacy.test.ts`, which is where a new on-chain field has to be argued for.
   - **The payload is the decision as the comparator wrote it** — `settlement_decisions.compared` verbatim, not a re-reading of the quote rows — so the browser recomputes the same bytes the Edge Function sent.
   - **Queued behind the disbursement's own anchor**, off a trigger on `chain_anchors` itself. The decision is taken inside the transition's trigger, which runs *before* `transition_loan` writes that transition's anchor row, so queueing it at the decision would leave `depends_on` null and let the job be claimed before the loan was `Disbursed` on chain — which the program would then refuse. The trigger writes the dependency in the one place it cannot be missing.
   - **Still no fabricated transaction.** §12's "no fake BRS transaction" holds as it did: the proof says a decision was taken, never that a token moved, and the stablecoin leg keeps no signature and no explorer link.

   Read paths added alongside (`20260925000100`, both read-only): `investor_position` carries the route its capital took with both quotes beside it, and `settlement_overview` carries the experiment's state and what each route has settled.
10. **`settlement_overview()`** gains the selected route per loan, so the desk's settlement view can show it.
11. **pgTAP `settlement_route.test.sql`:** the vectors, the switch off leaving legs unchanged, RLS (an entrepreneur and an investor cannot read the rate card), cases A/B/C deciding as specified, a BRS leg never carrying a signature, and the anchor payload carrying nothing personal.

**No changes** to `vault_transfers`, `vault-settle`, `record_investment`, `formalise_loan` or the refund path. Nothing new moves on devnet.

---

## 5 · UI changes

### 5.1 Credit & Capital Engine (§8.1) — **done, 18 Sep**
A **Settlement route** card in `Decision`, shown only when the global pool wins. Two comparable cards — *Direct* and *BRL stablecoin* — each leading with **what reaches her Pix**, then the rate and where it was struck, the spread and fees, and the USDC the vault must release for her principal. The selected one is highlighted, the reason codes read as sentences, and a `<details>` "Why this route?" carries the full line-by-line comparison and the model version. `CapitalPath` names the leg that pays her: the off-ramp, or the stablecoin and its 1:1 payout, both dashed and labelled **Simulated**, with no explorer link on either.

It is priced **in the browser**, from the database's own rate cards, as this page re-runs every other engine there and writes nothing. That needed two columns the opportunity already had (`20260925000200`, read-only): what a global allocation raised, and the rate it locked.

### 5.2 Investor Console (§8.2) — **done, 18 Sep**
Funding stays in USDC; **what she owes reads in reais on both pools**. A shared `Lifecycle` panel — *Written in reais, funded in dollars* — carries the principal and the total she repays, each with an informational dollar equivalent at the opportunity's quote, and the addendum's five steps beneath them: *USDC funded → BRL locked → Pix disbursed → BRL repayments → investor settlement*, each with the reality it already has elsewhere and a tick when it has actually happened. It lays itself out in as many columns as its container allows, because it sits full width on a position and in a 570 px column on an opportunity.

On `Position.tsx` the obligation tiles (repaid, outstanding) now lead in reais with the USDC beside them, the instalment table shows both, and *Invested* still leads in USDC — that is the currency that moved. The route's own step in *Where the money went* names the route that paid her, where its rate was struck and what it cost. On `OpportunityDetail.tsx` the same panel reads forward, before a loan exists.

One rounding rule for reais across the page: `positionReais`, which is `private.usdc_to_cents`. The quote is printed by one shared helper (`reaisRate`), after `R$ 5.400` was found reading as five thousand four hundred in Portuguese — the same trap in reverse in English, which is why the helper uses the reader's separators everywhere, including the engine card and the opportunity header.

### 5.3 Proof drawer (§8.3) — **done, 18 Sep**
The disbursement's proof carries a **Settlement routing** block: route, quoted at, quoted net, quote source (the provider's key and the page its card came from), reason code, simulation status and the comparator's version — marked **derived**, and reading *"Recorded, not anchored… no stablecoin transaction was made, so none is shown."* The proof above it is the disbursement itself, with its own commitment and devnet link (see §4.9). The block appears only where there is a decision to show.

### 5.4 The entrepreneur's screen
**Unchanged.** No BRS, no wallet, no crypto vocabulary (§8.2, last bullet). She sees reais, Pix and her instalments, as she does now.

---

## 6 · Seeded demo cases (§9) — **done locally, 18 Sep**

In `scripts/platform/seed-demo.mts`, on global loans only. Four decisions come out of a run: two of case A from the July cycle, then B and C on the two loans the desk disburses on camera, all four in the demo investor's portfolio.

| Case | Setup | Recorded |
| --- | --- | --- |
| A — Direct wins | Both feasible; the stablecoin's extra conversion costs more than it saves. | `direct_usdc_pix` · `DIRECT_LOWEST_COST`, `EXTRA_CONVERSION_ADDS_COST` |
| B — BRL stable wins | The opportunity locked R$ 5,500/USDC when it was allocated; today's rate is R$ 5,400, so the reais bought then are worth more than the reais bought now — by more than the extra conversion costs. | `brl_stable_pix` · `BRL_STABLE_BETTER_NET_BRL`, `BRL_STABLE_LOCKS_PRINCIPAL_EARLIER`, `BRL_STABLE_NO_FX_ON_PAYOUT`; R$ 28.66 more on the compared gross |
| C — Stablecoin unavailable | The provider is switched off for the minute that loan settles, and put back straight after. It is still priced, so the block comes out of the model. | `direct_usdc_pix` · `ROUTE_PROVIDER_UNAVAILABLE` alone — no comparative code, because only one route could have run |

**Case B is a rate, not a flag.** `fx_brl_per_usdc_milli` is set before the opportunity raises anything, because it decides how much USDC the target is; everything downstream reads it as it reads any other opportunity's.

**A fix the cases forced.** `allocated_at` was `now()` at listing, so every seeded opportunity claimed to have been allocated the second the script ran — two months *after* the July loans were disbursed. It is the stablecoin's quote timestamp, so the demo would have shown a rate struck after the money moved. The seed now dates it to the listing, and re-dates the July cohort's routing decision with the rest of its facts, as it already did for the Pix leg.

Still needs a reseed of the hackathon database, with approval (step 8).

---

## 7 · What I will not do

- **No Hodle integration.** BRS on Solana is production-only with no sandbox (§11), and we hold no Hodle credentials. It stays a rate card with `reality = 'simulated'` and a link to the documentation. The §10 "P1 optional" real quote endpoint is out.
- **No change to what moves on devnet.** Releases and payouts keep their amounts and their discipline.
- **No deduction from her disbursement**, and no change to any existing leg amount.
- **No fabricated BRS transaction**, id or explorer link, anywhere, ever.

---

## 8 · Decisions for the founder

1. **The ranking figure.** §3.3 — rank on reais delivered per US$ 100 and show the USDC needed for her principal beside it, keeping her disbursement whole. *(My recommendation; the alternative — netting costs out of what she receives — would make the demo claim she gets less than her contract says.)*
2. **Where the decision binds.** At disbursement, with a read-only preview on the engine and for the desk. *(Recommended: the quote has a TTL, and binding it at allocation would guarantee it is stale by the time money moves — which is case B itself.)*
3. **The switch's default.** On for the hackathon; `private.settlement_experiment()` off restores today's behaviour exactly.
4. **Settled, 18 Sep — the routing decision gets its own on-chain proof.** (§4.9.) I recommended against it and the founder said to build it, which was the right call: the demo's claim is that an economic decision can be audited, and the route was the one decision still taking that on trust. Built as the shape predicted: `SETTLEMENT_ROUTE_SEED`, a `SettlementRouteCommitment` account seeded by the loan holding the selected route and the commitment, an `anchor_settlement_route` instruction the operator signs, the `anchor_kind` value in its own migration, the payload, the branches in `anchor-submit` and `verify.ts`, and the client regenerated. See §4.9 and §11.

## 9 · Implementation sequence

1. ~~`packages/settlement-route` + vectors + Vitest. No UI, no database.~~ **Done, 18 Sep.** `settlement-route-v1.0.0`; 7 scenarios (the addendum's A, B, C plus quote expiry, no liquidity, a ticket under both cards, and an economic tie) and 16 property and unit cases. Its `centsFromMicroUsdc` is asserted equal to the allocation engine's `usdcToCents`, so a loan priced by one and settled by the other cannot drift. The rate cards in `vectors/scenarios.json` are the numbers step 2 seeds into `settlement_providers`.
2. ~~Migration: providers, quotes, decisions, the switch, `settle_route`, the preview RPC, types; pgTAP.~~ **Done, 18 Sep.** All 7 vectors give the same answer in SQL as in TypeScript. Built as planned, with three decisions taken while writing it:
   - **The stablecoin's quote is read from facts already recorded**, not invented: its locked rate is the opportunity's `fx_brl_per_usdc_milli` and its moment is `allocated_at`, while the direct route is priced at today's rate at the moment the money moves. That difference is the whole experiment, and case B is what it looks like.
   - **A provider that is switched off is still priced and still compared**, so `ROUTE_PROVIDER_UNAVAILABLE` comes out of the model rather than a route quietly disappearing.
   - **Time is compared in whole epoch seconds**, not `date_trunc`, so a decision cannot depend on the session's time zone and matches the TypeScript exactly.

   The suite is written to pass on a fresh *or* a seeded database: it gives the global pool its own room, rather than depending on what else happens to be raising. The older suites still need `db reset --local` (a seeded pool leaves nothing to allocate, and their fixtures fail before their first assertion) — which is why `settlement_route.test.sql` covers the release leg too, the one part of `settle_on_disbursal` this migration re-creates.
3. ~~Anchor kind and payload; `audit-commitments` domain; Verify.~~ **Done differently, 18 Sep** — see §4.9: no anchor kind, a recorded decision labelled derived, and the two read paths the console needs (`20260925000100`), covered by two more pgTAP cases.
4. ~~Engine card and `CapitalPath` hop.~~ **Done, 18 Sep.** Checked on seeded data in both languages and at 390 px: no overflow, no console errors, and the exchange rate printed in the reader's own separators — "R$ 5.400" reads as five thousand four hundred to a Brazilian, and did until it was fixed.
5. ~~Investor console: BRL denomination and the lifecycle line.~~ **Done, 18 Sep.** Checked on seeded local data against a real decision, in both languages and at 1280 and 390 px: no overflow, no console errors. Two fixes came out of it. The provider's card name is written in English in the database and said in English what the route label already said in the reader's language, so the prose now uses the localised route and the card's key is kept where it belongs, as the quote's source in the proof drawer. And two assertions in `settlement_route.test.sql` counted rows across the whole database rather than the fixture's own loan, so the suite was not seed-independent after all where it claimed to be — both are now scoped, which also keeps them honest once step 6 seeds a case B.
6. ~~Seed cases A/B/C; local reseed.~~ **Done, 18 Sep.** Reseeded locally and read back from the browser: case B's position says *"Travado na alocação, a R$ 5,500/USDC"* and settles through the stablecoin; case C says the stablecoin *"não pôde liquidar esta: provedor indisponível"*. Two things came out of reading it: a reason code that describes the route that did **not** run read, beside the route that paid her, as though that one had been switched off — the position now names the route it is about; and a quote's expiry was printed in the browser's locale rather than the reader's, and shown at all for a rate struck at allocation, which cannot expire. The engine card now says so.
7. ~~Docs; then Vitest, pgTAP, build, lint and screenshots.~~ **Done, 18 Sep.** ARCHITECTURE has a *Settlement routing* section, the routing row in the funnel spine (marked recorded, not anchored) and updated test counts; DEMO has the investor's beat after disbursement, the engine card and the proof drawer as optional beats, and the seeded cases in *Before recording*; PRIVACY states what a quote holds and what it cannot (no name, Pix key, wallet or bank detail; RLS scopes it by the loan, and an entrepreneur reads none of it); I18N has the glossary. 173 Vitest, 31 pgTAP on the new suite, build and `tsc` clean, lint at the same 9 pre-existing errors, and both languages at 1440 and 390 px with no overflow and no console errors.

   **The full battery, on a clean database: 499 of 499, all 18 suites** (founder authorised the reset). It earned its keep immediately. `rbac.test.sql` failed on its sixth assertion — *anonymous visitors can call one function* — because Postgres grants `EXECUTE` to `PUBLIC` on every new function, and `20260925000000` created ten `private.*` helpers without revoking it. `anon` has no `USAGE` on `private`, so nothing was reachable through PostgREST, but the invariant the suite exists to hold was broken, and only a reset could show it: the assertion reads the catalog, and the seeded database never re-applies the migration. The migration now revokes them and grants `service_role` what the scripts need. The suite's own expectations read the model version once, as the owner, because the helper is no longer callable by the roles it acts as.
8. ~~With approval: push the migrations, reseed hackathon, merge to `main`.~~ **Done, 18 Sep.** `hackathon` pushed; the three migrations applied to the hackathon project and `settlement_route.test.sql` and `rbac.test.sql` re-run against it, both passing; the project reseeded (four routing decisions, 977 anchors queued); `main` fast-forwarded and deployed. Verified on `www.empowerfi.io` in both languages: all four seeded positions name the route that paid them, no console errors, no overflow at 1440 px.

## 10 · Risks

- **P0 stability.** The switch is the mitigation, and step 2's pgTAP asserts that with it off no leg, amount or payload changes.
- **Two ramp assumptions already disagree** (`private.ramp_bps()` = 50, `funding_pools.ramp_bps` = 100). The comparator must not add a third quietly: the rate card becomes the one place settlement economics are stated, and the plan's step 2 reconciles `private.ramp_bps()` to it.
- **The real quote cannot price a loan.** MoneyGram's sandbox covers US$2–US$200 and a loan is larger, so route A's quote in the demo is the rate card, labelled as an assumption, with the sandbox quote kept where it already is — the payment simulator. Claiming otherwise would be the "misleading demo claim" §6's `sandbox_or_simulated` exists to prevent.
- **Enum values across transactions.** The anchor kind ships in its own migration, as `sponsor` did.

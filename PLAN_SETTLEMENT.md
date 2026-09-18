# BRL-denominated settlement — gap analysis and plan

**Source:** *EmpowerFI — Hackathon MVP Addendum: BRL-Denominated On-Chain Settlement & Stablecoin Routing Experiment* (founder, 17 Sep 2026), complementing the *Site + Hackathon MVP Refactor Specification — 2026*.
**Work:** on `hackathon`. Migrations, reseeds and the merge to `main` happen only after the founder approves.
**Status, 18 Sep:** founder approved the three decisions in §8. **Steps 1-3 done** — the model (`packages/settlement-route`, 23 Vitest cases), the database (`20260925000000`, `20260925000100`, 30 pgTAP cases) and the read paths the console needs. Step 3 changed shape once its real cost was known: see §4.9. Nothing on screen yet, nothing pushed. Steps 4-8 below are open, and §8.4 is a decision waiting on the founder.

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
feasible(route) = provider enabled ∧ liquidity_ok ∧ ticket within policy ∧ quote not expired at `now`
```

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
9. **No anchor kind — a recorded decision, labelled as one.** The plan said `settlement_route` would become a proof kind. It cannot be, cheaply: every kind in this system is one-to-one with an instruction of the `empowerfi_audit` program — 13 kinds, 13 instructions — each with its own account type in `state.rs`, its own `fetchMaybe*` in the generated client, its own branch in `anchor-submit` and its own branch in `verify.ts`. A new proof kind therefore means changing the Rust program and upgrading it on devnet **with the operator's upgrade authority**, a key this work does not touch, in the week of the hackathon. The addendum asks for the settlement fields *in the proof drawer* (§8.3) and forbids destabilising the working P0 (§2), so the decision is recorded in the database, read beside the loan's existing proofs — the disbursement's `loan_transition` anchor is what proves that moment happened — and labelled **derived** in the vocabulary the product already uses: computed from recorded facts, not proven on chain. "No fake BRS transaction" (§12) then holds by construction, because there is no transaction to fake.

   Read paths added instead (`20260925000100`, both read-only): `investor_position` carries the route its capital took with both quotes beside it, and `settlement_overview` carries the experiment's state and what each route has settled.
10. **`settlement_overview()`** gains the selected route per loan, so the desk's settlement view can show it.
11. **pgTAP `settlement_route.test.sql`:** the vectors, the switch off leaving legs unchanged, RLS (an entrepreneur and an investor cannot read the rate card), cases A/B/C deciding as specified, a BRS leg never carrying a signature, and the anchor payload carrying nothing personal.

**No changes** to `vault_transfers`, `vault-settle`, `record_investment`, `formalise_loan` or the refund path. Nothing new moves on devnet.

---

## 5 · UI changes

### 5.1 Credit & Capital Engine (§8.1)
A **Settlement route** card, revealed in `Decision` only when the global pool wins, below the existing pool decision. Two comparable sub-cards — *Direct USDC→Pix* and *USDC→BRS→Pix* — each showing net BRL per US$ 100, total estimated cost, FX and where it is struck, ETA, liquidity and its reality pill. The selected one is highlighted with its reason code, and a `<details>` "Why this route?" carries the full comparison (the same pattern as the `about` disclosures added on 17 Sep). `CapitalPath` gains the BRS hop on route B, dashed and labelled **Simulated**, with no explorer link.

### 5.2 Investor Console (§8.2)
Funding stays in USDC. `Position.tsx` and `OpportunityDetail.tsx` show the principal and the repayment obligation **in BRL with an informational USD equivalent**, and a lifecycle line: *USDC funded → BRL locked → Pix disbursed → BRL repayments → investor settlement*, each step carrying the reality it already has elsewhere.

### 5.3 Proof drawer (§8.3)
`settlement_route`, `quote_timestamp`, `quoted_net_brl`, `quote_source`, `route_reason_code`, `simulation_status`, shown with the loan's existing proofs and marked derived (see §4.9). A real Solana signature keeps its explorer link; the routing decision shows what it is — a record, with the disbursement's own proof next to it — and never a token transfer that did not happen.

### 5.4 The entrepreneur's screen
**Unchanged.** No BRS, no wallet, no crypto vocabulary (§8.2, last bullet). She sees reais, Pix and her instalments, as she does now.

---

## 6 · Seeded demo cases (§9)

In `scripts/platform/seed-demo.mts`, on global loans only:

| Case | Setup | Expected |
| --- | --- | --- |
| A — Direct wins | Both feasible; BRS's extra conversion costs more than it saves. | `direct_usdc_pix` · `DIRECT_LOWEST_COST` |
| B — BRL stable wins | Direct's quote expired at disbursement and its FX is worse; BRS locked the principal at allocation. | `brl_stable_pix` · `BRL_STABLE_BETTER_NET_BRL`, `BRL_STABLE_LOCKS_PRINCIPAL_EARLIER` |
| C — BRS unavailable | Provider disabled or liquidity below the ticket. | `direct_usdc_pix` · `ROUTE_PROVIDER_UNAVAILABLE` |

These need a reseed of the hackathon database, with approval.

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
4. **Open — does the routing decision need its own on-chain proof?** (§4.9.) Saying yes means a new instruction in the Anchor program, a devnet upgrade run with the operator's upgrade authority, a regenerated client and new branches in `anchor-submit` and `verify.ts`. It is a day's work and it touches the program every existing proof depends on, so it is not something to do mid-hackathon on my own initiative — and the upgrade itself has to be run by whoever holds the key. *Recommendation: not now. The demo already proves the disbursement; the route that paid it is an economic decision, and calling it "recorded" is the honest word.*

## 9 · Implementation sequence

1. ~~`packages/settlement-route` + vectors + Vitest. No UI, no database.~~ **Done, 18 Sep.** `settlement-route-v1.0.0`; 7 scenarios (the addendum's A, B, C plus quote expiry, no liquidity, a ticket under both cards, and an economic tie) and 16 property and unit cases. Its `centsFromMicroUsdc` is asserted equal to the allocation engine's `usdcToCents`, so a loan priced by one and settled by the other cannot drift. The rate cards in `vectors/scenarios.json` are the numbers step 2 seeds into `settlement_providers`.
2. ~~Migration: providers, quotes, decisions, the switch, `settle_route`, the preview RPC, types; pgTAP.~~ **Done, 18 Sep.** All 7 vectors give the same answer in SQL as in TypeScript. Built as planned, with three decisions taken while writing it:
   - **The stablecoin's quote is read from facts already recorded**, not invented: its locked rate is the opportunity's `fx_brl_per_usdc_milli` and its moment is `allocated_at`, while the direct route is priced at today's rate at the moment the money moves. That difference is the whole experiment, and case B is what it looks like.
   - **A provider that is switched off is still priced and still compared**, so `ROUTE_PROVIDER_UNAVAILABLE` comes out of the model rather than a route quietly disappearing.
   - **Time is compared in whole epoch seconds**, not `date_trunc`, so a decision cannot depend on the session's time zone and matches the TypeScript exactly.

   The suite is written to pass on a fresh *or* a seeded database: it gives the global pool its own room, rather than depending on what else happens to be raising. The older suites still need `db reset --local` (a seeded pool leaves nothing to allocate, and their fixtures fail before their first assertion) — which is why `settlement_route.test.sql` covers the release leg too, the one part of `settle_on_disbursal` this migration re-creates.
3. ~~Anchor kind and payload; `audit-commitments` domain; Verify.~~ **Done differently, 18 Sep** — see §4.9: no anchor kind, a recorded decision labelled derived, and the two read paths the console needs (`20260925000100`), covered by two more pgTAP cases.
4. Engine card and `CapitalPath` hop.
5. Investor console: BRL denomination and the lifecycle line.
6. Seed cases A/B/C; local reseed.
7. Docs: ARCHITECTURE (a settlement-routing section and the flow row), DEMO (one beat after formalisation), PRIVACY (quotes carry no personal data), I18N glossary; then Vitest, pgTAP, build, lint and screenshots at 1440 and 390 px in EN and PT.
8. With approval: push the migrations, reseed hackathon, merge to `main`.

## 10 · Risks

- **P0 stability.** The switch is the mitigation, and step 2's pgTAP asserts that with it off no leg, amount or payload changes.
- **Two ramp assumptions already disagree** (`private.ramp_bps()` = 50, `funding_pools.ramp_bps` = 100). The comparator must not add a third quietly: the rate card becomes the one place settlement economics are stated, and the plan's step 2 reconciles `private.ramp_bps()` to it.
- **The real quote cannot price a loan.** MoneyGram's sandbox covers US$2–US$200 and a loan is larger, so route A's quote in the demo is the rate card, labelled as an assumption, with the sandbox quote kept where it already is — the payment simulator. Claiming otherwise would be the "misleading demo claim" §6's `sandbox_or_simulated` exists to prevent.
- **Enum values across transactions.** The anchor kind ships in its own migration, as `sponsor` did.

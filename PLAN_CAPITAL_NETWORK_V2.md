# Global Capital Economics & Solana Rail — review of addendum v2, and plan

**Addendum:** `EmpowerFI_MVP_Capital_Network_Addendum_v2.pdf`, September 2026.
**Read against:** this repository at `92b2c7b`, 75 migrations, Capital Network v1 shipped and verified.
**Time on the clock:** 26 Sep → internal deadline Sat 10 Oct 23:59 BRT. Fourteen days, shared with the 17 items still open in `PLAN_HACKATHON.md`.
**Written in English** per the project documentation convention.

v2 is right that these are two economic problems and that mixing them would be
the easiest lie in the deck. It is wrong, again, about how much of this the
codebase already has. **Cost to Serve is finished. The itemised cost of moving
capital across the border is finished. The impact mandate is finished. The
devnet funding flow is finished, including the tokenized position v2 lists as
new work. The World Bank guardrail is not only honoured — the product already
says something more careful than the addendum asks for.**

What is genuinely missing is smaller and sharper than §4 suggests: **a second
eligibility question asked of the residual gap, a name and an aggregation for
costs that are already itemised, and one screen that puts the two economics side
by side.**

---

## 1 · Current-state map — what v2 touches

| v2 concept | What exists today | Verdict |
|---|---|---|
| §5 Global Capital Eligibility, as a step | `matchCapital()` offers the residual to global instruments and puts the same seven gates to them | Partly. The step exists; the **separate question** does not |
| §5.1 `GlobalCapitalEligibility` object | `capital_route_decisions` — gap, need, engine version, policy versions, reason codes, evaluated trace, status | **Extend it.** Do not add a fifth decision table |
| §6 Impact Fund / Global Capital Provider | `capital_providers` + `capital_instruments` (v1): mandate, geography, purposes, ticket, capacity, `policy_version`. Separately `investor_mandates` (kind `impact_fund`, states, purposes, sectors, risk bands, pools, ticket) | **Exists twice, for two different questions** — see §3.3 |
| §7 CTM components | `settlement_providers` + `packages/settlement-route`: `fx_spread_bps`, `fx_cost_cents`, `provider_fee_cents`, `network_fee_cents`, `total_cost_cents`, `cost_bps`, per route, per principal. `settlement_decisions` persists the comparison. `ramp-quote` prices a MoneyGram cash-out | **Most of CTM is built and itemised.** It has no name and no aggregate |
| §8 CTS | `cost_events`, `cost_rates` (16 stages, `staff_minutes`, `hourly_rate_cents`, `fixed_cents`, `borne_by`, `phase`), `cost_rate_cards` (versioned), `operating_economics_snapshots` (`per_100_of_ticket_cents`, `by_phase`, `by_stage`) | **Finished**, and versioned |
| §3 World Bank guardrail | `/app/capital/economics` shows WPS 8252 as *"Reference, not a comparison"* and explains why the two numbers are not comparable; `src/content/sources.ts` carries the citation | **Already honoured, more carefully than §3 asks** |
| §10 Domestic Coverage Rate, External Capital Gap | `private.capital_coverage()` → demand, domestic-only, combined, `domestic_coverage_bps`, `combined_coverage_bps` (portfolio). v1 gives the gap per opportunity | **Exists** |
| §10 Eligible External Capital Gap, Global Funding Coverage, CTM Rate, Capital Efficiency, Time to Global Funding | — | **New**, and the last one needs a timestamp that does not exist |
| §12 Efficiency Dashboard | `/app/impact` shows capital mobilized, qualified demand, domestic and global coverage. `/app/capital/economics` shows CTS per R$100, by phase and by stage | **Exists, split across two pages** |
| §12 "every number carries a status" | `REALITY` (`real`, `zcash`, `sandbox`, `simulated`, `mock`, `indicative`) and `DataLegend` (`private`, `derived`, `proven`) | Two vocabularies already; the addendum asks a **third question** — see §3.5 |
| §13 devnet funding flow | `record_investment` → `investment-confirm` → vault → `settlement_legs` → simulated Pix, with the settlement-route comparator choosing the rail | **Finished end to end** |
| §4 "connection to the tokenized investor position" | `credit_positions` mints one per investment, pool-agnostic, before the loan exists | **Already done.** Nothing to build |
| §14 anchoring eligibility and economic snapshots | `chain_anchors`; and the founder decided on 26 Sep to add no new proof kind for the MVP | **Out of scope by decision** |

---

## 2 · What is actually missing

Four things, in the order they matter:

1. **A second question, asked separately.** Today a global route either passes
   the seven gates or it does not, and a residual gap that nothing takes is
   simply unfunded. §17's criterion — *"a residual gap can be rejected for
   global funding even when domestic coverage is insufficient"* — is already the
   behaviour, but the **reason** is never recorded as a reason about *global
   capital*. Nobody can read why international money was not the answer.
2. **Affordability re-checked against the global route's total cost.** The
   affordability gate uses `estimated_cost_bps`, which for a pool route is the
   pool engine's all-in rate. It does not include what it costs to move the
   money — FX, ramp, provider and network fees, which the settlement comparator
   prices for a *disbursed loan*, after the decision. That ordering is the real
   gap in the economics, and §5 is right to name it.
3. **CTM as a number.** Its components exist per route, per principal. Nothing
   sums them, divides by global capital deployed, or shows them next to CTS.
4. **One screen where CTS and CTM sit together.** This is §8's stated purpose —
   *"so the demo never implies that cheap blockchain settlement eliminates the
   operational cost of small loans"* — and it is the single highest-value item
   in v2 for a judge.

---

## 3 · Review of the addendum — six places to deviate

### 3.1 · One engine with a second gate group, not a second engine

§5 lists ten conditions. Six are already gates in `matchCapital()`: purpose,
ticket/pooling, affordability, risk band (through the pool policy), capacity,
impact mandate. Building a separate deterministic engine would duplicate the
gate machinery, the reason-code ordering and the trace shape, and would give the
audit console two vocabularies for one question — the mistake v1 §3.5 already
refused once.

**Do:** `packages/capital-allocation/src/global.ts`, a `globalEligibility()`
that runs on the residual **after** the domestic pass, reusing `Gate`,
`NetworkReason` and the reason ordering. Its four genuinely new gates are
`economics` (total cost after mobilisation), `evidence` (data-quality
threshold), `regulatory_route`, and `domestic_reconsidered`. Its output is a new
section of the same `capital_route_decisions` row, not a fifth table.

### 3.2 · CTM is a phase of the cost model that exists, not a new cost model

`cost_rates` already has `phase`, `borne_by` and a versioned rate card, and
`operating_economics_snapshots` already reports `by_phase`. §7's rule — keep CTM
out of CTS — is a **phase boundary**, and the schema already has the concept.

**Do:** add the mobilisation stages (`compliance_kyb`, `wallet_infrastructure`,
`capital_mobilization`) to `cost_stage` with `phase = 'mobilization'`, and read
the market-priced components (FX, ramp, provider, network) from the settlement
quote that already computes them. `private.capital_mobilization(opportunity)`
then returns CTM itemised, and the CTS reader keeps its own phase and is
untouched. **A second FX calculation anywhere would be the third place this
project computes a spread, and it must not happen.**

### 3.3 · `investor_mandates` is not the Impact Fund profile, and v1 already built the right home

`investor_mandates` is one **investor account's** filter for the Investor
Console — what Irene wants to see. §6's profile is a **provider's** policy —
what a fund will fund. v1's `capital_providers` and `capital_instruments`
already hold mandate, geography, purposes, ticket, capacity and
`policy_version`, with column-level grants protecting what an operator may not
change.

**Do:** add `impact_fund` to `capital_provider_type`, and put the fields v1 does
not have — domicile, deployment currency, target population, duration
constraints, reporting requirements, KYC/KYB metadata, required-return ceiling —
on the provider and the instrument. Leave `investor_mandates` alone.

### 3.4 · Do not replace the benchmark wording. The product's is better.

§3 asks for the label *"Historical external benchmark — World Bank, 2005–2009
dataset"*. The product already says, in both languages, that it is a reference
and not a comparison, that one figure counts a whole institution against its
portfolio while the other counts modelled stage costs against reais lent, and
that **neither is EmpowerFI's measured cost**. Shortening that to the
addendum's label would lose the part that actually prevents the misreading.

**Do:** keep the wording, add the `benchmark` provenance mark to it, and carry
§19's guardrail forward: no percentage is ever computed against US$14.

### 3.5 · Provenance is a third question, and deserves its own small vocabulary

§12 wants every number labelled Observed / Partner-Provided / Simulated /
External Benchmark. `REALITY` answers *"is this rail real?"* and `DataLegend`
answers *"who may see this, and is it proven?"*. Provenance answers *"was this
measured, given to us, assumed, or quoted from a paper?"* — a third question,
and the repo already runs two orthogonal marks side by side without confusion.

**Do:** a four-value `Provenance` in `src/app/lib/economics.ts`, rendered with
the existing `StatusPill`, shown beside `REALITY` where both apply. Not a
replacement for either.

### 3.6 · No new dashboard page — put CTM next to CTS on the page that owns economics

§12 asks for "one compact dashboard". A third economics surface would split the
story across `/app/impact`, `/app/capital/economics` and the new page, and the
one thing §8 insists on is that CTS and CTM be seen **together**.

**Do:** a "Capital mobilization" section on `/app/capital/economics`, directly
under cost to serve, carrying eligible gap, global coverage, CTM and CTM rate,
capital efficiency, and the provenance mark on every figure. `/app/impact` keeps
its sponsor-facing coverage and links across.

---

## 4 · What to cut from v2's P0, and why

- **"Devnet Global Impact Capital funding flow using test assets"** — shipped.
  `record_investment` → `investment-confirm` → vault → settlement legs →
  simulated Pix, with the route comparator choosing the rail.
- **"Connection from funded global opportunity to the tokenized position"** —
  shipped, and pool-agnostic: a position is minted per investment, before the
  loan exists.
- **"Optional Solana commitments" for eligibility and economic snapshots** — out
  by the founder's decision of 26 Sep. A new proof kind is a program instruction
  and a devnet upgrade, and the MVP does not need it.
- **A separate `GlobalCapitalEligibility` table** — §3.1.
- **A second cost model** — §3.2.

That is roughly half of §4's list already done or deliberately not done.

---

## 5 · Build plan — P0

Four working days, not seven steps. Each ends with something demonstrable.

| Day | Deliverable | Notes |
|---|---|---|
| 1 | `globalEligibility()` in `packages/capital-allocation`: four new gates, reason codes in the existing namespace, vectors; the SQL mirror; `capital_route_decisions.global_eligibility` jsonb; pgTAP | Reuses `Gate`, `NetworkReason`, the ordering and the vector discipline |
| 2 | CTM: mobilisation stages on `cost_stage`, `private.capital_mobilization(opportunity)` reading the settlement quote it already has, snapshot columns, pgTAP | No FX is recomputed anywhere |
| 3 | Impact-fund provider: `impact_fund` provider type, the §6 fields, a seeded simulated fund with a mandate, the operator editor extended within its existing column grants | The seed mirrors §16's demo numbers |
| 4 | `/app/capital/economics` gains "Capital mobilization": eligible gap, global coverage, CTM and rate, capital efficiency, provenance marks; affordability re-checked against total cost shown on the route card | The one item a judge will actually read |

**Demo integration** (`docs/DEMO.md`): the network step already shows a gap. v2
adds one sentence after it — *"and here is what it costs to bring that money in,
next to what it costs us to serve the loan"* — and the Solana rail stops being a
claim about cheapness and becomes a measured number beside another measured
number.

---

## 6 · Decisions needed before coding

1. **Is the pilot fund named or invented?** §6 wants a fund profile. Every
   provider in v1 is simulated and unnamed for a reason. Recommend: invented,
   `is_simulated`, until a real fund consents — as with the advisory board.
2. **What goes inside CTM, and what stays beside it.** §7's formula sums
   *"On/off-ramp + FX + Hedge"*, and those are two different kinds of number.
   The ramp is what is actually paid to move the money once: the seeded
   providers charge 120 bps of spread plus 60 or 120 bps of fee, about **1.8%
   of the principal, one time**, and `packages/settlement-route` already
   itemises it. The hedge is `funding_pools.fx_hedge_bps` — **5% a year** the
   global pool charges for carrying BRL exposure over the loan's life. Summing
   them gives a figure whose unit is half per-operation and half per-year, and
   dividing that by capital deployed produces a CTM Rate that means nothing.
   §7 itself says to keep *"investor required return / cost of capital"* out of
   CTM, and a hedge is a required return on currency risk, not a fee paid to a
   rail. Recommend: **CTM is what is paid to move the money** — ramp, network,
   compliance, wallet, settlement — and the hedge is reported beside it, named,
   under cost of capital.

   *A note on affordability, since it is the same arithmetic.* She already pays
   a modelled mobilisation cost: her rate on the global pool carries the hedge
   and `ramp_bps` spread over the term. For a twelve-month loan the model
   charges about 200 bps of ramp against roughly 180 bps of real conversion
   cost, so **replacing the constant with a real quote at decision time moves
   her instalment very little**. That is worth showing rather than worth
   fearing, and it is a smaller change than it looked: the estimate the engine
   has been using is close to right.
3. **Does CTM include the ramp's cost when the ramp is a sandbox?** MoneyGram is
   sandbox-only. Recommend: yes, marked `sandbox` provenance, never blended with
   simulated assumptions.
4. **Time to Global Funding** needs a funded timestamp. No column records when
   an opportunity filled. Recommend: derive it from the last investment rather
   than add a column, and say so on the metric.

---

## 7 · What this plan does not build

- Live custody, live FX, production remittance, automated partner underwriting,
  legal token issuance or secondary trading (§19 agrees).
- Any claim that the global route is cheaper. It is measured and shown; nothing
  concludes.
- Any percentage computed against the World Bank figure.
- New on-chain proof kinds.

---

## 8 · Legal review — what v2 adds to §8 of v1's plan

1. Does presenting an **itemised cost of mobilising international capital**
   beside a credit route change the answer to v1's question 1 about
   intermediation?
2. A fund profile carries a **required return**. Does showing it to an
   entrepreneur, even as provider policy, make the route an offer of terms?
3. **Affordability after mobilisation cost**: if EmpowerFI computes and displays
   her total cost including FX and ramp, what does that make the figure — an
   estimate, a quote, or something she could rely on?

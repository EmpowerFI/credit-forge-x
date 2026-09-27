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

## 6.1 · Decisions taken, 26 Sep 2026

The founder accepted all four recommendations:

1. The pilot fund is **invented and `is_simulated`**, as every other provider in
   v1 is, until a real fund consents.
2. **CTM is what is paid to move the money** — ramp, network, compliance,
   wallet, settlement. The hedge is reported beside it, named, under cost of
   capital. No figure sums a per-operation cost with a per-year one.
3. The ramp's cost enters CTM **even while MoneyGram is sandbox**, marked
   `sandbox`, never blended with a simulated assumption.
4. Time to Global Funding is **derived from the last investment**, and the
   metric says so rather than implying a column that does not exist.

---

## 6.2 · Build log

### Day 1 — the second question, asked separately

`packages/capital-allocation/src/global.ts`, its SQL mirror in
`20261006000000_capital_global_eligibility.sql`, eight vectors in
`vectors/global.json`, and forty pgTAP assertions in
`platform/supabase/tests/capital_global.test.sql`. One decision row, two
answers: `capital_route_decisions.global_eligibility` holds the object v2 §5.1
asks for, and `eligible_gap_cents` is a column because §10 aggregates it.

Six gates, in the order the engine asks them: `gap`, `domestic_reconsidered`,
`economics`, `affordability`, `evidence`, `regulatory_route`. Four are new
questions; `affordability` is the network engine's own gate asked a second time,
and `gap` is a precondition stated rather than assumed. `domestic_reconsidered`
is asked **before** the economics on purpose: demand a local route would take
once she brings a bank statement does not go abroad, however cheap the global
route is. That is §17's criterion working in the direction §17 points it — a
residual gap refused for global funding *while domestic coverage is zero*, which
the pgTAP file now proves end to end.

**What the economics gate actually settled.** Her rate on the global pool
already carries a modelled cost of moving money — the pool engine's
`ramp_bps_year`. So the quote from `packages/settlement-route` **replaces** that
term; it is never added to it. On a twelve-month loan at the seeded rate cards
the swap costs her **79 basis points**, which is R$ 1,40 a month on a R$ 2.000
slice and R$ 3,50 on a whole R$ 5.000. The estimate the engine has been using
was close to right, and the honest number is now the one on the screen. The
return leg stays modelled, because nothing in this product prices BRL → USDC and
inventing a quote for it would have been the third place this repository computes
a spread.

**Three defects, two of them mine and one of them v1's.**

- *The global route's own instalment was charged against its own headroom.*
  `instalmentCommittedCents()` summed every allocation in the plan, so on a
  network where only the global route was left it refused the very gap it was
  offered. Found by the database, not by the TypeScript: the TS fixture happened
  to be all domestic. Fixed on both sides, with a test on both sides.
- *The gates answered questions nobody asked.* With no gap there is no quote to
  request and no evidence to weigh, yet the settlement gate was still returning
  "no" and the reason codes read like a refusal. A covered need now carries one
  gate and one code. Found by pgTAP, because the vector had politely passed
  `settlement_feasible: true` for a scenario where nothing was ever asked.
- *v1 never summed instalments across a stack.* Each route was capped at its own
  `max_instalment_share_bps` and nothing added them up, so two credit routes
  could in principle commit more of her month than eligibility allowed. The
  global question is where that sum first had to be honest, and it now is.

Verified: 674 pgTAP assertions across 21 files, 236 vitest tests across 21
files, `tsc --noEmit` clean, 0 eslint errors, build clean. TS and SQL agree on
all eight vectors across the whole answer, gate traces included.

### Day 2 — CTM: what it costs to bring the money in

`20261007000000_capital_mobilization.sql`, and 37 pgTAP assertions in
`platform/supabase/tests/capital_mobilization.test.sql`. No TypeScript engine and
no vectors, because CTM computes no model: it reads rates the card states and a
quote `packages/settlement-route` already made. A vector would hold two copies of
an addition to one answer.

On a R$ 5.000 ticket from the global pool, by the pilot card: **R$ 51,75 to
operate the mobilisation** (KYB 45 min, wallet operations R$ 3, reconciliation
20 min, at the desk rate) and **R$ 91,29 to the rails** (FX spread R$ 61,10,
provider fee R$ 30,19, network R$ 0) — **R$ 143,04 in all, 286 basis points**, or
R$ 2,86 per R$ 100 mobilised. Beside it, never inside it: the pool's **500 basis
points a year** of FX hedge, named as a required return on currency risk.

**A deviation from §3.2, and the reason for it.** The plan said to put the
mobilisation stages on `cost_stage` with `phase = 'mobilization'`, on the grounds
that the schema already had the phase concept. It does not, in the way that
mattered: `cost_rates.phase` is a reporting label, and both
`public.operating_economics()` and `public.cost_sensitivity()` enumerate *every*
rate on the card — the first even emits a zero line for stages nothing has
reached yet. A mobilisation rate placed there would have appeared inside cost to
serve by default, and every future reader would have had to remember to exclude
it. §7's rule deserves better than a convention, so CTM's rates live in
`public.capital_mobilization_rates`, versioned by the same `cost_rate_cards`.
Cost to serve cannot absorb them because it cannot see them, and pgTAP asserts
that the three stages are not `cost_stage` values, not `cost_rates` rows, and on
no `cost_event`.

**Where decision 3 landed.** The ramp's cost is in CTM and carries its own
provenance mark — but no seeded provider is a sandbox for a loan-sized
conversion, so today every market line reads `simulated`. MoneyGram's sandbox
prices US$2–US$200 cash pickup in Brazil and a loan is larger;
`private.quote_provenance()` marks a sandbox quote `partner_provided` the moment
one can price a ticket. Nothing is blended: the card's assumption and a
provider's answer never share a mark.

**Two things the day found.**

- *CTM was charging a ticket that never crossed a border.* With nothing
  mobilised, the three operating stages were still summed, so a domestic ticket
  came back with R$ 51,75 of mobilisation cost. Nothing mobilised is nothing
  spent mobilising; the totals are now zero and the rate is null rather than a
  division by nothing.
- *A quote nobody can execute still says what a conversion costs.* An amount
  outside every provider's ticket policy is priced and marked
  `executable: false`, because reporting nothing there would read as free. The
  first version of the test asserted the opposite, and the test was wrong.

Verified: 711 pgTAP assertions across 22 files, 236 vitest tests, `tsc --noEmit`
clean, 0 eslint errors, build clean.

### Day 3 — the fund, its policy, and a gate that reads it

`20261008000000_impact_fund_type.sql` and `20261008000100_impact_fund_provider.sql`,
27 pgTAP assertions in `platform/supabase/tests/impact_fund.test.sql`, seven more
in `packages/capital-allocation`, two new vectors, and the two screens that show
any of it.

The §6 profile went to whichever table the field is a fact about.
`capital_providers` gained **domicile**, **required return**, **reporting
requirements** and **KYB metadata**; `capital_instruments` gained **target
population** and a **term range**. `investor_mandates` was not touched: it is one
investor account's filter for the Investor Console, a different question with a
different owner.

The fund itself is invented, simulated, and unnamed — domiciled **NL**, asking
**6% a year** for its capital, wanting a quarterly impact report, annual audited
accounts and anonymised borrower-level data, with its counterparty checks marked
as never performed. Its instrument funds **R$ 1.000 to R$ 50.000 over 6 to 36
months**, for women-led businesses in verified communities, at **36% a year**
all-in to her, with **R$ 20 million** stated. It expands what the pools can
reach rather than competing with them, and it still has to say yes.

**Two deviations, both stated in the migration.** There is no "required-return
ceiling": a second ceiling beside `private.capital_cost_ceiling_bps()` would be
two ceilings with no stated precedence. And there is no deployment currency on
the provider, because `capital_instruments.currency` already says what a route
is denominated in.

**One thing the plan did not ask for.** A duration constraint the engine never
read would be decoration on a screen, so the term range is a **gate** —
`TERM_OUTSIDE_POLICY`, asked after purpose and before the papers, in both engines
and in the vectors. Full gate traces agree between TypeScript and SQL across all
eight network vectors, instrument by instrument.

**And the day found that day 1 and day 2 were verified with a command that
verifies nothing.** The repository's `tsconfig.json` carries `files: []` and only
references, so `npx tsc --noEmit` type-checks an empty project and exits clean
whatever the code says. The real check is `npx tsc -b`, and the moment it ran it
found the ten `GLOBAL_*` reason codes of day 1 with **no label in either
language** — a refused gap would have rendered `undefined` on the entrepreneur's
own screen. All ten are written now, and so are the impact fund's provider type,
its instrument type, the `term` gate and its two-sided trace. Every "tsc clean"
reported on days 1 and 2 should be read as unverified; the code is verified now.

Verified: 738 pgTAP assertions across 23 files, 243 vitest tests, `tsc -b`
clean, 0 eslint errors, build clean, and a browser pass over
`/app/capital/network` at 390, 768 and 1280 — the fund's profile, the term line,
the editor's new fields saved end to end, no console errors.

### Day 4 — the two economics on one screen, and the answer on her plan

`20261009000000_capital_economics_readers.sql`, eight more pgTAP assertions, a
"Capital mobilization" section under cost to serve on `/app/capital/economics`,
and the global answer on the recommended plan itself.

**The screen §8 exists for.** Two measured numbers, per R$ 100, side by side and
never added: **R$ 2,86 to bring the money in** against what it costs to make and
follow the loan — two costs with **two denominators**, one dividing by capital
that crossed the border and one by reais lent, and the copy says so. Beside them,
under "the two costs stay apart", the **5% a year** FX hedge, named as a required
return on currency risk and summed into neither. Capital efficiency, global
funding coverage and §10's eligible external capital gap sit under it, and every
figure carries a provenance mark — the fourth vocabulary the repository now runs,
beside reality and the data legend, and it replaces neither.

**Time to global funding** is derived from the last investment, as decision 4
settled, and the metric says so on its own line rather than implying a column
that does not exist.

**And the second question now reaches the person it is about.** `capital_plan()`
carries the global answer, so her own plan shows the gap local capital left, her
cost as the pool engine estimated it, her cost with the conversion quoted, the
distance between the two, and the instalment against what the local routes left
of her month. On the seeded scenario: a **R$ 1.000** gap, **36.0% estimated
against 36.8% quoted — 0.79 percentage points** — an instalment of R$ 114,04
with R$ 483,06 of her month still free, and the route refused anyway, because two
months of reported history is not enough for money that crosses a border. A
decision recorded before the question existed comes back null, and the screen
reads that as "not asked" rather than as "refused".

**Three things the browser found.** "1 tickets", in a string of my own. A money
tile clipping "R$ 5.000,00" at 390 — and, in the same audit, the *same* clipping
on the licence tile that has been there since the business-model section
shipped, fixed with it. And the side-by-side comparison labelled two different
denominators as if they were one, which is the sort of thing that reads fine
until someone divides.

Verified: 745 pgTAP assertions across 23 files, 243 vitest tests, `tsc -b`
clean, 0 eslint errors, build clean, and a browser pass over
`/app/capital/economics` and `/app/capital/network` at 390, 768 and 1280 — the
engine run end to end, no console errors, and no overflow left but the status
dot's own ping and a table that is deliberately scrollable.

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

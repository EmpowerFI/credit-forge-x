# Operating economics and cost to serve — review of the addendum, and plan

**Source:** *EmpowerFI MVP Addendum — Operating Economics & Cost-to-Serve Validation* (founder, 21 Sep 2026), companion to the *Site + Hackathon MVP Refactor Specification v2 — Solana*.
**Work:** on `hackathon`. Migrations, reseeds and the merge to `main` happen only after the founder approves.
**Status, 21 Sep: closed.** Reviewed against what is built, then built. **G1–G4 are done and live.** G5, the proof, was decided against — not deferred (§7.2). This work is finished for the hackathon.

**Review:** **most of the addendum already existed**; five things did not. §3 reviews the addendum itself, including one place where following it literally would make an honest number flattering. The founder accepted the three decisions in §7, and G1–G4 were built on 21 Sep.

**Rules kept:** do not rebuild what works, label every simulated value, put nothing personal on chain, and — added by this addendum — **never show an efficiency number without the guardrail that keeps it honest**.

---

## 1 · Current-state map — what the addendum touches

| What exists | Where | What it does today |
| --- | --- | --- |
| Cost model | `20260914200200_cost_to_serve.sql` | 14 `cost_stage` values with a pilot rate card (`cost_rates`: staff minutes, hourly rate, fixed cents, who bears it, phase). Costs are **recorded from the facts themselves** by triggers, one row per fact (`unique (stage, fact_id)`), counted **from the first community onboarding** — not from disbursement. |
| Program reader | `public.operating_economics(p_program_id)` (`20260924000000`) | Cost per R$ 100 lent (all-in and credit-only), per opportunity, per participant, stage breakdown, automated share, plus the discipline counters. Program-scoped. |
| Operating Economics page | `/app/capital/economics` → `src/app/pages/capital/OperatingEconomics.tsx` | Inside the Credit & Capital Engine area, not a separate workspace. Every metric is rendered as a **`Pair`**: "Must improve" beside "Must not be sacrificed". |
| Engine flow | `src/app/pages/capital/AllocationEngine.tsx` + `engine/*` | Credit Engine qualifies, then the Capital Allocation Engine routes. `Decision` shows an "estimated all-in cost" in bps — that is **route economics** (funding, FX, ramp), which §5 rightly says to keep apart from operating cost to serve. |
| Benchmark | `OperatingEconomics.tsx:155`, `src/content/sources.ts`, `components/home/copy.ts` | WPS 8252 is already labelled "Reference, not a comparison … Neither is EmpowerFI's measured cost", and explains that it counts a whole institution against its portfolio while this counts modelled stage costs against reais lent. |
| Proof layer | 14 anchor kinds, `verify.ts`, proof drawer | None of them is operating economics. |

## 2 · Gaps against the addendum

Everything else in §4, §7, §10 and §11 is already met. These five are not.

| # | Gap | Addendum |
| --- | --- | --- |
| ~~G1~~ | ~~**No ticket-sensitivity simulation.**~~ **Done.** `cost_sensitivity()` over the card, on `/app/capital/economics` under the cost pair, with the ticket actually lent among its rows and the measured number beside it. | §6 |
| ~~G2~~ | ~~**The rate card is not versioned.**~~ **Done.** `cost_rate_cards` (version, effective_from, source, note); `cost_rates.card_version`; `cost_events.rate_version`, stamped by the date of the fact. `is_assumption` is gone: the card says it. | §9, §11 |
| ~~G3~~ | ~~**No operating economics inside the engine flow.**~~ **Done.** The two numbers of §3, with their guardrail, at the end of the engine run — after the decision, where the reader asks what producing it cost. | §4, §3 |
| ~~G4~~ | ~~**No snapshot per opportunity.**~~ **Done.** `operating_economics_snapshots`, written by trigger when the opportunity opens for funding, and backfilled for the ones that opened before. | §9 |
| G5 | **No proof for it.** Nothing anchors a snapshot hash/version/timestamp. **Closed, not built:** see §7.2. | §9, §11 |

## 3 · Review of the addendum

**§4's "Estimated Cost to Serve" per opportunity would flatter the number, and must not replace the one on the page.**
This is the one place where following the addendum literally would weaken what exists. The cost model counts **every** participant from the first community onboarding, including everyone prepared who never borrows. That is deliberate, and it is the whole point: the expensive part of small-ticket lending is not the loan you make, it is the pipeline behind it. An "estimated cost to serve" for one qualified opportunity counts a single successful path and would come out far lower than the program number on `/app/capital/economics` — two numbers with the same name and a silent disagreement between them, which is exactly the shape of a claim a judge should not trust.

**Proposal instead of §4's single field:** the engine panel shows **two numbers side by side**, and the gap between them is the story.

| | What it is | Source |
| --- | --- | --- |
| **This opportunity, so far** | The cost events actually recorded for this entrepreneur, enrollment to now | `cost_events`, a fact, not an estimate |
| **The program, per R$ 100 lent** | The funnel-wide number, everyone included | `operating_economics`, already built |

The second is always larger. Showing both says what the hypothesis actually claims: the marginal case looks cheap, and the honest cost is the pipeline.

**§5's "CTS ratio" and "cost per R$100" are the same quantity.** `ratio × 100 = cost per R$ 100`. The page already shows the readable form. Adding the ratio as a separate tile would be one more number saying the same thing — skip it, and keep the currency amount and per-R$ 100 that §11 asks for.

**§6's sensitivity cannot recompute from the recorded events.** Cost events are facts about work that happened; changing a ticket size does not change them. The simulation must run over the **rate card**, as a model, clearly separated from the measured page. That is a feature, not a limitation — it is the difference between "what we spent" and "what the structure implies".

**§9 asks for more versioning than is needed.** `cost_events` already stores the computed `amount_cents` and `staff_minutes` at the moment of the fact, so history is **already immune** to a later rate change — the addendum's "observed pilot data must never overwrite historical snapshots" is half-satisfied. What is genuinely missing is narrow: a version stamp, so a number can say which card produced it. That is a column and a small table, not a snapshot architecture.

**§9's anchoring is the expensive one, and it is the founder's call.** A 15th anchor kind means a Rust account type and instruction, a devnet program upgrade, a privacy review entry, an `anchor-submit` branch, a `verify.ts` branch, a migration for the enum and one for the payload, and `anchor-reconcile`'s `HOLDER` map. That was a full day for `settlement_route`. See §7.

**§10 and §11's messaging criteria are already met**, and in places exceeded — the benchmark copy explains the methodological difference, which the addendum does not ask for.

## 4 · The model — ticket sensitivity (G1)

Not a new engine. A pure function over the rate card, `packages/` or a SQL reader, with the split made explicit:

- **Per-loan stages** — `credit_intent`, `eligibility_assessment`, `opportunity_preparation`, `partner_referral`, `partner_decision`, `disbursement`: incurred once, whatever the ticket.
- **Per-instalment stages** — `servicing`: incurred per instalment recorded.
- **Pipeline stages** — `community_onboarding` … `readiness_assessment`: incurred per participant, not per loan, and therefore divided by however many participants it takes to produce one loan. This ratio is itself an assumption and must be labelled.

`cost per R$100 (ticket) = (per-loan + servicing × instalments + pipeline ÷ conversion) ÷ ticket × 100`

Tickets R$ 1.000 / 2.000 / 5.000 / 10.000, as §6 asks. The output is labelled **illustrative** and states the conversion assumption on its face, because that assumption moves the answer more than the ticket does.

## 5 · Database and UI

| # | Change | Where |
| --- | --- | --- |
| G2 | `cost_rate_cards` (version, effective_from, source `simulated`/`observed`, note) + `cost_rates.card_version` + `cost_events.rate_version`, stamped by `private.record_cost` | new migration |
| G1 | `public.cost_sensitivity(p_ticket_cents[])` over the current card | same migration |
| G1 | Ticket selector and recomputed tiles, under the cost `Pair`, marked illustrative | `OperatingEconomics.tsx` |
| G2 | The card's version and source shown wherever a cost number is | `OperatingEconomics.tsx` |
| G3 | Operating-economics step between the Credit Engine and the Capital Engine: the two numbers of §3, with its guardrail | `engine/` |
| G4 | `operating_economics_snapshots` (opportunity, ticket, totals, breakdown, card version, engine version) written when an opportunity opens for funding | new migration |

## 6 · What I will not do

- Not a fourth workspace (§3 forbids it, and the page is already inside the engine area).
- Not a per-opportunity "cost to serve" that competes with the program number — see §3.
- Not a cost-reduction claim anywhere, in any language, before pilot data exists.
- Not a CTS-ratio tile duplicating cost per R$ 100.
- Not funding cost, expected loss, FX, hedge or ramp fees inside operating cost — §5 is right, and the engine already keeps them apart.

## 7 · Decisions for the founder — settled, 21 Sep

All three accepted as recommended: the two numbers, no anchor for the hackathon, and the schema change (no reseed was needed for P0 — existing cost events were stamped with the pilot card in place).

1. **The two numbers (§3) instead of §4's single estimated CTS.** My recommendation: yes. It is more honest and it reuses what exists.
2. **G5 — anchor the snapshot as a 15th proof kind? Decided: no.** My recommendation was **not for the hackathon**, and the founder closed it rather than deferring it. Operating economics is a *modelled* number over an assumption card; proving on chain that we committed to an assumption proves less than the 14 kinds that prove facts about a person's journey and a loan. If the pilot replaces assumptions with observed data, that is when a proof starts to mean something. The cost is a devnet program upgrade of the program all 981 existing proofs depend on.
3. **Reseed?** G2 and G4 change the schema; the hackathon project would need a push and, for snapshots to exist on seeded opportunities, a reseed.

## 8 · Sequence

**P0 — makes the hypothesis visible and measurable (§12's "smallest P0 version") — done, 21 Sep**
1. ~~G2, the versioned rate card.~~ Migration `20260927000000_cost_rate_cards.sql`, pushed. A card is a row with a source and a date; each rate belongs to one; each cost event is stamped by the card in force **on the date of the fact**, so the pilot's measured rates arrive as a new card and nothing already recorded moves. Proved in `credit.test.sql`: a new card prices what happens after it, and what was recorded before keeps its card *and its price*.
2. ~~G1, ticket sensitivity.~~ `cost_sensitivity()` (migrations `…000000` and `…000100`), on the page under the cost pair. It never reads recorded amounts — those are facts about work that happened. It runs over the card, with how often each stage has occurred as its multipliers, and it puts **the ticket actually lent among its rows** with the measured number beside it, because a model nobody can hold against a measurement is a claim. On the demo today: R$ 43,09 per R$ 100 lent at a R$ 1.000 ticket, R$ 4,31 at R$ 10.000 — the same work, divided by ten times as much.

**P1 — puts it in the flow — done, 21 Sep**
3. ~~G3, the two numbers in the engine run.~~ Migration `20260928000000_opportunity_economics.sql` and `engine/Economics.tsx`. What was recorded for her (a fact out of `cost_events`, never an estimate), the same against her own ticket, and the programme's cost per R$ 100 lent beside it. On the demo today: **R$ 1,05 against R$ 26,80** — and the panel says why in one sentence, because a number 25× smaller with a similar name would otherwise read as the answer. Beside it, what was not skipped to get there: the affordability test against its limit, the decision, and the two model versions. Costs are not for everyone — an investor sees an opportunity, never what it cost to make one, and the section does not render for them.
4. ~~G4, the snapshot.~~ One row per opportunity, written when it opens for funding: her costs **up to that instant**, the ticket, the breakdown, the card that priced it and the allocation engine's version. The backfill uses the same cut-off, so an opportunity that opened last month is not credited with this month's servicing.

**Deviation from §5, worth recording:** the plan said the engine step would sit *between* the two engines. It sits after the decision instead. At the hold point between the engines the page is asking for one click, RUN CAPITAL ALLOCATION, and a cost panel there competes with it; after the decision, "what did producing this cost?" is the question a reader already has.

Not done, and deliberately: a per-opportunity number that replaces the programme's (§6), and G5.

**P2 — closed**
5. ~~G5, the proof.~~ Decided against, 21 Sep. Operating economics is a number *modelled* over an assumption card: anchoring it would prove that we committed to an assumption, which is less than what the 14 existing kinds prove — facts about a person's journey and a loan. It would also cost a devnet upgrade of the program all 981 live proofs depend on. When the pilot replaces assumptions with observed rates, a proof of the snapshot starts to mean something; until then it would be ceremony. The snapshot itself is already immutable in the database, with the card and the engine version that produced it.

## 9 · Risks

- **Two numbers called "cost to serve" is the main risk of this addendum.** §3's naming has to survive translation into both languages: *this opportunity so far* and *the program, per R$ 100 lent* must never both be labelled "custo de servir".
- **The conversion assumption in §4's model** moves the sensitivity result more than the ticket does. If it is not on the face of the tile, the tile is a claim rather than a simulation.
- **A reseed before the demo** is the usual risk: the operator wallet must be funded first, or the anchor queue stalls silently.

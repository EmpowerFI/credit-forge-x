# Capital Network & multi-instrument routing — review of the addendum, and plan

**Addendum:** `EmpowerFI_MVP_Capital_Network_Addendum_v1.pdf`, v1.0, September 2026.
**Read against:** this repository at `af7df70`, 68 migrations, `packages/capital-allocation` v1.0.0.
**Time on the clock:** 26 Sep → internal deadline Sat 10 Oct 23:59 BRT. Fourteen days, shared with the 17 items still open in `PLAN_HACKATHON.md`.
**Written in English** per the project documentation convention.

The addendum is right about the thesis and out of date about the codebase. It is
written as though the Capital Engine were a bare domestic-vs-global switch with
nothing around it. What is actually there is a versioned engine with hard gates,
reason codes, a SQL mirror, test vectors, a provider registry pattern, a
referral funnel and an anchoring queue. Roughly **half of the addendum's P0 and
most of its P1 already exist under other names.** The plan below builds the half
that does not, and says where the addendum should be deviated from.

---

## 1 · Current-state map — what the addendum touches

| Addendum concept | What exists today | Verdict |
|---|---|---|
| §4.3 `CapitalNeed` | `public.qualified_credit_opportunities` — amount, term, purpose, risk band, confidence, instalment, linked to `eligibility_assessments` and `credit_intents` | **Exists.** Do not build a fifth table |
| affordability range | `eligibility_assessments.max_instalment_cents`, `affordability_bps`, `suggested_min_cents`, `suggested_max_cents` | **Exists**, versioned, re-runnable |
| §4.1 `CapitalProvider` | `public.partners` (kind, ticket range, accepted purposes, decision method, active) and `public.settlement_providers` (policy, capacity, ticket, `reality`, `enabled`) | Two partial precedents, neither is it — see §3.3 |
| §4.2 `CapitalInstrument` | `public.funding_pools` — two rows, enum-keyed: return, risk bands, ticket range, purposes, impact mandate, FX and ramp costs | The shape is right, the cardinality is wrong |
| §4.4 `CapitalRouteDecision` | `qualified_credit_opportunities.allocation` jsonb + `allocation_reason_codes` + `allocation_model_version` + `allocated_at` | Persisted and versioned, but **one route only** |
| §6 Gate 1 readiness | `readiness_assessments` → `eligibility_assessments` → opportunity; the opportunity only exists if eligibility passed | **Exists** |
| §6 Gates 2–4 | `poolChecks()` — risk appetite, ticket, mandate, liquidity, each with its reason code and both sides of the comparison | **Exists**, for pools |
| §6 Score | `all_in_bps` — required return + expected loss + cost to serve + FX hedge + ramp | Exists as a **cost** ranking, not a fit score |
| §8 Reason codes | 13 codes in `AllocationReason`, ordered, mirrored in SQL, covered by vectors | 3 of the addendum's 18 exist verbatim, 2 more under a different spelling |
| §10 metrics | `allocatePortfolio()` returns demand, domestic-only, combined, coverage bps, left per pool | **Exists at portfolio level**, not per need |
| §9.3 / P1 partner view | `/app/partner` — pipeline, reviews, decisions, portfolio, servicing; `partner_decisions`; opportunity `status in (referred, partner_approved, partner_declined)` with `partner_id`, `referred_at` | **P1 is largely shipped** |
| §11 Solana anchoring | `chain_anchors` + `anchor_kind` enum, extended once already for settlement routes | Extending it again is a small change |
| §5 `GLOBAL_IMPACT_CAPITAL` | The whole global pool path: FX, settlement route, Zcash, tokenized positions | **Exists and must not be disturbed** |

---

## 2 · Gaps against the addendum

Genuinely new work, in the order it matters:

1. **Cardinality.** `funding_pool` is an enum of two values, load-bearing across `record_investment`, `funding_target_micro_usdc`, the Investor Console, the settlement route and the tokenized position. The network needs N instruments.
2. **Partial allocation.** Today an opportunity gets one pool or none. The capital stack is the addendum's real idea and the thing no part of the codebase does.
3. **A fit score.** Ranking by all-in annual cost is not the same as ranking by fit.
4. **Domestic Coverage and External Capital Gap per need.** They exist per portfolio; the addendum wants them per opportunity, which is what makes the gap legible.
5. **Instruments that are not loans.** Barter/internal-network and sponsored capital have no home in a schema whose vocabulary is `loans`, `investments` and `funding_pools`.
6. **Operator UI** for providers and instruments. No surface exists that *persists* capital policy: `funding_pools` is edited by migration, and the Assumptions sheet on `/app/capital` says so in its own header — "Simulated; nothing is saved." The instrument editor would be the first place in the product where a human writes capital policy to the database, which is why §6.4 asks who may open it.

---

## 3 · Review of the addendum — five places to deviate

### 3.1 · `CapitalNeed` already exists; extend the opportunity instead of adding a table

§4.3 lists eleven fields. Nine are already columns on `qualified_credit_opportunities` or on the `eligibility_assessments` row it points at, including the affordability range the addendum treats as new. Building `capital_needs` would duplicate the qualified opportunity and immediately raise the question of which one the Investor Console, the partner pipeline and the loan are hanging off.

**Do:** add `urgency` and `desired_date` to the opportunity (the two fields genuinely missing), and let `capital_need_id` in the addendum mean `opportunity_id` throughout.

### 3.2 · The capital plan must **wrap** the pool allocation, not replace it

This is the decision the whole plan turns on.

§9.2 says "Replace a single Selected Pool field with Recommended Capital Plan." Taken literally that severs `funding_pool`, and with it `record_investment()`, `funding_target_micro_usdc`, the investor portfolio, the settlement decision, the Zcash allocation path and every tokenized position — none of which the addendum wants touched (§16: "Do not rewrite or remove ... Investor Console, Solana proof layer or tokenized-credit prototype").

**Do:** the two P2P pools become two instruments in the network, and their route keeps writing `funding_pool`, `funding_target_micro_usdc` and the rest **exactly as it does today**. The capital plan is a new row that *contains* that decision alongside the referral routes. Downstream code reads the same columns it always read, and a P0 with the network switched off behaves identically to today — the pattern `private.settlement_experiment()` already established.

**Consequence:** the new instrument types (regional credit, microcredit, barter, sponsored) are **referral routes**. They never create an `investment`, never mint a position, never touch `loans`. They produce a recommendation and a status.

### 3.3 · `partners` is not `CapitalProvider`, and stretching it would be a legal error

`partner_kind` is `credit_union | scd | fintech | bank | impact_fund | other` — the regulated counterparty that *approves credit*. A community barter network is not one, and §12 forbids both describing such mechanisms as credit and implying EmpowerFI or its providers hold a regulated role they do not.

**Do:** a new `capital_providers` table with a descriptive `provider_type` and a nullable `partner_id` pointing at `partners` for those providers that are also approving partners. The referral funnel that already exists then applies to exactly those, and to no others.

### 3.4 · Implement the seven-weight fit score, but do not display seven weights

§6's `FitScore` has seven terms. With seeded demo instruments, a seven-term weighted score produces a number nobody can check — precisely the fake precision this project refuses everywhere else ("every number, with its source").

**Do:** implement the formula as specified — it is cheap, deterministic and configurable. In the UI, show the **hard gates that eliminated instruments** and the **two or three terms that actually moved the ranking**, with the weights named as configurable policy, not credit policy. A judge should be able to say why route A beat route B in one sentence.

### 3.5 · One reason-code namespace, not two

§8 introduces `TICKET_OUTSIDE_POLICY` where the engine already has `TICKET_OUTSIDE_POOL_POLICY`, and `DOMESTIC_POOL_EXHAUSTED`, `GLOBAL_EXPANDS_CAPACITY`, `GLOBAL_IMPACT_MANDATE_MATCH` already exist verbatim. Two vocabularies for the same idea would show up in the audit console as two answers to one question.

**Do:** extend `AllocationReason` to the union, keep the existing spellings where they collide, and version the engine to `capital-allocation-v2.0.0`. `AuditModels` already renders model versions, so the change is visible where it should be.

---

## 4 · The data model

Three new tables. `capital_needs` is not one of them (§3.1).

```
capital_providers      id, display_name, legal_name, provider_type, status,
                       coverage (country/uf/city), partner_id → partners (nullable),
                       commercial_model jsonb (informational), is_simulated

capital_instruments    id, provider_id, name, instrument_type, currency,
                       ticket_min_cents, ticket_max_cents, eligible_uf[], purposes[],
                       business_age_min_months, required_documents[],
                       max_instalment_share_bps (null where no repayment),
                       rate_bps, fee_bps, estimated_cost_bps,
                       closed_network_rules jsonb, capacity_cents,
                       impact_mandate, is_domestic, is_global, active,
                       policy_version, effective_from, effective_to, is_simulated

capital_route_decisions  id, opportunity_id, engine_version, decided_at,
                       evaluated jsonb (every instrument with its gate results),
                       allocations jsonb (instrument_id, amount_cents, fit_score, reasons),
                       reason_codes text[], domestic_coverage_cents,
                       external_capital_gap_cents, status, snapshot_hash
```

`instrument_type` as an enum matching §5, with the two P2P pools represented as
`DOMESTIC_P2P` and `GLOBAL_IMPACT_CAPITAL` instruments whose policy is read from
`funding_pools` rather than duplicated — one source of truth for the numbers the
Investor Console already shows.

---

## 5 · Build plan — P0

Five working days, in this order. Each day ends with something demonstrable.

| Day | Deliverable | Notes |
|---|---|---|
| 1 | Migration: three tables, `instrument_type` enum, reason-code union, RLS in the repo idiom, seed of 3 providers × 4 instruments, all `is_simulated` | Seed mirrors §16.7: regional credit, microcredit, barter/internal network, Global Impact Capital |
| 2 | `packages/capital-allocation` v2: gates, fit score, partial allocation, coverage and gap, reason codes; vectors extended; SQL mirror `private.match_capital()`; pgTAP | The existing vector discipline applies — browser and database must give one answer |
| 3 | `public.run_capital_engine(opportunity_id)` — explicit, idempotent, versioned, writes one decision row; the existing `open_for_funding` trigger untouched | Matches the demo's "Click Run Capital Engine". Minimum blast radius |
| 4 | Operator UI at `/app/capital/network`: provider and instrument tables, instrument editor, **Test Match** against a chosen opportunity | New nav entry under the Credit & Capital Operator workspace in `views.ts` |
| 5 | Opportunity UI: Recommended Capital Plan — total need, covered, domestic coverage, residual gap, route cards with allocation, fit, reasons, constraints and status | Plus the anchor: extend `anchor_kind` with `capital_route`, reuse the queue |

**Demo integration** slots into `docs/DEMO.md` between the current engine step and
the funding step: run the engine, show the plan, show the gap, and let the gap be
what the Global Impact Capital route then funds on Devnet. That is a better story
than today's — the global rail stops being an alternative and becomes the answer
to a gap the audience just watched appear.

### 5.1 · Build log — what each day actually shipped, and what it found

**Day 1 · the registry** (`20261002000000_capital_network.sql`, 23 pgTAP assertions).
Three tables, four providers and five instruments, all simulated, and nothing
downstream touched. The two P2P routes are instruments that *point at*
`funding_pools` rather than copying it, held there by a check constraint, so the
network and the Investor Console cannot disagree about what a pool has left.

Two of §12's guardrails went into the schema rather than into a screen, where a
translation could lose them: `is_credit = false` on the productive exchange,
whose unit of account is `unit` and not money, and `requires_partner_approval`
true on every partner route.

**Day 2 · the engine** (`packages/capital-allocation/src/network.ts`, 27 tests).
Seven gates, each carrying both sides of its comparison; the seven-weight fit
score of §6; domestic first and global for the residual.

*Building it found a bug in day 1's schema.* `covered + gap = requested` is false
the moment a global route fills part of the gap: R$3,000 domestic and R$2,000
global against a R$5,000 need leaves coverage at R$5,000 and the gap still at
R$2,000, because the gap measures the **domestic** network. Replaced with three
independent numbers that sum to the request, and a generated
`external_capital_gap_cents`, so the two definitions cannot drift.

**Day 3 · the run** (`20261003000000_capital_engine_run.sql`, 21 more assertions).
`private.match_capital()` mirrors the TypeScript engine, and
`vectors/network.json` holds the two to one answer across six scenarios — every
gate, every limit and every reason code identical, not just the headline figures.
`public.run_capital_engine(opportunity)` is the operator's button: it refuses
anyone who is not a capital operator, refuses an opportunity whose owner has
withdrawn the `partner` consent scope, and is idempotent — the same engine over
the same need reaching the same answer records no second row.
`private.open_for_funding()` is untouched.

*Two fields the addendum did not ask for, and one proxy it should know about.*
The decision now stores the `need` it ran against, as `eligibility_assessments`
stores its `inputs`; without that a recommendation could not be reproduced. And
`documents_on_file` had to exist somewhere: nothing in this product records which
papers a business has, so an operator states them when running the engine and the
statement is kept rather than floated. Finally, **there is no incorporation date
anywhere in the schema**, so `business_age_months` is the span of the check-in
history she has actually reported — a proxy, and it must be labelled as one
wherever the operator UI shows it, because it is what closes the regional
product's six-month gate.

**Day 4 · the operator's screen** (`/app/capital/network`, two more migrations, 9
more assertions). The registry, the instrument editor and the run, in the
workspace's own idiom. Verified in a browser against the hackathon project:
plan rendered, engine run recorded, a second run recorded nothing, PT and EN,
390px through 1280px, no overflow the app shell did not already have.

*Who may change what, settled in the schema rather than on the screen.* An
operator moves commercial terms — ticket, capacity, cost, mandate, states,
purposes, papers, instalment share, open or closed. An operator may not change
`instrument_type`, `pool`, `currency`, `is_domestic`, `is_global`,
`requires_partner_approval`, `is_credit`, the provider, the code or **the name**:
the words a woman reads on a route card are not a field to be reworded into
"quick credit". Column-level grants enforce it, so the database refuses the
screen rather than trusting it. Nothing grants `insert`, because creating an
instrument declares all of those at once; a new route arrives by migration, as a
funding pool does. A new structural check makes it stick: a credit route must
always state the share of her instalment it may take, since leaving it null is
how the affordability gate gets skipped.

*Two deviations from §5.* "Test Match" is called **Run the engine**, because it
is the recorded run: the need is assembled by `private.capital_need()` from the
opportunity, the eligibility assessment, her state and her check-in history, and
rebuilding that in the browser would be a second place for the same rules to
disagree from. Idempotency is what makes pressing it safe. And §6.4's "narrower"
turned out to be about **editing**, not about the page: reading the registry
matches its row-level policy, running the engine is the desk and capital
operators (`partner` had to be added — it is EmpowerFI's own P2P desk, and
routing is its work), and setting a policy is narrower still.

*Three defects the browser found that the type checker and the tests did not.*
A single `{ en, pt }` passed to `localized()` rendered as an object and took the
whole app down with a blank page — the runtime returns the pair while the type
says `string`. `localized()` now rejects a lone label at compile time, and the
guard found exactly one call site: mine. Every gate's refusal printed raw
enum values and centavos ("hers renovation · asked working_capital"); they are
now phrased in her language and her currency, on both sides of the comparison.
And every number field in the editor had a step coarser than its own precision,
so a share of 60% failed the browser's validity check and the form refused to
submit **without saying why**.

---

## 6 · Decisions needed before coding

1. **Real or fictional providers.** Every seeded provider must be labelled simulated. If PGTech or any named party is to appear, that needs their consent first, as with the advisory board — and the addendum itself calls the PGTech signal untested (§17).
2. **What the barter route is called.** §12 forbids "loan", "credit" and "currency" unless the legal structure supports it. Proposed EN/PT: "productive exchange within a network / troca produtiva em rede", never in the same visual family as the credit routes.
3. **Does the residual gap auto-route to global capital, or does an operator do it?** The demo reads better with a button. Auto-routing also edges closer to "offer", which §12 warns about.
4. **Whether `/app/capital/network` is operator-only or also admin.** Today `/app/capital` is open to sponsor, capital_provider, partner, admin and auditor. Editing capital policy should be narrower.

---

## 7 · What this plan does not build, and says so

- Automated underwriting, approval or any promise of credit. Every route card carries "Partner approval required" (§16.8).
- Partner-facing referral view beyond what `/app/partner` already does (addendum P1).
- Automatic billing of partner fees; `commercial_model` is metadata only.
- Live FX, custody, secondary market.
- Any change to how a loan, an investment, a settlement or a tokenized position works.

---

## 8 · Legal review — questions this raises

To be added to `docs/LEGAL_REVIEW.md` before the network is shown to anyone outside:

1. Does presenting a ranked list of third-party credit products to a qualified business constitute *correspondente bancário* activity, intermediation, or neither, under the current structure?
2. What wording keeps a barter/internal-network route outside the definition of credit, foreign exchange and payment arrangement?
3. May a sponsored-capital route linked to a program be shown beside credit routes without the program becoming a party to a credit offer?
4. What must a route card say so that a recommendation is not an offer — and is "Partner approval required" enough?
5. Do the `commercial_model` fields, even as metadata, need per-partner validation before being stored at all?

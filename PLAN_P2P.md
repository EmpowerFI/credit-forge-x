# EmpowerFI — P2P North Star: gap analysis and P0 plan

**Source:** *EmpowerFI Hackathon Dashboards — P2P North Star, adjustment specification v2* (founder, 16 Sep 2026). It supersedes the four-route Capital Route Optimizer.
**Window:** feature freeze Thu 8 Oct, as in `PLAN_REDESIGN.md`. Work happens on `hackathon`; `main` only after the founder approves.
**Status, 16 Sep:** gap analysis done, decisions D1–D2 taken (§5); P0 in progress.

---

## 1 · Where the product stands

What already matches the spec, and stays:

- **The lifecycle.** Community → readiness → eligibility → qualified opportunity → funding → loan → servicing → repayment → productive outcome. Each step is proven on Solana devnet, with no PII on chain (`scan-chain-pii`, privacy tests).
- **Global investing.** Wallet sign-in, network, SOL and test USDC, a real transfer into the program vault, the allocation proven on chain. Shielded ZEC is a second way to pay, credited to the vault as USDC.
- **The borrower stays BRL/Pix-facing.** She asks and repays in reais. Pix both ways is a labelled mock.
- **Settlement.** Real devnet releases and payouts, a simulated off-ramp, and a MoneyGram sandbox quote in the simulator.
- **Privacy.** A "what you see / what stays private" panel on Opportunity Detail. Consent enforced by scope. Verify on Solana on positions and the audit trail. Shared audit reports.

What conflicts with the spec:

1. **The partner is the lender of record everywhere.** The partner decides, lends and services, and "EmpowerFI never makes the lending decision" (decision R1, 14 Sep). It shows in the Partner Desk persona, `partner_decide`, `PARTNER_APPROVED`, the consent scope "share with a credit partner", and about 40 UI strings across the investor, community, entrepreneur, admin and audit screens. The spec wants an EmpowerFI-controlled P2P experience, with a regulated partner only as a bridge for a real pilot.
2. **Four routes, not two.** `packages/capital-route` prices `domestic_pix` (bank transfer → partner → Pix), `brl_stablecoin`, `usd_wire` and `usd_stablecoin`. The routes appear in `/app/capital` (`CapitalRoutes.tsx`) and on Settlement ("US dollars · bank wire", "BRL stablecoin · off-ramp").
3. **No funding pool and no allocation.** Every opportunity is funded the same way, in USDC into one vault. Nothing represents a domestic pool, global liquidity, mandate, risk appetite or coverage, and there are no reason codes for a funding choice.
4. **Community Intelligence counts people, not capital.** Its funnel ends at *Referred → Financed*. It has no "Qualified capital demand", eligible amount, funded amount, funding gap or coverage. The impact tab shows no financed R$ and no repayment.
5. **Regulatory wording.** No screen calls EmpowerFI a licensed SEP. The required prototype disclaimer appears nowhere, and the sidebar says "every figure here is simulated", which is wrong for the real devnet transfers.
6. **Privacy gaps.**
   - The privacy panel exists only on Opportunity Detail, and that screen has no Verify link.
   - Leaders see no investor data in the UI, but row-level security lets a leader read an opportunity's funding columns, the partner id, partner decisions and loan rates directly from the tables.

## 2 · Gap analysis by acceptance criterion

| # | Criterion (§15) | Today | Work |
|---|---|---|---|
| 1 | The main investor experience has only two funding routes | Four routes on Settlement and `/app/capital`; no route on opportunities | Two-pool engine; route on every opportunity, position and settlement view; remove the four-route comparison |
| 2 | Domestic P2P is not bank-correspondent origination | `domestic_pix` is "Bank transfer → partner → Pix"; the partner lends | Domestic P2P = Brazilian investors' simulated BRL pool → P2P structure → Pix; partner wording per decision D1 |
| 3 | Global capital justified by availability, mandate and economics | The public site says stablecoins beat wires cross-border; nothing in the app | Reason codes and "Why this pool?"; coverage figures show global capital expanding capacity for opportunities the domestic pool cannot take |
| 4 | The engine can select either pool | No engine | `packages/capital-allocation`, deterministic, with tests; the choice and codes persisted on each opportunity |
| 5 | Qualified demand and funding coverage visible | Not computed | Investor console hero (demand, domestic liquidity, global USDC, coverage) and the coverage bars from the mock-up; also in Community Intelligence |
| 6 | Global investor connects a wallet and uses test USDC on devnet | Done | Keep; show it only on Global opportunities |
| 7 | Borrower stays BRL/Pix-facing | Done | Show Maria her funding progress in reais |
| 8 | Mock off-ramp and Pix visibly labelled | Done on Settlement, Position and the partner loan page | Keep; add a Domestic P2P route view |
| 9 | Community dashboard generates qualified P2P demand | Funnel stops at Referred → Financed; head counts only | Funnel ends *Eligible → P2P opportunity → Funded*; hero "Qualified capital demand"; cohort eligible, funded, gap, domestic and global coverage; next actions for readiness, credit intent, eligibility and funding; impact joins financed capital to repayment and outcome |
| 10 | Privacy boundaries visible in the UI | One panel, on Opportunity Detail | "What you can see / What stays private", worded exactly, on Opportunities, Opportunity Detail and Position, with Verify on Solana wherever a commitment exists; close the leader row-level-security gaps |
| 11 | SEP described as future architecture, not current authorisation | Not described at all | The required prototype disclaimer in the app shell, login and README; SEP as future architecture in `sources.ts` and the investor pages |
| 12 | One end-to-end story in under three minutes | No script | `docs/DEMO.md` following §14, rehearsed on a clean seed |

## 3 · Design

### 3.1 The two pools

| | Domestic P2P | Global P2P |
|---|---|---|
| Capital | Brazilian investors, a **simulated BRL pool** | International and impact investors, **test USDC on Solana devnet** |
| Investing in the demo | "Simulate a BRL allocation", labelled SIMULATED, no wallet | Wallet → test USDC → sign → confirmed → position (ZEC as an alternative payment, converted to USDC) |
| To her business | BRL pool → P2P structure → Pix (mock) | USDC → vault → regulated off-ramp (simulated; MoneyGram sandbox quote) → Pix (mock) |
| FX / hedge | none | explicit simulated assumption |

A `funding_pools` table holds each pool's policy, seeded and marked simulated:
- available capital (BRL cents for domestic, micro-USDC for global);
- required return in basis points a year;
- eligible risk bands;
- ticket range;
- mandate: productive purposes, and an impact flag for women-led, community-verified businesses;
- global only: FX spread, hedge a year, ramp cost.

Liquidity is the policy's capital less what is committed to open opportunities.

### 3.2 The Capital Allocation Engine

- **Package:** `packages/capital-allocation`, a pure TypeScript function with a version string (`capital-allocation-v1.0.0`). It is mirrored in SQL and checked against shared test vectors, as readiness and eligibility already are, so the audit console can re-run it in the browser.
- **Input:** the opportunity (amount, term, instalment, affordability, risk band, purpose, readiness) and both pools' policies and remaining liquidity.
- **Decision 1 and 2, feasibility per pool:**
  - `RISK_BAND_NOT_ELIGIBLE` when the band is outside the pool's appetite;
  - `TICKET_OUTSIDE_POOL_POLICY` when the amount is outside the pool's ticket range;
  - `DOMESTIC_POOL_EXHAUSTED` when domestic liquidity is below the amount.
- **Decision 3, economics among feasible pools:**
  - Compare the borrower's all-in yearly rate: required return + expected loss + cost to serve, plus FX/hedge and ramp for global.
  - The cheaper pool wins, with ties going to domestic.
  - Codes: `DOMESTIC_LOWEST_COST`, `DOMESTIC_LIQUIDITY_AVAILABLE`, `GLOBAL_LOWER_REQUIRED_RETURN`, `GLOBAL_FX_COST_DOMINATES`, `GLOBAL_RAMP_COST_DOMINATES`, `GLOBAL_EXPANDS_CAPACITY`, `GLOBAL_IMPACT_MANDATE_MATCH`.
- **Output:**
  - the selected pool (or none, with the codes saying why);
  - borrower economics: rate a month and instalment;
  - investor economics: the expected simulated return;
  - reason codes;
  - funding-gap impact, meaning coverage before and after.
- **When it runs:** where funding opens today (`private.open_for_funding`), in order of opportunity creation, so each allocation draws down liquidity. The pool is fixed once funding starts; an opportunity is never moved while investors hold positions in it.
- **Coverage:**
  - domestic-only coverage = demand the domestic pool alone could fund ÷ qualified demand;
  - combined coverage = demand funded by domestic + global ÷ qualified demand.
  - Both come from the same engine run.

### 3.3 Data

- **`qualified_credit_opportunities` gains:**
  - `funding_pool` (enum `domestic` | `global`);
  - `allocation_reason_codes text[]`;
  - `allocation_model_version`;
  - `allocated_at`;
  - for domestic, `funding_target_cents` and `funded_cents`, in reais.
- **`investments` gains** `pool` and `amount_cents` for domestic positions. Domestic positions are always `simulated`. `record_investment` and `create_zcash_request` refuse wallet or ZEC money on a domestic opportunity.
- **Investor RPCs:** `investor_opportunities`, `investor_portfolio`, `investor_position`, `settlement_overview` and the desk RPC return the pool, the codes and the BRL amounts. A new `capital_overview()` returns qualified demand, liquidity per pool and coverage.
- **Community RPCs:** they return capital totals only, never per-investor data. Leaders lose direct table reads of funding columns, decisions and rates.
- **On chain:**
  - Nothing changes in the program, and no existing proof changes.
  - The opportunity commitment stays as it is: its hash covers the immutable request, not the pool.
  - The allocation decision is recorded with its model version and is reproducible in the browser.
  - Global positions stay proven as allocations on chain; domestic simulated positions are proven the same way and marked simulated.
- **Seed:** calibrated so the demo state is close to the spec's example. That means about R$ 126k of qualified demand, a domestic pool covering about 38%, a global pool of about 18k test USDC and about 96% combined coverage. Some opportunities must land in each pool, with each reason code shown at least once.

### 3.4 Screens

- **Investor console**
  - **Overview:** hero tiles for Qualified demand, Domestic liquidity, Global liquidity (USDC) and Funding coverage, plus the two coverage bars from the mock-up. The wallet card stays for global.
  - **Opportunities:** a route column and filter (Domestic / Pix, Global / USDC), status (open, partial, funded), and the routing principle note.
  - **Opportunity Detail:**
    - the decision snapshot: purpose, amount, term, readiness, risk band, affordability, reason codes;
    - Funding Route and "Why this pool?" covering availability, economics and mandate;
    - the invest flow for the route: wallet and USDC for global, or a SIMULATED BRL allocation for domestic;
    - "What you can see / What stays private" and Verify on Solana.
  - **Portfolio and Position:** principal, route, term, risk band, expected simulated return, repayments and Verify. "Where the money went" follows the route.
  - **Settlement:** the two routes side by side, with the four-route comparison removed. The simulator prices the global route's off-ramp (MoneyGram sandbox or assumptions) against the domestic route's zero FX.
- **Capital Allocation Engine** (replaces `/app/capital` and `CapitalRoutes.tsx`)
  - Inputs 1–3: demand, domestic pool, global pool, all editable.
  - Decisions 1–3 as steps.
  - Output: the selected pool, borrower and investor economics, reason codes and funding-gap impact.
  - A "replay the portfolio" view recomputes coverage from the live opportunities.
- **Community Intelligence**
  - The funnel ends *Eligible → P2P opportunity → Funded*.
  - Overview hero "Qualified capital demand".
  - Cohorts show eligible amount, funded amount, funding gap, and domestic and global coverage.
  - Participant next action covers education, check-in, readiness, credit intent, eligibility and funding.
  - Impact joins financed capital to repayments and productive outcomes.
  - No investor wallet or capital-provider details.
- **Maria's app:** "Your request is open to investors — R$ x of R$ y", in reais.
- **Everywhere:**
  - The required disclaimer — *"Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet."* — goes in the app shell, the login page and the README.
  - The regulated partner is mentioned only as a bridge for a real pilot.

## 4 · P0, in increments

Each increment ends with the checks green: tsc, Vitest, Deno, pgTAP and the build, with lint at baseline.

1. **Engine:** `packages/capital-allocation`, its SQL mirror and shared vectors; `capital-route` reduced to the two routes.
2. **Data:** migration (pools, opportunity and investment columns, allocation on open, domestic BRL allocation, capital overview, leader row-level-security tightening), pgTAP, calibrated seed.
3. **Investor console:** hero and coverage, route on opportunities, detail with "Why this pool?", domestic simulated allocation, positions, privacy panels and Verify.
4. **Engine page and Settlement:** the Capital Allocation Engine replaces `/app/capital`; Settlement shows two routes.
5. **Community Intelligence:** the demand funnel, cohort capital metrics, next actions, impact.
6. **Wording:** the disclaimer, the EmpowerFI P2P desk (D1), and a pass over every flagged string (about 40 in the app, plus README and docs; on the public site only the disclaimer and direct contradictions, per D2).
7. **Proof:** `docs/DEMO.md` (the 12 steps of §14, under three minutes), a clean reseed on the hackathon environment (about 1 devnet SOL), a live run of both routes, screens at 1440 and 390 px, then the founder's E2E test.

## 5 · Decisions (founder, 16 Sep)

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | Who approves, formalises and services a loan? | **An EmpowerFI P2P desk** | Supersedes R1. The Partner Desk persona becomes EmpowerFI's P2P operations. There is no separate partner approval: a funded opportunity is formalised at the rate the allocation engine set, and EmpowerFI services it. A regulated partner is mentioned only as a bridge for a real-world pilot. The database role `partner` stays internally; the labels change. |
| D2 | Rewrite the public site now? | **App and docs now** | P0 covers the app, README and docs. On the site: only the prototype disclaimer and fixes to direct contradictions. The positioning rewrite comes later as a draft for the founder. |

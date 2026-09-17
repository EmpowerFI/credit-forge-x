# The Credit Engine page as a live decision engine — gap analysis and plan

**Source:** founder's redesign brief, 16 Sep 2026 ("redesign and refactor the existing EmpowerFI Credit Engine / Capital Allocation Engine page").
**Work:** on `hackathon`; `main`, the hackathon database and a reseed only after the founder approves.
**Status, 16 Sep:** live. Migration pushed and the hackathon environment reseeded with the founder's approval; merged to `main`. On the hackathon data the cases are Q-E6E089 (A), Q-61FCC2 (B) and Q-3BDC81 (C); codes change with every reseed.

> - **Built:**
>   - the engine's per-check trace (`poolChecks`);
>   - `engine_opportunities()`, with pgTAP for roles, codes and privacy;
>   - the page as a live decision engine: selector, snapshot, Engine 1 pipeline, Engine 2 branches, economics, decision, capital path with real and simulated hops, liquidity drawdown, Verify on Solana, animated replay, assumptions drawer, states, skip and reduced motion, EN and PT, desktop canvas and stacked mobile.
> - **Demo cases, from seeded data (local):**
>   - **A:** 6-month stock and materials, R$ 2,200, domestic by lowest cost, 25% against 26%.
>   - **B:** R$ 6,700 stock and materials, above domestic's ticket, global expands capacity.
>   - **C:** R$ 4,800 workspace renovation, above domestic's ticket and outside global's mandate, waiting for capital.
> - **Seed change for C:**
>   - The business most able to carry a loan asks R$ 4,800 to improve her workspace.
>   - Since no pool can fund it, combined coverage settles at 89.14% (was 96.52%); domestic alone 39.36%.
> - **Checks:** Vitest 140, pgTAP 432, build, lint with no new problems, every case at 1440 and 390 px with no overflow or console errors.

## 1 · What exists today

| Piece | Where | Runs |
|---|---|---|
| The page | `src/app/pages/capital/AllocationEngine.tsx` (`/app/capital`, for investors, the desk, admins and auditors) | Browser |
| Pools hero: qualified demand, domestic and global liquidity, coverage | `pages/investor/CapitalPools.tsx`, reading `capital_overview()` | Database, read in the browser |
| Capital Allocation Engine | `packages/capital-allocation` (`allocate`, `allocatePortfolio`) and the same rules in SQL (`private.allocate_funding`), held to one set of vectors | Both. The database allocates each opportunity when it opens to investors (`private.open_for_funding`) and keeps the pool, the reason codes and the whole result on the opportunity (`funding_pool`, `allocation`, `allocation_reason_codes`). |
| Pool state | `funding_pools` (policy, capital); `private.pool_book` (lent, claimed). `capital_overview()` gives each pool's liquidity (capital less what is lent), its policy, the queue of demand not yet lent, and coverage replayed in SQL. | Database |
| Portfolio replay | `allocatePortfolio` over `capital_overview().demand`, checked against the database's coverage | Browser |
| Credit engine: readiness and eligibility | `packages/readiness-engine`, `packages/eligibility-engine`, run by Edge Functions; results in `readiness_assessments` (score, band, features) and `eligibility_assessments` (decision, affordability, risk, confidence, reasons) | Server. The browser only re-runs them on the audit screen, with audit access. |
| Credit snapshot per opportunity | `investor_opportunities()`: readiness score and band, months reported, records kept, eligibility decision, affordability, risk, confidence, community, proofs (readiness, eligibility, opportunity and consent commitments with signatures) | Database, for investors and overseers |
| Solana | Readiness and eligibility attestations and the opportunity commitment, anchored and verifiable (`VerifyOnSolana`) | Devnet |

## 2 · Gaps against the brief

1. **Opportunities are typed, not selected.** "Input 1" is a form. Nothing lets you pick a stored qualified opportunity.
2. **Credit and capital look like one step.** The page shows only allocation. Readiness and eligibility, the first engine, never appear.
3. **Not every opportunity can be selected.** `investor_opportunities()` shows only opportunities open to investors, so the ones waiting for capital (the most instructive cases) are missing, and the desk cannot call it at all. **Needed:** an `engine_opportunities()` read, pseudonymous and consent-bound, for every role that sees the page: the queue of qualified demand with its credit snapshot and proofs. For the desk it uses the desk's own codes.
4. **Checks are summed, not shown.** `allocate()` returns only the failed checks (`blocks`). A per-check trace (liquidity, ticket, risk appetite, mandate, with the values compared) has to come from the engine itself, not be re-derived in the page. **Needed:** the engine explains each check, and `assess` builds its blocks from that explanation, so the two cannot drift.
5. **Results are static.** Everything shows at once, and there is no run, no sequence, no skip and no reduced motion.
6. **The assumptions crowd the page.** Inputs 2 and 3 stay open all the time.
7. **The replay is a static table.** It has no sequence, and no liquidity drawing down.
8. **No capital path or consumption view.** Nothing shows where the money goes, which steps are real on devnet and which are simulated, or what a pool has left after the decision.
9. **The allocation is not on chain.** The chain holds the credit decision (readiness and eligibility attestations, the opportunity commitment). The pool choice is recorded in the database with its model version. "Verify on Solana" can show the credit side's commitments and say plainly that the route is a database record. Committing the allocation on chain needs a program change and is out of scope.
10. **Demo cases:**
    - **Domestic wins on economics (A):** exists today. Q-7ABFD2 is 6 months, so the ramp makes global dearer.
    - **Global unlocks a ticket domestic cannot take (B):** exists (Q-E6D46F, R$ 6,700), but it is waiting at listing and invisible to investors (gap 3).
    - **Neither pool can take it (C):** no opportunity produces this against today's liquidity. It needs a seed change and a reseed of the hackathon environment, which needs the founder's approval.

## 3 · Design decisions

- **What a run means:**
  - **Engine 1 (credit):** shows the recorded readiness and eligibility, which are the real results, proven on Solana.
  - **Engine 2 (allocation):** runs `allocate()` in the browser, against today's liquidity as the KPIs show it and with the assumptions in the drawer.
  - **Stopping on credit:** a run stops after Engine 1 if eligibility did not qualify the request.
- **Nothing is written:**
  - The database allocates when an opportunity opens to investors, so a run is analysis only and can never create or duplicate an allocation.
  - **Liquidity drawdown:** before → after is shown as what this decision would draw.
  - **Allocated state:** "Recorded at listing" shows the stored pool beside it.
  - **Confirming an allocation:** there is no button, because the database already does it at listing.
- **Replay:** `allocatePortfolio` over the queue in order, animated, with coverage checked against the database's.
- **States:** IDLE, OPPORTUNITY_SELECTED, RUNNING_CREDIT_ENGINE, CREDIT_REJECTED, RUNNING_CAPITAL_ALLOCATION, DOMESTIC_SELECTED / GLOBAL_SELECTED / WAITING_FOR_CAPITAL, ALLOCATED (recorded at listing), ERROR (technical only).
- **Motion:** about 5 s, skippable, instant with `prefers-reduced-motion`, and still once the decision is shown.

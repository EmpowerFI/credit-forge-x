# Demo script: one economic loop

This script follows one story end to end: a sponsor's evidence, credit intelligence, a qualified opportunity, capital, repayment and outcome, then back to the sponsor. It runs on the hackathon environment at `www.empowerfi.io/app`, and every demo account uses the password `EmpowerFI-demo-2026`.

The bar at the top of the app numbers the three stories: 1 Impact Intelligence, 2 Credit & Capital Engine, 3 Investor Console. Operations sit beside them. On the right, **View platform as** switches between the five views (sponsor, investor or impact fund, operator, community, entrepreneur): each opens a page with that view's value and tools. A demo account switches to the right demo persona in one click, so a judge never has to sign out.

> Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.

| # | Time | Story · account | Do | Say |
|---|---|---|---|---|
| 1 | 0:00 | 1 · `sponsor@demo.empowerfi.io` | On the login page, **View platform as: Program Sponsor / ESG** → **Enter as demo · Helena Prado**. | "A foundation funds a program that four communities run. What did it buy, and can it verify it?" |
| 2 | 0:15 | Sponsor | Read the header and hero: funding deployed, reached, reporting, credit ready, capital requested and mobilised, repayment, outcome coverage. Then the funnel from **Sponsored** to **Performing**, and **Segments** ("groups under 5 hidden"). | "Program execution becomes evidence, and the same data qualifies credit. Aggregates only: no name, no figure she reported." |
| 3 | 0:40 | Sponsor | **Drill into an opportunity** → **Run the engine** on a code. | "Each business appears by a pseudonymous code, and only if she consented to be shown to investors." |
| 4 | 0:50 | 2 · Sponsor | The opportunity comes selected → **RUN CREDIT ENGINE**: business data, preparation, readiness, affordability, risk, eligibility. | "Engine 1 asks whether this business should become a qualified credit opportunity." |
| 5 | 1:05 | Sponsor | It stops at **Qualified credit opportunity**. | "Qualified first. No pool is asked about a request that did not qualify." |
| 6 | 1:10 | Sponsor | **RUN CAPITAL ALLOCATION**: liquidity, ticket, risk appetite and mandate in both pools, then economics among the feasible ones. | "Engine 2 asks which pool can fund it sustainably." |
| 7 | 1:25 | Sponsor | The route: **Domestic / Pix**, **Global / USDC**, or **Waiting for capital**. Run the three seeded cases: a 6-month stock request (domestic costs her less), R$ 6,700 (above the domestic ticket, so global unlocks it) and a R$ 4,800 workspace renovation (no pool can fund it). | "Global capital earns its place by availability and mandate, not by being on a blockchain. Waiting for capital is a decision, not an error." |
| 8 | 1:45 | 3 · `investor@demo.empowerfi.io` | Click **3 Investor Console** in the bar; it enters as the demo investor. The overview shows the **impact fund's mandate**. | "An impact fund is an investor with a mandate: verified communities, three purposes, grades A–B, R$ 1,000 to R$ 6,000." |
| 9 | 2:00 | Investor | *Opportunities*: **Fits your mandate** by default. Each card shows affordability and proof status. **Global**: **Connect your wallet to invest** on the opportunity itself — the picker and the signature open there, and the demo session becomes your address without leaving the page → invest test USDC → sign → confirmed. **Domestic**: *Simulate a BRL allocation*. | "Global capital moves as real devnet USDC. The domestic pool is simulated reais." |
| 10 | 2:25 | Operations · P2P desk | **Operations → P2P desk** (enters as the desk) → *Pipeline* → a funded opportunity → **Formalise and disburse**. On the loan, the capital path marks each step real, simulated or mock. | "USDC to a regulated off-ramp, then Pix to her business. Here, the off-ramp and Pix are labelled simulations." |
| 11 | 2:45 | Desk | *Loan* → **Start repayment** → **Record instalment 1**. | "She repays in reais, by Pix; investors' shares go back to them." |
| 12 | 2:55 | Desk | *Portfolio* → **Ready to measure** → the loan → how she used the capital → **Measure productive outcome**. | "Sales before and after, from the months she reports anyway. An observation, not a claim that the loan caused it." |
| 13 | 3:10 | 1 · Sponsor | **1 Impact Intelligence** in the bar. Outcome coverage goes up by one, and repayment and outcomes update. | "The outcome returns to the sponsor as evidence." |
| 14 | 3:20 | Sponsor | **Evidence on Solana** → a proof → **Verify** opens the proof drawer → **Verify on Solana**. Or **Generate auditable report**. | "Every commitment is checked from this browser against Solana devnet. Evidence without financial surveillance." |

**Optional, after step 7 (40 s):** **Operating economics** on the engine page. "Can productive credit become cheaper to operate without becoming weaker credit? We don't claim the answer. We measure it: cost to serve beside eligibility discipline, time to decision beside affordability checks, follow-up, and portfolio quality. The rates are pilot assumptions and the data is simulated."

**Optional prelude:** `maria@demo.empowerfi.io` submits her September check-in and asks for capital, and it becomes a qualified opportunity (Operations → My business).

## Before recording

- **Choose the language.** From the English site (or with the EN | PT switch) the app reads in English; from `empowerfi.io/pt`, in Portuguese. The demo data is the same in both.
- **Reseed the hackathon environment:** run `seed-demo-accounts.mts`, then `seed-demo.mts --yes`. It uses about 1 devnet SOL.
  - The seed prints the capital figures, the program and the loan it leaves unmeasured for step 12.
  - Proofs take about half an hour to confirm on devnet after a reseed.
- **Case codes** (Q-…) change with every reseed. The engine's picker searches by code, purpose and amount.
- **Wallet:** have a devnet wallet with test SOL and USDC ready for step 9. The invest panel links to the faucets.

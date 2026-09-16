# Demo script — the P2P North Star, in under three minutes

One story, end to end, on the hackathon environment (`www.empowerfi.io/app`, password `EmpowerFI-demo-2026` for every demo account). Timings are targets; the whole run fits in three minutes.

> Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.

| # | Time | Who | Do | Say |
|---|---|---|---|---|
| 1 | 0:00 | `maria@demo.empowerfi.io` | *Monthly check-in* → submit September | "Maria reports her month. Her figures stay private; only a commitment goes to Solana." |
| 2 | 0:15 | Maria | *My business*: readiness turns **Credit ready**; ask for capital (e.g. R$ 3,000 for inventory) | "Readiness, then her own request. Being ready and not asking is a complete outcome." |
| 3 | 0:30 | Maria | Eligibility runs: **Your request is open to investors — R$ 0 of R$ 3,000** | "Eligibility sizes what the business can carry, and the request becomes a qualified P2P opportunity." |
| 4 | 0:40 | `investor@demo.empowerfi.io` | *Overview*: Qualified demand, Domestic liquidity, Global liquidity, Funding coverage, the two coverage bars | "Which pool of capital can fund this sustainably? Domestic P2P alone covers part of the demand; with global capital, most of it." |
| 5 | 0:55 | Investor | *Credit engine*: select a qualified opportunity → **Run credit engine**. Three cases in the demo data: a 6-month stock request (both pools can fund it, domestic costs her less), a R$ 6,700 request (above the domestic ticket: global unlocks it), a R$ 4,800 workspace renovation (neither pool: waiting for capital). Then **Replay today's allocation** | "Engine 1 asks whether the business is credit-ready. Engine 2 asks which pool can fund it: feasibility first, then her all-in cost. Global capital earns its place by capacity, not by being on a blockchain." |
| 6 | 1:15 | Investor | *Opportunities* → Maria's (route pill) → **Funding route · Why this pool?** and **Privacy boundaries** | "The investor sees the decision snapshot, never who she is." |
| 7 | 1:30 | Investor | **Global**: connect wallet → invest test USDC → sign → confirmed → position. **Domestic**: *Simulate a BRL allocation* (labelled Simulated) | "Global capital moves as real devnet USDC; the domestic pool is simulated reais." |
| 8 | 1:50 | Investor | *Portfolio* → the new position: route, term, risk band, expected simulated return | |
| 9 | 2:00 | `partner@demo.empowerfi.io` | *Pipeline* → a funded opportunity → **Formalise and disburse** | "EmpowerFI's P2P desk formalises at the engine's rate. Her Pix payout is a labelled mock." |
| 10 | 2:15 | Desk | *Loan* → **Start repayment** → **Record instalment 1** | "She repays in reais, by Pix; investors' shares go back to them." |
| 11 | 2:30 | `leader@demo.empowerfi.io` | *Overview*: Qualified capital demand, Funded, Funding gap, Coverage; *Impact*: financed → repaid → outcomes | "The community produces qualified demand, and sees capital as totals, never investors." |
| 12 | 2:45 | Investor or auditor | Opportunity → **Verify on Solana**, or any proof → *Verify* | "Every commitment checked from this browser against Solana devnet." |

## Before recording

- Choose the language. Opened from the English site (or with the EN | PT switch), the whole app and every account read in English; from `empowerfi.io/pt`, in Portuguese. The demo data (names, businesses, communities) is the same in both.

- Reseed the hackathon environment (`seed-demo-accounts.mts`, then `seed-demo.mts --yes`; about 1 devnet SOL). The seed prints the capital figures: demand, each pool's liquidity and coverage.
- Maria's September check-in is left for the demo; so is one funded opportunity waiting on the desk.
- A wallet on devnet with test SOL and USDC for step 7 (faucets on the invest panel).

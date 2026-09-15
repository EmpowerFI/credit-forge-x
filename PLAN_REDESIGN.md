# EmpowerFI — `/app` redesign plan

**Source:** *EmpowerFI Hackathon Product Experience & Dashboard Redesign v1* (founder brief, 14 Sep 2026, 18 pages, 7 mockups).
**North star:** corporate credibility outside; financial-product depth inside.
**Window:** now → **feature freeze Thu 8 Oct**. The current `/app` stays live in production until the redesign is ready; all work happens on `hackathon` and reaches `main` only when a phase is finished and verified.

## 1 · Decisions (founder, 14 Sep)

| # | Question | Decision | Consequence |
|---|---|---|---|
| R1 | When does an investor put capital in? | **Right after eligibility** | Eligibility → opportunity **OPEN** for funding → **FUNDED** → the partner, as lender of record, formalises and disburses. If the partner declines, investors are refunded. EmpowerFI still never takes the final credit decision. |
| R2 | Names in the investor's view? | **No names** | Cards show purpose, sector, verified community and a code. What the investor sees and what stays private are both shown explicitly. |
| R3 | Wallet login? | **Real wallet + demo mode** | Phantom, Solflare or Backpack on devnet is the main path. "Explore without a wallet" opens the same console as the demo investor, read-only. |
| R4 | Privacy of USDC flows | **Common vault + optional Cloak** | Circle devnet USDC goes into one program-owned vault. Allocation to an opportunity lives in the database and is proven by a commitment, so the chain never links an amount to a borrower. "Invest privately (Cloak)" is optional and uses Cloak's shielded pool and Mock USDC, after a half-day spike. If Cloak's devnet relay is down, the demo ships without that mode. |

## 2 · Principles carried over

- The thesis doesn't change. Readiness ≠ eligibility ≠ lender formalisation. Ready without asking is a complete outcome. Only participants who are ready and asked reach eligibility, and so only they reach investors.
- No PII or borrower amounts on chain. The investor's own deposit is public on Solana, as every token transfer is. Which opportunity it funds is not.
- Every demo figure is labelled simulated or devnet, and no return is presented as a promise.
- Blockchain is not assumed cheaper. The route breakdown comes from `packages/capital-route`.

## 3 · Visual system

| Surface | Look |
|---|---|
| Corporate (unchanged pages) | cream/white ground, navy type, gold accents, narrative |
| Product (`/app`) | dark navy ground, navy-2 cards, subtle borders, **gold for the primary action**, green only for verified/positive, red for alerts, blue for neutral financial data |

- **Shared chrome:** the same logo, header rhythm and spacing on both surfaces, so moving between them never feels like changing company. The corporate header gets **Launch App** (goes to `/app/investor` and asks for a wallet) and **Communities** (goes to the conventional login).
- **Components:** stat tiles, dense tables, status pills, tooltips, skeleton loading, toasts, a transaction progress stepper, a network badge, a wallet chip with balances, and an explorer link on every proof.
- **Numbers:** compact typography with large figures; monospace only for hashes and addresses.
- **Data legend** (used everywhere): 🔒 private · ✦ derived intelligence · ✓ proven on Solana.
- **Avoid:** purple and neon gradients. The density of Kamino is the reference; its layout and language are not.

## 4 · Information architecture

| Persona | Navigation | Auth | Depth for the hackathon |
|---|---|---|---|
| Investor | Overview · Opportunities · Portfolio · Payments · Audit trail | Wallet (plus demo mode) | **Strongest** |
| Community | Overview · Cohorts · Participants · Readiness · Credit pipeline · Impact | Email | **Strongest** |
| Auditor / Admin | Attestations · Events · Models · Consents · System | Email | **Strong** (verify-on-Solana everywhere) |
| Credit partner | Pipeline · Reviews · Decisions · Portfolio · Servicing | Email | Restyle + funding states |
| Entrepreneur | My business · Check-in · Consent | Email | Restyle + consent screen |

## 5 · Phases

### Phase 0 — Visual system and shell (≈2 days)
- Dark product theme as tokens (not per-component colours); product components (stat tile, table, status pill, skeleton, tx stepper, network badge, data legend).
- Persona shell: top bar with the shared logo, sidebar by persona, mobile drawer.
- Corporate header: Launch App and Communities entries.
- Existing pages move into the new shell unchanged in behaviour.

### Phase 1 — Investor console, wallet-first (≈6 days) · P0

> **Status, 15 Sep:** built on `hackathon`, awaiting the founder's review. Everything below is in, with two design changes:
> - `refund` and `release` became one operator-signed `vault_transfer`. It also serves Phase 4's `pay_out`. The reason is kept in the database, and the instruction takes no borrower account. It's the program's one amount, reviewed in the privacy test.
> - Refunds are live: `vault-refund`, driven by pg_cron, is signed before sending and never sends twice. Release and pay-out wiring comes in Phase 4.
>
> Verified: Sign in with Solana on the hackathon project (a new wallet becomes a capital provider), and every console screen in demo mode at 1440 and 390 px. **Still open:** one real devnet-USDC investment and refund end to end, waiting on faucet USDC.
- **Wallet:** wallet-standard connection (`@wallet-standard/react`, `@solana/react` on the existing `@solana/kit`); devnet badge; abbreviated address; SOL and USDC balances; "Get test SOL" (Solana faucet) and "Get test USDC" (Circle faucet), with a balance refresh on return.
- **Auth:** Sign in with Solana (Supabase Web3 auth). A new wallet becomes a `capital_provider` profile. Demo mode signs in as `investor@demo`, read-only.
- **Program:**
  - a USDC vault owned by a program PDA (`init_vault`);
  - an `AllocationCommitment` keyed by a random allocation ref, so it is unlinkable to the investor or the borrower;
  - `refund` and `release` instructions (operator-signed) for declined opportunities and partner disbursement.
  - Also LiteSVM tests, an upgrade in place, and privacy-test and scan updates.
- **Data:**
  - `opportunities` gain `funding_status` (OPEN, PARTIALLY_FUNDED, FUNDED, CLOSED, REFUNDED) and a USDC target at a labelled demo FX quote;
  - an `investments` table (wallet, opportunity, amount, deposit signature, mode, status);
  - an `investment-confirm` Edge Function that reads the deposit transaction from chain, checks mint, vault, sender and amount, records the allocation and queues its commitment.
- **Screens:**
  - **Overview:** portfolio value, deployed, available USDC, expected return (demo), allocation by risk band, activity feed.
  - **Opportunities:** a marketplace with filters (risk, purpose, term, amount, community) and states.
  - **Opportunity detail:** the underwriting snapshot, "what you see / what stays private", verifiable evidence, and the invest panel (connect → check USDC → faucet → sign → confirm → explorer link).
  - **Portfolio:** positions, position detail (deposit signature, opportunity commitment, schedule, repayments, outcome).
  - **Audit trail:** every proof behind the investor's positions.
- **Seed:** open opportunities for funding, plus demo positions for the demo investor (recorded, marked simulated).

### Phase 2 — Community Intelligence, rebuilt (≈4 days) · P0
- **Overview:** hero metrics (participants, education complete, credit ready, credit intent, eligible, financed); the funnel Joined → Education → Data sufficient → Credit ready → Credit intent → Eligible → Funded/Referred → Financed; cohort health (check-in completion, data quality, time to readiness, need a human follow-up, alerts).
- **Action queue:** who is missing a check-in, has unfinished education, needs review, or is ready with a capital need. Each action is recorded as an outreach event and counted in cost to serve.
- **Participants:** a table and a drill-down journey timeline (onboarding, education, check-ins, readiness evaluations, intent, eligibility), readiness state with missing requirements and reasons, data quality and regularity, next best action, consent status.
- **Cohorts** (by intake month): conversion by cohort, time-to-readiness distribution, reasons for not-ready and for manual review, credit need by purpose, operations, outcomes.
- **Tabs:** Overview, Cohorts, Participants, Readiness, Credit pipeline, Impact.

### Phase 3 — Privacy as product (≈3 days) · P0
- **Consent screen** for the entrepreneur: what may be used for readiness, shared with the partner, shown to investors (as an anonymised opportunity) and aggregated for impact. Stored in `consents` and enforced: no investor listing without consent.
- **Opportunity:** the "what the investor can see / what stays private" panel, using the data legend.
- **Audit console:** attestations, events, models (versions and vectors), consents, system (queue, reconciliation). Each proof shows timestamp, model and schema version, commitment, transaction and verification state, with Verify on Solana one click away.

### Phase 4 — Payments and settlement (≈3 days) · P1
- **Route:** Investor wallet → vault (program) → regulated ramp partner → local rail (Pix), with each step's state.
- **Payment simulator:** a USDC input, an FX/ramp quote, the estimated BRL output, a route breakdown from `packages/capital-route`, and a "mock settlement" for the Pix leg.
- **"What is real in this demo":** devnet SOL and USDC, wallet signing and vault transactions are real; the ramp quote is a sandbox if credentials exist; the Pix payout is a mock.
- **Repayments:** simulated back to investors from the vault (operator-signed `pay_out`), with explorer links.
- **Cloak private mode:** the spike first, then the feature if the relay works.
- **Optional:** a MoneyGram ramps sandbox, only if credentials are provided.

### Phase 5 — Partner and auditor depth, polish (≈3 days)
- Partner: funding states, formalise or decline (with a refund), servicing.
- Export: a shareable audit report.
- Responsive pass at 390 px, loading, error and success states everywhere, and a full demo run on a clean seed.

## 6 · Definition of done (from the brief)

- [ ] Within 5 seconds a visitor can tell whether they're on the corporate site or in a financial workspace, without thinking they changed company.
- [ ] An investor connects a wallet, gets test USDC, opens an opportunity, invests, sees the confirmation and finds the position in the portfolio.
- [ ] A community leader sees where participants are stuck and who is ready for the next action.
- [ ] Any judge can open an opportunity and understand what is private, what was derived and what was proven on chain.
- [ ] No important screen looks like a landing page: each has state, data, interaction, loading, error and success states, and a drill-down.
- [ ] Every demo or simulated figure is labelled as such; no return or approval is presented as production reality.

**Demo narrative:** the community creates readiness → the opportunity becomes investable → a wallet funds it with devnet USDC → the operation is tracked → the privacy-preserving evidence is verified on Solana.

## 7 · Out of scope (P2)

Real Pix, real borrower payouts, production P2P, mainnet funds, real investor returns, production KYC and FX.

## 8 · Needed from the founder

- MoneyGram (or other ramp) sandbox credentials, if the ramp sandbox is wanted (Phase 4, optional).
- Review at the end of each phase. `main` is updated only after a phase is approved.

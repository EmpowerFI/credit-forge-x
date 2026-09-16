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
| R4 | Privacy of USDC flows | **Common vault + optional Cloak** | Circle devnet USDC goes into one program-owned vault. Allocation to an opportunity lives in the database and is proven by a commitment, so the chain never links an amount to a borrower. "Invest privately (Cloak)" is optional and uses Cloak's shielded pool and Mock USDC, after a half-day spike. If Cloak's devnet relay is down, the demo ships without that mode. **Superseded by R5 (15 Sep): Zcash replaces Cloak.** |
| R5 | Private investing, and the Zcash track (15 Sep) | **Shielded ZEC replaces Cloak** | EmpowerFI competes in both the Solana and the Zcash tracks of the Crypto World's Fair. The founder's submission form names both. "Invest with shielded ZEC" is a real payment on Zcash testnet: a ZIP 321 request to EmpowerFI's shielded address, with the allocation reference in the encrypted memo. A viewing-key watcher records the allocation, and the allocation is still proven on Solana. The auditor receives the viewing key, so disclosure is selective. NEAR Intents, which converts ZEC to USDC on Solana in production, has no testnet. In the demo, the operator credits the vault with devnet USDC at a labelled quote. Cloak has no prize here, and its devnet mode uses Mock USDC. |

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
> Verified end to end on devnet, 15 Sep, with a test wallet and faucet USDC:
> - Sign in with Solana: a new wallet became a capital provider.
> - Two 5 USDC deposits became allocations. A repeated signature was recorded once, and each allocation proof confirmed on chain.
> - The partner declined one opportunity. Its 5 USDC came back from the vault by itself in under a minute ([tx](https://explorer.solana.com/tx/5WiVCLj8c2hKgnxC25qgDtMKtDZBgVQ9EBRKxnk5KYd5aPbM1SF1Mb4pSPNbUNnd3vzN3BVgAwc8vFFPUmDr8Bij?cluster=devnet)). The transfer names no borrower or opportunity account.
> - Every console screen in demo mode, at 1440 and 390 px.
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

> **Status, 15 Sep:** built on `hackathon`, awaiting the founder's review.
> - **Database:** one private function works out each participant's stage and next action. Four readers (overview, participants, one participant's journey, cohorts) and `record_outreach` sit on top of it, and each outreach becomes a cost-to-serve event.
> - **Screens:** Overview, Cohorts, Participants, Readiness, Credit pipeline and Impact, plus the participant journey. Every step in the journey carries its proof on Solana.
> - **Privacy:** no reported sales, costs or household amounts reach the leader. A pgTAP test checks this.
>
> Verified on the demo data: in Grajaú, 40 joined, 13 are credit ready and 3 are financed. A reminder logged from the queue moved it and added R$ 5,00 of community time to cost to serve.
>
> Changes from the brief: outreach is logged, not sent (no messaging channel or phone numbers are stored). Consent status moves to Phase 3 with the `consents` table.
>
> The seed now dates each eligibility after its request. The live demo keeps the old order until the next reseed.
- **Overview:** hero metrics (participants, education complete, credit ready, credit intent, eligible, financed); the funnel Joined → Education → Data sufficient → Credit ready → Credit intent → Eligible → Funded/Referred → Financed; cohort health (check-in completion, data quality, time to readiness, need a human follow-up, alerts).
- **Action queue:** who is missing a check-in, has unfinished education, needs review, or is ready with a capital need. Each action is recorded as an outreach event and counted in cost to serve.
- **Participants:** a table and a drill-down journey timeline (onboarding, education, check-ins, readiness evaluations, intent, eligibility), readiness state with missing requirements and reasons, data quality and regularity, next best action, consent status.
- **Cohorts** (by intake month): conversion by cohort, time-to-readiness distribution, reasons for not-ready and for manual review, credit need by purpose, operations, outcomes.
- **Tabs:** Overview, Cohorts, Participants, Readiness, Credit pipeline, Impact.

### Phase 3 — Privacy as product (≈3 days) · P0

> **Status, 15 Sep:** built on `hackathon`, awaiting the founder's review.
> - **Consent:**
>   - four uses of her data: assess, share with a partner, show to investors without her name, count in impact;
>   - she records it in the app, or her leader records it from the signed form;
>   - each change is a new record, proven on Solana (`anchor_consent`, program upgraded in place).
> - **Enforced in the database:**
>   - no assessment, request, referral or investor listing without the use that allows it;
>   - withdrawing investor consent unlists the opportunity and refunds its investors, unless the loan was disbursed, and the partner lends its own capital;
>   - impact totals count only consenting outcomes.
> - **Screens:**
>   - her Consent page, with what each change does before she saves;
>   - consent in the leader's participant list, journey and enrollment;
>   - "shown because she allowed it" on the investor's opportunity, with its proof.
> - **Audit console:**
>   - Attestations, Events, Models, Consents and System;
>   - participants by code;
>   - the latest decisions re-run in the browser;
>   - consent checked against what happened;
>   - the vault's balance on Solana compared with the database;
>   - the verify page gains consent proofs and each proof's time, schema and model.
>
> Verified on the live demo:
> - 100 backfilled consent records (marked simulated) were anchored and verify on chain.
> - The four enforcement checks read 0.
> - 24 of 24 recent decisions reproduce in the browser.
> - The vault holds 5.00 USDC, as the database accounts for.
> - Maria saved and reverted a change in the app (records #2 and #3).
>
> The seed now records consent at enrollment. Some participants stay out of impact figures, including one first-cycle borrower. Two requests are kept from investors, one of them in Grajaú. The next reseed replaces the backfill.
- **Consent screen** for the entrepreneur: what may be used for readiness, shared with the partner, shown to investors (as an anonymised opportunity) and aggregated for impact. Stored in `consents` and enforced: no investor listing without consent.
- **Opportunity:** the "what the investor can see / what stays private" panel, using the data legend.
- **Audit console:** attestations, events, models (versions and vectors), consents, system (queue, reconciliation). Each proof shows timestamp, model and schema version, commitment, transaction and verification state, with Verify on Solana one click away.

### Phase 4 — Payments and settlement (≈3 days) · P1
- **Route:** Investor wallet → vault (program) → regulated ramp partner → local rail (Pix), with each step's state.
- **Payment simulator:** a USDC input, an FX/ramp quote, the estimated BRL output, a route breakdown from `packages/capital-route`, and a "mock settlement" for the Pix leg.
- **"What is real in this demo":** devnet SOL and USDC, wallet signing and vault transactions are real; the ramp quote is a sandbox if credentials exist; the Pix payout is a mock.
- **Repayments:** simulated back to investors from the vault (operator-signed `pay_out`), with explorer links.
- **Invest with shielded ZEC (R5, in place of Cloak):**
  - a ZIP 321 payment request (QR and link) to EmpowerFI's shielded Zcash testnet address, with the allocation reference in the memo;
  - a small Rust watcher (librustzcash or zingolib against a testnet lightwalletd) holds the viewing key, detects the payment and records the allocation, which is proven on Solana as today;
  - the auditor console shows the treasury's received notes, read with the viewing key;
  - optionally, returns paid to a shielded address.
  - The watcher cannot run on Supabase Edge (Deno). A Vercel Rust function is the first choice.
  - This is the main technical risk, so a spike comes first.
- **Optional:** a MoneyGram ramps sandbox, only if credentials are provided.

> **Status (15 Sep): Invest with shielded ZEC is built and live on the hackathon environment.**
>
> - **Spike passed.** `services/zcash-watcher` is our own receive-only watcher, in Rust, on librustzcash's crates. It is stateless: it trial-decrypts compact blocks and fully decrypts the transactions that match, for memos. It reads Sapling, Orchard and Ironwood (NU6.3), and the testnet faucet already pays in Ironwood.
> - **Where it runs.** No Vercel Rust function after all: the root `Cargo.toml` is the Anchor workspace. The watcher is compiled to WebAssembly (622 KB) and runs inside a Supabase Edge Function, `zcash-watch`. Deno speaks HTTP/2 to `testnet.zec.rocks`, and pg_cron calls it every minute.
> - **The flow.**
>   - `zcash-request` returns a ZIP 321 request at CoinGecko's quote, with a random `EFI-` reference in the memo.
>   - After 2 confirmations the operator credits the vault with devnet USDC (the simulated NEAR Intents leg), never twice.
>   - `record_investment` then records a `zcash`-mode allocation, anchored on Solana.
> - **Screens.** The invest panel pays with Devnet USDC or Shielded ZEC: QR, wallet link, live steps, and no Solana wallet needed. Positions show the shielded payment. The audit console gains a Zcash treasury view: the viewing key, disclosed with import commands, and every note read.
> - **Verified live.** Two real testnet payments went from request to allocation proven on Solana in about 3–4 minutes, one of them paid from the UI's own ZIP 321 link. The vault holds 7.00 USDC on chain, matching the database (5 by wallet, 2 by ZEC).
> - **Tests.** pgTAP 317 (36 new), Vitest 98, Deno 43, watcher 4.
> - **Environment.**
>   - The treasury and test-investor wallets are zcash-devtool wallets in `~/empowerfi-hackathon-keys/zcash/`.
>   - The operator was given 10 devnet USDC from the test investor, to fund ZEC credits.
>   - The treasury was set with `scripts/platform/zcash-treasury.mts`.
>
> **Status (15 Sep): Settlement is built and live on the hackathon environment.**
>
> - **Derived from facts.** Settlement legs come by trigger from facts already recorded:
>   - on disbursement: a release of the loan's real deposits, and a mock Pix of the principal to her business;
>   - on each instalment: a mock Pix in, and a payout of each real investor's share, to their wallet (or held, for a ZEC position without one).
> - **Sending.** `vault-settle` (pg_cron, 15 s) sends them, never twice:
>   - all releases due at the same time go in one `vault_transfer` to the ramp, the operator on devnet;
>   - each payout transaction brings the shares into the vault and pays them out.
>   - The vault's expected balance nets out releases.
> - **Screens.**
>   - Investor → **Settlement**: the route with live figures; the payment simulator (quote, ramp spread, tax, rail cost by route from `packages/capital-route`, and a mock Pix settlement); "What is real in this demo"; vault transfers; your payouts.
>   - Position → **Where the money went**, leg by leg, plus a "Paid out" column in the schedule.
>   - The audit System view shows releases, payouts and the settlement queue.
> - **Verified live on Q-D07121.** The remainder was funded with a simulated position, then disbursed.
>   - 10 real USDC were released in one transfer (`3E3wMa…`).
>   - Instalment 1 paid the test wallet 0.565765 USDC (`ai8Axk…`, operator 15 → 14.434235, vault net 0).
>   - The two ZEC positions' shares are held.
>   - The vault reads 0.00 on chain = 0.00 expected.
> - **Tests.** pgTAP 342 (25 new), Vitest 100.
> - **Environment.** Historical disbursements and instalments got mock Pix legs by backfill (no real legs). Q-D07121 is now disbursed and active with one instalment: the reseed restores it.
> - **Phase 4 left:** nothing. Returns paid to a shielded address came with Phase 5.
>
> **MoneyGram sandbox (16 Sep): live on the hackathon environment.**
> - **What it is.** MoneyGram Ramps' sandbox (`playground.xramps.moneygram.com`), authenticated with its secret key as a Supabase function secret. `ramp-quote` prices a USDC cash-out on Solana to reais in Brazil for a signed-in user: fee, rate, what is received.
> - **Where it shows.** The payment simulator quotes with MoneyGram's sandbox by default, next to what the demo assumptions would give, and keeps the demo assumptions one click away. "What is real" labels it Sandbox · MoneyGram.
> - **Its limits, found on the sandbox.** Brazil is priced from $2 to $200 a transfer, as cash pickup only: no bank or Pix delivery, no cash-in. A loan's release is larger than that, so releases still convert at the demo quote and Pix stays a mock.
> - **Tests.** Deno 47 (4 new), Vitest 113 (3 new).

### Phase 5 — Partner and auditor depth, polish (≈3 days)
- Partner: funding states, formalise or decline (with a refund), servicing.
- Export: a shareable audit report.
- Responsive pass at 390 px, loading, error and success states everywhere, and a full demo run on a clean seed.

> **Status (15 Sep): built on `hackathon` and live on the hackathon environment.**
>
> - **Partner desk,** in five views, plus a page for each loan:
>   - **Pipeline:** every request's stage and the partner's next action.
>   - **Reviews:** the decision, with investors' funding beside EmpowerFI's assessment.
>   - **Decisions:** the record of every decision.
>   - **Portfolio:** the book, the risk mix, capital sources and outcomes.
>   - **Servicing:** formalise once funded, or decline with a refund; record instalments; overdue instalments; a 45-day calendar.
>   - **Each loan:** its terms, where the money went, the schedule with Pix ids and investors' shares, and every step's proof.
>   - It reads one function, `partner_desk()`.
> - **Decline at formalisation.** Cancelling an approved loan now needs a reason, closes the opportunity and refunds its investors. Before this, their capital stayed allocated to a loan that would never exist. Simulated positions are refunded at once.
> - **Shared audit reports.**
>   - Audit console → Reports re-runs the latest decisions, reads the vault on chain, freezes a snapshot with no personal data, looks up its proofs and transfers on Solana, and shares a link.
>   - `/app/report/:token` opens without an account. It re-runs the chain checks in the reader's browser, with retries when the public RPC rate-limits, and exports JSON or a print-ready PDF.
>   - Revoking a report closes its link.
> - **Returns in shielded ZEC.**
>   - A ZEC investor with no Solana wallet gives a shielded return address, with the payment request or later on the position.
>   - Instalment shares and refunds are then owed in ZEC. A refund's USDC goes back from the vault to the ramp first.
>   - `scripts/platform/zcash-returns.mts` sends them from the treasury on the operator's machine, where the spending key stays.
> - **Polish.** Every screen was checked for every persona, at 1440 and 390 px: no horizontal overflow and no console errors. A shared report was stuck loading for visitors without an account; the cause was the auth provider clearing the query cache on every session event, and it now clears only on sign-out.
> - **Verified live on a clean seed.**
>   - All 967 proofs, the seed's and the live run's, were anchored and re-read.
>   - Two real testnet ZEC payments were made with return addresses.
>   - The partner approved, formalised and disbursed one opportunity. 1 USDC was released to the ramp, and instalment 1's share went back as 18,000 zat of shielded ZEC (`8a4f85b7…`).
>   - The partner declined the other. The vault returned 1 USDC to the ramp in 31 s, and the treasury refunded 89,000 zat (`26311626…`).
>   - A report checked 120 of 120 proofs on chain, from the auditor's browser and again from a visitor's. The vault reads 0.00 on chain = 0.00 expected.
> - **Tests.** pgTAP 395 (partner desk 19, ZEC returns 21, audit reports 13), Vitest 110, Deno 43.
> - **Found on the way.** Two treasury sends made back to back on one sync were rejected by the node, and nothing left the treasury. The "never twice" rule held the return for a person to check. The script now syncs before each send, and releases a send the node refused.

## 6 · Definition of done (from the brief)

Ticked where built and checked by the team; the founder's end-to-end test confirms them.

- [x] Within 5 seconds a visitor can tell whether they're on the corporate site or in a financial workspace, without thinking they changed company.
- [x] An investor connects a wallet, gets test USDC, opens an opportunity, invests, sees the confirmation and finds the position in the portfolio.
- [x] A community leader sees where participants are stuck and who is ready for the next action.
- [x] Any judge can open an opportunity and understand what is private, what was derived and what was proven on chain.
- [x] No important screen looks like a landing page: each has state, data, interaction, loading, error and success states, and a drill-down.
- [x] Every demo or simulated figure is labelled as such; no return or approval is presented as production reality.

**Demo narrative:** the community creates readiness → the opportunity becomes investable → a wallet funds it with devnet USDC → the operation is tracked → the privacy-preserving evidence is verified on Solana.

## 7 · Out of scope (P2)

Real Pix, real borrower payouts, production P2P, mainnet funds, real investor returns, production KYC and FX.

## 8 · Needed from the founder

- ~~MoneyGram sandbox credentials~~ — received 16 Sep; the quote is live.
- Review at the end of each phase. `main` is updated only after a phase is approved.

# Tokenized productive credit — review of the addendum, and plan

**Source:** *EmpowerFI MVP Addendum — Tokenized Productive Credit* (founder, 22 Sep 2026), companion to the *Site + Hackathon MVP Refactor Specification v2 — Solana* and to `PLAN_ECONOMICS.md`.
**Work:** on `hackathon`. Migrations, reseeds and the merge to `main` happen only after the founder approves.
**Window:** 18 days to the internal deadline (Sat 10 Oct 2026, 23:59 BRT).
**Status, 22 Sep: proposed.** Inspected against what is built, per §14. Five decisions in §6 need the founder's word before coding.

**Review:** the addendum is buildable on what exists, and **most of its plumbing is already here** — the wallet layer, the SPL machinery, the proof drawer, the explorer links, the share arithmetic. Three of its instructions would, followed literally, put a wrong number or a fake number on the screen. §3 says which and proposes what to do instead.

**Rules kept:** do not rebuild what works, label every simulated value, put nothing personal on chain, never show a number that is not real — and, added by this addendum, **never let transferability read as liquidity**.

---

## 1 · Current-state map — what the addendum touches

*Answering §14's "before coding, inspect and report".*

| §14 asks | What exists | Where |
| --- | --- | --- |
| 1. Opportunity, investment, payment, wallet and proof models | `qualified_credit_opportunities` (with `funding_status`, `funding_target_micro_usdc`, `funded_micro_usdc`, `allocated_at`), `investments` (investor, opportunity, `wallet_address`, `amount_micro_usdc`, `mode`, `status`, `deposit_signature`), `loans`, `payments` (per instalment), `loan_events`, `chain_anchors` (14 kinds, queue with `depends_on`), `vault_transfers` | `20260914200100`, `20260916000100_investing.sql`, `20260919000300_settlement.sql` |
| 2. Smallest extension for a position and its transfers | Nothing exists. `investor_position()` already returns `share_bps` = investment ÷ funding target — the investor's economic share is **already computed**, it just has no asset behind it | `20260919000300_settlement.sql:367` |
| 3. Reusable Devnet/token primitives | Real SPL transfers with `@solana/kit` + `@solana-program/token`: ATA creation, `transferChecked`, a program-signed vault authority, the operator as signer, and the "record the signature and last valid block height before sending" discipline | `functions/vault-settle`, `functions/vault-refund`, `functions/investment-confirm`, `src/app/lib/solana.ts` |
| 4. Where Tokenized Positions belongs | Investor Console has `/app/investor` (overview), `/opportunities`, `/portfolio`, `/positions/:id`, `/settlement`, `/audit`. A position page already shows lifecycle, route, proof and ZEC returns | `src/app/PlatformApp.tsx:153-159`, `pages/investor/Position.tsx` (561 lines) |
| 5. What stays off chain | Enforced already: `scan-chain-pii.mts` scans for it, `docs/PRIVACY.md` states it, and every anchor carries a commitment hash rather than a payload | `scripts/platform/scan-chain-pii.mts`, `_shared/audit-commitments` |
| 6. Transfer eligibility | Nothing exists | — |
| 7. Simulated vs real | The `DataTag`/`REALITY` vocabulary already labels every value as private, derived, simulated or proven on Solana | `components/product/DataLegend.tsx`, `lib/settlement.ts` |

**The seeded reality, measured on the linked project today:**

| | |
| --- | --- |
| Opportunities `funded` | 9 |
| Investments | 69 — 61 simulated allocated, 7 refunded, **1 wallet-mode with a real address** |
| Investors per funded opportunity | up to 8 |
| Anchors confirmed | 982, none of them about ownership |

## 2 · Gaps against the addendum

| # | Gap | Addendum |
| --- | --- | --- |
| T1 | **No asset.** A funded investment produces a row and a payout schedule, nothing a wallet can hold. | §3.5, §4 |
| T2 | **No ownership on chain.** `investments.investor_id` is a Postgres row; nothing says who owns what to anyone outside. | §4, §9 |
| T3 | **No transfer, and no notion of an eligible wallet.** | §4, §8 |
| T4 | **No asset identity.** No `EF-CREDIT-1042`; opportunities have `opportunity_no`, positions have nothing. | §4, §5 |
| T5 | **No position view.** The Investor Console shows a funding position, not an asset with owner, state and history. | §8 |
| T6 | **No language guardrails for this claim.** `docs/LEGAL_REVIEW.md` covers lending and investment copy, not tokenization, secondary markets or the legal instrument question. | §11 |

Everything else the addendum lists — proof drawer, explorer links, off-chain PII, engine snapshots, the borrower's Pix last mile, Operating Economics — already exists and must be left alone.

## 3 · Review of the addendum — three places to deviate

### 3.1 · "The investor's economic position" is per **investment**, not per opportunity

§3.5 says "create a Devnet representation of the investor's economic position", and §5's field table reads as one asset per loan: *Original principal — BRL amount*.

A funded opportunity here has **up to eight investors**. One asset per opportunity has no owner. One asset per investment does, and it is the thing the addendum actually describes.

The consequence is a number on the screen. A position that owns 12% of a R$ 6.700 loan must not display R$ 6.700 as its principal. The fields become:

| Addendum field | What it must show |
| --- | --- |
| Original principal | **Her share** — `amount_micro_usdc`, with the loan's principal beside it as context |
| Outstanding | Her share of the outstanding balance |
| Payments | The loan's progress (3/12), which is a fact about the loan, not about her |

`share_bps` is already computed for exactly this reason. **Proposal: one position per investment**, and every money field on the asset is hers, with the loan's own figures labelled as the loan's.

### 3.2 · Roadmap metric placeholders should be a sentence, not four empty tiles

§8 asks for "roadmap metrics placeholders only when clearly marked experimental: Secondary Volume, Time to Exit, Discount/Premium, Liquidity Available", and §13 requires that no fake volume or depth is presented.

Four tiles reading "—" invite exactly the reading the addendum forbids: a viewer sees the shape of a marketplace dashboard and fills the blanks. The repo's standing rule is that a number appears when it is real.

**Proposal: one line naming the four metrics as roadmap, and no tiles.** It satisfies §8's intent and §13's constraint at once. Flagged as a deviation because it is a literal instruction not followed.

### 3.3 · Ownership needs no commitment hash, because the token *is* the record

§9 lists the proof layer's MVP evidence as "commitments **+ Devnet transaction links**". Every other fact on this platform is private, so it is anchored as a hash an auditor recomputes. Ownership is not private and not derived: the mint and the transfer *are* public Solana transactions with signatures and explorer links.

Anchoring a commitment of "who owns this" beside a token that already says who owns it is a second source of truth that can disagree with the first.

**Proposal: no new anchor kind, no new program instruction, no program redeploy for P0.** The position's economics are already anchored through `opportunity`, `allocation`, `loan`, `payment` and `loan_transition`. This removes the riskiest step in the build — a program upgrade four days before a demo — and the `anchor_position` kind stays available as P1 if a commitment of the position's *terms at creation* turns out to be wanted.

## 4 · The asset: what it is on chain

Three designs were considered.

| Design | Ownership enforced by | Cost | Verdict |
| --- | --- | --- | --- |
| PDA with an `owner` field, updated by the operator | the platform, off chain in effect | new program instruction + redeploy | **No.** It is the proof layer wearing an asset's name; nobody can hold it |
| **Token-2022 mint, 1 unit, `DefaultAccountState = frozen`** | **the chain** — only accounts the platform thaws can receive | one edge function, no program change | **Proposed** |
| Token-2022 + transfer-hook program | the chain, with arbitrary policy | a second Anchor program | Right for production, too large for P0 |

**The proposal in one paragraph.** Each funded investment gets a Token-2022 mint with zero decimals and a supply of one, created by the operator, who holds mint and freeze authority. The mint carries the `DefaultAccountState` extension set to *frozen*, so a token account for it is unusable until the platform thaws it — which is how "eligible wallets" stops being a UI rule and becomes something the chain enforces. The metadata extension carries the asset id (`EF-CREDIT-1042`) and nothing else. Transfer is an ordinary SPL transfer that fails unless the destination account has been thawed, so a holder cannot move the asset to a wallet the platform has not admitted.

This is the honest version of "controlled transferability", it needs no program upgrade, and it gives §9's asset layer something real to point at.

**What stays off chain:** everything already off chain, plus the investor's identity. The token's owner is a wallet address; nothing on chain links it to a person, and `scan-chain-pii.mts` gets the new tables in its sweep.

## 5 · Build plan — P0

Ordered so each step is demonstrable on its own, and nothing later can break what came before.

| # | Step | What it delivers | Size |
| --- | --- | --- | --- |
| **B1** | **Data model.** `credit_positions` (one per investment, `asset_no` → `EF-CREDIT-####`, mint, owner wallet, token account, share, state), `position_events` (created / minted / payment / transferred / closed, with signature), `position_transfers`, `eligible_wallets`. Trigger: a position row appears when its opportunity reaches `funded` — never before, which is §13's first constraint expressed as a constraint rather than a check | §13's "cannot be created before funded" holds by construction | ½ d |
| **B2** | **Reader.** `investor_positions()` and `tokenized_position(id)` with the same RLS shape as `investor_position()`: hers, or an auditor's. Share, outstanding, payment progress, risk band, data freshness, evidence quality, proof status | the §5 field table, from real data | ½ d |
| **B3** | **`position-mint` function.** Cron-dispatched like `vault-settle`: create the Token-2022 mint, create and thaw the owner's account, mint one, record the signature before sending. Idempotent by position | the asset exists on Devnet | 1 d |
| **B4** | **`position-transfer` function.** Checks `eligible_wallets`, creates and thaws the destination, transfers one unit, records the event | §13's demonstrable ownership event | ½ d |
| **B5** | **Investor Console.** A Tokenized Positions tab, a position detail with the §5 fields, the transfer action, the event history, and the guardrail copy. Reuses `ProofDrawer`, `ExplorerLink`, `StatusPill`, `DataTag` | §8 | 1 d |
| **B6** | **Copy, legal and demo.** §11's guardrails as fixed strings in both locales; a tokenization section in `docs/LEGAL_REVIEW.md`; the demo sequence in `docs/DEMO.md` | §11, §12 | ½ d |
| **B7** | **Seed.** Eligible test wallets, deterministic devnet wallets for the demo investors, positions minted for the nine funded opportunities | a populated console rather than an empty tab | ½ d |

**≈ 4½ days of work against 18 days of calendar.** The slack is deliberate: B3 and B4 touch devnet, where the failure modes are slow.

## 6 · Decisions needed before coding

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | One position per **investment**, or per opportunity? | Per investment (§3.1). Per opportunity has no owner |
| D2 | Mint for **all** funded positions, including the 61 simulated investments, or only for the one real wallet? | All, each labelled simulated — the platform already writes real anchors for simulated facts, and an empty tab demonstrates nothing. ≈0.25 devnet SOL |
| D3 | **Token-2022 default-frozen**, or a PDA ownership record? | Token-2022 (§4). Only it makes "controlled" true rather than claimed |
| D4 | Roadmap metrics: **one line**, or four placeholder tiles? | One line (§3.2) |
| D5 | The demo transfer is signed **in the browser by the investor**, or by the operator on her behalf? | Browser, with an operator-signed fallback for simulated positions. It is the difference between showing ownership and asserting it |

## 7 · Not built, and said so

Per §4, §7 and §11: no exchange, no AMM, no order book, no securitization, no tranching, no pool packaging, no public secondary market, no bids, no depth, no volume, no claim that EmpowerFI is a SEP, a securities marketplace, an exchange, a securitizer or an authorized secondary market, and no claim that the token constitutes legal ownership of a receivable. The copy says what it is: a Devnet prototype of a possible future regulated architecture, whose legal instrument requires Brazilian counsel and BCB/CVM validation before any real issuance.

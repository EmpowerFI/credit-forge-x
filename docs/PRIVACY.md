# Privacy

**Auditability without financial surveillance.** Anyone can check that EmpowerFI's records are the ones it proved, in the order it proved them. Nobody learns a participant's name, income or debts from doing so, and inside the platform each role sees only what its job needs.

This document states what is protected, how, and what isn't solved yet. [ARCHITECTURE.md](ARCHITECTURE.md) describes the system itself.

## Three layers

| Layer | Contents | Who reaches it |
|---|---|---|
| **Private data vault** (Postgres) | Names, business names, cities, reported sales, costs and household spending, requests, loans, payments | Row-level security per role; writes go only through checked functions |
| **Derived intelligence** (Postgres) | Readiness and eligibility results, affordability, risk and confidence grades, outcomes, cost to serve | As above; the P2P desk and investors get reduced views of it |
| **Solana** | Commitments (32-byte hashes), lifecycle states, sequence numbers, times | Public |

## What goes on chain, and what never does

On chain, per fact, there is only:

- a 32-byte commitment;
- keys linking the fact to the accounts it depends on;
- small integers (a month as `YYYYMM`, an assessment, instalment or measurement number, a model version, a schema version, a time);
- lifecycle enums (community status, readiness status and band, eligibility decision, risk and confidence grades, loan status).

These never go on chain: a name, CPF, phone, e-mail, address, a business name, an amount (sales, costs, household spending, request, principal, instalment, payment), raw check-ins, bank or Pix data, a score.

Two checks enforce this:

- `packages/audit-client/privacy.test.ts` reads the program's IDL. It pins every account field and every instruction argument by name and type, and allows only 32-byte hashes, public keys, small integers and data-less enums. Nothing can hold text. Adding a field fails the test until someone reviews it deliberately.
- `scripts/platform/scan-chain-pii.mts` reads every account the program owns on devnet. It checks that each is a reviewed type at its fixed size. Then it searches the raw bytes for every name, business name, e-mail, community name and city in the database, and checks every decoded integer field against every reported amount and loan amount. Last run, before allocations and consent records existed: 3,864 accounts across the ten types then in use, zero findings. It now also reviews `AllocationCommitment` and `ConsentCommitment`.

### Why a commitment reveals nothing

A commitment is `SHA-256(domain ‖ 0x00 ‖ canonical JSON of the record)`. Every record's payload includes its own random UUID. Knowing or guessing someone's sales doesn't let anyone rebuild the hash: the 122 random bits would have to be guessed too. The hash proves a record without disclosing it.

### Pseudonymous, not anonymous

A participant's on-chain accounts all hang off one `BorrowerAudit`, keyed by `SHA-256(domain ‖ borrower_ref)`. The `borrower_ref` is 32 random bytes that exist only in the database; they aren't derived from anything about her. Someone watching the chain can see that *some* participant of *some* community reported in certain months, became credit-ready, got a loan and paid instalments. They can't see who she is, which community by name, or any amount.

What remains is honest to state:

- **Linkability over time.** Her facts are linked to each other, by design, because that's the history the product builds. Someone who already knows she joined a given community on a given day could look for an enrollment account with that timestamp. Timestamps are kept because ordering is part of what is proven.
- **Public lifecycle states.** Readiness status and band, eligibility decision and grades, and loan status are public for that pseudonym, so that a lender or auditor can rely on them without asking EmpowerFI. The detail behind each is only committed.
- **Erasure.** A proof on chain can't be deleted. Deleting her records and her `borrower_ref` from the database leaves only hashes that nobody can link back to her or reverse. This is the design answer to an erasure request under LGPD, and it still needs legal review.

### Investor capital

Investors move real devnet USDC, and every token transfer on Solana is public. So the design keeps the money flows away from the participants:

- **In.** An investor deposits with a plain token transfer to the program's vault, one account for every opportunity. The chain shows that wallet sent that amount to the vault. Which opportunity it funds lives only in the database, proven by an `AllocationCommitment` keyed by a random reference that names neither party.
- **Out.** `vault_transfer` is the program's one instruction with an amount, reviewed as such in the privacy test. It covers a refund when the P2P desk declines, capital released for disbursement, and a repayment paid out. It takes no borrower, opportunity or allocation account, and the reason is recorded only in the database.
- **Releases are batched.** Global capital goes to the off-ramp in one transfer covering several funded opportunities, never loan by loan, so no transfer's amount is a loan's principal.
- **The ramp, on devnet.** Releases of global capital go to the regulated off-ramp's USDC account; on devnet that account is the operator's. With each instalment it sends the real investors' shares back into the vault, which pays them out in the same transaction. The conversion to reais is simulated at the demo quote, and Pix both ways is a mock (`vault-settle`, `platform/supabase/tests/settlement.test.sql`).
- **The ramp's quote.** The payment simulator asks MoneyGram Ramps' sandbox what a USDC cash-out in Brazil would cost (`ramp-quote`). Only the amount, the country and the currencies go to MoneyGram: no name, wallet, customer id or loan. Nothing is sent and nothing is recorded.
- **Settlement routing carries no one.** On a global loan, the disbursement records both routes' quotes and which was chosen (`settlement_quotes`, `settlement_decisions`). A quote holds amounts, a rate, fees, times and a provider key, and nothing else: no name, no Pix key, no wallet, no bank detail, no entrepreneur or investor id. The only person-shaped thing on the row is the loan it belongs to, which is how row-level security scopes it — an investor reads it because she funds that loan, the desk because it is its loan, and an entrepreneur reads none of it, nor the proof of it.
- **What the routing proof publishes.** `SettlementRouteCommitment` holds the loan's account, which of the two routes paid it, and a 32-byte commitment over the whole decision. The route is public on purpose: a proof that hid which way the money went would prove nothing worth proving, and the chain already holds the loan and its status. The amounts, the rate, the fees, the provider and the reasons stay in the commitment, and the record behind it stays in the database. Because no stablecoin transfer is made, none is shown: the leg carries no transaction id and no explorer link, and the proof says a decision was taken, never that a token moved.

What remains, stated plainly:

- **An investor's own flows are public**, as for any wallet: deposits, refunds and payouts, with amounts and times.
- **Matching is hard but not impossible.** Any signed-in investor sees each opportunity's USDC target. Someone watching the vault could try to match deposits to targets. Deposits are split across many investors and opportunities, which blurs it without ruling it out. The stronger answer is investing with shielded ZEC (below): no investor wallet is linked to the vault's inflow.

## Investing with shielded ZEC

An investor can fund an opportunity by paying EmpowerFI's shielded treasury on Zcash testnet instead of sending USDC from a Solana wallet (PLAN_REDESIGN.md, decision R5). No Solana wallet is needed.

- **The request.** `zcash-request` answers with a ZIP 321 payment request: the treasury's unified address, the amount in ZEC at a quote (CoinGecko's, or a labelled demo quote), and a memo carrying a random reference, `EFI-` and ten characters. The reference says nothing about the investor or the opportunity; only the database ties it to them.
- **On Zcash.** The payment is shielded (Sapling, Orchard or, since NU6.3, Ironwood). Amount, memo, sender and recipient are encrypted. An explorer shows only that a transaction happened.
- **The watcher.** `zcash-watch` holds the treasury's unified full viewing key, which reads what the treasury receives and can spend nothing. Every minute it trial-decrypts the new compact blocks from a lightwalletd, fetches each transaction that paid the treasury, and records every note it can read in `zcash_receipts`, matched to a request by its memo or not. The decryption is `services/zcash-watcher` (Rust, librustzcash's crates), compiled to WebAssembly for the Edge Function. It keeps no wallet state: the last height scanned is in the database.
- **Into the vault.** After two confirmations the operator transfers the same value in devnet USDC into the program's vault. That transfer is the allocation's deposit, and the allocation is anchored on Solana like any other. So the vault's inflow is the operator's, not the investor's.
- **Selective disclosure.** The viewing key is in the database's `private` schema, read only by the watcher and by `audit_zcash()`, which is for auditors. The audit console shows it, with the commands to import it into any Zcash wallet and list the same payments without trusting EmpowerFI. It is not in the repository: `scripts/platform/zcash-treasury.mts` sets it from the treasury wallet, which stays outside the repository. The treasury's spending key never reaches a server.

What remains, stated plainly:

- **The conversion is simulated.** In production NEAR Intents converts ZEC to USDC on Solana. It has no testnet, so the operator credits the vault at the quote and every screen says so.
- **The operator's credit is public.** Its amount matches the allocation, as a wallet deposit's does. What it no longer shows is who paid.
- **EmpowerFI reads its own treasury.** It knows which request each payment answers, as it knows every allocation. Other investors, the P2P desk and the public don't.
- **What comes back goes back as ZEC,** when the investor has no Solana wallet and gives a shielded return address (unified or Sapling; transparent addresses are refused). Each instalment's share, and a refund, is owed in `zcash_returns`. For a refund, the vault first returns the USDC to the ramp, the operator on devnet, in a real devnet transfer. The treasury then pays the ZEC at the quote of the day. Sending takes the treasury's spending key, so it happens on the operator's machine (`scripts/platform/zcash-returns.mts`): each return is marked sending before anything leaves, and is never sent twice. The return address is kept with the request, seen only by the investor and the operator; the audit console and shared reports list returns by transaction, never by address. With a Solana wallet, a ZEC position is refunded and paid out in USDC to that wallet.

## Consent

A participant decides what her data is used for, in four uses. Each builds on the one before it, except impact, which stands alone:

| Use | What it reads | Who sees what comes of it |
|---|---|---|
| **Assess my business** | Check-ins, education progress, community verification | Her, her leader, auditors |
| **Share my request with EmpowerFI's P2P desk** | The request, EmpowerFI's assessment, indicators rounded to R$ 100 | EmpowerFI's P2P desk, under a code |
| **Show my request to investors, without my name** | Purpose, sector, amount, term, community, grades | Investors in the console |
| **Count my business in impact figures** | Whether sales changed after a loan, how the capital was used | Only totals |

The wording is versioned (`consent-v2` since the P2P desk, in `src/app/lib/consent.ts`), and each record stores the version she saw. She reads it in English or Portuguese; the Portuguese is a translation of the same version, with the same meaning, so the version recorded doesn't depend on the language.

**How consent is given.** She gives it herself in the app, or her community leader records it from the form she signed. The second is how most participants give it. Either way the record states which, and who recorded it.

**How changes are kept.** Nothing is edited. Each change is a new, numbered record, and each record is proven on Solana by a `ConsentCommitment` under her borrower account. The chain holds the hash of what she chose, never the choices, so what she agreed to and when can't be rewritten afterwards.

**Enforced in the database, not only shown:**

- No readiness or eligibility assessment without consent to assess.
- Asking for credit needs consent to share the request with EmpowerFI's P2P desk.
- An opportunity opens to investors — and is given a pool — only with consent to be shown. Withdrawing it takes the opportunity off the market at once, unless the loan has already been disbursed, and anyone who had funded it is refunded. Without it, a request cannot be funded: investors fund every loan.
- Outcomes count in impact totals only with consent to impact figures. The community's Impact view says how many outcomes were left out, never whose.

The audit console re-checks each assessment, referral and listing against the consent that was in force when it happened. `platform/supabase/tests/consent.test.sql` covers each rule.

What remains, stated plainly:

- **Changes are visible, not their content.** On chain, anyone can see that a pseudonym has several consent records, and when each was made.
- **What was shared stays shared.** Withdrawing consent stops future use. It doesn't recall what a formalised loan already required.

## Shared audit reports

An auditor can freeze what the audit console shows into a report and share it by link (`audit_reports`). Whoever opens the link needs no account.

- **What a report holds** is chosen field by field in `private.audit_snapshot()`, never copied from the console wholesale: counts and states of every proof, the models in use, whether consent was enforced, credit totals, the vault's ledger and the transactions that moved it, the Zcash treasury's received notes and returns by transaction, and the latest proofs by commitment, account and transaction.
- **What it never holds:** names, business names, participant or community codes, any record behind a commitment, investor identities or wallets, the Zcash viewing key, memos or return addresses, and error text (an RPC error can carry a provider's key). `platform/supabase/tests/audit_reports.test.sql` checks this.
- **Checks, twice.** The auditor's browser re-runs the latest decisions, reads the vault on chain and looks up every proof and transfer in the report; those results are stored beside it, labelled as the auditor's. The reader's browser can run the chain checks again, straight against Solana.
- **The link is the credential:** 24 random bytes. Revoking a report closes it. Resetting the demo deletes every report.

## Evidence without financial surveillance

The sponsor's view follows the same three layers. Private data never leaves the private layer. Impact Intelligence reads derived intelligence only, in aggregate, and hides any group of fewer than five businesses in a breakdown (sector, geography, purpose, readiness, data quality, credit intent), so a small group cannot single a business out. Its proofs are the commitments already on Solana. The proof drawer beside every event shows a commitment and its transaction to anyone who can see the event, and recomputes the record only for those allowed to read it.

## Who sees what

Row-level security enforces all of this, and pgTAP tests check it for every role.

| Role | Sees | Doesn't see |
|---|---|---|
| **Entrepreneur** | Her own profile, business, check-ins, assessments, requests, loans, payments, outcome and cost; can audit her own proofs; records and changes her consent | Anyone else's; and none of the settlement machinery — not the rate cards, not a quote, not a routing decision. Her side is reais, Pix and her instalments |
| **Program sponsor** | Its own programs, in aggregate over the communities that run them: counts, shares, capital totals, repayment, outcomes of businesses that consented to impact reporting (the rest counted as withheld), proof counts, and qualified opportunities by Q- code where she consented to be shown to investors. Can verify commitments on Solana | Any name, business, person id or reported figure; any group under five in a breakdown; the record behind a proof; any investor |
| **Community leader** | Members of the communities she leads: their records, funnel, cost to serve, and capital totals — qualified demand, funded, funding gap, domestic and global coverage; records their consent from the signed form | Other communities' members; any investor, wallet or position; opportunities, decisions and loans read directly from their tables; reported amounts in Community Intelligence |
| **EmpowerFI P2P desk** (the `partner` role) | Qualified opportunities on its desk, pseudonymous: `P-XXXXXX`, sector, verified community, indicators rounded to R$100, EmpowerFI's assessment and reasons. How much investors have funded each, from how many, and how much of it is real devnet USDC. Its own loans, schedules, payments, settlement legs and outcomes | Names, business names, check-ins, readiness detail, who the investors are, anything not referred to it |
| **Capital provider** | Opportunities she allowed to be shown, as a decision snapshot: purpose, amount, community, readiness and risk bands, affordability, eligibility and allocation reason codes, the pool — under "What you can see / What stays private" on screen. Its own positions, and for a loan it funds, the settlement route that paid it with both quotes behind it. Can verify every commitment on Solana from the browser, without the record behind it | Names, business names, revenue and expenses, Pix and bank data, raw check-ins, consent records |
| **Auditor** | Everything, read-only; every proof. The audit console names participants by code (`P-XXXXXX`), never by name. Holds the Zcash treasury's viewing key, and sees every note it reads | Can't write anything; the viewing key spends nothing |
| **Admin (EmpowerFI)** | Everything; verifies communities, opens flagged opportunities to investors | Can't verify a community it leads |
| **Anonymous visitor** | An audit report shared with them by link, and nothing else | Any table or view; any function but `shared_audit_report` |

These rules hold for every table, view and function, and `platform/supabase/tests/rbac.test.sql` checks them from the database catalog, so anything added later is covered automatically:

- row-level security on every table;
- no reads or writes for anonymous visitors, and one function they may call: opening a shared audit report by its token;
- no direct writes for signed-in users;
- views run as the caller;
- security-definer functions pin their `search_path`;
- nobody can grant themselves a role or a partner.

## What the product won't use

Engagement data (opens, clicks, time in the app, whether she upgraded) is never an input to readiness or eligibility. It isn't evidence of creditworthiness, and using it would penalise the people with the least spare time. Readiness uses business signals only: reported months, record-keeping, cash flow, education completed, community verification.

## Keys and secrets

- The program's **upgrade authority** and the **operator** that signs every proof are separate keys. `set_operator` rotates the operator without a new program ID.
- The operator key, the anchoring secret, the RPC key and MoneyGram's sandbox keys live as Supabase function secrets and in Vault. They're never in the repository and never in the browser bundle. The audit screen uses the public devnet RPC.
- The Zcash treasury's seed stays in its wallet, off every server. Only its viewing key is in the database, in the `private` schema, for the watcher and auditors. Returns in ZEC are sent from the operator's machine, where the wallet is; the script never reads or prints the seed or its age identity.
- Demo accounts share a public password on purpose, because judges need to log in. Every demo record is marked `is_simulated`.

## Open before production

- LGPD: counsel's review of the consent wording and the legal basis for each use, a data-protection impact assessment, retention periods, and a data-subject request process (including the erasure approach above).
- A real P2P operation needs the regulatory structure first (SEP authorisation or a regulated partner as a bridge for a pilot); the desk in this prototype is not a licensed lender.
- Reference rotation: a participant who wants a fresh pseudonym would need a new `borrower_ref` and a link between her old and new histories that only the database knows.
- The global route: FX hedge, off-ramp and tax treatment of cross-border capital are assumptions in the allocation engine until validated.
- Shielded ZEC: NEAR Intents for the conversion, returns sent automatically from a custodied key rather than by hand, mainnet confirmation depth (ten blocks, not two), reorg handling in the watcher (it records each scanned block's hash but doesn't yet rewind), and a treasury key held in custody, not a developer wallet.

# Privacy

**Auditability without financial surveillance.** Anyone can check that EmpowerFI's records are the ones it proved, in the order it proved them. Nobody learns a participant's name, income or debts from doing so, and inside the platform each role sees only what its job needs.

This document states what is protected, how, and what isn't solved yet. [ARCHITECTURE.md](ARCHITECTURE.md) describes the system itself.

## Three layers

| Layer | Contents | Who reaches it |
|---|---|---|
| **Private data vault** (Postgres) | Names, business names, cities, reported sales, costs and household spending, requests, loans, payments | Row-level security per role; writes go only through checked functions |
| **Derived intelligence** (Postgres) | Readiness and eligibility results, affordability, risk and confidence grades, outcomes, cost to serve | As above; partners and capital providers get reduced views of it |
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
- `scripts/platform/scan-chain-pii.mts` reads every account the program owns on devnet. It checks that each is a reviewed type at its fixed size. Then it searches the raw bytes for every name, business name, e-mail, community name and city in the database, and checks every decoded integer field against every reported amount and loan amount. Last run: 3,864 accounts across all ten types, zero findings.

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
- **Out.** `vault_transfer` is the program's one instruction with an amount, reviewed as such in the privacy test. It covers a refund when a partner declines, capital released for disbursement, and a repayment paid out. It takes no borrower, opportunity or allocation account, and the reason is recorded only in the database.
- **Releases are batched.** Capital goes to the partner in one transfer covering several funded opportunities, never loan by loan, so no transfer's amount is a loan's principal.

What remains, stated plainly:

- **An investor's own flows are public**, as for any wallet: deposits, refunds and payouts, with amounts and times.
- **Matching is hard but not impossible.** Any signed-in investor sees each opportunity's USDC target. Someone watching the vault could try to match deposits to targets. Deposits are split across many investors and opportunities, which blurs it without ruling it out. The optional Cloak mode (a shielded pool) is the stronger answer.

## Who sees what

Row-level security enforces all of this, and pgTAP tests check it for every role.

| Role | Sees | Doesn't see |
|---|---|---|
| **Entrepreneur** | Her own profile, business, check-ins, assessments, requests, loans, payments, outcome and cost; can audit her own proofs | Anyone else's |
| **Community leader** | Members of the communities she leads: their records, funnel and cost to serve | Other communities' members; partners' books |
| **Credit partner** | Opportunities referred to it, pseudonymous: `P-XXXXXX`, sector, verified community, indicators rounded to R$100, EmpowerFI's assessment and reasons. Its own loans, payments and outcomes | Names, business names, check-ins, readiness detail, anything not referred to it |
| **Capital provider** | The portfolio its capital funds, in aggregate. Loans under a code derived from the loan alone (`L-XXXXXX`), which can't be joined to the partner's pseudonyms. Can audit loans, status changes and payments | People, check-ins, readiness, eligibility, opportunities, per-person outcomes |
| **Auditor** | Everything, read-only; every proof | Can't write anything |
| **Admin (EmpowerFI)** | Everything; verifies communities, refers flagged opportunities | Can't make a lending decision, or verify a community it leads |
| **Anonymous visitor** | Nothing | No table, view or function |

These rules hold for every table, view and function, and `platform/supabase/tests/rbac.test.sql` checks them from the database catalog, so anything added later is covered automatically:

- row-level security on every table;
- no reads or writes for anonymous visitors;
- no direct writes for signed-in users;
- views run as the caller;
- security-definer functions pin their `search_path`;
- nobody can grant themselves a role or a partner.

## What the product won't use

Engagement data (opens, clicks, time in the app, whether she upgraded) is never an input to readiness or eligibility. It isn't evidence of creditworthiness, and using it would penalise the people with the least spare time. Readiness uses business signals only: reported months, record-keeping, cash flow, education completed, community verification.

## Keys and secrets

- The program's **upgrade authority** and the **operator** that signs every proof are separate keys. `set_operator` rotates the operator without a new program ID.
- The operator key, the anchoring secret and the RPC key live as Supabase function secrets and in Vault. They're never in the repository and never in the browser bundle. The audit screen uses the public devnet RPC.
- Demo accounts share a public password on purpose, because judges need to log in. Every demo record is marked `is_simulated`.

## Open before production

- LGPD: the legal basis and consent flow for each processing purpose, a data-protection impact assessment, retention periods, and a data-subject request process (including the erasure approach above), all with counsel.
- Consent for sharing an opportunity with a partner is implied by her request in the pilot. Production needs an explicit, per-partner consent record.
- Reference rotation: a participant who wants a fresh pseudonym would need a new `borrower_ref` and a link between her old and new histories that only the database knows.
- Stablecoin and cross-border capital routes: tax and regulatory treatment are assumptions in the simulator until validated.

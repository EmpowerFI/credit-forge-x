# The proof layer, reviewed — what to carry forward

**Written for:** the founder, and whoever writes the real contract. Third in the series, after [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) and [STUDY-SPLIT.md](STUDY-SPLIT.md).

`programs/empowerfi-audit` is 1,455 lines of source and 1,646 of tests: 13 account types, 17 instructions, one state machine. It is good code. Nothing here is a rewrite argument.

But the real deployment will be a different program, which makes this the cheapest moment there will ever be to decide what goes in it. Seven findings, ordered by whether they change a decision. The first three are the ones I would not ship without — the third because it cannot be fixed afterwards.

The hackathon program is frozen — its ID is fixed for the submission and nothing below should be changed now.

---

## 1. One key is hot by necessity and can empty the vault

This is the finding.

`vault_transfer` moves USDC out of the program's vault. Look at what constrains it:

```rust
/// CHECK: any token account of the same mint; SPL Token checks the mint.
#[account(mut)]
pub destination: UncheckedAccount<'info>,
```

…and the only other gate is `has_one = operator`. So: **no destination allowlist, no amount cap, no daily limit, no timelock, no second signature.** One signature moves the entire balance anywhere.

That would be an acceptable custodial design if the signing key lived in cold storage. It does not, and it cannot — because the *same* `operator` key signs `anchor_checkin`, `attest_readiness`, `anchor_consent` and every other commitment. It has to be hot, on a server, used many times a day, held in a file (`OPERATOR_KEYPAIR_FILE`).

**A key that must be hot to anchor and must be cold to hold funds is two keys.** Today it is one, and the blast radius of a server compromise is the whole vault rather than "someone writes a false commitment", which is bad but recoverable.

For the real contract:

- **Split the roles on `PlatformConfig`:** `operator` (anchoring, hot) and `treasurer` (the vault, cold). `vault_transfer` requires the treasurer; nothing else does.
- **Put the treasurer behind a multisig.** Squads is the standard answer and is already on the post-hackathon list for the upgrade authority.
- **Bound the instruction anyway**, because a multisig signs what it is shown: a destination allowlist PDA, and a per-transaction cap in the config. Both are a few lines, and they turn "the treasurer can do anything" into "the treasurer can do the things we wrote down".

## 2. The authority cannot be rotated

`set_operator` exists and is gated on `config.authority`. **`set_authority` does not exist.** `config.authority` is written once in `initialize_platform` and is immutable for the life of the program.

So if the authority key is lost or compromised, the operator key can never be rotated again — and the operator key is the hot one. The only recovery is a program upgrade, which needs the upgrade authority, which is also a single key today.

A `set_authority` guarded by the current authority is about fifteen lines. Add it, and consider a two-step (`propose` / `accept`) so a typo in a pubkey does not lock the program out permanently — that is the usual failure, not theft.

## 3. Rent is a deposit, not a fee — and today it is stuck

The number in the first version of this section was right and the label on it was wrong, which made it read as an operating cost that would sink the unit economics. It is not an operating cost. It matters for a different reason.

**Two different things get paid on every anchor.**

| | per anchor | 5,000 women, 120,000 anchors/year | recoverable? |
|---|---|---|---|
| transaction fee | 0.000005 SOL | **~0.6 SOL ≈ US$72/year** | no — it is spent |
| rent exemption | ~0.0011 SOL | ~132 SOL ≈ US$16,000 | **yes, by closing the account** |

Measured, not estimated. The account layouts are small — `CheckinCommitment` is 86 bytes with the discriminator, `ReadinessAttestation` 90 — and `solana rent 86` gives **0.00108712 SOL**. Nothing in the repo sets a priority fee (`grep` for `ComputeBudget` returns nothing), and `anchor_checkin` has `payer = operator` with one signer, so the fee is the 5,000-lamport base.

Which also reprices the project's own history: **1,031 anchors cost about 1.2 SOL, of which roughly 0.005 SOL — under a cent — was actually spent.** The rest is a deposit sitting inside 1,031 accounts.

So the real finding is narrower and sharper than "rent is expensive":

> **The rent is refundable and this program cannot refund it.** There is no `close` instruction anywhere, so every lamport of deposit is permanently locked by omission.

At 5,000 women that is US$16,000 of working capital immobilised, growing every month, against a service priced at US$4 per entrepreneur per month — US$240,000 a year of revenue. As a cost it would be 7% of revenue and survivable; as locked capital it is a balance-sheet item that never comes back. And it is denominated in SOL, so a 3× rally triples it without anyone deciding anything.

Three ways to fix it, and they compose:

- **A `close` instruction, decided now.** `close_checkin` callable by the authority after N years, returning the deposit to the treasury. Cheap at design time and **impossible to add later** — accounts created under a program with no close can never be closed by a future version of that program's logic unless the upgrade keeps the same program ID. This is the one that turns US$16,000 of permanent loss into US$16,000 of float.
- **Batch the high-volume records into a Merkle root.** One root account per community per month instead of one account per check-in: 5,000 women go from 60,000 check-in accounts a year to **12**, and the rent line disappears rather than shrinking. A record's proof becomes the commitment plus its sibling path, checked against the on-chain root — still verifiable by a stranger with no access to our database, because a wrong path does not reproduce the root.
- **Keep a dedicated account only where the granularity is the point.** The records that gate a credit decision — the readiness attestation an eligibility relied on, a loan transition, an outcome — are low-volume and high-stakes, and an address of their own is worth its deposit. Check-ins are the opposite: high-volume, and only ever read as "she reported these months".

The batching option has one cost worth naming: the sibling paths live in the database, so if EmpowerFI disappears, nobody can rebuild a proof from the chain alone. That is fixable for free — publish each month's leaf set, which is nothing but hashes and carries no personal data, somewhere outside our control. Then the chain holds the root, the world holds the leaves, and the database holds only the convenience.

**Decide this for the real contract, not after the first real anchor.** The split above is also an argument for the monthly record that [STUDY-WHATSAPP.md §4.1](STUDY-WHATSAPP.md) recommends on other grounds; fortnightly *periods* would double the account count.

## 4. Append-only, except in the one place it matters most

Every record in this program gets its own PDA and is never rewritten — which is the property that makes the layer worth having. Except one.

`transition_loan` overwrites:

```rust
loan.last_transition_commitment = transition_commitment;
loan.transitions = loan.transitions.saturating_add(1);
```

So the chain can prove a loan is `Defaulted` and that it changed status four times. It cannot prove what the second change committed to. If someone later disputes *when* the loan became `Active`, or what the partner's approval record said, the chain has a count and the database has everything — which is exactly the arrangement this layer exists to avoid.

And the payload already exists: `packages/audit-commitments` defines `EMPOWERFI:LOAN_TRANSITION:v1`. The commitment is computed and then written into a slot that the next transition overwrites.

A `LoanTransitionCommitment` PDA seeded by `(loan, transition_no)` fixes it. At four or five transitions per loan it is a small number of accounts against the rent table above, and it is the difference between a provable loan history and a provable loan *state*.

## 5. No events at all

`emit!` appears zero times. Nothing about the program is observable except by reading accounts.

That means any indexer, any sponsor-facing feed, and `anchor-reconcile` itself must poll accounts or parse raw transactions. Anchor events cost almost nothing — a few bytes of log per instruction — and they are what lets someone else build on the proof layer without asking for database access, which is supposedly the point.

Emit one per anchoring instruction, carrying the commitment, the kind and the PDA.

## 6. SPL Token only, and the decimals are read by hand

`vault_transfer` pins `TOKEN_PROGRAM_ID` and reads the mint's decimals at a raw byte offset:

```rust
const MINT_DECIMALS_OFFSET: usize = 44;
```

The only check on the account is `owner = TOKEN_PROGRAM_ID`, so a token *account* passed as the mint would yield a garbage decimals byte. SPL Token's own `TransferChecked` refuses it downstream, so this is not exploitable — it is fragile rather than wrong.

Two reasons to change it for the real contract. `anchor_spl::token_interface` deserialises a real `Mint` and removes the offset entirely. And it covers **Token-2022**, which this program cannot touch today — while the product already mints investor positions as Token-2022 elsewhere. A vault that can never hold the asset the rest of the system issues is a constraint worth removing before it is load-bearing.

## 7. `schema_version` is written and never read

Every account carries `schema_version = SCHEMA_VERSION`, and nothing anywhere checks it. Today that is harmless, because everything is v1.

It stops being harmless at the first v2, which is precisely when nobody remembers the field exists. Either enforce it on read in the instructions that chain records together, or drop it and version through the domain tag alone — which `audit-commitments` already does with its `:v1` suffix, and which is the mechanism an outside verifier actually sees.

---

## What already exists, and what to take from it

The question behind this review is the one the SAS gap raised: **what did we rebuild that already existed?**

That comparison is already written up in [ARCHITECTURE.md § Why not the Solana Attestation Service](ARCHITECTURE.md#why-not-the-solana-attestation-service), checked against the program's source and the deployed account on 5 October 2026, and it still holds. The short version: SAS validates that an attestation matches its schema and that the signer is authorised on the credential. **It never reads another attestation.** So none of this program's rules survive a move to it — eligibility could be written with no readiness behind it, a loan could skip `Draft` → `Paid`, an outcome could land on a loan that never disbursed. Those refusals are what makes the sequence trustworthy rather than just the hashes.

That conclusion does not change. What this review adds is a sharper line between *adopt*, *steal* and *keep*:

**Adopt SAS where the product has not built anything.** Investor KYC, accreditation and eligibility by jurisdiction are its documented use case and a requirement of the regulated architecture this points at. An investor who already holds a KYC attestation should reuse it rather than pass through another verification flow. That is an integration and it belongs on the roadmap next to the investor console — which is deferred for regulation anyway, so the two unblock together.

**Steal two ideas without adopting the service.** `close_attestation` is the answer to finding 3, and SAS having it is evidence that permanent rent is a choice rather than a fact of the platform. And its schema registry is the enforced version of finding 7.

**Keep what is genuinely ours.** The dependency chain — readiness before eligibility, eligibility before opportunity, opportunity before loan, disbursement before payment and outcome — is the product, not plumbing. So is the discipline in `state.rs`: 32-byte commitments, enums, versions and timestamps, and never a name, a document number or a financial value. And `initialize_platform` being gated on the program's own upgrade authority, so nobody can claim the config in the window after deploy, is a detail that is easy to get wrong and was got right.

---

## For the real contract

Carry forward, in order:

**Must change**
1. `operator` and `treasurer` as separate keys, treasurer behind a multisig, with a destination allowlist and an amount cap.
2. `set_authority`, two-step.
3. A `close` instruction for the rent deposit, and the per-record-versus-batched decision taken before the first real anchor. Both are irreversible once accounts exist.
4. A PDA per loan transition.

**Should change**
5. Events on every anchoring instruction.
6. `token_interface` instead of pinned SPL Token and a hand-read offset.
7. Enforce `schema_version` or remove it.

**Keep unchanged**
The commitment discipline, the dependency rules and their refusals, the PDA-per-record append-only model, and the upgrade-authority-gated initialisation.

**Then have it audited by someone else.** This review is useful and it is not an audit — it is one reader going through 1,455 lines knowing what they expect to find. Before real money moves through `vault_transfer`, the program needs a reviewer with no prior belief about what it says.

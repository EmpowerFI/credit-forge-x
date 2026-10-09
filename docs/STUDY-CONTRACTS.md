# The proof layer, reviewed — what to carry forward

**Written for:** the founder, and whoever writes the real contract. Third in the series, after [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) and [STUDY-SPLIT.md](STUDY-SPLIT.md).

`programs/empowerfi-audit` is 1,455 lines of source and 1,646 of tests: 13 account types, 17 instructions, one state machine. It is good code. Nothing here is a rewrite argument.

But the real deployment will be a different program, which makes this the cheapest moment there will ever be to decide what goes in it. Seven findings, ordered by whether they change a decision. The first two are the ones I would not ship without.

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

## 3. Rent is the running cost, and it only goes one way

There is no `close` instruction anywhere in the program. Every check-in, assessment, payment, consent and outcome creates a PDA that exists forever and holds its rent exemption forever.

Measured in this project: **1,031 anchors cost about 1.2 SOL**, so roughly **0.0012 SOL per account**. Project that onto a real cohort:

| | anchors/year | SOL/year | at US$120/SOL |
|---|---|---|---|
| 100 women | ~2,400 | ~2.9 | ~US$350 |
| 1,000 women | ~24,000 | ~29 | ~US$3,500 |
| 5,000 women | ~120,000 | ~144 | ~US$17,000 |

Counting one check-in and one assessment per woman per month. It accumulates — year two costs year one again, plus the new accounts — and none of it is recoverable, because nothing can be closed.

Three things follow:

- **This is a design decision, not an operating expense.** It is affordable at pilot scale and it is the number that decides whether every check-in gets its own account at ten thousand women, or whether months get batched into a periodic Merkle root with the per-month proof served from the database. Decide it for the real contract, not after.
- **It is an argument for the monthly record** that [STUDY-WHATSAPP.md §4.1](STUDY-WHATSAPP.md) already recommends on other grounds. Fortnightly *periods* would double this table.
- **Decide a close policy now even if nothing uses it yet.** A `close_checkin` callable by the authority after N years, returning rent, is cheap to add at design time and impossible to add to accounts that already exist under a program without it.

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
3. A PDA per loan transition.

**Should change**
4. A close policy and a decision on per-record versus batched anchoring, taken against the rent table.
5. Events on every anchoring instruction.
6. `token_interface` instead of pinned SPL Token and a hand-read offset.
7. Enforce `schema_version` or remove it.

**Keep unchanged**
The commitment discipline, the dependency rules and their refusals, the PDA-per-record append-only model, and the upgrade-authority-gated initialisation.

**Then have it audited by someone else.** This review is useful and it is not an audit — it is one reader going through 1,455 lines knowing what they expect to find. Before real money moves through `vault_transfer`, the program needs a reviewer with no prior belief about what it says.

# The proof layer, reviewed — what to carry forward

**Written for:** the founder, and whoever writes the real contract. Third in the series, after [STUDY-WHATSAPP.md](STUDY-WHATSAPP.md) and [STUDY-SPLIT.md](STUDY-SPLIT.md).

`programs/empowerfi-audit` is 1,455 lines of source and 1,646 of tests: 13 account types, 17 instructions, one state machine. It is good code. Nothing here is a rewrite argument.

But the real deployment will be a different program, which makes this the cheapest moment there will ever be to decide what goes in it. Seven findings, ordered by whether they change a decision — the first three are the ones I would not ship without, the third because it cannot be fixed afterwards. Then §8 answers the question the third one raises: how much of this needs to be on a chain at all.

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
- **Batch the high-volume records into a Merkle root**, and **keep a dedicated account only where the granularity is the point.** Which records those are is a measurement rather than a judgement, and §8 makes it: about nine in ten accounts are check-ins and readiness recomputes, and the program reads neither. Batching them takes 128,500 accounts a year down to ~9,000 without touching a single validation.

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

## 8. Do we need all of this on chain? — the anchoring set, reconsidered

The question is the right one and the answer is no, but not for the reason the rent table suggests. Four measurements, then the cut.

### 8.1 The validations are free. The accounts are the cost.

The instinct is that the on-chain checks are what is expensive, so the saving comes from relaxing them. The opposite is true.

The entire program contains **four** validations that read another record, and `grep` finds all of them:

| instruction | reads | checks |
|---|---|---|
| `register_borrower_ref` | `community` | `status == Verified` |
| `attest_eligibility` | `readiness` | same borrower, `status == CreditReady` |
| `anchor_opportunity` | `eligibility` | same borrower, `decision != NotEligible` |
| `anchor_payment`, `anchor_outcome`, `anchor_settlement_route`, `transition_loan` | `loan` | `status` is in a legal set |

Each one is a single extra account read and a field comparison — a few thousand compute units against a 200,000 budget, and nothing at all in rent, since the dependency account already exists for its own sake. Everything else in the program is either `has_one = operator` (free, and the thing that stops a stranger writing into our namespace) or hygiene: `commitment != [0u8; 32]`, `n >= 1`, `valid_period`. Those catch our own pipeline's bugs at the one place we cannot patch afterwards. **None of it is worth optimising.**

What costs money is that **every anchored record gets its own account**, at ~0.0011 SOL of locked deposit each. So the only optimisation that moves the number is reducing the *number of accounts*, and the validations matter solely because a validation forces its dependency to have an account.

### 8.2 Nine of the thirteen account types are read by nobody on chain

Follow from the table above: only four account types — `CommunityAudit`, `ReadinessAttestation`, `EligibilityAttestation`, `LoanAccount` — are ever *consumed* by a constraint. The other nine exist purely as records.

`CheckinCommitment` is the clearest case. `grep` for `CHECKIN_SEED` across every instruction returns `anchor_checkin` and nothing else. No validation anywhere reads a check-in. It is written, and from the program's point of view never looked at again. The same is true of `ConsentCommitment`, `PaymentCommitment`, `OutcomeCommitment`, `AllocationCommitment` and `SettlementRouteCommitment`.

**A record nothing depends on does not need its own address.** That is not a weakness in the design — a record is a legitimate reason to anchor. It is the fact that makes those records safe to batch, because batching only breaks things that need a stable address to point at.

### 8.3 Where the volume actually is

For 5,000 women, steady state, counting one check-in and one readiness recompute per woman per month and assuming one in ten borrows once a year over twelve instalments:

| | accounts/year | share | consumed by a constraint? |
|---|---|---|---|
| `checkin` | 60,000 | 47% | never |
| `readiness` | 60,000 | 47% | only the ~500 an eligibility cites |
| the credit chain (eligibility, opportunity, loan, payments, outcome, route) | ~8,500 | 6% | yes |
| one-off per woman (enrollment, consent) | 10,000, once | — | enrollment yes, consent never |
| one-off per community | 2 per community | — | yes |

**About nine in ten accounts are check-ins and readiness recomputes, and almost none of them is read by anything.** The credit chain — the part with all the validations, all the dependency rules, the part that looks expensive — is 6% of the volume.

So the cut is not in the loop's logic. It is in the two highest-volume records, which are also the two with the least on-chain consequence.

### 8.4 The cut

Three changes, in order of how much they save:

**1. Batch check-ins into a monthly Merkle root.** One root account per community per month. 60,000 accounts a year become **12**. Nothing on chain pointed at a check-in account, so nothing breaks. A woman's month is proved by her commitment plus a sibling path against the root — still checkable by a stranger, because a wrong path does not reproduce the root.

**2. Batch readiness the same way, and promote on demand.** The monthly root carries every recompute, which is what preserves the timestamp — the property that matters is *"this was computed in March, not fabricated in June"*, and a root dated March gives that. When an eligibility actually needs to cite one, anchor that single attestation into its own account at that moment. The constraint in `attest_eligibility` works unchanged. Roughly 500 individual accounts a year instead of 60,000, and the ones that gate a credit decision are exactly the ones that keep an address.

**3. Keep the credit chain exactly as it is.** 8,500 accounts a year is ~9 SOL of deposit for 5,000 women. It is the part a lending partner reads, the part where the dependency rules are the product, and the part where the volume does not justify complexity.

Result:

| | accounts/year | deposit | spent on fees |
|---|---|---|---|
| today's model | ~128,500 | ~141 SOL (~US$17,000) | ~US$77 |
| with 1 and 2 | **~9,000** | **~10 SOL (~US$1,200)** | ~US$5 |

A 93% reduction, achieved without removing a single validation — and with a `close` instruction (§3) even the US$1,200 is float rather than loss.

### 8.5 The other cut: three kinds anchor for nobody

Separate from volume, worth asking of each of the fifteen anchor kinds: **who reads this, and what do they do differently because it is on a chain?**

| kind | reader | verdict |
|---|---|---|
| `community`, `community_verification` | sponsor, partner | keep |
| `enrollment` | consumed by every later record | keep |
| `consent` | LGPD — provable opt-in with a timestamp we cannot move | keep, and it is one of the strongest |
| `checkin` | the entrepreneur, the sponsor (as volume) | keep, batched |
| `readiness` | the lending partner | keep, batched + promoted |
| `eligibility`, `opportunity`, `loan`, `loan_transition`, `payment`, `outcome` | the lending partner, the sponsor | keep |
| `allocation`, `capital_route` | the investor | **defer** |
| `settlement_route` | the settlement counterparty | **defer** |

`allocation`, `capital_route` and `settlement_route` serve the investor and settlement flows that [STUDY-SPLIT.md §8](STUDY-SPLIT.md) already establishes do not exist in the live product, because the investor console is deferred for regulation. Anchoring them in the real contract means maintaining three instructions, three account types and three domain tags for a reader who is not there yet.

Leave the instructions out of v1 of the real contract and add them when the console unblocks. The domain tags in `audit-commitments` can stay — they cost nothing and they are the published record of the intended model.

**That is the honest version of "the perfect is the enemy of the good".** The hackathon program models the complete economic loop, which is exactly right for a showroom: a visitor should be able to see the whole thing. The real contract should anchor what someone reads, and the reader list is shorter than the loop. Six kinds plus the loan chain, not fifteen.

### 8.6 What the chain never did, and nobody should claim it did

One thing to hold on to while cutting, because it is the easiest claim to overstate and the hardest to walk back.

Every payload on chain is a hash. The program validates **sequence and uniqueness** — that a month is anchored once, that an eligibility had a `CreditReady` readiness in front of it, that an outcome belongs to a loan that disbursed. It has never validated that a figure is *true*. A wrong revenue number, honestly reported and correctly committed, produces a perfect proof of a wrong number.

That is not a flaw to fix; it is the boundary of what this layer is for, and the reason the dependency rules matter at all. What the chain buys is that **the story is forward-only**: we cannot construct a credit history in retrospect. Both of the batching changes above preserve that property exactly, because the root is timestamped and a leaf cannot be added to a root that is already written.


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
5. Anchor the set in §8.4–8.5, not the current fifteen kinds: check-ins and readiness batched into a monthly root with readiness promoted to its own account when an eligibility cites it, the credit chain unchanged, and `allocation`, `capital_route` and `settlement_route` left out until there is an investor console to read them.
6. Events on every anchoring instruction.
7. `token_interface` instead of pinned SPL Token and a hand-read offset.
8. Enforce `schema_version` or remove it.

**Keep unchanged**
The commitment discipline, the dependency rules and their refusals, the upgrade-authority-gated initialisation — and the append-only property itself, which §8.4 preserves because a leaf cannot be added to a root already written. What changes is one account per record, not the model.

**Then have it audited by someone else.** This review is useful and it is not an audit — it is one reader going through 1,455 lines knowing what they expect to find. Before real money moves through `vault_transfer`, the program needs a reviewer with no prior belief about what it says.

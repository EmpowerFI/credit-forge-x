# Business Passport

A verifiable record of a business's activity, built from the daily WhatsApp journal, that a woman can choose to show to a partner — a bank, a fintech, an impact investor — without EmpowerFI becoming a public ledger of her finances.

This is the plan agreed on 2026-10-18 after a critical review of the founder's specification, and what of it is built.

## Decisions

- **Input stays structured.** The daily form is the way figures come in; no free-text interpretation by a model. Revisit with real usage.
- **Late entries stay out.** Today or yesterday, as the credit adviser set it. Revisit with real usage.
- **Credential format: W3C VC 2.0 secured with VC-JOSE (SD-JWT),** not Data Integrity with JSON-LD. Any JOSE library verifies it, and selective disclosure is how a share shows only the indicators she authorised.
- **Custodial, said plainly.** She holds no wallet; EmpowerFI keeps the credential on her behalf and she controls sharing through WhatsApp.
- **Evidence levels exist only when there is evidence.** Everything today is `SELF_DECLARED`. `EXTERNALLY_VERIFIED` arrives with an external source (Open Finance, statements), not before.
- **The signing key never sits in the database.**
- **Anchoring of snapshots and credentials in Merkle batches via Memo.** The existing `empowerfi_audit` program keeps the credit lifecycle until the mainnet redesign; per-borrower accounts make a pseudonymous borrower's cadence visible, which batches avoid.
- **The API serves the first partner,** not a catalogue: a time-limited verification link and a status check.

## Steps

| | | |
|---|---|---|
| 1 | Close the daily journal: correction without losing history, closed vs no-sales days, coverage | **built** (#87) |
| 2 | Immutable, versioned monthly snapshots | **built** (#88) |
| 3 | Sharing authorisation: purpose, scope, recipient, expiry, preview before she agrees | **built** (#89) |
| 4 | Business Passport: signed SD-JWT credential, status list, verification link | **built** (below) |
| 5 | Merkle batch anchoring of snapshots and credentials on Solana devnet | |
| 6 | Minimal API for the first partner | |

## Step 2 — monthly snapshots

`metric_snapshots` (migration `20261117000000_a_month_is_a_record_with_versions.sql`).

- **When.** Every final month of the journal with at least one kept day, written by `journal_close_month` as the month closes (the 2nd). A month that counts for credit is also assembled into `checkins`, as before.
- **What.** The pseudonymous subject (`passport_subjects.subject_ref`, `B-` and ten random characters, derived from nothing about her), period, version, methodology (`snapshot-v1.0.0`), evidence level (`SELF_DECLARED`), data origin (`whatsapp_journal`), how many lines it rests on, and the indicators: sales (and by payment method), business expenses, the business balance — sales minus business expenses as declared, **not a profit** — withdrawals, equipment, debt, receivable, payable, days kept, closed and selling, coverage, whether it counts for credit, the change in sales against the previous month's snapshot, and how many lines were struck through.
- **A random salt per snapshot,** fixed when it is written, so a published commitment cannot be tested against guesses of her figures.
- **Never edited.** A trigger refuses any update except setting the commitment once, and any delete except as part of erasing her (LGPD).
- **Corrections are versions.** Staff strike through a line with a reason (`journal_admin_void`) and issue the next version (`snapshot_correct`), which names the one it supersedes and brings the credit engine's month in line. A version that changes nothing is refused. `snapshot_history` lists every version. Staff means the credit platform's admins or an owner of the dashboard.

## Step 3 — sharing authorisation

`share_authorisations` (migration `20261118000000_she_sees_what_goes_before_it_goes.sql`). The broad AUTORIZO of the rewards programme is retired: nothing of hers reaches a partner on it now.

- **One share, one recipient, one purpose, one list, one period of time.** A share names a recipient (`passport_recipients`, kept by staff with `passport_recipient_save`), a purpose from a fixed list (`credit_offer` for now), indicators from a fixed vocabulary (`private.share_indicators`), the exact snapshot versions of the months it covers, and how many days it lasts once she agrees (1 to 90). By default a credit offer gets sales, business expenses, business balance and days kept, for the last three closed months, for 30 days -- what the decision needs and no more. Staff can propose a different list.
- **She reads it before she agrees, with her own figures.** The database writes the message, month by month, and stores it exactly as sent, with its SHA-256. It says who will see it, what for, until when, that the figures are declared by her, and what does **not** go: her name, phone, CPF, or any single sale or expense. A pseudonymous code stands in for her name; if the partner wants to make an offer, it reaches her through EmpowerFI.
- **How it reaches her.** A partner benefit whose milestone names its recipient (`reward_milestones.recipient_code`) proposes the share the moment she earns it; otherwise staff propose it (`share_propose`, optionally tied to the waiting benefit). Either way it is sent right after her next record, inside the window she opened, so it costs nothing. She has seven days from delivery to answer AUTORIZO or NÃO; after that it lapses. One open proposal at a time, so the answer is never ambiguous.
- **AUTORIZO** authorises it for its days, releases the benefit that was waiting, and, if her consent record did not yet include the partner scope, adds a record that does (assessment is never turned on by a share). **NÃO** declines it, and nothing goes. **AUTORIZAÇÕES** lists the shares in force; **ENCERRAR n** ends one at once.
- **Nothing is rewritten.** A trigger keeps every column she was shown fixed and lets the status only move forward: proposed to authorised, declined or lapsed; authorised to revoked. A month corrected after she agreed does not change what she agreed to share; a new share does.
- **What it opens.** `private.share_is_live` -- authorised, within its days, not ended, recipient still active -- is the gate step 4 checks before a credential or a link shows anything. `share_history` gives staff every share with its exact text.

## Step 4 — the signed credential and the link

`passport_credentials`, `share_links`, `share_accesses` (migration `20261119000000_a_month_signed_and_shown_only_as_she_allowed.sql`), the `passport` Edge Function, `packages/passport`, and the page `/app/passport/<token>`.

- **One credential per snapshot version.** A W3C Verifiable Credential (Data Model 2.0, base context only), secured with SD-JWT as VC-JOSE-COSE describes it: header `typ: vc+sd-jwt`, `alg: ES256`, `kid` the key's RFC 7638 thumbprint. Type `BusinessActivityCredential`. Always visible: the pseudonymous subject (`urn:empowerfi:subject:B-…`), the month, days in the month, currency, snapshot version, methodology, `evidenceLevel: SELF_DECLARED`, data origin. Disclosable one by one: the nine indicators of the share vocabulary. Valid for a year from issuance.
- **Signed when first needed.** The first time a link opens a month, the function signs it and the database keeps the result. A month nobody is ever shown is never signed. The stored credential is written once.
- **A share shows only what she authorised.** The link serves each month as a presentation of the same signed credential with only her authorised disclosures. No holder key binding: she has no wallet, and EmpowerFI presents on her behalf only under a live share.
- **Revocation: a Bitstring Status List** (W3C v1.0, 131,072 positions, served signed as `typ: vc+jwt` at `…/passport/status/1`). Each credential takes a random position that is never reused. A credential is revoked when its month is corrected (a new snapshot version supersedes it) or when she is erased: her rows go, the positions they held stay revoked as tombstones.
- **The link.** Staff create it for a live share (`share_link_create`, which returns the token once and keeps only its SHA-256; a new link closes the previous one). It stops opening the moment the share ends, by expiry or by ENCERRAR. Every opening is recorded, and AUTORIZAÇÕES tells her how many times the recipient opened it and when last. An unknown, expired or ended link says only which of the three it is.
- **The page** `/app/passport/<token>` shows the share, each month's disclosed figures, and checks each month in the visitor's browser: signature, revocation, validity, and the evidence level said in words. The issuer it trusts is pinned by the deployment (`VITE_PASSPORT_ISSUER`), never read from the link.
- **Independent verification.** `npx tsx scripts/passport/verify.mts <link url>` checks a link with none of our code: the signature through Node's OpenSSL, the disclosure digests and the status list from the specifications. Tampering with a single figure fails it.

### The signing key

It lives only in the `passport` function's secrets, one per environment, never in the database or the repository.

```
npx tsx scripts/passport/generate-key.mts ~/.config/empowerfi/passport-prod.env
npx supabase secrets set --env-file ~/.config/empowerfi/passport-prod.env --project-ref <ref>
```

The script writes the private key to that file only (mode 600, refusing paths inside the repository and existing files) and prints the public key and its `kid`.

**Rotating the key.** Generate a new file, add the old key's *public* JWK (printed when it was made, and served at `…/passport/jwks`) to `PASSPORT_RETIRED_KEYS` as a JSON array, then set the new `PASSPORT_SIGNING_KEY`. Credentials signed by the old key keep verifying. If a key is compromised, do not retire it: drop it, and re-issue is a follow-up (revoke every credential it signed).


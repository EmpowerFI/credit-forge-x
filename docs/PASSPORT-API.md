# EmpowerFI Business Passport — partner API

**Written for:** engineers at a partner institution integrating with EmpowerFI. Version 1.

The Business Passport is a verifiable record of a small business's monthly activity, kept day by day by the entrepreneur in EmpowerFI's WhatsApp journal. You can read it only when she has authorised you: for one purpose, for the indicators and months she saw before agreeing, and for a limited number of days. She can end it at any time. Every read is recorded and she can see when you read it.

## What you receive

For each month, the response carries a **W3C Verifiable Credential** (Data Model 2.0) secured with **SD-JWT** (`typ: vc+sd-jwt`, `alg: ES256`). Only the indicators she authorised are disclosed. You can check every piece yourself, without trusting EmpowerFI's servers:

| check | how |
|---|---|
| signature | ES256 against `GET {issuer}/jwks`, by `kid` |
| disclosures | each disclosure's SHA-256 must be in `credentialSubject._sd` |
| revocation | W3C Bitstring Status List at `credentialStatus.statusListCredential` (a `vc+jwt` signed by the same issuer) |
| validity | `validFrom` / `validUntil` |
| existence in time | the month's `anchor`: an RFC 9162 Merkle proof to a root that a Solana devnet Memo, signed by the authority at `GET {issuer}/anchoring`, carries |

`scripts/passport/verify.mts` in our repository does all of it with Node's built-in crypto and no EmpowerFI code. It is a reference you can port.

**Evidence level.** Every month is `SELF_DECLARED`: her own records, not checked against a bank statement or any other independent source. Read the figures that way.

**What is not in it.** Her name, phone, tax ID, address, or any single sale or expense. She is identified by a pseudonymous `subject_ref` (`B-` followed by ten characters) that is stable across her months. To make her an offer, contact EmpowerFI with the share's `id`.

## Authentication

```
Authorization: Bearer efp_…
```

EmpowerFI creates your key and gives it to you once. Keep it in a secret store; anyone holding it reads what you can. Ask us to revoke it if it leaks, and for a new one when you rotate. A key reads only the shares authorised to your institution.

Base URL: `https://<project>.supabase.co/functions/v1/passport`. We will tell you the production one.

## Endpoints

### `GET /api/v1/shares`

The shares in force for you now.

```json
{
  "status": "ok",
  "shares": [
    {
      "id": "ccc7c188-822f-48fc-b4cf-2d2513bde5e8",
      "subject_ref": "B-26mlea4zd6",
      "purpose": "credit_offer",
      "periods": ["2026-09", "2026-10", "2026-11"],
      "indicators": ["revenue_cents", "business_expenses_cents", "business_balance_cents", "days_kept"],
      "authorised_at": "2026-10-19T21:55:47Z",
      "expires_at": "2026-11-18T21:55:47Z"
    }
  ]
}
```

### `GET /api/v1/shares/{id}`

One share and its months. **Recorded as a read**, and shown to her.

```json
{
  "status": "live",
  "passport_version": "passport-v1.0.0",
  "issuer": "https://<project>.supabase.co/functions/v1/passport",
  "jwks": "…/jwks",
  "anchoring": "…/anchoring",
  "share": { "id": "…", "recipient": "…", "purpose": "credit_offer", "subject_ref": "B-…",
             "indicators": ["…"], "authorised_at": "…", "expires_at": "…" },
  "months": [
    {
      "period": "2026-10",
      "version": 1,
      "superseded": false,
      "presentation": "eyJhbGciOiJFUzI1NiIs…~WyJ…~WyJ…~",
      "anchor": {
        "batch_no": 3, "size": 6, "index": 1, "root": "cd01…", "proof": ["…"],
        "signature": "2YDQ…", "slot": 36, "block_time": "2026-10-19T21:23:13Z",
        "cluster": "devnet", "authority": "gZ9J…"
      }
    }
  ]
}
```

- `presentation`: the SD-JWT, `<issuer-signed JWT>~<disclosure>~…~`, without key binding. Disclosed claims are in `credentialSubject` once verified. Amounts are integer cents of BRL. `days_kept` is out of `credentialSubject.daysInPeriod`.
- `superseded: true`: the month was corrected after she authorised the share. Its credential is revoked, and seeing the corrected version needs a new authorisation from her.
- `anchor: null`: not in a confirmed batch yet. Batches go out once a day.

### `GET /api/v1/shares/{id}/status`

Whether a share is still in force. **Not** recorded as a read: it returns no figure.

```json
{ "status": "live", "id": "…", "expires_at": "2026-11-18T21:55:47Z", "ended_at": null }
```

`status` is `live`, `expired` (its days ran out) or `ended` (she ended it). Do not keep using figures from a share that is no longer live, beyond what the law requires you to retain.

## Errors

| HTTP | `status` | meaning |
|---|---|---|
| 401 | `unauthorised` | no key, unknown key, revoked key |
| 404 | `not_found` | no such share for your institution |
| 410 | `expired` / `ended` | the share is no longer in force |
| 503 | `not_configured` | the issuer is not set up in this environment |
| 500 | `error` | ours; retry later |

## Indicators

| key | meaning |
|---|---|
| `revenue_cents` | sales in the month |
| `business_expenses_cents` | business expenses: stock, packaging, operating costs, staff |
| `business_balance_cents` | sales minus business expenses, **as declared — not a profit** |
| `days_kept` | days she recorded (a day with no sales counts when she says so) |
| `selling_days` | days with at least one sale |
| `receivable_cents` / `payable_cents` | sales and expenses on credit, still to be received or paid |
| `withdrawals_cents` | money taken out for the household |
| `financing_cents` | loan or debt instalments paid |

Equipment purchases and debt instalments are kept outside the business balance on purpose.

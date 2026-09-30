# platform/ — the hackathon backend

Supabase project `empowerfi-hackathon` (`yuxrujoghizcfdmbkqfg`). Kept in its own
workdir so that nothing here can be pushed to the website's database, which the
root `supabase/` folder is linked to. Always pass `--workdir platform`.

```
platform/supabase/
├─ migrations/     schema, RLS, RPCs, anchoring pipeline
├─ tests/          pgTAP — run locally and against the linked project
└─ functions/
   ├─ readiness-evaluate/    runs the readiness engine for a participant, records the result
   ├─ eligibility-evaluate/  runs the eligibility engine for her open request, records it
   ├─ anchor-submit/         writes queued commitments to the empowerfi_audit program
   ├─ anchor-reconcile/      re-checks confirmed proofs against the chain and the records
   ├─ investment-confirm/    turns a wallet's devnet USDC deposit into an allocation
   ├─ vault-settle/          releases to the off-ramp and instalment payouts, from the vault
   ├─ vault-refund/          returns declined or withdrawn allocations from the vault
   ├─ zcash-request/         a ZIP 321 request to fund an opportunity with shielded ZEC
   ├─ zcash-watch/           reads the shielded treasury with its viewing key, credits the vault
   ├─ ramp-quote/            MoneyGram Ramps sandbox quote for a USDC cash-out to Brazil (cash pickup, $2–$500)
   ├─ fx-quote/              USDC/BRL from Mercado Bitcoin and USD/BRL from the Banco Central, every ten minutes
   └─ _shared/               vendored copies of packages/ (do not edit, see its README)
```

## Everyday commands

```sh
npx supabase start --workdir platform -x studio,imgproxy,vector,logflare,supavisor,storage-api,realtime,postgres-meta
npx supabase db reset --workdir platform          # rebuild the local DB from migrations
npx supabase test db --workdir platform           # pgTAP, local
npx supabase test db --linked --workdir platform  # pgTAP, remote, in a rolled-back transaction
npx supabase db push --workdir platform           # apply new migrations to the remote
npx supabase functions deploy <name> --workdir platform  # each of the eleven
npm run platform:types                            # regenerate src/app/lib/platform.types.ts
npm run platform:sync-shared                      # after changing packages/audit-*
```

Local ports are 553xx so this stack runs beside the mobile app's (543xx).

## Demo data

```sh
# service key into a mode-600 file, never on a command line
npx supabase projects api-keys --project-ref yuxrujoghizcfdmbkqfg --reveal -o json  # take the "secret" key
PLATFORM_SERVICE_KEY_FILE=<file> npx tsx scripts/platform/seed-demo-accounts.mts        # accounts + the P2P desk
PLATFORM_SERVICE_KEY_FILE=<file> npx tsx scripts/platform/seed-demo.mts --yes          # scenario
# wallets for the tokenised positions; --investor-wallet is the one you will connect in the demo
PLATFORM_SERVICE_KEY_FILE=<file> OPERATOR_KEYPAIR_FILE=<file> \
  npx tsx scripts/platform/seed-positions.mts --investor-wallet <address>
```

`seed-demo` resets the scenario (`reset_demo_data`) and rebuilds it
deterministically, in about 30 seconds:

- 4 verified communities, 100 participants (Maria Oliveira, `maria@demo`,
  among them), education progress, six months of check-ins shaped by business
  profiles, a readiness assessment for everyone — same engine, same recording
  function as the live path;
- the two pools of P2P capital, simulated and sized to the demand: domestic
  capital alone covers about 38% of qualified demand, both pools about 96%;
- requests from some of those who are ready, each through the eligibility
  engine and allocated to a pool by the Capital Allocation Engine as it opens
  to investors; investors' simulated positions, partly filling most
  opportunities; the desk's formalisations and declines taken in the desk's
  own session (one funded opportunity left ready to formalise); one
  short-history request held for manual review;
- a first cycle: six loans from July, repaid on time, paid off early or late,
  with outcomes measured in September.

It holds the anchor worker's lease while it runs: first-cycle facts are dated
after the functions record them, and must not be anchored before. About 1,000
proofs then confirm over the next half hour or so. It prints the personas (the
ready participant kept without a request, Jaqueline Pereira, and the one
awaiting review, Sônia Santos), the desk's queue, and the capital figures:
qualified demand, each pool's liquidity and coverage. Everything is
`is_simulated`.

Each run writes new devnet accounts (refs are random), about 1 SOL of rent
from the operator. Check `solana balance <operator>` before re-seeding.

Maria has July and August: her September check-in, done live, makes her ready.

Demo logins, all with password `EmpowerFI-demo-2026`: `admin@`, `leader@`,
`maria@`, `partner@`, `investor@`, `auditor@demo.empowerfi.io`.

## The anchoring pipeline

```
RPC writes a fact  →  chain_anchors row (pending, maybe depends_on another)
pg_cron, every 10s →  private.dispatch_anchor_jobs() — only if a job is due
                   →  pg_net POST anchor-submit, header x-anchor-secret
anchor-submit      →  claim_anchor_jobs → commitment → send → confirm
                   →  complete_anchor_job | fail_anchor_job (backoff, then failed)
```

Before sending, anchor-submit looks the account up on chain: the same
commitment means a previous run already wrote it (the signature is recovered);
a different one is a mismatch and fails for good.

One run at a time: `start_anchor_run` is a lease, and the dispatcher stays
quiet while it is held. Parallel runs used to hit the public devnet RPC's rate
limit (429); a run that meets one stops and hands back the jobs it had not
reached (`release_anchor_jobs`). Each claimed batch is sent whole and then
confirmed in one status query, and a blockhash is reused for 20 s.

Through Helius, a full seed's 700 anchors confirm in about nine minutes, all
on the first attempt. Through the public RPC it took 16.5 minutes and hundreds
of rate-limited retries. The browser's audit screen keeps using the public RPC:
a key in the site's bundle would be visible to every visitor.

## Scheduled work

`pg_cron` dispatches each job through `pg_net`, with the anchoring secret; most run only when something is due:

| Job | Function | When |
|---|---|---|
| `dispatch-anchor-jobs` | `anchor-submit` | every 10 s, while commitments are queued |
| `reconcile-anchors` | `anchor-reconcile` | every minute, while a proof is due its daily check |
| `vault-settle` | `vault-settle` | checked every 15 s; runs when a settlement leg is due |
| `vault-refunds` | `vault-refund` | checked every 15 s; runs when a wallet allocation is due a refund |
| `zcash-watch` | `zcash-watch` | every minute, once a treasury is configured |

How money moves through them is in [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#money-investing-the-vault-and-settlement).

## Reconciliation

`anchor-reconcile`, dispatched every minute by `private.dispatch_reconcile()`
while any confirmed proof is due (never checked, or not for a day), takes up to
200 at a time. It recomputes each commitment from the record as it is now and
compares it with the stored one and the account on chain: `verified`,
`missing` or `mismatch`, with `reconcile_note`. Read-only on chain; same secret
and URL (with `anchor-submit` replaced) as the anchoring function. The audit
screen shows the last result.

## Zero-PII scan

```sh
PLATFORM_SERVICE_KEY_FILE=<file> SOLANA_RPC_URL=<rpc> npx tsx scripts/platform/scan-chain-pii.mts
```

Reads every account the program owns, checks each is a reviewed type at its
fixed size, and searches the bytes for every name, e-mail, place and amount in
the database. Exits non-zero on any finding.

## Secrets, once per environment

Never committed. The operator key is the one in `~/empowerfi-hackathon-keys/`.

| Where | Name | Value |
|---|---|---|
| Function secrets (`supabase secrets set --env-file`) | `OPERATOR_KEYPAIR` | the operator keypair JSON array |
| | `ANCHOR_CRON_SECRET` | random, 32 bytes hex |
| | `SOLANA_RPC_URL` | Helius devnet URL, from `~/empowerfi-hackathon-keys/helius-devnet-rpc.url` (it carries the API key). Falls back to the public devnet RPC if unset |
| | `MONEYGRAM_BASE_URL`, `MONEYGRAM_SECRET_KEY` | MoneyGram Ramps sandbox, from `~/empowerfi-hackathon-keys/moneygram/sandbox.env`; only `ramp-quote` reads them |
| | `ZCASH_LIGHTWALLETD` | optional; defaults to a public Zcash testnet lightwalletd |
| Database (`scripts/platform/zcash-treasury.mts`) | the treasury's address and unified viewing key | read by `zcash-watch` and by auditors; the spending key never leaves the wallet outside the repository |
| Vault (`select vault.create_secret(value, name)`) | `anchor_submit_url` | `<functions url>/anchor-submit` |
| | `anchor_cron_secret` | same value as `ANCHOR_CRON_SECRET` |

Write secret values into a temporary file with mode 600 and pass it with
`--env-file` / `db query -f`, so they never appear on a command line.

**Nothing to set for the crossing.** The ZEC leg's live prices come from NEAR
Intents' 1Click API, called from the browser with dry quotes — no key, no
function, no secret, and no deposit address in the reply, so there is nothing
here that could move funds. If you are looking for a key because a crossing
panel says the price could not be read, there is none to find: the network was
unreachable, and every other screen carries on without it.

## Anchoring locally

The local edge runtime (Deno 2.1-compatible) times out booting this function
while it fetches its npm dependencies, so run it with Deno directly instead,
against the local database, and call it by hand:

```sh
cd platform/supabase/functions/anchor-submit
SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
  npx deno@2.9.6 run --allow-net --allow-env --allow-read --env-file=../.env index.ts
curl -X POST -H "x-anchor-secret: <ANCHOR_CRON_SECRET from ../.env>" http://127.0.0.1:8000/
```

`../.env` holds the three function secrets for local use (git-ignored). Local
runs write real devnet accounts — keyed by random refs, so they never collide
with the remote's.

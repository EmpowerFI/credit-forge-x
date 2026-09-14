# platform/ — the hackathon backend

Supabase project `empowerfi-hackathon` (`yuxrujoghizcfdmbkqfg`). Kept in its own
workdir so that nothing here can be pushed to the website's database, which the
root `supabase/` folder is linked to. Always pass `--workdir platform`.

```
platform/supabase/
├─ migrations/     schema, RLS, RPCs, anchoring pipeline
├─ tests/          pgTAP — run locally and against the linked project
└─ functions/
   ├─ anchor-submit/   writes queued commitments to the empowerfi_audit program
   └─ _shared/         vendored copies of packages/ (do not edit, see its README)
```

## Everyday commands

```sh
npx supabase start --workdir platform -x studio,imgproxy,vector,logflare,supavisor,storage-api,realtime,postgres-meta
npx supabase db reset --workdir platform          # rebuild the local DB from migrations
npx supabase test db --workdir platform           # pgTAP, local
npx supabase test db --linked --workdir platform  # pgTAP, remote, in a rolled-back transaction
npx supabase db push --workdir platform           # apply new migrations to the remote
npx supabase functions deploy anchor-submit --workdir platform
npm run platform:sync-shared                      # after changing packages/audit-*
```

Local ports are 553xx so this stack runs beside the mobile app's (543xx).

## Demo data

```sh
# service key into a mode-600 file, never on a command line
npx supabase projects api-keys --project-ref yuxrujoghizcfdmbkqfg --reveal -o json  # take the "secret" key
PLATFORM_SERVICE_KEY_FILE=<file> npx tsx scripts/platform/seed-demo-accounts.mts        # accounts + partner
PLATFORM_SERVICE_KEY_FILE=<file> npx tsx scripts/platform/seed-demo.mts --yes          # scenario
```

`seed-demo` resets the scenario (`reset_demo_data`) and rebuilds it
deterministically: 4 verified communities, 100 participants (Maria Oliveira,
`maria@demo`, among them), education progress, six months of check-ins shaped
by business profiles, a readiness assessment for everyone (same engine, same
recording function as the live path) and credit intents for some of those who
are ready. It prints the ready participant kept without a request, for the
demo. Every fact is queued for devnet. Everything is `is_simulated`.

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

## Secrets, once per environment

Never committed. The operator key is the one in `~/empowerfi-hackathon-keys/`.

| Where | Name | Value |
|---|---|---|
| Function secrets (`supabase secrets set --env-file`) | `OPERATOR_KEYPAIR` | the operator keypair JSON array |
| | `ANCHOR_CRON_SECRET` | random, 32 bytes hex |
| | `SOLANA_RPC_URL` | Helius devnet URL, from `~/empowerfi-hackathon-keys/helius-devnet-rpc.url` (it carries the API key). Falls back to the public devnet RPC if unset |
| Vault (`select vault.create_secret(value, name)`) | `anchor_submit_url` | `<functions url>/anchor-submit` |
| | `anchor_cron_secret` | same value as `ANCHOR_CRON_SECRET` |

Write secret values into a temporary file with mode 600 and pass it with
`--env-file` / `db query -f`, so they never appear on a command line.

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

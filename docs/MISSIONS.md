# EmpowerFI Missions — campaign vaults on Solana

A sponsor buys a 30-day campaign, priced per entrepreneur, for at least 100 entrepreneurs. The money goes into a vault on Solana devnet that the campaign's own account owns. The terms are written on chain:

- 50% goes to EmpowerFI and 50% to the entrepreneurs.
- An entrepreneur's reward unlocks after she keeps the diary for 30 days.
- **Impact Marketing** is the only sponsorship product. What is not claimed goes to EmpowerFI, under the campaign terms.
- Product activations are not a campaign type: since 9 November 2026 they are handled as strategic partnerships, outside Missions. The program still has an `Activation` reward kind and refuses it; nothing on the site, the page or the dashboard offers it.

**Co-sponsors** (since 9 November 2026, migration `20261228000000`): a published campaign that is still running can be joined by other sponsors. Each co-sponsor creates its own on-chain campaign and vault with the lead's exact days; the database links it (`campaign_vaults.joins`) and `campaign-register` checks the lead is published, running, with the same dates, and that the wallet is not in it already. The page shows one campaign with every sponsor and the sums; each vault is attested and pays on its own, so an entrepreneur who keeps the days is paid once by each sponsor. Each co-sponsorship is reviewed in the dashboard like any vault, and shows only while its lead is published. The program is unchanged.

The page at **`/app/missions`**, inside the platform (Explore the platform), is open to anyone without a sign-in. It reads the app's production database (`campaign_vaults_public()`) and checks it against the chain's own account.

## What is where

| Piece | Where |
|---|---|
| Program `empowerfi_rewards` | `programs/empowerfi-rewards`: `create_campaign`, `fund_campaign`, `attest_engagement`, `pay_reward`. LiteSVM tests in `tests/rewards.rs`. |
| Database | Migrations `20261222000000_a_campaign_paid_into_a_vault_on_solana.sql` (`campaign_vaults`, `campaign_attestations`, `private.campaign_leaf_salts`) and `20261226000000_her_reward_wallet_and_the_campaigns_she_is_in.sql` (`private.reward_wallets`, `campaign_payments`, `private.vault_cohort`). |
| Daily proof and payments | Edge Function `campaign-attest`, called by the `campaign-attest` cron at 23:40 São Paulo: it attests, writes new wallets' addresses, then pays. |
| Registration | Edge Function `campaign-register`, called by the page after the sponsor's transaction. |
| Open page | `src/app/missions/` (route `/app/missions`; a card on the platform entrance and a link in its header). |
| Scripts | `scripts/rewards/generate-keys.mts`. |

## Who takes part

Every entrepreneur of the diary whose latest consent says yes to the impact figures takes part in every listed campaign. She does not join one from the diary. Her days are the ones she really recorded in the diary within the campaign's window, which may start up to 29 days ago, so the diary's history counts.

The page shows, for each campaign:

- **Participants:** everyone who shares her impact figures.
- **Active:** those who recorded at least one day in the window.
- **Completed 30 days:** those who kept the campaign's days.
- **Mean days:** the average of days kept by those who recorded.
- **Paid:** the rewards confirmed on chain.

At the top, the page adds up what the sponsors sent to the vaults and the rewards paid.

## Her reward wallet

Every entrepreneur gets a reward wallet: the program's address at `["recipient", her wallet ref]`.

- **No key exists.** Nothing anywhere holds a key for it, and only the program moves what it holds.
- **Opaque.** The ref is a random uuid in `private.reward_wallets`, created when she enters the diary (a trigger on `entrepreneurs`), so the address says nothing of who she is.
- **On-chain accounts.** Her token account is created by the first reward paid into it.
- **Later.** A later version of the program will move rewards from it to a wallet she chooses, for example a partner app. That is not built yet.

## Privacy

Every count obeys the five-woman floor that sponsors already have. Below five women in a campaign, the page shows no count, and nothing is attested or paid on chain.

What does go on chain:

- the counts: how many women are in the campaign, and how many kept the 30 days;
- a Merkle root over salted leaves (`sha256("EMPOWERFI:CAMPAIGN_LEAF:v2" || campaign uuid || wallet ref || salt)`), one leaf per woman who kept the 30 days;
- each reward paid: her wallet's address, the amount, and her leaf.

No name, e-mail or business figure goes on chain. The database keeps the salts, the leaves, and which wallet is whose.

## Money

- The vault is the associated USDC account of the campaign PDA (`["campaign", campaign uuid]`), so only the program can sign for it.
- **`pay_reward` pays one woman at a time.** The operator, whose key sits in the Edge Function, gives her wallet ref, her salt and her leaf's RFC 9162 inclusion proof against the root attested last.
  - The program rebuilds her leaf and checks the proof.
  - It pays her share (the entrepreneurs' half split by seats) into a token account her wallet owns.
  - It writes a receipt at `["paid", campaign, wallet ref]`, so she is paid once.
  - It refuses any payment that would dig into EmpowerFI's half.
- **The operator cannot pay anyone else.** It cannot pay a leaf outside the root, send money to a wallet other than the leaf's own, or touch the house's half.

## Who sponsors

The sponsor is whoever connects a wallet on `/app/missions`. The steps:

1. **Sign one transaction.** Under *Sponsor a campaign* the sponsor fills in its name, the campaign's name, the start date (30 days from it), the seats (at least 100) and the price per entrepreneur (at least 0.01 USDC). It then signs one transaction. That transaction creates the campaign with `create_campaign`, creates the campaign's own USDC account, and pays price × seats into it with `fund_campaign`. The connected wallet is the sponsor on chain.
2. **The chain is checked.** The page then calls `campaign-register`, which is open and has no sign-in. It trusts only the chain:
   - the transaction landed and touched the campaign;
   - the account belongs to the program;
   - the account carries EmpowerFI's terms: its operator, its house wallet, devnet USDC, at least 100 seats, 30 days, funded in full;
   - the terms commitment matches;
   - the vault holds the funds.
3. **It is recorded, unlisted.** `campaign_register` writes the sponsor, the campaign and its vault. The campaign starts **unlisted and invited**: the names a wallet typed show nowhere until EmpowerFI reviews them. A wallet can reuse only a sponsor name it registered itself, never the house's or a dashboard sponsor's.
4. **EmpowerFI approves it.** Someone who manages campaigns lists it. Listing shows it on the page, and from then on it is attested and paid. The diary no longer offers it to join, because everyone who shares her figures is already in it.

   ```sql
   select public.campaign_vault_list('<campaign id>', true);   -- false takes it back
   ```

Shared code lives in `packages/campaign-vault`: addresses, terms, instruction bytes and the account layout. The Edge Functions use a copy in `_shared/campaign-vault`, kept in sync with `npm run platform:sync-shared`.

## Setting it up, once

All keys go to `~/.config/empowerfi/rewards/`, outside the repo. Nothing secret is printed.

1. **Generate the keys.** This also writes the program id into `lib.rs` and `Anchor.toml`.

   ```
   npx tsx scripts/rewards/generate-keys.mts ~/.config/empowerfi/rewards <prod-ref>
   ```

   The script also writes a sponsor key, which is EmpowerFI's own wallet. Its address is `HOUSE_WALLET` in the package: EmpowerFI's half belongs to it, and it never sponsors by default.
2. **Build and deploy** the program, with the Helius RPC and the fixed buffer:

   ```
   cargo-build-sbf --manifest-path programs/empowerfi-rewards/Cargo.toml --sbf-out-dir target/deploy
   solana program deploy target/deploy/empowerfi_rewards.so --program-id <keys>/program-keypair.json \
     --buffer <keys>/buffer-keypair.json -u "$RPC" --use-rpc --with-compute-unit-price 50000 --max-sign-attempts 300
   ```

3. **Apply the migrations and deploy the functions.** Migrations are `20261222…` and `20261223…`; functions are `campaign-attest` and `campaign-register`.
4. **Set the operator secrets.** Then run `operator-vault.sql` once and delete it.

   ```
   npx supabase secrets set --env-file <keys>/operator.env --project-ref <prod-ref> --workdir platform
   ```

## Tested

- **Program:** 14 LiteSVM tests covering the terms, the 100-seat floor, the 30-day minimum, Activation refused, funding once, only the sponsor funds, the vault owned by the campaign, only the operator attests, and the counts adding up.
- **On a local validator, with a test mint at the devnet USDC address:**
  - the sponsor transaction, built as the page builds it from `packages/campaign-vault`, created and funded a campaign with 10 USDC in the vault;
  - every check `campaign-register` runs passed;
  - an attestation encoded by `_shared/campaign.ts` landed and was read back.
- **Registration on a fresh database:**
  - a campaign registers unlisted and invited, and registering it again is a no-op;
  - the same wallet may reuse its sponsor name, but another wallet, or the house name, is refused;
  - only staff can list, and listing opens it and puts it on the page;
  - anon cannot register.
- **Database:** on a fresh database, four women produce no attestation and no counts. Six women, two of whom kept 31 days, produce counts of 6 and 2 and two leaves. The anon role reads only the public function.

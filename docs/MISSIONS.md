# EmpowerFI Missions — campaign vaults on Solana

A sponsor buys a 30-day campaign, priced per entrepreneur, for at least 100 entrepreneurs. The money goes into a vault on Solana devnet that the campaign's own account owns. The terms are written on chain:

- 50% goes to EmpowerFI and 50% to the entrepreneurs.
- An entrepreneur's reward unlocks after she keeps the diary for 30 days.
- **Impact** campaigns only for now. What is not claimed goes to EmpowerFI.
- **Activation** campaigns (30 days plus a verified activation, with unclaimed money going back to the sponsor) are refused by the program until an activation can be verified.

The page at **`/app/missions`**, inside the platform (Explore the platform), is open to anyone without a sign-in. It reads the app's production database (`campaign_vaults_public()`) and checks it against the chain's own account.

## What is where

| Piece | Where |
|---|---|
| Program `empowerfi_rewards` | `programs/empowerfi-rewards`: `create_campaign`, `fund_campaign`, `attest_engagement`. LiteSVM tests in `tests/rewards.rs`. |
| Database | Migration `20261222000000_a_campaign_paid_into_a_vault_on_solana.sql`: `campaign_vaults`, `campaign_attestations`, `private.campaign_leaf_salts`. |
| Daily proof | Edge Function `campaign-attest`, called by the `campaign-attest` cron at 23:40 São Paulo. |
| Open page | `src/app/missions/` (route `/app/missions`; a card on the platform entrance and a link in its header). |
| Scripts | `scripts/rewards/generate-keys.mts` and `scripts/rewards/create-campaign.mts`. |

## Privacy

Every count obeys the five-woman floor that sponsors already have. Below five women in a campaign, the page shows no count and nothing is attested on chain.

What does go on chain:

- the counts: how many women are in the campaign, and how many kept the 30 days;
- a Merkle root over salted leaves (`sha256("EMPOWERFI:CAMPAIGN_LEAF:v1:<campaign>:" || salt)`), one leaf per woman who kept the 30 days.

No name, e-mail or business figure goes on chain. The database keeps the salts and the leaves.

## Money

- The vault is the associated USDC account of the campaign PDA (`["campaign", campaign uuid]`), so only the program can sign for it.
- **This version only takes money in.** There is no instruction that pays rewards out.
- The operator key, which sits in the Edge Function, can only attest. It cannot move funds.

## Setting it up, once

All keys go to `~/.config/empowerfi/rewards/`, outside the repo. Nothing secret is printed.

1. **Apply the migration**, dev first and then prod. Deploy the function:

   ```
   npx supabase functions deploy campaign-attest --project-ref <ref> --workdir platform
   ```

2. **Generate the keys.** This also writes the new program id into `lib.rs` and `Anchor.toml`. Commit that change.

   ```
   npx tsx scripts/rewards/generate-keys.mts ~/.config/empowerfi/rewards <prod-ref>
   ```

3. **Fund the wallets:**
   - The deploy wallet (`~/.config/solana/id.json`) needs about 3 SOL for the deploy (≈200 KB).
   - The sponsor and the operator need a little SOL each: https://faucet.solana.com.
   - The sponsor also needs devnet USDC for price × seats: https://faucet.circle.com (Solana, Devnet).

4. **Build and deploy.** Use the Helius RPC and the fixed buffer, so a failed upload resumes instead of stranding rent:

   ```
   cargo-build-sbf --manifest-path programs/empowerfi-rewards/Cargo.toml --sbf-out-dir target/deploy
   RPC=$(cat ~/empowerfi-hackathon-keys/helius-devnet-rpc.url)
   solana program deploy target/deploy/empowerfi_rewards.so \
     --program-id ~/.config/empowerfi/rewards/program-keypair.json \
     --buffer ~/.config/empowerfi/rewards/buffer-keypair.json \
     -u "$RPC" --use-rpc --with-compute-unit-price 50000 --max-sign-attempts 300
   ```

5. **Set the operator secrets.** Then run `operator-vault.sql` once in the SQL Editor and delete it.

   ```
   npx supabase secrets set --env-file ~/.config/empowerfi/rewards/operator.env --project-ref <prod-ref> --workdir platform
   ```

6. **Create and fund a campaign.** This creates the campaign on chain and in one transaction prints the SQL that records it. That SQL creates the campaign row (sponsor EmpowerFI, open for women to join from the diary) and its vault row. Run it in the SQL Editor.

   ```
   REWARDS_KEYS=~/.config/empowerfi/rewards SOLANA_RPC_URL="$RPC" npx tsx scripts/rewards/create-campaign.mts \
     --name "Missão 30 dias" --starts 2026-11-10 --ends 2026-12-09 --seats 100 --price 0.10 \
     --operator <attesting operator address>
   ```

The dashboard keeps the name EmpowerFI for the house programme, so a campaign sponsored by EmpowerFI is created here and cannot be edited in the dashboard.

## Tested

- **Program:** 14 LiteSVM tests covering the terms, the 100-seat floor, the 30-day minimum, Activation refused, funding once, only the sponsor funds, the vault owned by the campaign, only the operator attests, and the counts adding up.
- **On a local validator:** `create-campaign.mts` created and funded a campaign (10 test USDC into the vault), then an attestation encoded by `_shared/campaign.ts` landed and was read back.
- **Database:** on a fresh database, four women produce no attestation and no counts. Six women, two of whom kept 31 days, produce counts of 6 and 2 and two leaves. The anon role reads only the public function.

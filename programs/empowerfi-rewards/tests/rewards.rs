//! Campaign vaults, exercised in LiteSVM: terms, funding, engagement.

use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::instruction::Instruction,
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    empowerfi_rewards::{
        leaf_commitment, verify_inclusion, Campaign, CampaignStatus, Receipt, RewardKind, RewardsError, CAMPAIGN_SEED,
        HOUSE_SHARE_BPS, MIN_SEATS, RECEIPT_SEED, RECIPIENT_SEED, TOKEN_PROGRAM_ID, UNLOCK_DAYS,
    },
    solana_sha256_hasher::hashv,
    litesvm::{types::TransactionResult, LiteSVM},
    solana_account::Account,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const NOW: i64 = 1_789_000_000;
const DAY: i64 = 86_400;
const USDC: u64 = 1_000_000;
const REF: [u8; 16] = [7; 16];

struct Env {
    svm: LiteSVM,
    sponsor: Keypair,
    operator: Keypair,
    house: Pubkey,
    mint: Pubkey,
    sponsor_tokens: Pubkey,
}

fn campaign_pda(r: &[u8; 16]) -> Pubkey {
    Pubkey::find_program_address(&[CAMPAIGN_SEED, r], &empowerfi_rewards::ID).0
}

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    svm.add_program(empowerfi_rewards::ID, include_bytes!("../../../target/deploy/empowerfi_rewards.so")).unwrap();
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = NOW;
    svm.set_sysvar(&clock);
    let (sponsor, operator) = (Keypair::new(), Keypair::new());
    svm.airdrop(&sponsor.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&operator.pubkey(), 10_000_000_000).unwrap();
    let (mint, sponsor_tokens) = (Pubkey::new_unique(), Pubkey::new_unique());
    put_mint(&mut svm, mint);
    put_token_account(&mut svm, sponsor_tokens, mint, sponsor.pubkey(), 10_000 * USDC);
    Env { svm, sponsor, operator, house: Pubkey::new_unique(), mint, sponsor_tokens }
}

fn set_time(svm: &mut LiteSVM, t: i64) {
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = t;
    svm.set_sysvar(&clock);
}

fn put_mint(svm: &mut LiteSVM, mint: Pubkey) {
    let mut data = vec![0u8; 82];
    data[44] = 6;
    data[45] = 1;
    svm.set_account(mint, Account { lamports: 1_461_600, data, owner: TOKEN_PROGRAM_ID, executable: false, rent_epoch: 0 })
        .unwrap();
}

fn put_token_account(svm: &mut LiteSVM, address: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) {
    let mut data = vec![0u8; 165];
    data[0..32].copy_from_slice(mint.as_ref());
    data[32..64].copy_from_slice(owner.as_ref());
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    data[108] = 1;
    svm.set_account(address, Account { lamports: 2_039_280, data, owner: TOKEN_PROGRAM_ID, executable: false, rent_epoch: 0 })
        .unwrap();
}

fn balance(svm: &LiteSVM, a: &Pubkey) -> u64 {
    u64::from_le_bytes(svm.get_account(a).unwrap().data[64..72].try_into().unwrap())
}

fn send(svm: &mut LiteSVM, ix: Instruction, signers: &[&Keypair]) -> TransactionResult {
    svm.expire_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&signers[0].pubkey()), &svm.latest_blockhash());
    svm.send_transaction(VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap())
}

fn assert_error(res: TransactionResult, e: RewardsError) {
    let code = anchor_lang::error::ERROR_CODE_OFFSET + e as u32;
    let err = res.expect_err("should have failed");
    let s = format!("{:?}", err.err);
    assert!(s.contains(&format!("Custom({code})")), "expected {code}, got {s}\n{:#?}", err.meta.logs);
}

fn campaign(svm: &LiteSVM) -> Campaign {
    Campaign::try_deserialize(&mut svm.get_account(&campaign_pda(&REF)).unwrap().data.as_slice()).unwrap()
}

struct Terms {
    kind: RewardKind,
    price: u64,
    seats: u32,
    starts_at: i64,
    ends_at: i64,
}

fn terms() -> Terms {
    Terms { kind: RewardKind::Impact, price: 10 * USDC, seats: MIN_SEATS, starts_at: NOW, ends_at: NOW + 30 * DAY }
}

fn create_ix(env: &Env, t: &Terms) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_rewards::ID,
        &empowerfi_rewards::instruction::CreateCampaign {
            campaign_ref: REF,
            kind: t.kind,
            price_per_seat: t.price,
            seats: t.seats,
            starts_at: t.starts_at,
            ends_at: t.ends_at,
            terms_commitment: [9; 32],
        }
        .data(),
        empowerfi_rewards::accounts::CreateCampaign {
            sponsor: env.sponsor.pubkey(),
            operator: env.operator.pubkey(),
            house: env.house,
            mint: env.mint,
            campaign: campaign_pda(&REF),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn fund_ix(env: &Env, sponsor: &Pubkey, vault: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_rewards::ID,
        &empowerfi_rewards::instruction::FundCampaign {}.data(),
        empowerfi_rewards::accounts::FundCampaign {
            sponsor: *sponsor,
            campaign: campaign_pda(&REF),
            mint: env.mint,
            sponsor_tokens: env.sponsor_tokens,
            vault,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
    )
}

fn attest_ix(operator: &Pubkey, enrolled: u32, engaged: u32, root: [u8; 32]) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_rewards::ID,
        &empowerfi_rewards::instruction::AttestEngagement { enrolled, engaged, engagement_root: root }.data(),
        empowerfi_rewards::accounts::AttestEngagement { operator: *operator, campaign: campaign_pda(&REF) }
            .to_account_metas(None),
    )
}

/// A created campaign and an empty vault it owns.
fn created(env: &mut Env) -> Pubkey {
    let ix = create_ix(env, &terms());
    send(&mut env.svm, ix, &[&env.sponsor]).unwrap();
    let vault = Pubkey::new_unique();
    put_token_account(&mut env.svm, vault, env.mint, campaign_pda(&REF), 0);
    vault
}

fn funded(env: &mut Env) -> Pubkey {
    let vault = created(env);
    let ix = fund_ix(env, &env.sponsor.pubkey(), vault);
    send(&mut env.svm, ix, &[&env.sponsor]).unwrap();
    vault
}

// ------------------------------------------------------------------ terms

#[test]
fn a_campaign_writes_its_terms() {
    let mut env = setup();
    created(&mut env);
    let c = campaign(&env.svm);
    assert_eq!(c.status, CampaignStatus::Created);
    assert_eq!((c.seats, c.price_per_seat, c.house_share_bps, c.unlock_days), (MIN_SEATS, 10 * USDC, HOUSE_SHARE_BPS, UNLOCK_DAYS));
    assert_eq!((c.sponsor, c.operator, c.house, c.mint), (env.sponsor.pubkey(), env.operator.pubkey(), env.house, env.mint));
    assert_eq!(c.total(), 1_000 * USDC);
}

#[test]
fn a_campaign_is_sold_for_at_least_100_entrepreneurs() {
    let mut env = setup();
    let ix = create_ix(&env, &Terms { seats: MIN_SEATS - 1, ..terms() });
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::TooFewSeats);
}

#[test]
fn a_campaign_runs_at_least_30_days() {
    let mut env = setup();
    let ix = create_ix(&env, &Terms { ends_at: NOW + 30 * DAY - 1, ..terms() });
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::TooShort);
}

#[test]
fn activation_is_not_accepted_yet() {
    let mut env = setup();
    let ix = create_ix(&env, &Terms { kind: RewardKind::Activation, ..terms() });
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::ActivationNotYet);
}

#[test]
fn a_campaign_is_created_once() {
    let mut env = setup();
    created(&mut env);
    let ix = create_ix(&env, &terms());
    assert!(send(&mut env.svm, ix, &[&env.sponsor]).is_err());
}

// ------------------------------------------------------------------ funding

#[test]
fn the_sponsor_pays_price_times_seats_into_the_campaigns_vault() {
    let mut env = setup();
    let vault = funded(&mut env);
    assert_eq!(balance(&env.svm, &vault), 1_000 * USDC);
    assert_eq!(balance(&env.svm, &env.sponsor_tokens), 9_000 * USDC);
    let c = campaign(&env.svm);
    assert_eq!((c.status, c.vault, c.funded), (CampaignStatus::Funded, vault, 1_000 * USDC));
    // Half for EmpowerFI, half for the entrepreneurs: 5 USDC each of the 100.
    assert_eq!((c.house_share(), c.entrepreneurs_share(), c.reward_per_seat()), (500 * USDC, 500 * USDC, 5 * USDC));
}

#[test]
fn a_campaign_is_funded_once() {
    let mut env = setup();
    let vault = funded(&mut env);
    let ix = fund_ix(&env, &env.sponsor.pubkey(), vault);
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::AlreadyFunded);
}

#[test]
fn only_the_sponsor_funds() {
    let mut env = setup();
    let vault = created(&mut env);
    let other = Keypair::new();
    env.svm.airdrop(&other.pubkey(), 1_000_000_000).unwrap();
    let ix = fund_ix(&env, &other.pubkey(), vault);
    assert_error(send(&mut env.svm, ix, &[&other]), RewardsError::NotTheSponsor);
}

#[test]
fn the_vault_is_a_token_account_the_campaign_owns() {
    let mut env = setup();
    created(&mut env);
    let someone_elses = Pubkey::new_unique();
    put_token_account(&mut env.svm, someone_elses, env.mint, Pubkey::new_unique(), 0);
    let ix = fund_ix(&env, &env.sponsor.pubkey(), someone_elses);
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::NotTheVault);

    let other_mint = Pubkey::new_unique();
    put_mint(&mut env.svm, other_mint);
    let wrong_mint = Pubkey::new_unique();
    put_token_account(&mut env.svm, wrong_mint, other_mint, campaign_pda(&REF), 0);
    let ix = fund_ix(&env, &env.sponsor.pubkey(), wrong_mint);
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::NotTheVault);
}

#[test]
fn a_campaign_that_is_over_is_not_funded() {
    let mut env = setup();
    let vault = created(&mut env);
    set_time(&mut env.svm, NOW + 30 * DAY);
    let ix = fund_ix(&env, &env.sponsor.pubkey(), vault);
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::AlreadyOver);
}

// ------------------------------------------------------------------ engagement

#[test]
fn the_operator_attests_engagement() {
    let mut env = setup();
    funded(&mut env);
    let ix = attest_ix(&env.operator.pubkey(), 12, 0, [0; 32]);
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
    let ix = attest_ix(&env.operator.pubkey(), 14, 3, [5; 32]);
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
    let c = campaign(&env.svm);
    assert_eq!((c.enrolled, c.engaged, c.engagement_root, c.attestations), (14, 3, [5; 32], 2));
    assert_eq!(c.attested_at, NOW);
}

#[test]
fn only_the_operator_attests() {
    let mut env = setup();
    funded(&mut env);
    let ix = attest_ix(&env.sponsor.pubkey(), 1, 1, [5; 32]);
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::NotTheOperator);
}

#[test]
fn engagement_is_attested_only_on_a_funded_campaign() {
    let mut env = setup();
    created(&mut env);
    let ix = attest_ix(&env.operator.pubkey(), 1, 1, [5; 32]);
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotFunded);
}

#[test]
fn engagement_adds_up() {
    let mut env = setup();
    funded(&mut env);
    let op = env.operator.pubkey();
    assert_error(send(&mut env.svm, attest_ix(&op, 2, 3, [5; 32]), &[&env.operator]), RewardsError::MoreEngagedThanEnrolled);
    assert_error(send(&mut env.svm, attest_ix(&op, 200, 101, [5; 32]), &[&env.operator]), RewardsError::MoreEngagedThanSeats);
    assert_error(send(&mut env.svm, attest_ix(&op, 3, 2, [0; 32]), &[&env.operator]), RewardsError::RootDoesNotFit);
    assert_error(send(&mut env.svm, attest_ix(&op, 3, 0, [5; 32]), &[&env.operator]), RewardsError::RootDoesNotFit);
}

// ------------------------------------------------------------------ rewards

/// RFC 9162 over already-hashed leaves, as the database builds the trees.
fn mth(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.len() == 1 {
        return leaves[0];
    }
    let k = split(leaves.len());
    hashv(&[&[1u8][..], &mth(&leaves[..k])[..], &mth(&leaves[k..])[..]]).to_bytes()
}
fn split(n: usize) -> usize {
    let mut k = 1;
    while k * 2 < n {
        k *= 2;
    }
    k
}
fn path(leaves: &[[u8; 32]], m: usize) -> Vec<[u8; 32]> {
    if leaves.len() == 1 {
        return vec![];
    }
    let k = split(leaves.len());
    if m < k {
        let mut p = path(&leaves[..k], m);
        p.push(mth(&leaves[k..]));
        p
    } else {
        let mut p = path(&leaves[k..], m - k);
        p.push(mth(&leaves[..k]));
        p
    }
}

/// Five women in the campaign, three kept the days: their wallets, salts and tree.
struct Cohort {
    refs: Vec<[u8; 16]>,
    salts: Vec<[u8; 32]>,
    hashed: Vec<[u8; 32]>,
    root: [u8; 32],
}
fn cohort(n: u8) -> Cohort {
    let refs: Vec<[u8; 16]> = (0..n).map(|i| [100 + i; 16]).collect();
    let salts: Vec<[u8; 32]> = (0..n).map(|i| [200 + i; 32]).collect();
    let hashed: Vec<[u8; 32]> = refs
        .iter()
        .zip(&salts)
        .map(|(r, s)| hashv(&[&[0u8][..], &leaf_commitment(&REF, r, s)[..]]).to_bytes())
        .collect();
    let root = mth(&hashed);
    Cohort { refs, salts, hashed, root }
}

fn wallet(r: &[u8; 16]) -> Pubkey {
    Pubkey::find_program_address(&[RECIPIENT_SEED, r], &empowerfi_rewards::ID).0
}
fn receipt_pda(r: &[u8; 16]) -> Pubkey {
    Pubkey::find_program_address(&[RECEIPT_SEED, campaign_pda(&REF).as_ref(), r], &empowerfi_rewards::ID).0
}

#[allow(clippy::too_many_arguments)]
fn pay_ix(env: &Env, signer: &Pubkey, vault: Pubkey, r: [u8; 16], tokens: Pubkey, salt: [u8; 32], index: u32, proof: Vec<[u8; 32]>) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_rewards::ID,
        &empowerfi_rewards::instruction::PayReward { recipient_ref: r, salt, index, proof }.data(),
        empowerfi_rewards::accounts::PayReward {
            operator: *signer,
            campaign: campaign_pda(&REF),
            mint: env.mint,
            vault,
            recipient: wallet(&r),
            recipient_tokens: tokens,
            receipt: receipt_pda(&r),
            token_program: TOKEN_PROGRAM_ID,
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// A funded campaign with three engaged women attested, and a token account for each wallet.
fn attested(env: &mut Env) -> (Pubkey, Cohort, Vec<Pubkey>) {
    let vault = funded(env);
    let c = cohort(3);
    let ix = attest_ix(&env.operator.pubkey(), 5, 3, c.root);
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
    let tokens: Vec<Pubkey> = c.refs.iter().map(|r| {
        let t = Pubkey::new_unique();
        put_token_account(&mut env.svm, t, env.mint, wallet(r), 0);
        t
    }).collect();
    (vault, c, tokens)
}

#[test]
fn the_tree_is_the_rfc_9162_tree() {
    let c = cohort(5);
    for i in 0..5 {
        assert!(verify_inclusion(c.hashed[i], i as u64, 5, &path(&c.hashed, i), c.root));
        assert!(!verify_inclusion(c.hashed[i], ((i + 1) % 5) as u64, 5, &path(&c.hashed, i), c.root));
    }
    assert!(!verify_inclusion(c.hashed[0], 0, 4, &path(&c.hashed, 0), c.root));
}

#[test]
fn a_woman_who_kept_the_days_is_paid_her_share_into_her_wallet() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    let before = balance(&env.svm, &vault);
    let reward = campaign(&env.svm).reward_per_seat();
    assert_eq!(reward, 5 * USDC); // half of 10 USDC per seat
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[1], tokens[1], c.salts[1], 1, path(&c.hashed, 1));
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
    assert_eq!(balance(&env.svm, &tokens[1]), reward);
    assert_eq!(balance(&env.svm, &vault), before - reward);
    let r = Receipt::try_deserialize(&mut env.svm.get_account(&receipt_pda(&c.refs[1])).unwrap().data.as_slice()).unwrap();
    assert_eq!((r.recipient, r.amount, r.campaign), (wallet(&c.refs[1]), reward, campaign_pda(&REF)));
}

#[test]
fn she_is_paid_once() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], tokens[0], c.salts[0], 0, path(&c.hashed, 0));
    send(&mut env.svm, ix.clone(), &[&env.operator]).unwrap();
    assert!(send(&mut env.svm, ix, &[&env.operator]).is_err());
    assert_eq!(balance(&env.svm, &tokens[0]), campaign(&env.svm).reward_per_seat());
}

#[test]
fn only_a_leaf_of_the_attested_root_is_paid() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    // Another salt, another index, a stranger's wallet: none is in the root.
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], tokens[0], [1; 32], 0, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotInTheRoot);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], tokens[0], c.salts[0], 2, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotInTheRoot);
    let stranger = [42; 16];
    let t = Pubkey::new_unique();
    put_token_account(&mut env.svm, t, env.mint, wallet(&stranger), 0);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, stranger, t, c.salts[0], 0, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotInTheRoot);
}

#[test]
fn a_new_attestation_replaces_the_root_payments_are_proved_against() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    let five = cohort(5);
    let ix = attest_ix(&env.operator.pubkey(), 6, 5, five.root);
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[2], tokens[2], c.salts[2], 2, path(&c.hashed, 2));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotInTheRoot);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, five.refs[2], tokens[2], five.salts[2], 2, path(&five.hashed, 2));
    send(&mut env.svm, ix, &[&env.operator]).unwrap();
}

#[test]
fn only_the_operator_pays() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    let ix = pay_ix(&env, &env.sponsor.pubkey(), vault, c.refs[0], tokens[0], c.salts[0], 0, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.sponsor]), RewardsError::NotTheOperator);
}

#[test]
fn the_reward_goes_only_to_a_token_account_her_wallet_owns() {
    let mut env = setup();
    let (vault, c, _) = attested(&mut env);
    let elsewhere = Pubkey::new_unique();
    put_token_account(&mut env.svm, elsewhere, env.mint, env.operator.pubkey(), 0);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], elsewhere, c.salts[0], 0, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NotHerTokenAccount);
}

#[test]
fn empowerfis_half_never_leaves_the_vault_here() {
    let mut env = setup();
    let (vault, c, tokens) = attested(&mut env);
    let k = campaign(&env.svm);
    // As if every other seat had been paid: one reward short of the house's half.
    put_token_account(&mut env.svm, vault, env.mint, campaign_pda(&REF), k.house_share() + k.reward_per_seat() - 1);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], tokens[0], c.salts[0], 0, path(&c.hashed, 0));
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::EntrepreneursShareSpent);
}

#[test]
fn nobody_is_paid_before_someone_has_kept_the_days() {
    let mut env = setup();
    let vault = funded(&mut env);
    let c = cohort(1);
    let t = Pubkey::new_unique();
    put_token_account(&mut env.svm, t, env.mint, wallet(&c.refs[0]), 0);
    let ix = pay_ix(&env, &env.operator.pubkey(), vault, c.refs[0], t, c.salts[0], 0, vec![]);
    assert_error(send(&mut env.svm, ix, &[&env.operator]), RewardsError::NobodyEngaged);
}

#[test]
fn the_leaf_is_the_one_the_database_and_the_client_hash() {
    let campaign = [0x11, 0x11, 0x11, 0x11, 0x22, 0x22, 0x33, 0x33, 0x44, 0x44, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55];
    let wallet = [0xaa, 0xaa, 0xaa, 0xaa, 0xbb, 0xbb, 0xcc, 0xcc, 0xdd, 0xdd, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee];
    let hex: String = leaf_commitment(&campaign, &wallet, &[7; 32]).iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, "da525a5476b8fc4de752bd0bc3a0b682bc0c7e22c5351c3500052670bc24588c");
}

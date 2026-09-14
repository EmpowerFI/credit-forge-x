//! Wave 1 of the proof layer, exercised in LiteSVM: platform config, community
//! registration and verification, borrower registration.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    empowerfi_audit::{
        error::AuditError, BorrowerAudit, CommunityAudit, CommunityStatus, PlatformConfig,
        BORROWER_SEED, COMMUNITY_SEED, CONFIG_SEED, SCHEMA_VERSION,
    },
    litesvm::{types::TransactionResult, LiteSVM},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const NOW: i64 = 1_789_000_000;

fn loader_upgradeable() -> Pubkey {
    Pubkey::from_str_const("BPFLoaderUpgradeab1e11111111111111111111111")
}

fn program_data_address() -> Pubkey {
    Pubkey::find_program_address(&[empowerfi_audit::ID.as_ref()], &loader_upgradeable()).0
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &empowerfi_audit::ID).0
}

fn community_pda(community_ref: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[COMMUNITY_SEED, community_ref], &empowerfi_audit::ID).0
}

fn borrower_pda(borrower_ref_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[BORROWER_SEED, borrower_ref_hash], &empowerfi_audit::ID).0
}

struct Env {
    svm: LiteSVM,
    admin: Keypair,
    operator: Keypair,
}

/// Loads the program as an upgradeable one whose upgrade authority is `admin`,
/// which is what devnet will look like after `anchor deploy`.
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    svm.add_program(
        empowerfi_audit::ID,
        include_bytes!("../../../target/deploy/empowerfi_audit.so"),
    )
    .unwrap();

    let admin = Keypair::new();
    let operator = Keypair::new();

    // LiteSVM writes ProgramData with no upgrade authority. Patch it in:
    // bincode layout is variant (u32) | slot (u64) | Option tag (u8) | Pubkey.
    let address = program_data_address();
    let mut account = svm.get_account(&address).unwrap();
    account.data[12] = 1;
    account.data[13..45].copy_from_slice(admin.pubkey().as_ref());
    svm.set_account(address, account).unwrap();

    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = NOW;
    svm.set_sysvar(&clock);

    svm.airdrop(&admin.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&operator.pubkey(), 10_000_000_000).unwrap();
    Env {
        svm,
        admin,
        operator,
    }
}

fn send(svm: &mut LiteSVM, ix: Instruction, signers: &[&Keypair]) -> TransactionResult {
    // A fresh blockhash per call, so a deliberately repeated instruction fails
    // on the program's rules rather than as a duplicate transaction.
    svm.expire_blockhash();
    let msg =
        Message::new_with_blockhash(&[ix], Some(&signers[0].pubkey()), &svm.latest_blockhash());
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
}

fn assert_custom_error(res: TransactionResult, error: AuditError) {
    let code = anchor_lang::error::ERROR_CODE_OFFSET + error as u32;
    let err = res.expect_err("transaction should have failed");
    let rendered = format!("{:?}", err.err);
    assert!(
        rendered.contains(&format!("Custom({code})")),
        "expected custom error {code}, got {rendered}\nlogs: {:#?}",
        err.meta.logs
    );
}

fn fetch<T: AccountDeserialize>(svm: &LiteSVM, address: &Pubkey) -> T {
    let account = svm.get_account(address).expect("account should exist");
    T::try_deserialize(&mut account.data.as_slice()).unwrap()
}

// ---------------------------------------------------------------- instructions

fn initialize_ix(authority: &Pubkey, operator: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::InitializePlatform {
            operator: *operator,
        }
        .data(),
        empowerfi_audit::accounts::InitializePlatform {
            authority: *authority,
            config: config_pda(),
            program: empowerfi_audit::ID,
            program_data: program_data_address(),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn set_operator_ix(authority: &Pubkey, operator: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::SetOperator {
            operator: *operator,
        }
        .data(),
        empowerfi_audit::accounts::SetOperator {
            authority: *authority,
            config: config_pda(),
        }
        .to_account_metas(None),
    )
}

fn register_community_ix(
    operator: &Pubkey,
    community_ref: [u8; 32],
    commitment: [u8; 32],
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::RegisterCommunity {
            community_ref,
            commitment,
        }
        .data(),
        empowerfi_audit::accounts::RegisterCommunity {
            operator: *operator,
            config: config_pda(),
            community: community_pda(&community_ref),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn verify_community_ix(
    operator: &Pubkey,
    community_ref: [u8; 32],
    verification_commitment: [u8; 32],
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::VerifyCommunity {
            verification_commitment,
        }
        .data(),
        empowerfi_audit::accounts::VerifyCommunity {
            operator: *operator,
            config: config_pda(),
            community: community_pda(&community_ref),
        }
        .to_account_metas(None),
    )
}

fn register_borrower_ix(
    operator: &Pubkey,
    community_ref: [u8; 32],
    borrower_ref_hash: [u8; 32],
    enrollment_commitment: [u8; 32],
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::RegisterBorrowerRef {
            borrower_ref_hash,
            enrollment_commitment,
        }
        .data(),
        empowerfi_audit::accounts::RegisterBorrowerRef {
            operator: *operator,
            config: config_pda(),
            community: community_pda(&community_ref),
            borrower: borrower_pda(&borrower_ref_hash),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// An initialised platform, ready for commitments.
fn initialized() -> Env {
    let mut env = setup();
    let ix = initialize_ix(&env.admin.pubkey(), &env.operator.pubkey());
    let admin = env.admin.insecure_clone();
    send(&mut env.svm, ix, &[&admin]).unwrap();
    env
}

/// A verified community, ready for borrowers.
fn verified_community(env: &mut Env, community_ref: [u8; 32]) {
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), community_ref, [1; 32]),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        verify_community_ix(&op.pubkey(), community_ref, [2; 32]),
        &[&op],
    )
    .unwrap();
}

// ------------------------------------------------------------------- platform

#[test]
fn upgrade_authority_initializes_the_platform() {
    let env = initialized();
    let config: PlatformConfig = fetch(&env.svm, &config_pda());
    assert_eq!(config.authority, env.admin.pubkey());
    assert_eq!(config.operator, env.operator.pubkey());
    assert_eq!(config.created_at, NOW);
}

#[test]
fn anyone_else_cannot_initialize_the_platform() {
    let mut env = setup();
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut env.svm,
        initialize_ix(&intruder.pubkey(), &intruder.pubkey()),
        &[&intruder],
    );
    assert_custom_error(res, AuditError::NotUpgradeAuthority);
    assert!(env.svm.get_account(&config_pda()).is_none());
}

#[test]
fn the_platform_initializes_only_once() {
    let mut env = initialized();
    let admin = env.admin.insecure_clone();
    let res = send(
        &mut env.svm,
        initialize_ix(&admin.pubkey(), &admin.pubkey()),
        &[&admin],
    );
    assert!(res.is_err());
    let config: PlatformConfig = fetch(&env.svm, &config_pda());
    assert_eq!(
        config.operator,
        env.operator.pubkey(),
        "the original operator must survive"
    );
}

#[test]
fn only_the_authority_rotates_the_operator() {
    let mut env = initialized();
    let replacement = Keypair::new();

    let op = env.operator.insecure_clone();
    let res = send(
        &mut env.svm,
        set_operator_ix(&op.pubkey(), &replacement.pubkey()),
        &[&op],
    );
    assert_custom_error(res, AuditError::UnauthorizedAuthority);

    let admin = env.admin.insecure_clone();
    send(
        &mut env.svm,
        set_operator_ix(&admin.pubkey(), &replacement.pubkey()),
        &[&admin],
    )
    .unwrap();
    let config: PlatformConfig = fetch(&env.svm, &config_pda());
    assert_eq!(config.operator, replacement.pubkey());
}

// ------------------------------------------------------------------ community

#[test]
fn operator_registers_a_community() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [9; 32]),
        &[&op],
    )
    .unwrap();

    let community: CommunityAudit = fetch(&env.svm, &community_pda(&[7; 32]));
    assert_eq!(community.community_ref, [7; 32]);
    assert_eq!(community.commitment, [9; 32]);
    assert_eq!(community.status, CommunityStatus::Registered);
    assert_eq!(community.verification_commitment, [0; 32]);
    assert_eq!(community.registered_at, NOW);
    assert_eq!(community.verified_at, 0);
    assert_eq!(community.schema_version, SCHEMA_VERSION);
}

#[test]
fn only_the_operator_writes_commitments() {
    let mut env = initialized();
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut env.svm,
        register_community_ix(&intruder.pubkey(), [7; 32], [9; 32]),
        &[&intruder],
    );
    assert_custom_error(res, AuditError::UnauthorizedOperator);
}

#[test]
fn a_community_registers_only_once() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [9; 32]),
        &[&op],
    )
    .unwrap();
    let res = send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [8; 32]),
        &[&op],
    );
    assert!(res.is_err());
    let community: CommunityAudit = fetch(&env.svm, &community_pda(&[7; 32]));
    assert_eq!(
        community.commitment, [9; 32],
        "the first commitment must survive"
    );
}

#[test]
fn zero_bytes_are_rejected() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();
    let res = send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [0; 32]),
        &[&op],
    );
    assert_custom_error(res, AuditError::ZeroCommitment);
    let res = send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [0; 32], [9; 32]),
        &[&op],
    );
    assert_custom_error(res, AuditError::ZeroReference);
}

#[test]
fn operator_verifies_a_community_once() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [9; 32]),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        verify_community_ix(&op.pubkey(), [7; 32], [5; 32]),
        &[&op],
    )
    .unwrap();

    let community: CommunityAudit = fetch(&env.svm, &community_pda(&[7; 32]));
    assert_eq!(community.status, CommunityStatus::Verified);
    assert_eq!(community.verification_commitment, [5; 32]);
    assert_eq!(community.verified_at, NOW);

    let res = send(
        &mut env.svm,
        verify_community_ix(&op.pubkey(), [7; 32], [6; 32]),
        &[&op],
    );
    assert_custom_error(res, AuditError::CommunityAlreadyVerified);
}

// ------------------------------------------------------------------- borrower

#[test]
fn a_borrower_needs_a_verified_community() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_community_ix(&op.pubkey(), [7; 32], [9; 32]),
        &[&op],
    )
    .unwrap();
    let res = send(
        &mut env.svm,
        register_borrower_ix(&op.pubkey(), [7; 32], [3; 32], [4; 32]),
        &[&op],
    );
    assert_custom_error(res, AuditError::CommunityNotVerified);
    assert!(env.svm.get_account(&borrower_pda(&[3; 32])).is_none());
}

#[test]
fn operator_registers_a_borrower_in_a_verified_community() {
    let mut env = initialized();
    verified_community(&mut env, [7; 32]);
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_borrower_ix(&op.pubkey(), [7; 32], [3; 32], [4; 32]),
        &[&op],
    )
    .unwrap();

    let borrower: BorrowerAudit = fetch(&env.svm, &borrower_pda(&[3; 32]));
    assert_eq!(borrower.borrower_ref_hash, [3; 32]);
    assert_eq!(borrower.community, community_pda(&[7; 32]));
    assert_eq!(borrower.enrollment_commitment, [4; 32]);
    assert_eq!(borrower.registered_at, NOW);
    assert_eq!(borrower.schema_version, SCHEMA_VERSION);

    // The same borrower cannot be registered twice, in this community or another.
    verified_community(&mut env, [8; 32]);
    let res = send(
        &mut env.svm,
        register_borrower_ix(&op.pubkey(), [8; 32], [3; 32], [4; 32]),
        &[&op],
    );
    assert!(res.is_err());
}

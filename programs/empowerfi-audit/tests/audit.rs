//! Wave 1 of the proof layer, exercised in LiteSVM: platform config, community
//! registration and verification, borrower registration.

use {
    anchor_lang::{
        prelude::Pubkey, solana_program::instruction::Instruction, AccountDeserialize,
        InstructionData, ToAccountMetas,
    },
    empowerfi_audit::{
        error::AuditError, AllocationCommitment, BorrowerAudit, CheckinCommitment, CommunityAudit, CommunityStatus,
        EligibilityAttestation, EligibilityDecision, Grade, LoanAccount, LoanStatus,
        OpportunityCommitment, OutcomeCommitment, PaymentCommitment, PlatformConfig, ReadinessAttestation,
        ReadinessBand, ReadinessStatus, ALLOCATION_SEED, BORROWER_SEED, CHECKIN_SEED, COMMUNITY_SEED, CONFIG_SEED,
        ELIGIBILITY_SEED, LOAN_SEED, OPPORTUNITY_SEED, OUTCOME_SEED, PAYMENT_SEED, READINESS_SEED,
        SCHEMA_VERSION,
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

// ------------------------------------------------------- check-ins, readiness

fn checkin_pda(borrower: &Pubkey, period: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[CHECKIN_SEED, borrower.as_ref(), &period.to_le_bytes()],
        &empowerfi_audit::ID,
    )
    .0
}

fn readiness_pda(borrower: &Pubkey, assessment_no: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[
            READINESS_SEED,
            borrower.as_ref(),
            &assessment_no.to_le_bytes(),
        ],
        &empowerfi_audit::ID,
    )
    .0
}

fn anchor_checkin_ix(
    operator: &Pubkey,
    borrower: &Pubkey,
    period: u32,
    commitment: [u8; 32],
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AnchorCheckin { period, commitment }.data(),
        empowerfi_audit::accounts::AnchorCheckin {
            operator: *operator,
            config: config_pda(),
            borrower: *borrower,
            checkin: checkin_pda(borrower, period),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn attest_readiness_ix(
    operator: &Pubkey,
    borrower: &Pubkey,
    assessment_no: u32,
    status: ReadinessStatus,
    band: ReadinessBand,
    commitment: [u8; 32],
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AttestReadiness {
            assessment_no,
            status,
            band,
            model_version: 100,
            commitment,
        }
        .data(),
        empowerfi_audit::accounts::AttestReadiness {
            operator: *operator,
            config: config_pda(),
            borrower: *borrower,
            attestation: readiness_pda(borrower, assessment_no),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// A registered borrower in a verified community; returns her account.
fn registered_borrower(env: &mut Env) -> Pubkey {
    verified_community(env, [7; 32]);
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        register_borrower_ix(&op.pubkey(), [7; 32], [3; 32], [4; 32]),
        &[&op],
    )
    .unwrap();
    borrower_pda(&[3; 32])
}

#[test]
fn operator_anchors_a_month_once() {
    let mut env = initialized();
    let borrower = registered_borrower(&mut env);
    let op = env.operator.insecure_clone();

    send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &borrower, 202609, [11; 32]),
        &[&op],
    )
    .unwrap();
    let checkin: CheckinCommitment = fetch(&env.svm, &checkin_pda(&borrower, 202609));
    assert_eq!(checkin.borrower, borrower);
    assert_eq!(checkin.period, 202609);
    assert_eq!(checkin.commitment, [11; 32]);
    assert_eq!(checkin.anchored_at, NOW);
    assert_eq!(checkin.schema_version, SCHEMA_VERSION);

    // The month is the key: a second commitment for September is refused.
    let res = send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &borrower, 202609, [12; 32]),
        &[&op],
    );
    assert!(res.is_err());
    let checkin: CheckinCommitment = fetch(&env.svm, &checkin_pda(&borrower, 202609));
    assert_eq!(
        checkin.commitment, [11; 32],
        "the first commitment must survive"
    );

    // Another month is another account.
    send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &borrower, 202610, [13; 32]),
        &[&op],
    )
    .unwrap();
}

#[test]
fn a_checkin_needs_a_valid_period_and_the_operator() {
    let mut env = initialized();
    let borrower = registered_borrower(&mut env);
    let op = env.operator.insecure_clone();
    for bad in [202613, 202600, 201912, 2026, 0] {
        let res = send(
            &mut env.svm,
            anchor_checkin_ix(&op.pubkey(), &borrower, bad, [11; 32]),
            &[&op],
        );
        assert_custom_error(res, AuditError::InvalidPeriod);
    }
    let res = send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &borrower, 202609, [0; 32]),
        &[&op],
    );
    assert_custom_error(res, AuditError::ZeroCommitment);

    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut env.svm,
        anchor_checkin_ix(&intruder.pubkey(), &borrower, 202609, [11; 32]),
        &[&intruder],
    );
    assert_custom_error(res, AuditError::UnauthorizedOperator);
}

#[test]
fn only_a_registered_borrower_reports() {
    let mut env = initialized();
    verified_community(&mut env, [7; 32]);
    let op = env.operator.insecure_clone();
    // A community account is not a borrower: the account type is checked.
    let not_a_borrower = community_pda(&[7; 32]);
    let res = send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &not_a_borrower, 202609, [11; 32]),
        &[&op],
    );
    assert!(res.is_err());
    // Nor is an address nobody registered.
    let res = send(
        &mut env.svm,
        anchor_checkin_ix(&op.pubkey(), &borrower_pda(&[99; 32]), 202609, [11; 32]),
        &[&op],
    );
    assert!(res.is_err());
}

#[test]
fn operator_attests_readiness_with_public_status_and_private_detail() {
    let mut env = initialized();
    let borrower = registered_borrower(&mut env);
    let op = env.operator.insecure_clone();

    send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            1,
            ReadinessStatus::NeedsMoreData,
            ReadinessBand::Low,
            [21; 32],
        ),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            2,
            ReadinessStatus::CreditReady,
            ReadinessBand::High,
            [22; 32],
        ),
        &[&op],
    )
    .unwrap();

    let second: ReadinessAttestation = fetch(&env.svm, &readiness_pda(&borrower, 2));
    assert_eq!(second.borrower, borrower);
    assert_eq!(second.assessment_no, 2);
    assert_eq!(second.status, ReadinessStatus::CreditReady);
    assert_eq!(second.band, ReadinessBand::High);
    assert_eq!(second.model_version, 100);
    assert_eq!(second.commitment, [22; 32]);
    assert_eq!(second.attested_at, NOW);

    // An assessment number is used once, and numbering starts at 1.
    let res = send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            2,
            ReadinessStatus::ManualReview,
            ReadinessBand::Low,
            [23; 32],
        ),
        &[&op],
    );
    assert!(res.is_err());
    let res = send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            0,
            ReadinessStatus::CreditReady,
            ReadinessBand::High,
            [24; 32],
        ),
        &[&op],
    );
    assert_custom_error(res, AuditError::InvalidAssessmentNumber);
}

// ------------------------------------------- eligibility, opportunity, loan

fn eligibility_pda(borrower: &Pubkey, n: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[ELIGIBILITY_SEED, borrower.as_ref(), &n.to_le_bytes()],
        &empowerfi_audit::ID,
    )
    .0
}
fn opportunity_pda(borrower: &Pubkey, n: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[OPPORTUNITY_SEED, borrower.as_ref(), &n.to_le_bytes()],
        &empowerfi_audit::ID,
    )
    .0
}
fn loan_pda(opportunity: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[LOAN_SEED, opportunity.as_ref()], &empowerfi_audit::ID).0
}
fn payment_pda(loan: &Pubkey, n: u16) -> Pubkey {
    Pubkey::find_program_address(
        &[PAYMENT_SEED, loan.as_ref(), &n.to_le_bytes()],
        &empowerfi_audit::ID,
    )
    .0
}

fn attest_eligibility_ix(
    op: &Pubkey,
    borrower: &Pubkey,
    readiness: &Pubkey,
    n: u32,
    decision: EligibilityDecision,
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AttestEligibility {
            eligibility_no: n,
            decision,
            risk_band: Grade::Low,
            confidence: Grade::High,
            model_version: 100,
            commitment: [31; 32],
        }
        .data(),
        empowerfi_audit::accounts::AttestEligibility {
            operator: *op,
            config: config_pda(),
            borrower: *borrower,
            readiness: *readiness,
            eligibility: eligibility_pda(borrower, n),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn anchor_opportunity_ix(
    op: &Pubkey,
    borrower: &Pubkey,
    eligibility: &Pubkey,
    n: u32,
) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AnchorOpportunity {
            opportunity_no: n,
            commitment: [41; 32],
        }
        .data(),
        empowerfi_audit::accounts::AnchorOpportunity {
            operator: *op,
            config: config_pda(),
            borrower: *borrower,
            eligibility: *eligibility,
            opportunity: opportunity_pda(borrower, n),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn create_loan_ix(op: &Pubkey, opportunity: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::CreateLoan {
            terms_commitment: [51; 32],
        }
        .data(),
        empowerfi_audit::accounts::CreateLoan {
            operator: *op,
            config: config_pda(),
            opportunity: *opportunity,
            loan: loan_pda(opportunity),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn transition_ix(op: &Pubkey, loan: &Pubkey, to: LoanStatus, tag: u8) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::TransitionLoan {
            to,
            transition_commitment: [tag; 32],
        }
        .data(),
        empowerfi_audit::accounts::TransitionLoan {
            operator: *op,
            config: config_pda(),
            loan: *loan,
        }
        .to_account_metas(None),
    )
}

fn payment_ix(op: &Pubkey, loan: &Pubkey, n: u16) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AnchorPayment {
            instalment_no: n,
            commitment: [61; 32],
        }
        .data(),
        empowerfi_audit::accounts::AnchorPayment {
            operator: *op,
            config: config_pda(),
            loan: *loan,
            payment: payment_pda(loan, n),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

/// A registered borrower with two readiness attestations: #1 NeedsMoreData, #2 CreditReady.
fn ready_borrower(env: &mut Env) -> (Pubkey, Pubkey, Pubkey) {
    let borrower = registered_borrower(env);
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            1,
            ReadinessStatus::NeedsMoreData,
            ReadinessBand::Low,
            [21; 32],
        ),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &borrower,
            2,
            ReadinessStatus::CreditReady,
            ReadinessBand::High,
            [22; 32],
        ),
        &[&op],
    )
    .unwrap();
    (
        borrower,
        readiness_pda(&borrower, 1),
        readiness_pda(&borrower, 2),
    )
}

#[test]
fn eligibility_only_follows_credit_ready_readiness_of_the_same_borrower() {
    let mut env = initialized();
    let (borrower, not_ready, ready) = ready_borrower(&mut env);
    let op = env.operator.insecure_clone();

    let res = send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &not_ready,
            1,
            EligibilityDecision::Eligible,
        ),
        &[&op],
    );
    assert_custom_error(res, AuditError::ReadinessNotCreditReady);

    // Someone else's CreditReady attestation does not count for her.
    verified_community(&mut env, [8; 32]);
    send(
        &mut env.svm,
        register_borrower_ix(&op.pubkey(), [8; 32], [9; 32], [4; 32]),
        &[&op],
    )
    .unwrap();
    let other = borrower_pda(&[9; 32]);
    send(
        &mut env.svm,
        attest_readiness_ix(
            &op.pubkey(),
            &other,
            1,
            ReadinessStatus::CreditReady,
            ReadinessBand::High,
            [23; 32],
        ),
        &[&op],
    )
    .unwrap();
    let res = send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &readiness_pda(&other, 1),
            1,
            EligibilityDecision::Eligible,
        ),
        &[&op],
    );
    assert_custom_error(res, AuditError::ReadinessNotCreditReady);

    send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &ready,
            1,
            EligibilityDecision::EligibleReduced,
        ),
        &[&op],
    )
    .unwrap();
    let e: EligibilityAttestation = fetch(&env.svm, &eligibility_pda(&borrower, 1));
    assert_eq!(e.readiness, ready);
    assert_eq!(e.decision, EligibilityDecision::EligibleReduced);
    assert_eq!(e.risk_band, Grade::Low);
    assert_eq!(e.confidence, Grade::High);
}

#[test]
fn an_opportunity_needs_an_eligibility_that_is_not_not_eligible() {
    let mut env = initialized();
    let (borrower, _, ready) = ready_borrower(&mut env);
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &ready,
            1,
            EligibilityDecision::NotEligible,
        ),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &ready,
            2,
            EligibilityDecision::Eligible,
        ),
        &[&op],
    )
    .unwrap();

    let res = send(
        &mut env.svm,
        anchor_opportunity_ix(&op.pubkey(), &borrower, &eligibility_pda(&borrower, 1), 1),
        &[&op],
    );
    assert_custom_error(res, AuditError::NotEligible);

    send(
        &mut env.svm,
        anchor_opportunity_ix(&op.pubkey(), &borrower, &eligibility_pda(&borrower, 2), 1),
        &[&op],
    )
    .unwrap();
    let o: OpportunityCommitment = fetch(&env.svm, &opportunity_pda(&borrower, 1));
    assert_eq!(o.eligibility, eligibility_pda(&borrower, 2));
    assert_eq!(o.commitment, [41; 32]);
}

/// An opportunity ready for a loan.
fn opportunity(env: &mut Env) -> Pubkey {
    let (borrower, _, ready) = ready_borrower(env);
    let op = env.operator.insecure_clone();
    send(
        &mut env.svm,
        attest_eligibility_ix(
            &op.pubkey(),
            &borrower,
            &ready,
            1,
            EligibilityDecision::Eligible,
        ),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        anchor_opportunity_ix(&op.pubkey(), &borrower, &eligibility_pda(&borrower, 1), 1),
        &[&op],
    )
    .unwrap();
    opportunity_pda(&borrower, 1)
}

#[test]
fn a_loan_follows_its_state_machine_and_nothing_else() {
    let mut env = initialized();
    let opp = opportunity(&mut env);
    let op = env.operator.insecure_clone();
    send(&mut env.svm, create_loan_ix(&op.pubkey(), &opp), &[&op]).unwrap();
    let loan = loan_pda(&opp);
    assert!(
        send(&mut env.svm, create_loan_ix(&op.pubkey(), &opp), &[&op]).is_err(),
        "one loan per opportunity"
    );

    // Draft cannot skip to Disbursed, nor pay an instalment.
    let res = send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Disbursed, 70),
        &[&op],
    );
    assert_custom_error(res, AuditError::InvalidLoanTransition);
    let res = send(&mut env.svm, payment_ix(&op.pubkey(), &loan, 1), &[&op]);
    assert_custom_error(res, AuditError::LoanNotRepaying);

    for (to, tag) in [
        (LoanStatus::PartnerApproved, 71),
        (LoanStatus::Disbursed, 72),
        (LoanStatus::Active, 73),
    ] {
        send(
            &mut env.svm,
            transition_ix(&op.pubkey(), &loan, to, tag),
            &[&op],
        )
        .unwrap();
    }
    send(&mut env.svm, payment_ix(&op.pubkey(), &loan, 1), &[&op]).unwrap();
    assert!(
        send(&mut env.svm, payment_ix(&op.pubkey(), &loan, 1), &[&op]).is_err(),
        "an instalment is paid once"
    );
    send(&mut env.svm, payment_ix(&op.pubkey(), &loan, 2), &[&op]).unwrap();
    let res = send(&mut env.svm, payment_ix(&op.pubkey(), &loan, 0), &[&op]);
    assert_custom_error(res, AuditError::InvalidInstalmentNumber);

    send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Paid, 74),
        &[&op],
    )
    .unwrap();
    let l: LoanAccount = fetch(&env.svm, &loan);
    assert_eq!(l.status, LoanStatus::Paid);
    assert_eq!(l.transitions, 4);
    assert_eq!(l.last_transition_commitment, [74; 32]);
    assert_eq!(l.terms_commitment, [51; 32]);

    // Paid is final.
    let res = send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Active, 75),
        &[&op],
    );
    assert_custom_error(res, AuditError::InvalidLoanTransition);
    let p: PaymentCommitment = fetch(&env.svm, &payment_pda(&loan, 2));
    assert_eq!(p.instalment_no, 2);
    assert_eq!(p.loan, loan);
}

#[test]
fn a_loan_can_be_cancelled_before_disbursement_only() {
    let mut env = initialized();
    let opp = opportunity(&mut env);
    let op = env.operator.insecure_clone();
    send(&mut env.svm, create_loan_ix(&op.pubkey(), &opp), &[&op]).unwrap();
    let loan = loan_pda(&opp);
    send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::PartnerApproved, 71),
        &[&op],
    )
    .unwrap();
    send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Disbursed, 72),
        &[&op],
    )
    .unwrap();
    let res = send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Cancelled, 73),
        &[&op],
    );
    assert_custom_error(res, AuditError::InvalidLoanTransition);
}

// ------------------------------------------------------------------ outcome

fn outcome_pda(loan: &Pubkey, n: u16) -> Pubkey {
    Pubkey::find_program_address(
        &[OUTCOME_SEED, loan.as_ref(), &n.to_le_bytes()],
        &empowerfi_audit::ID,
    )
    .0
}

fn outcome_ix(op: &Pubkey, loan: &Pubkey, n: u16) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AnchorOutcome {
            outcome_no: n,
            commitment: [81; 32],
        }
        .data(),
        empowerfi_audit::accounts::AnchorOutcome {
            operator: *op,
            config: config_pda(),
            loan: *loan,
            outcome: outcome_pda(loan, n),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

#[test]
fn an_outcome_is_measured_only_on_a_loan_that_reached_the_business() {
    let mut env = initialized();
    let opp = opportunity(&mut env);
    let op = env.operator.insecure_clone();
    send(&mut env.svm, create_loan_ix(&op.pubkey(), &opp), &[&op]).unwrap();
    let loan = loan_pda(&opp);
    send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::PartnerApproved, 71),
        &[&op],
    )
    .unwrap();

    // Approved is not disbursed: nothing reached the business yet.
    let res = send(&mut env.svm, outcome_ix(&op.pubkey(), &loan, 1), &[&op]);
    assert_custom_error(res, AuditError::OutcomeBeforeDisbursement);

    for (to, tag) in [(LoanStatus::Disbursed, 72), (LoanStatus::Active, 73)] {
        send(
            &mut env.svm,
            transition_ix(&op.pubkey(), &loan, to, tag),
            &[&op],
        )
        .unwrap();
    }
    let res = send(&mut env.svm, outcome_ix(&op.pubkey(), &loan, 0), &[&op]);
    assert_custom_error(res, AuditError::InvalidOutcomeNumber);

    // Only the operator writes it.
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let res = send(
        &mut env.svm,
        outcome_ix(&intruder.pubkey(), &loan, 1),
        &[&intruder],
    );
    assert_custom_error(res, AuditError::UnauthorizedOperator);

    send(&mut env.svm, outcome_ix(&op.pubkey(), &loan, 1), &[&op]).unwrap();
    assert!(
        send(&mut env.svm, outcome_ix(&op.pubkey(), &loan, 1), &[&op]).is_err(),
        "a measurement is written once"
    );
    let o: OutcomeCommitment = fetch(&env.svm, &outcome_pda(&loan, 1));
    assert_eq!(o.loan, loan);
    assert_eq!(o.outcome_no, 1);
    assert_eq!(o.commitment, [81; 32]);
    assert_eq!(o.measured_at, NOW);
    assert_eq!(o.schema_version, SCHEMA_VERSION);

    // And after the loan ends, a later measurement still can be.
    send(
        &mut env.svm,
        transition_ix(&op.pubkey(), &loan, LoanStatus::Defaulted, 74),
        &[&op],
    )
    .unwrap();
    send(&mut env.svm, outcome_ix(&op.pubkey(), &loan, 2), &[&op]).unwrap();
}

// --------------------------------------------------------------- allocation

fn allocation_pda(ref_hash: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[ALLOCATION_SEED, ref_hash], &empowerfi_audit::ID).0
}

fn allocation_ix(op: &Pubkey, ref_hash: [u8; 32], commitment: [u8; 32]) -> Instruction {
    Instruction::new_with_bytes(
        empowerfi_audit::ID,
        &empowerfi_audit::instruction::AnchorAllocation {
            allocation_ref_hash: ref_hash,
            commitment,
        }
        .data(),
        empowerfi_audit::accounts::AnchorAllocation {
            operator: *op,
            config: config_pda(),
            allocation: allocation_pda(&ref_hash),
            system_program: anchor_lang::system_program::ID,
        }
        .to_account_metas(None),
    )
}

#[test]
fn an_allocation_is_committed_once_by_the_operator_alone() {
    let mut env = initialized();
    let op = env.operator.insecure_clone();

    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let res = send(&mut env.svm, allocation_ix(&intruder.pubkey(), [91; 32], [92; 32]), &[&intruder]);
    assert_custom_error(res, AuditError::UnauthorizedOperator);

    let res = send(&mut env.svm, allocation_ix(&op.pubkey(), [0; 32], [92; 32]), &[&op]);
    assert_custom_error(res, AuditError::ZeroReference);
    let res = send(&mut env.svm, allocation_ix(&op.pubkey(), [91; 32], [0; 32]), &[&op]);
    assert_custom_error(res, AuditError::ZeroCommitment);

    send(&mut env.svm, allocation_ix(&op.pubkey(), [91; 32], [92; 32]), &[&op]).unwrap();
    assert!(
        send(&mut env.svm, allocation_ix(&op.pubkey(), [91; 32], [93; 32]), &[&op]).is_err(),
        "an allocation is written once"
    );
    let a: AllocationCommitment = fetch(&env.svm, &allocation_pda(&[91; 32]));
    assert_eq!(a.allocation_ref_hash, [91; 32]);
    assert_eq!(a.commitment, [92; 32]);
    assert_eq!(a.allocated_at, NOW);
    assert_eq!(a.schema_version, SCHEMA_VERSION);
}

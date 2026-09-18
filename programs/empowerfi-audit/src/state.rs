use anchor_lang::prelude::*;

// Everything stored here is a 32-byte commitment, an enum, a version or a
// timestamp. Never a name, document number, contact detail, bank or Pix data,
// or a raw financial value: PostgreSQL is the system of record, this program
// is only the proof that a record existed, unchanged, at a point in time.

/// Singleton. Who administers the program and which key writes commitments.
#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    /// Program upgrade authority at initialisation; rotates the operator.
    pub authority: Pubkey,
    /// Server-side key that submits every commitment.
    pub operator: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CommunityStatus {
    Registered,
    Verified,
}

/// One per community. `community_ref` is 32 random bytes generated server-side,
/// so the address reveals nothing about the community it stands for.
#[account]
#[derive(InitSpace)]
pub struct CommunityAudit {
    pub community_ref: [u8; 32],
    /// Commitment to the community's canonical record at registration.
    pub commitment: [u8; 32],
    pub status: CommunityStatus,
    /// Commitment to the verification record; zero until verified.
    pub verification_commitment: [u8; 32],
    pub registered_at: i64,
    /// Zero until verified.
    pub verified_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// One per entrepreneur. Keyed by the hash of her `borrower_ref`, never the
/// ref itself, so the chain cannot be joined back to the database by anyone
/// who does not already hold the database row.
#[account]
#[derive(InitSpace)]
pub struct BorrowerAudit {
    pub borrower_ref_hash: [u8; 32],
    /// The CommunityAudit she was enrolled through.
    pub community: Pubkey,
    /// Commitment to the enrollment record (who, which community, when).
    pub enrollment_commitment: [u8; 32],
    pub registered_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// One month of one business. The commitment covers the figures she reported;
/// the figures themselves never leave the database.
#[account]
#[derive(InitSpace)]
pub struct CheckinCommitment {
    /// The BorrowerAudit it belongs to.
    pub borrower: Pubkey,
    /// YYYYMM. Part of the address, so a month is anchored once.
    pub period: u32,
    pub commitment: [u8; 32],
    pub anchored_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ReadinessStatus {
    CreditReady,
    NeedsMoreData,
    NeedsPreparation,
    ManualReview,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ReadinessBand {
    Low,
    Medium,
    High,
}

/// One readiness assessment. Status and band are public enums; the score,
/// the features and the reasons stay in the database behind the commitment.
/// Readiness is not eligibility, and neither is a lending decision.
#[account]
#[derive(InitSpace)]
pub struct ReadinessAttestation {
    pub borrower: Pubkey,
    /// 1, 2, 3 … per borrower. Part of the address.
    pub assessment_no: u32,
    pub status: ReadinessStatus,
    pub band: ReadinessBand,
    /// major * 10000 + minor * 100 + patch: readiness-v0.1.0 is 100.
    pub model_version: u16,
    pub commitment: [u8; 32],
    pub attested_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum EligibilityDecision {
    Eligible,
    EligibleReduced,
    ManualReview,
    NotEligible,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Grade {
    Low,
    Medium,
    High,
}

/// One eligibility assessment, for a specific requested amount. It points at
/// the readiness attestation it relied on, which the program checks was
/// CreditReady and of the same borrower: eligibility never precedes readiness.
/// It is EmpowerFI's assessment, not the partner's lending decision.
#[account]
#[derive(InitSpace)]
pub struct EligibilityAttestation {
    pub borrower: Pubkey,
    pub readiness: Pubkey,
    pub eligibility_no: u32,
    pub decision: EligibilityDecision,
    pub risk_band: Grade,
    pub confidence: Grade,
    /// major * 10000 + minor * 100 + patch: eligibility-v0.1.0 is 100.
    pub model_version: u16,
    pub commitment: [u8; 32],
    pub attested_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// A qualified credit opportunity: what EmpowerFI takes to a partner. Only
/// from an eligibility that is not NotEligible.
#[account]
#[derive(InitSpace)]
pub struct OpportunityCommitment {
    pub borrower: Pubkey,
    pub eligibility: Pubkey,
    pub opportunity_no: u32,
    pub commitment: [u8; 32],
    pub created_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LoanStatus {
    Draft,
    PartnerApproved,
    Disbursed,
    Active,
    Paid,
    Defaulted,
    Cancelled,
}

impl LoanStatus {
    /// The loan state machine. Postgres enforces the same one: the database
    /// stops a bad screen, the program stops a bad database.
    pub fn can_become(self, next: LoanStatus) -> bool {
        use LoanStatus::*;
        matches!(
            (self, next),
            (Draft, PartnerApproved)
                | (Draft, Cancelled)
                | (PartnerApproved, Disbursed)
                | (PartnerApproved, Cancelled)
                | (Disbursed, Active)
                | (Active, Paid)
                | (Active, Defaulted)
        )
    }
}

/// One loan per opportunity. Terms and every status change are commitments
/// to records held off-chain (amount, rate and the partner's decision are
/// never written here); the status itself is public.
#[account]
#[derive(InitSpace)]
pub struct LoanAccount {
    pub borrower: Pubkey,
    pub opportunity: Pubkey,
    pub status: LoanStatus,
    pub terms_commitment: [u8; 32],
    /// Commitment to the record behind the latest status change.
    pub last_transition_commitment: [u8; 32],
    pub transitions: u16,
    pub created_at: i64,
    pub updated_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// One instalment paid. The amount stays off-chain, in the commitment.
#[account]
#[derive(InitSpace)]
pub struct PaymentCommitment {
    pub loan: Pubkey,
    pub instalment_no: u16,
    pub commitment: [u8; 32],
    pub recorded_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// A productive-outcome measurement for a loan: what changed in the business
/// after it, as a commitment. The figures stay in the database; the numbers
/// here only order the measurements.
#[account]
#[derive(InitSpace)]
pub struct OutcomeCommitment {
    pub loan: Pubkey,
    pub outcome_no: u16,
    pub commitment: [u8; 32],
    pub measured_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// An investor's capital allocated to an opportunity, as a commitment. Keyed
/// by the hash of a random reference held only in the database, so the proof
/// points neither to the investor's wallet nor to the borrower.
#[account]
#[derive(InitSpace)]
pub struct AllocationCommitment {
    pub allocation_ref_hash: [u8; 32],
    pub commitment: [u8; 32],
    pub allocated_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// One consent record of a borrower: what she allowed her data to be used
/// for, as a commitment. Every change is a new record, so what she agreed to
/// and when stays provable; which choices she made stays in the database.
#[account]
#[derive(InitSpace)]
pub struct ConsentCommitment {
    pub borrower: Pubkey,
    pub consent_no: u32,
    pub commitment: [u8; 32],
    pub recorded_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

/// Which way a global loan's dollars became her reais. The two the comparator
/// weighs, and nothing about a provider, an amount or a person: the economics
/// live in the commitment, and the record behind it in the database.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum SettlementRoute {
    /// USDC → regulated off-ramp → Pix, with the rate struck at the payout.
    DirectUsdcPix,
    /// USDC → a BRL stablecoin held on chain → Pix one to one, with the rate
    /// struck when the opportunity was allocated.
    BrlStablePix,
}

/// The settlement route a loan took, as a commitment. One per loan: the
/// decision is taken once, when the money moves, and is never revised — a
/// later route would be a different loan. The route itself is public, because
/// a proof that hides which way it went proves nothing worth proving; both
/// quotes, their costs and the reasons stay inside the commitment.
#[account]
#[derive(InitSpace)]
pub struct SettlementRouteCommitment {
    pub loan: Pubkey,
    pub route: SettlementRoute,
    pub commitment: [u8; 32],
    pub decided_at: i64,
    pub schema_version: u8,
    pub bump: u8,
}

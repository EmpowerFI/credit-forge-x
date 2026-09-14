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

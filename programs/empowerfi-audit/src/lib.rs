//! EmpowerFI proof layer.
//!
//! PostgreSQL is the operational system of record; this program only records
//! commitments to those records, their state and when they were written — so
//! an auditor can recompute a hash from the database and find it here,
//! unchanged. See PLAN_HACKATHON.md, §C.2 and §F.

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4rqhxEwPiTd5CATztMfNmFfLaSntcmZPuzHKgmbESfRR");

#[program]
pub mod empowerfi_audit {
    use super::*;

    /// Creates the singleton config. Upgrade authority only.
    pub fn initialize_platform(ctx: Context<InitializePlatform>, operator: Pubkey) -> Result<()> {
        initialize_platform::handler(ctx, operator)
    }

    /// Replaces the operator key. Platform authority only.
    pub fn set_operator(ctx: Context<SetOperator>, operator: Pubkey) -> Result<()> {
        set_operator::handler(ctx, operator)
    }

    pub fn register_community(
        ctx: Context<RegisterCommunity>,
        community_ref: [u8; 32],
        commitment: [u8; 32],
    ) -> Result<()> {
        register_community::handler(ctx, community_ref, commitment)
    }

    pub fn verify_community(
        ctx: Context<VerifyCommunity>,
        verification_commitment: [u8; 32],
    ) -> Result<()> {
        verify_community::handler(ctx, verification_commitment)
    }

    pub fn register_borrower_ref(
        ctx: Context<RegisterBorrowerRef>,
        borrower_ref_hash: [u8; 32],
        enrollment_commitment: [u8; 32],
    ) -> Result<()> {
        register_borrower_ref::handler(ctx, borrower_ref_hash, enrollment_commitment)
    }

    /// Commits one month of a registered borrower's business. Once per month.
    pub fn anchor_checkin(
        ctx: Context<AnchorCheckin>,
        period: u32,
        commitment: [u8; 32],
    ) -> Result<()> {
        anchor_checkin::handler(ctx, period, commitment)
    }

    /// Attests one readiness assessment: public status and band, private detail.
    pub fn attest_readiness(
        ctx: Context<AttestReadiness>,
        assessment_no: u32,
        status: ReadinessStatus,
        band: ReadinessBand,
        model_version: u16,
        commitment: [u8; 32],
    ) -> Result<()> {
        attest_readiness::handler(ctx, assessment_no, status, band, model_version, commitment)
    }
}

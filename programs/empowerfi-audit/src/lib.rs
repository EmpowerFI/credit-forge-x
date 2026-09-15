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

    /// Attests an eligibility assessment. Only against a CreditReady readiness
    /// attestation of the same borrower: eligibility never precedes readiness.
    pub fn attest_eligibility(
        ctx: Context<AttestEligibility>,
        eligibility_no: u32,
        decision: EligibilityDecision,
        risk_band: Grade,
        confidence: Grade,
        model_version: u16,
        commitment: [u8; 32],
    ) -> Result<()> {
        attest_eligibility::handler(
            ctx,
            eligibility_no,
            decision,
            risk_band,
            confidence,
            model_version,
            commitment,
        )
    }

    /// Commits a qualified credit opportunity, from an eligibility that is not NotEligible.
    pub fn anchor_opportunity(
        ctx: Context<AnchorOpportunity>,
        opportunity_no: u32,
        commitment: [u8; 32],
    ) -> Result<()> {
        anchor_opportunity::handler(ctx, opportunity_no, commitment)
    }

    /// Opens the loan for an opportunity, in Draft. One per opportunity.
    pub fn create_loan(ctx: Context<CreateLoan>, terms_commitment: [u8; 32]) -> Result<()> {
        create_loan::handler(ctx, terms_commitment)
    }

    /// Moves a loan along its state machine; anything else is refused.
    pub fn transition_loan(
        ctx: Context<TransitionLoan>,
        to: LoanStatus,
        transition_commitment: [u8; 32],
    ) -> Result<()> {
        transition_loan::handler(ctx, to, transition_commitment)
    }

    /// Commits one paid instalment, once, on a disbursed or active loan.
    pub fn anchor_payment(
        ctx: Context<AnchorPayment>,
        instalment_no: u16,
        commitment: [u8; 32],
    ) -> Result<()> {
        anchor_payment::handler(ctx, instalment_no, commitment)
    }

    /// Commits an investor's allocation to an opportunity, keyed by a reference
    /// that links it to neither party on chain.
    pub fn anchor_allocation(
        ctx: Context<AnchorAllocation>,
        allocation_ref_hash: [u8; 32],
        commitment: [u8; 32],
    ) -> Result<()> {
        anchor_allocation::handler(ctx, allocation_ref_hash, commitment)
    }

    /// Commits a productive-outcome measurement, on a loan that was disbursed.
    pub fn anchor_outcome(
        ctx: Context<AnchorOutcome>,
        outcome_no: u16,
        commitment: [u8; 32],
    ) -> Result<()> {
        anchor_outcome::handler(ctx, outcome_no, commitment)
    }
}

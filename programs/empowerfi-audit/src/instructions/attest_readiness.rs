use anchor_lang::prelude::*;

use crate::{
    constants::{BORROWER_SEED, CONFIG_SEED, READINESS_SEED, SCHEMA_VERSION},
    error::AuditError,
    state::{BorrowerAudit, PlatformConfig, ReadinessAttestation, ReadinessBand, ReadinessStatus},
};

#[derive(Accounts)]
#[instruction(assessment_no: u32)]
pub struct AttestReadiness<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = operator @ AuditError::UnauthorizedOperator,
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        seeds = [BORROWER_SEED, borrower.borrower_ref_hash.as_ref()],
        bump = borrower.bump,
    )]
    pub borrower: Account<'info, BorrowerAudit>,

    #[account(
        init,
        payer = operator,
        space = 8 + ReadinessAttestation::INIT_SPACE,
        seeds = [READINESS_SEED, borrower.key().as_ref(), &assessment_no.to_le_bytes()],
        bump,
    )]
    pub attestation: Account<'info, ReadinessAttestation>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AttestReadiness>,
    assessment_no: u32,
    status: ReadinessStatus,
    band: ReadinessBand,
    model_version: u16,
    commitment: [u8; 32],
) -> Result<()> {
    require!(assessment_no >= 1, AuditError::InvalidAssessmentNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let attestation = &mut ctx.accounts.attestation;
    attestation.borrower = ctx.accounts.borrower.key();
    attestation.assessment_no = assessment_no;
    attestation.status = status;
    attestation.band = band;
    attestation.model_version = model_version;
    attestation.commitment = commitment;
    attestation.attested_at = Clock::get()?.unix_timestamp;
    attestation.schema_version = SCHEMA_VERSION;
    attestation.bump = ctx.bumps.attestation;
    Ok(())
}

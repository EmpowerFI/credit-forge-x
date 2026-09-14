use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
#[instruction(opportunity_no: u32)]
pub struct AnchorOpportunity<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(seeds = [BORROWER_SEED, borrower.borrower_ref_hash.as_ref()], bump = borrower.bump)]
    pub borrower: Account<'info, BorrowerAudit>,

    #[account(
        constraint = eligibility.borrower == borrower.key() @ AuditError::NotEligible,
        constraint = eligibility.decision != EligibilityDecision::NotEligible @ AuditError::NotEligible,
    )]
    pub eligibility: Account<'info, EligibilityAttestation>,

    #[account(
        init,
        payer = operator,
        space = 8 + OpportunityCommitment::INIT_SPACE,
        seeds = [OPPORTUNITY_SEED, borrower.key().as_ref(), &opportunity_no.to_le_bytes()],
        bump,
    )]
    pub opportunity: Account<'info, OpportunityCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AnchorOpportunity>,
    opportunity_no: u32,
    commitment: [u8; 32],
) -> Result<()> {
    require!(opportunity_no >= 1, AuditError::InvalidAssessmentNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);

    let o = &mut ctx.accounts.opportunity;
    o.borrower = ctx.accounts.borrower.key();
    o.eligibility = ctx.accounts.eligibility.key();
    o.opportunity_no = opportunity_no;
    o.commitment = commitment;
    o.created_at = Clock::get()?.unix_timestamp;
    o.schema_version = SCHEMA_VERSION;
    o.bump = ctx.bumps.opportunity;
    Ok(())
}

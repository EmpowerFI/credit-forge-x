use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
#[instruction(outcome_no: u16)]
pub struct AnchorOutcome<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    // Only a loan that reached the business can have an outcome.
    #[account(
        seeds = [LOAN_SEED, loan.opportunity.as_ref()],
        bump = loan.bump,
        constraint = matches!(
            loan.status,
            LoanStatus::Disbursed | LoanStatus::Active | LoanStatus::Paid | LoanStatus::Defaulted
        ) @ AuditError::OutcomeBeforeDisbursement,
    )]
    pub loan: Account<'info, LoanAccount>,

    #[account(
        init,
        payer = operator,
        space = 8 + OutcomeCommitment::INIT_SPACE,
        seeds = [OUTCOME_SEED, loan.key().as_ref(), &outcome_no.to_le_bytes()],
        bump,
    )]
    pub outcome: Account<'info, OutcomeCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<AnchorOutcome>, outcome_no: u16, commitment: [u8; 32]) -> Result<()> {
    require!(outcome_no >= 1, AuditError::InvalidOutcomeNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);
    let o = &mut ctx.accounts.outcome;
    o.loan = ctx.accounts.loan.key();
    o.outcome_no = outcome_no;
    o.commitment = commitment;
    o.measured_at = Clock::get()?.unix_timestamp;
    o.schema_version = SCHEMA_VERSION;
    o.bump = ctx.bumps.outcome;
    Ok(())
}

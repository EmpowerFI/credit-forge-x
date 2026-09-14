use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
pub struct CreateLoan<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(seeds = [OPPORTUNITY_SEED, opportunity.borrower.as_ref(), &opportunity.opportunity_no.to_le_bytes()], bump = opportunity.bump)]
    pub opportunity: Account<'info, OpportunityCommitment>,

    // One loan per opportunity: the opportunity is the address.
    #[account(
        init,
        payer = operator,
        space = 8 + LoanAccount::INIT_SPACE,
        seeds = [LOAN_SEED, opportunity.key().as_ref()],
        bump,
    )]
    pub loan: Account<'info, LoanAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateLoan>, terms_commitment: [u8; 32]) -> Result<()> {
    require!(terms_commitment != [0u8; 32], AuditError::ZeroCommitment);
    let now = Clock::get()?.unix_timestamp;
    let loan = &mut ctx.accounts.loan;
    loan.borrower = ctx.accounts.opportunity.borrower;
    loan.opportunity = ctx.accounts.opportunity.key();
    loan.status = LoanStatus::Draft;
    loan.terms_commitment = terms_commitment;
    loan.last_transition_commitment = terms_commitment;
    loan.transitions = 0;
    loan.created_at = now;
    loan.updated_at = now;
    loan.schema_version = SCHEMA_VERSION;
    loan.bump = ctx.bumps.loan;
    Ok(())
}

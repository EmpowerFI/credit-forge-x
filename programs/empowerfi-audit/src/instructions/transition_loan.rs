use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
pub struct TransitionLoan<'info> {
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut, seeds = [LOAN_SEED, loan.opportunity.as_ref()], bump = loan.bump)]
    pub loan: Account<'info, LoanAccount>,
}

pub fn handler(
    ctx: Context<TransitionLoan>,
    to: LoanStatus,
    transition_commitment: [u8; 32],
) -> Result<()> {
    require!(
        transition_commitment != [0u8; 32],
        AuditError::ZeroCommitment
    );
    let loan = &mut ctx.accounts.loan;
    require!(
        loan.status.can_become(to),
        AuditError::InvalidLoanTransition
    );
    loan.status = to;
    loan.last_transition_commitment = transition_commitment;
    loan.transitions = loan.transitions.saturating_add(1);
    loan.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}

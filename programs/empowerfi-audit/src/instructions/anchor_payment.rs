use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
#[instruction(instalment_no: u16)]
pub struct AnchorPayment<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        seeds = [LOAN_SEED, loan.opportunity.as_ref()],
        bump = loan.bump,
        constraint = matches!(loan.status, LoanStatus::Disbursed | LoanStatus::Active) @ AuditError::LoanNotRepaying,
    )]
    pub loan: Account<'info, LoanAccount>,

    // One record per instalment: paying the same instalment twice is refused.
    #[account(
        init,
        payer = operator,
        space = 8 + PaymentCommitment::INIT_SPACE,
        seeds = [PAYMENT_SEED, loan.key().as_ref(), &instalment_no.to_le_bytes()],
        bump,
    )]
    pub payment: Account<'info, PaymentCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AnchorPayment>,
    instalment_no: u16,
    commitment: [u8; 32],
) -> Result<()> {
    require!(instalment_no >= 1, AuditError::InvalidInstalmentNumber);
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);
    let p = &mut ctx.accounts.payment;
    p.loan = ctx.accounts.loan.key();
    p.instalment_no = instalment_no;
    p.commitment = commitment;
    p.recorded_at = Clock::get()?.unix_timestamp;
    p.schema_version = SCHEMA_VERSION;
    p.bump = ctx.bumps.payment;
    Ok(())
}

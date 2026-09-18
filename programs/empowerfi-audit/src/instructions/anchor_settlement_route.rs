use anchor_lang::prelude::*;

use crate::{constants::*, error::AuditError, state::*};

#[derive(Accounts)]
pub struct AnchorSettlementRoute<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = operator @ AuditError::UnauthorizedOperator)]
    pub config: Account<'info, PlatformConfig>,

    // The route is how the disbursement was paid, so there is nothing to
    // record until the loan has reached it. A cancelled loan never will.
    #[account(
        seeds = [LOAN_SEED, loan.opportunity.as_ref()],
        bump = loan.bump,
        constraint = matches!(
            loan.status,
            LoanStatus::Disbursed | LoanStatus::Active | LoanStatus::Paid | LoanStatus::Defaulted
        ) @ AuditError::RouteBeforeDisbursement,
    )]
    pub loan: Account<'info, LoanAccount>,

    // One route per loan: `init` refuses a second, so a decision cannot be
    // rewritten once it is on chain.
    #[account(
        init,
        payer = operator,
        space = 8 + SettlementRouteCommitment::INIT_SPACE,
        seeds = [SETTLEMENT_ROUTE_SEED, loan.key().as_ref()],
        bump,
    )]
    pub settlement_route: Account<'info, SettlementRouteCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<AnchorSettlementRoute>,
    route: SettlementRoute,
    commitment: [u8; 32],
) -> Result<()> {
    require!(commitment != [0u8; 32], AuditError::ZeroCommitment);
    let r = &mut ctx.accounts.settlement_route;
    r.loan = ctx.accounts.loan.key();
    r.route = route;
    r.commitment = commitment;
    r.decided_at = Clock::get()?.unix_timestamp;
    r.schema_version = SCHEMA_VERSION;
    r.bump = ctx.bumps.settlement_route;
    Ok(())
}

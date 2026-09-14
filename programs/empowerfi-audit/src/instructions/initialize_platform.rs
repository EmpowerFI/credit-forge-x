use anchor_lang::prelude::*;

use crate::{
    constants::CONFIG_SEED, error::AuditError, program::EmpowerfiAudit, state::PlatformConfig,
};

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, PlatformConfig>,

    // Only the program's upgrade authority may initialise. Without this, anyone
    // could claim the config first after deploy, and the only way back would be
    // a new program ID — which the plan rules out for the whole hackathon.
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, EmpowerfiAudit>,

    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ AuditError::NotUpgradeAuthority,
    )]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializePlatform>, operator: Pubkey) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.operator = operator;
    config.created_at = Clock::get()?.unix_timestamp;
    config.bump = ctx.bumps.config;
    Ok(())
}

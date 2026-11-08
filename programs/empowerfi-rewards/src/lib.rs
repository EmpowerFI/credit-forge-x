//! EmpowerFI campaign vaults.
//!
//! A sponsor funds a 30-day campaign, priced per entrepreneur (at least 100
//! seats). The money sits in a vault the campaign itself owns, and the terms
//! are written here, where anyone can read them: half for EmpowerFI, half for
//! the entrepreneurs, and a reward unlocks only after 30 days kept in the
//! diary. The diary proves who kept them: each attestation is a Merkle root
//! over opaque commitments, plus the counts -- never a name, an e-mail or a
//! figure of her business.
//!
//! Rewards go out one woman at a time: the operator proves her leaf is in the
//! attested root, and the program pays her share into her reward wallet -- an
//! address of this program, [RECIPIENT_SEED, her opaque reference], with no
//! private key anywhere. Only this program can ever move what it holds, which
//! is what a later version will do to hand it to the wallet she chooses. A
//! receipt per campaign and wallet pays her once; EmpowerFI's half never
//! leaves the vault here.

use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::{invoke, invoke_signed},
    },
};

use solana_sha256_hasher::hashv;

declare_id!("5cWTf64kSqVQSKJW3DoSCs6uyrcXXWXppCMd15yrjAgT");

/// SPL Token, the program USDC lives under.
pub const TOKEN_PROGRAM_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TRANSFER_CHECKED: u8 = 12;
/// Offset of `decimals` in an SPL mint: COption<Pubkey> (36) | supply (8).
const MINT_DECIMALS_OFFSET: usize = 44;
/// An SPL token account: mint (32) | owner (32) | amount (8) | ...
const TOKEN_ACCOUNT_LEN: usize = 165;

/// Frozen for the life of the program ID: changing it moves every campaign.
#[constant]
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
/// The fewest entrepreneurs a campaign is sold for.
#[constant]
pub const MIN_SEATS: u32 = 100;
/// EmpowerFI's half, in basis points.
#[constant]
pub const HOUSE_SHARE_BPS: u16 = 5_000;
/// Days she keeps the diary before her reward unlocks.
#[constant]
pub const UNLOCK_DAYS: u16 = 30;
const DAY: i64 = 86_400;
/// Her reward wallet: [RECIPIENT_SEED, recipient_ref]. Frozen for the life of the program ID.
#[constant]
pub const RECIPIENT_SEED: &[u8] = b"recipient";
/// One receipt per campaign and wallet: [RECEIPT_SEED, campaign, recipient_ref].
#[constant]
pub const RECEIPT_SEED: &[u8] = b"paid";
/// What a leaf commits to: this prefix, the campaign, her wallet, her salt.
pub const LEAF_DOMAIN: &[u8] = b"EMPOWERFI:CAMPAIGN_LEAF:v2";
/// The longest inclusion proof accepted: a tree of up to 2^24 leaves.
const MAX_PROOF: usize = 24;

#[program]
pub mod empowerfi_rewards {
    use super::*;

    /// Writes a campaign's terms. The sponsor signs and pays; `operator` is
    /// the key that will attest engagement, `house` the account EmpowerFI's
    /// half (and, for an impact campaign, what is not claimed) belongs to.
    #[allow(clippy::too_many_arguments)]
    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        campaign_ref: [u8; 16],
        kind: RewardKind,
        price_per_seat: u64,
        seats: u32,
        starts_at: i64,
        ends_at: i64,
        terms_commitment: [u8; 32],
    ) -> Result<()> {
        require!(campaign_ref != [0u8; 16], RewardsError::ZeroReference);
        require!(terms_commitment != [0u8; 32], RewardsError::ZeroCommitment);
        // Activation needs a verified activation, which nothing can prove yet.
        require!(kind == RewardKind::Impact, RewardsError::ActivationNotYet);
        require!(seats >= MIN_SEATS, RewardsError::TooFewSeats);
        require!(price_per_seat > 0, RewardsError::ZeroAmount);
        price_per_seat.checked_mul(seats as u64).ok_or(RewardsError::Overflow)?;
        require!(ends_at - starts_at >= UNLOCK_DAYS as i64 * DAY, RewardsError::TooShort);
        let now = Clock::get()?.unix_timestamp;
        require!(ends_at > now, RewardsError::AlreadyOver);

        let c = &mut ctx.accounts.campaign;
        c.campaign_ref = campaign_ref;
        c.sponsor = ctx.accounts.sponsor.key();
        c.operator = ctx.accounts.operator.key();
        c.house = ctx.accounts.house.key();
        c.mint = ctx.accounts.mint.key();
        c.vault = Pubkey::default();
        c.kind = kind;
        c.price_per_seat = price_per_seat;
        c.seats = seats;
        c.house_share_bps = HOUSE_SHARE_BPS;
        c.unlock_days = UNLOCK_DAYS;
        c.starts_at = starts_at;
        c.ends_at = ends_at;
        c.terms_commitment = terms_commitment;
        c.status = CampaignStatus::Created;
        c.created_at = now;
        c.bump = ctx.bumps.campaign;
        emit!(CampaignCreated { campaign: c.key(), sponsor: c.sponsor, seats, price_per_seat });
        Ok(())
    }

    /// The sponsor pays the whole campaign, price times seats, into a token
    /// account the campaign owns. Once.
    pub fn fund_campaign(ctx: Context<FundCampaign>) -> Result<()> {
        let a = &ctx.accounts;
        let c = &a.campaign;
        require!(c.status == CampaignStatus::Created, RewardsError::AlreadyFunded);
        require!(Clock::get()?.unix_timestamp < c.ends_at, RewardsError::AlreadyOver);
        {
            let vault = a.vault.try_borrow_data()?;
            require!(vault.len() == TOKEN_ACCOUNT_LEN, RewardsError::NotTheVault);
            require!(vault[0..32] == c.mint.to_bytes(), RewardsError::NotTheVault);
            require!(vault[32..64] == c.key().to_bytes(), RewardsError::NotTheVault);
        }
        let amount = c.total();
        let decimals = *a.mint.try_borrow_data()?.get(MINT_DECIMALS_OFFSET).ok_or(RewardsError::NotAMint)?;
        let mut data = Vec::with_capacity(10);
        data.push(TRANSFER_CHECKED);
        data.extend_from_slice(&amount.to_le_bytes());
        data.push(decimals);
        invoke(
            &Instruction {
                program_id: TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(a.sponsor_tokens.key(), false),
                    AccountMeta::new_readonly(a.mint.key(), false),
                    AccountMeta::new(a.vault.key(), false),
                    AccountMeta::new_readonly(a.sponsor.key(), true),
                ],
                data,
            },
            &[
                a.sponsor_tokens.to_account_info(),
                a.mint.to_account_info(),
                a.vault.to_account_info(),
                a.sponsor.to_account_info(),
            ],
        )?;

        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.campaign;
        c.vault = ctx.accounts.vault.key();
        c.funded = amount;
        c.funded_at = now;
        c.status = CampaignStatus::Funded;
        emit!(CampaignFunded {
            campaign: c.key(),
            vault: c.vault,
            amount,
            house_share: c.house_share(),
            entrepreneurs_share: c.entrepreneurs_share(),
        });
        Ok(())
    }

    /// The diary's word on engagement: how many entrepreneurs are in the
    /// campaign, how many have kept it `unlock_days` days, and the Merkle root
    /// of those who have (opaque leaves; the database keeps the tree). Each
    /// attestation replaces the last; the history is in the events.
    pub fn attest_engagement(
        ctx: Context<AttestEngagement>,
        enrolled: u32,
        engaged: u32,
        engagement_root: [u8; 32],
    ) -> Result<()> {
        let c = &mut ctx.accounts.campaign;
        require!(c.status == CampaignStatus::Funded, RewardsError::NotFunded);
        require!(engaged <= enrolled, RewardsError::MoreEngagedThanEnrolled);
        require!(engaged <= c.seats, RewardsError::MoreEngagedThanSeats);
        require!((engaged == 0) == (engagement_root == [0u8; 32]), RewardsError::RootDoesNotFit);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= c.starts_at, RewardsError::NotStarted);
        c.enrolled = enrolled;
        c.engaged = engaged;
        c.engagement_root = engagement_root;
        c.attested_at = now;
        c.attestations = c.attestations.checked_add(1).ok_or(RewardsError::Overflow)?;
        emit!(EngagementAttested { campaign: c.key(), enrolled, engaged, engagement_root, attestation: c.attestations });
        Ok(())
    }

    /// Pays one woman who kept the days: her leaf -- the campaign, her wallet's
    /// reference and her salt -- must sit at `index` of the root attested
    /// last, a tree of exactly `engaged` leaves. Her share goes to a token
    /// account her reward wallet owns; the receipt makes it once. What
    /// EmpowerFI is owed stays: a payment that would dig into it fails.
    pub fn pay_reward(
        ctx: Context<PayReward>,
        recipient_ref: [u8; 16],
        salt: [u8; 32],
        index: u32,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let a = &ctx.accounts;
        let c = &a.campaign;
        require!(c.status == CampaignStatus::Funded, RewardsError::NotFunded);
        require!(c.engaged > 0, RewardsError::NobodyEngaged);
        require!(proof.len() <= MAX_PROOF, RewardsError::NotInTheRoot);
        let commitment = leaf_commitment(&c.campaign_ref, &recipient_ref, &salt);
        let leaf = hashv(&[&[0u8][..], &commitment[..]]).to_bytes();
        require!(
            verify_inclusion(leaf, index as u64, c.engaged as u64, &proof, c.engagement_root),
            RewardsError::NotInTheRoot
        );
        {
            let t = a.recipient_tokens.try_borrow_data()?;
            require!(t.len() == TOKEN_ACCOUNT_LEN, RewardsError::NotHerTokenAccount);
            require!(t[0..32] == c.mint.to_bytes(), RewardsError::NotHerTokenAccount);
            require!(t[32..64] == a.recipient.key().to_bytes(), RewardsError::NotHerTokenAccount);
        }
        let amount = c.reward_per_seat();
        require!(amount > 0, RewardsError::ZeroAmount);
        let in_vault = {
            let v = a.vault.try_borrow_data()?;
            require!(v.len() == TOKEN_ACCOUNT_LEN, RewardsError::NotTheVault);
            u64::from_le_bytes(v[64..72].try_into().unwrap())
        };
        require!(in_vault >= amount && in_vault - amount >= c.house_share(), RewardsError::EntrepreneursShareSpent);

        let decimals = *a.mint.try_borrow_data()?.get(MINT_DECIMALS_OFFSET).ok_or(RewardsError::NotAMint)?;
        let mut data = Vec::with_capacity(10);
        data.push(TRANSFER_CHECKED);
        data.extend_from_slice(&amount.to_le_bytes());
        data.push(decimals);
        let bump = [c.bump];
        let seeds: &[&[u8]] = &[CAMPAIGN_SEED, c.campaign_ref.as_ref(), &bump];
        invoke_signed(
            &Instruction {
                program_id: TOKEN_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(a.vault.key(), false),
                    AccountMeta::new_readonly(a.mint.key(), false),
                    AccountMeta::new(a.recipient_tokens.key(), false),
                    AccountMeta::new_readonly(c.key(), true),
                ],
                data,
            },
            &[
                a.vault.to_account_info(),
                a.mint.to_account_info(),
                a.recipient_tokens.to_account_info(),
                c.to_account_info(),
            ],
            &[seeds],
        )?;

        let now = Clock::get()?.unix_timestamp;
        let campaign = c.key();
        let recipient = a.recipient.key();
        let r = &mut ctx.accounts.receipt;
        r.campaign = campaign;
        r.recipient = recipient;
        r.amount = amount;
        r.paid_at = now;
        r.bump = ctx.bumps.receipt;
        emit!(RewardPaid { campaign, recipient, amount, leaf: commitment });
        Ok(())
    }
}

/// sha256(LEAF_DOMAIN | campaign_ref | recipient_ref | salt): what the
/// database puts in the tree for her (20261226).
pub fn leaf_commitment(campaign_ref: &[u8; 16], recipient_ref: &[u8; 16], salt: &[u8; 32]) -> [u8; 32] {
    hashv(&[LEAF_DOMAIN, &campaign_ref[..], &recipient_ref[..], &salt[..]]).to_bytes()
}

fn node(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    hashv(&[&[1u8][..], &left[..], &right[..]]).to_bytes()
}

/// RFC 9162 section 2.1.3.2: whether the (already hashed) leaf at `index`
/// sits in a tree of `size` leaves with this root. The same algorithm the
/// database's trees are built for (_shared/passport verifyInclusion).
pub fn verify_inclusion(leaf: [u8; 32], index: u64, size: u64, proof: &[[u8; 32]], root: [u8; 32]) -> bool {
    if index >= size {
        return false;
    }
    let (mut fnode, mut snode) = (index, size - 1);
    let mut r = leaf;
    for p in proof {
        if snode == 0 {
            return false;
        }
        if fnode & 1 == 1 || fnode == snode {
            r = node(p, &r);
            if fnode & 1 == 0 {
                while fnode & 1 == 0 && fnode != 0 {
                    fnode >>= 1;
                    snode >>= 1;
                }
            }
        } else {
            r = node(&r, p);
        }
        fnode >>= 1;
        snode >>= 1;
    }
    snode == 0 && r == root
}

// ------------------------------------------------------------------ accounts

#[derive(Accounts)]
#[instruction(campaign_ref: [u8; 16])]
pub struct CreateCampaign<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    /// CHECK: only its key is stored: the signer of later attestations.
    pub operator: UncheckedAccount<'info>,
    /// CHECK: only its key is stored: who EmpowerFI's half belongs to.
    pub house: UncheckedAccount<'info>,
    /// CHECK: an SPL mint; fund_campaign reads its decimals and SPL Token checks it.
    #[account(owner = TOKEN_PROGRAM_ID)]
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = sponsor,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, campaign_ref.as_ref()],
        bump,
    )]
    pub campaign: Account<'info, Campaign>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundCampaign<'info> {
    pub sponsor: Signer<'info>,
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.campaign_ref.as_ref()],
        bump = campaign.bump,
        has_one = sponsor @ RewardsError::NotTheSponsor,
        has_one = mint @ RewardsError::NotAMint,
    )]
    pub campaign: Account<'info, Campaign>,
    /// CHECK: the campaign's mint (has_one above).
    #[account(owner = TOKEN_PROGRAM_ID)]
    pub mint: UncheckedAccount<'info>,
    /// CHECK: SPL Token debits it only if the sponsor owns it.
    #[account(mut)]
    pub sponsor_tokens: UncheckedAccount<'info>,
    /// CHECK: a token account of the campaign's mint owned by the campaign,
    /// checked in the handler; that ownership is what makes it the vault.
    #[account(mut, owner = TOKEN_PROGRAM_ID)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: pinned to SPL Token.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct AttestEngagement<'info> {
    pub operator: Signer<'info>,
    #[account(
        mut,
        seeds = [CAMPAIGN_SEED, campaign.campaign_ref.as_ref()],
        bump = campaign.bump,
        has_one = operator @ RewardsError::NotTheOperator,
    )]
    pub campaign: Account<'info, Campaign>,
}

#[derive(Accounts)]
#[instruction(recipient_ref: [u8; 16])]
pub struct PayReward<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,
    #[account(
        seeds = [CAMPAIGN_SEED, campaign.campaign_ref.as_ref()],
        bump = campaign.bump,
        has_one = operator @ RewardsError::NotTheOperator,
        has_one = mint @ RewardsError::NotAMint,
        has_one = vault @ RewardsError::NotTheVault,
    )]
    pub campaign: Account<'info, Campaign>,
    /// CHECK: the campaign's mint (has_one above).
    #[account(owner = TOKEN_PROGRAM_ID)]
    pub mint: UncheckedAccount<'info>,
    /// CHECK: the campaign's vault (has_one above); SPL Token debits it on the campaign's signature.
    #[account(mut, owner = TOKEN_PROGRAM_ID)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: her reward wallet: an address of this program, never an account it writes.
    #[account(seeds = [RECIPIENT_SEED, recipient_ref.as_ref()], bump)]
    pub recipient: UncheckedAccount<'info>,
    /// CHECK: a token account of the campaign's mint owned by her wallet, checked in the handler.
    #[account(mut, owner = TOKEN_PROGRAM_ID)]
    pub recipient_tokens: UncheckedAccount<'info>,
    #[account(
        init,
        payer = operator,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [RECEIPT_SEED, campaign.key().as_ref(), recipient_ref.as_ref()],
        bump,
    )]
    pub receipt: Account<'info, Receipt>,
    /// CHECK: pinned to SPL Token.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// ------------------------------------------------------------------ state

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum RewardKind {
    /// Unlocks after the days kept; what is not claimed goes to EmpowerFI.
    Impact,
    /// Unlocks after the days kept and a verified activation; what is not
    /// claimed goes back to the sponsor. Not accepted yet.
    Activation,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CampaignStatus {
    Created,
    Funded,
}

/// One per campaign, at [CAMPAIGN_SEED, campaign_ref]. `campaign_ref` is the
/// campaign's id in the database; nothing here names a person.
#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub campaign_ref: [u8; 16],
    pub sponsor: Pubkey,
    pub operator: Pubkey,
    pub house: Pubkey,
    pub mint: Pubkey,
    /// The token account holding the money; default until funded.
    pub vault: Pubkey,
    pub kind: RewardKind,
    /// In the mint's base units.
    pub price_per_seat: u64,
    pub seats: u32,
    pub house_share_bps: u16,
    pub unlock_days: u16,
    pub starts_at: i64,
    pub ends_at: i64,
    /// Commitment to the campaign's full terms as the database keeps them.
    pub terms_commitment: [u8; 32],
    pub status: CampaignStatus,
    pub funded: u64,
    pub funded_at: i64,
    pub enrolled: u32,
    pub engaged: u32,
    pub engagement_root: [u8; 32],
    pub attested_at: i64,
    pub attestations: u32,
    pub created_at: i64,
    pub bump: u8,
}

/// That one wallet was paid by one campaign, and how much.
#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub campaign: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub paid_at: i64,
    pub bump: u8,
}

impl Campaign {
    /// What the sponsor pays: price times seats (checked at creation).
    pub fn total(&self) -> u64 {
        self.price_per_seat * self.seats as u64
    }
    /// EmpowerFI's half of what was funded.
    pub fn house_share(&self) -> u64 {
        (self.funded as u128 * self.house_share_bps as u128 / 10_000) as u64
    }
    /// The entrepreneurs' half: the rest, so no unit is lost to rounding.
    pub fn entrepreneurs_share(&self) -> u64 {
        self.funded - self.house_share()
    }
    /// One entrepreneur's reward, once she has kept the days.
    pub fn reward_per_seat(&self) -> u64 {
        self.entrepreneurs_share() / self.seats as u64
    }
}

// ------------------------------------------------------------------ events

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub sponsor: Pubkey,
    pub seats: u32,
    pub price_per_seat: u64,
}

#[event]
pub struct CampaignFunded {
    pub campaign: Pubkey,
    pub vault: Pubkey,
    pub amount: u64,
    pub house_share: u64,
    pub entrepreneurs_share: u64,
}

#[event]
pub struct EngagementAttested {
    pub campaign: Pubkey,
    pub enrolled: u32,
    pub engaged: u32,
    pub engagement_root: [u8; 32],
    pub attestation: u32,
}

#[event]
pub struct RewardPaid {
    pub campaign: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub leaf: [u8; 32],
}

// ------------------------------------------------------------------ errors

#[error_code]
pub enum RewardsError {
    #[msg("A reference of all zero bytes is not a reference")]
    ZeroReference,
    #[msg("A commitment of all zero bytes is not a commitment")]
    ZeroCommitment,
    #[msg("Activation campaigns are not accepted yet")]
    ActivationNotYet,
    #[msg("A campaign is sold for at least 100 entrepreneurs")]
    TooFewSeats,
    #[msg("An amount of zero")]
    ZeroAmount,
    #[msg("Amount overflows")]
    Overflow,
    #[msg("A campaign runs at least the days that unlock a reward")]
    TooShort,
    #[msg("The campaign is already over")]
    AlreadyOver,
    #[msg("The campaign is already funded")]
    AlreadyFunded,
    #[msg("The campaign is not funded")]
    NotFunded,
    #[msg("The campaign has not started")]
    NotStarted,
    #[msg("Not a token account of the campaign's mint owned by the campaign")]
    NotTheVault,
    #[msg("Not an SPL mint, or not the campaign's")]
    NotAMint,
    #[msg("Signer is not the campaign's sponsor")]
    NotTheSponsor,
    #[msg("Signer is not the campaign's operator")]
    NotTheOperator,
    #[msg("More engaged than enrolled")]
    MoreEngagedThanEnrolled,
    #[msg("More engaged than the seats paid for")]
    MoreEngagedThanSeats,
    #[msg("A root is given exactly when someone is engaged")]
    RootDoesNotFit,
    #[msg("No one has kept the days yet")]
    NobodyEngaged,
    #[msg("This leaf is not in the root attested last")]
    NotInTheRoot,
    #[msg("Not a token account of the campaign's mint owned by her reward wallet")]
    NotHerTokenAccount,
    #[msg("The entrepreneurs' half is spent")]
    EntrepreneursShareSpent,
}

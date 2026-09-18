use anchor_lang::prelude::*;

// PDA seeds. Changing any of these moves every account the program has
// written, so they are frozen for the life of the program ID.
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const COMMUNITY_SEED: &[u8] = b"community";
#[constant]
pub const BORROWER_SEED: &[u8] = b"borrower";
#[constant]
pub const CHECKIN_SEED: &[u8] = b"checkin";
#[constant]
pub const READINESS_SEED: &[u8] = b"readiness";
#[constant]
pub const ELIGIBILITY_SEED: &[u8] = b"eligibility";
#[constant]
pub const OPPORTUNITY_SEED: &[u8] = b"opportunity";
#[constant]
pub const LOAN_SEED: &[u8] = b"loan";
#[constant]
pub const PAYMENT_SEED: &[u8] = b"payment";
#[constant]
pub const OUTCOME_SEED: &[u8] = b"outcome";
#[constant]
pub const ALLOCATION_SEED: &[u8] = b"allocation";
#[constant]
pub const CONSENT_SEED: &[u8] = b"consent";
#[constant]
pub const SETTLEMENT_ROUTE_SEED: &[u8] = b"settlement_route";
/// Owner of the program's USDC vault (its associated token account). Investors
/// deposit with a plain token transfer; the chain sees a deposit to the vault,
/// never which opportunity it funds.
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Version of the commitment schemas these accounts carry. It matches the
/// `:v1` suffix of the domain tags in packages/audit-commitments; a payload
/// change bumps both together.
#[constant]
pub const SCHEMA_VERSION: u8 = 1;

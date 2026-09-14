use anchor_lang::prelude::*;

// PDA seeds. Changing any of these moves every account the program has
// written, so they are frozen for the life of the program ID.
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const COMMUNITY_SEED: &[u8] = b"community";
#[constant]
pub const BORROWER_SEED: &[u8] = b"borrower";

/// Version of the commitment schemas these accounts carry. It matches the
/// `:v1` suffix of the domain tags in packages/audit-commitments; a payload
/// change bumps both together.
#[constant]
pub const SCHEMA_VERSION: u8 = 1;

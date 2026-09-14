use anchor_lang::prelude::*;

#[error_code]
pub enum AuditError {
    #[msg("Signer is not the program's upgrade authority")]
    NotUpgradeAuthority,
    #[msg("Signer is not the platform authority")]
    UnauthorizedAuthority,
    #[msg("Signer is not the platform operator")]
    UnauthorizedOperator,
    #[msg("A commitment of all zero bytes is not a commitment")]
    ZeroCommitment,
    #[msg("A reference of all zero bytes is not a reference")]
    ZeroReference,
    #[msg("Community is already verified")]
    CommunityAlreadyVerified,
    #[msg("Community must be verified before borrowers are registered in it")]
    CommunityNotVerified,
}

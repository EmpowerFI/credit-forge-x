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
    #[msg("Period must be YYYYMM, between 202001 and 210012")]
    InvalidPeriod,
    #[msg("Assessments are numbered from 1")]
    InvalidAssessmentNumber,
    #[msg("Eligibility needs a CreditReady readiness attestation of the same borrower")]
    ReadinessNotCreditReady,
    #[msg("An opportunity needs an eligibility that is not NotEligible, of the same borrower")]
    NotEligible,
    #[msg("That loan status change is not allowed")]
    InvalidLoanTransition,
    #[msg("Payments are recorded only on a disbursed or active loan")]
    LoanNotRepaying,
    #[msg("Instalments are numbered from 1")]
    InvalidInstalmentNumber,
    #[msg("Outcomes are measured only once the loan has been disbursed")]
    OutcomeBeforeDisbursement,
    #[msg("Outcome measurements are numbered from 1")]
    InvalidOutcomeNumber,
    #[msg("A transfer moves a positive amount")]
    ZeroAmount,
    #[msg("The mint account is not an SPL mint")]
    NotAMint,
    #[msg("Consent records are numbered from 1")]
    InvalidConsentNumber,
    #[msg("A settlement route is recorded only once the loan's money has moved")]
    RouteBeforeDisbursement,
}

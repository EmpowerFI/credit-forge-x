// Each module exports a `handler`; lib.rs always calls them by module path
// (`register_community::handler`), so the glob re-export of the name is never
// used ambiguously. The globs are what bring Anchor's generated account types
// into scope for #[program].
#![allow(ambiguous_glob_reexports)]

pub mod anchor_allocation;
pub mod anchor_checkin;
pub mod anchor_consent;
pub mod anchor_opportunity;
pub mod anchor_outcome;
pub mod anchor_payment;
pub mod attest_eligibility;
pub mod attest_readiness;
pub mod create_loan;
pub mod initialize_platform;
pub mod register_borrower_ref;
pub mod register_community;
pub mod set_operator;
pub mod transition_loan;
pub mod vault_transfer;
pub mod verify_community;

pub use anchor_allocation::*;
pub use anchor_checkin::*;
pub use anchor_consent::*;
pub use anchor_opportunity::*;
pub use anchor_outcome::*;
pub use anchor_payment::*;
pub use attest_eligibility::*;
pub use attest_readiness::*;
pub use create_loan::*;
pub use initialize_platform::*;
pub use register_borrower_ref::*;
pub use register_community::*;
pub use set_operator::*;
pub use transition_loan::*;
pub use vault_transfer::*;
pub use verify_community::*;

// Each module exports a `handler`; lib.rs always calls them by module path
// (`register_community::handler`), so the glob re-export of the name is never
// used ambiguously. The globs are what bring Anchor's generated account types
// into scope for #[program].
#![allow(ambiguous_glob_reexports)]

pub mod initialize_platform;
pub mod register_borrower_ref;
pub mod register_community;
pub mod set_operator;
pub mod verify_community;

pub use initialize_platform::*;
pub use register_borrower_ref::*;
pub use register_community::*;
pub use set_operator::*;
pub use verify_community::*;

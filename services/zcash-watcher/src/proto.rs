//! The few lightwalletd messages the watcher uses, from `compact_formats.proto`
//! and `service.proto` (zcash/lightwallet-protocol). Only the fields read or
//! written here are declared; prost skips the rest.

#[derive(Clone, PartialEq, prost::Message)]
pub struct ChainSpec {}

#[derive(Clone, PartialEq, prost::Message)]
pub struct BlockId {
    #[prost(uint64, tag = "1")]
    pub height: u64,
    #[prost(bytes = "vec", tag = "2")]
    pub hash: Vec<u8>,
}

pub const POOL_SAPLING: i32 = 2;
pub const POOL_ORCHARD: i32 = 3;
pub const POOL_IRONWOOD: i32 = 4;

#[derive(Clone, PartialEq, prost::Message)]
pub struct BlockRange {
    #[prost(message, optional, tag = "1")]
    pub start: Option<BlockId>,
    #[prost(message, optional, tag = "2")]
    pub end: Option<BlockId>,
    #[prost(int32, repeated, tag = "3")]
    pub pool_types: Vec<i32>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct TxFilter {
    #[prost(message, optional, tag = "1")]
    pub block: Option<BlockId>,
    #[prost(uint64, tag = "2")]
    pub index: u64,
    #[prost(bytes = "vec", tag = "3")]
    pub hash: Vec<u8>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct RawTransaction {
    #[prost(bytes = "vec", tag = "1")]
    pub data: Vec<u8>,
    #[prost(uint64, tag = "2")]
    pub height: u64,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct CompactBlock {
    #[prost(uint64, tag = "2")]
    pub height: u64,
    #[prost(bytes = "vec", tag = "3")]
    pub hash: Vec<u8>,
    #[prost(message, repeated, tag = "7")]
    pub vtx: Vec<CompactTx>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct CompactTx {
    #[prost(uint64, tag = "1")]
    pub index: u64,
    #[prost(bytes = "vec", tag = "2")]
    pub txid: Vec<u8>,
    #[prost(message, repeated, tag = "5")]
    pub outputs: Vec<CompactSaplingOutput>,
    #[prost(message, repeated, tag = "6")]
    pub actions: Vec<CompactOrchardAction>,
    #[prost(message, repeated, tag = "9")]
    pub ironwood_actions: Vec<CompactOrchardAction>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct CompactSaplingOutput {
    #[prost(bytes = "vec", tag = "1")]
    pub cmu: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")]
    pub ephemeral_key: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")]
    pub ciphertext: Vec<u8>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub struct CompactOrchardAction {
    #[prost(bytes = "vec", tag = "1")]
    pub nullifier: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")]
    pub cmx: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")]
    pub ephemeral_key: Vec<u8>,
    #[prost(bytes = "vec", tag = "4")]
    pub ciphertext: Vec<u8>,
}

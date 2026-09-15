//! A receive-only Zcash watcher.
//!
//! It holds a unified full viewing key and answers two questions about a range of
//! blocks served by a lightwalletd: which transactions paid that key (trial
//! decryption of compact blocks), and, for one of them, how much each shielded
//! output was worth and what its memo says (full decryption of the raw
//! transaction). It never spends, so it keeps no note-commitment tree and no
//! state: the caller keeps the last height it scanned.
//!
//! Transport is left to the caller. This crate builds gRPC request bodies and
//! parses gRPC response bodies, so the same code serves a native CLI and a
//! WebAssembly module called from a Deno Edge Function.

use std::fmt;

use orchard::note_encryption::{CompactAction, IronwoodDomain, OrchardDomain};
use prost::Message;
use sapling::note_encryption::{CompactOutputDescription, SaplingDomain, Zip212Enforcement};
use serde::Serialize;
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_note_encryption::{try_compact_note_decryption, try_note_decryption, EphemeralKeyBytes};
use zcash_primitives::transaction::Transaction;
use zcash_protocol::{
    consensus::{BlockHeight, BranchId, Network},
    memo::{Memo, MemoBytes},
};

#[cfg(target_arch = "wasm32")]
mod wasm;

pub mod proto;

/// Every pool the watcher can receive into. Ironwood (ZIP 2005, NU6.3) is
/// Orchard-shaped and decrypted with the Orchard viewing key, under its own
/// note plaintext version.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Pool {
    Sapling,
    Orchard,
    Ironwood,
}

#[derive(Debug)]
pub struct Error(String);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for Error {}

fn err(msg: impl Into<String>) -> Error {
    Error(msg.into())
}

/// A payment seen in a compact block: enough to know it is ours and what it is worth.
/// The memo needs the full transaction (see [`Watcher::decrypt_transaction`]).
#[derive(Clone, Debug, Serialize)]
pub struct Hit {
    pub height: u64,
    /// Display order (as block explorers show it).
    pub txid: String,
    pub pool: Pool,
    pub index: usize,
    pub value_zat: u64,
}

#[derive(Clone, Debug, Serialize)]
pub struct Scan {
    pub from: Option<u64>,
    pub to: Option<u64>,
    pub blocks: usize,
    /// Hash of the last block scanned (display order), for reorg checks by the caller.
    pub last_hash: Option<String>,
    pub hits: Vec<Hit>,
}

/// One shielded output of a transaction that paid the viewing key.
#[derive(Clone, Debug, Serialize)]
pub struct Received {
    pub pool: Pool,
    pub index: usize,
    pub value_zat: u64,
    /// The memo as text, when it is a text memo.
    pub memo: Option<String>,
    /// The raw 512-byte memo, hex, with trailing zeros trimmed.
    pub memo_hex: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct Decrypted {
    pub txid: String,
    pub height: u64,
    pub outputs: Vec<Received>,
}

/// Holds the prepared incoming viewing keys of one account. Only the external
/// scope is used: the watcher cares about payments received, not change.
pub struct Watcher {
    network: Network,
    sapling: Option<sapling::keys::PreparedIncomingViewingKey>,
    orchard: Option<orchard::keys::PreparedIncomingViewingKey>,
}

impl Watcher {
    /// Parses a unified full viewing key (`uview1…` on mainnet, `uviewtest1…` on testnet).
    pub fn new(ufvk: &str) -> Result<Self, Error> {
        let ufvk = ufvk.trim();
        let network = if ufvk.starts_with("uviewtest") {
            Network::TestNetwork
        } else if ufvk.starts_with("uview") {
            Network::MainNetwork
        } else {
            return Err(err("not a unified full viewing key"));
        };
        let key = UnifiedFullViewingKey::decode(&network, ufvk).map_err(err)?;
        let sapling = key
            .sapling()
            .map(|dfvk| sapling::keys::PreparedIncomingViewingKey::new(&dfvk.to_ivk(zip32::Scope::External)));
        let orchard = key
            .orchard()
            .map(|fvk| orchard::keys::PreparedIncomingViewingKey::new(&fvk.to_ivk(zip32::Scope::External)));
        if sapling.is_none() && orchard.is_none() {
            return Err(err("the viewing key has no shielded component"));
        }
        Ok(Self { network, sapling, orchard })
    }

    pub fn network(&self) -> Network {
        self.network
    }

    /// Trial-decrypts a `GetBlockRange` response body (a sequence of gRPC frames,
    /// one compact block each).
    pub fn scan_block_range(&self, body: &[u8]) -> Result<Scan, Error> {
        let mut scan = Scan { from: None, to: None, blocks: 0, last_hash: None, hits: vec![] };
        for frame in grpc_frames(body)? {
            let block = proto::CompactBlock::decode(frame).map_err(|e| err(format!("compact block: {e}")))?;
            scan.from.get_or_insert(block.height);
            scan.to = Some(block.height);
            scan.blocks += 1;
            scan.last_hash = Some(display_hex(&block.hash));
            for tx in &block.vtx {
                self.scan_compact_tx(block.height, tx, &mut scan.hits);
            }
        }
        Ok(scan)
    }

    fn scan_compact_tx(&self, height: u64, tx: &proto::CompactTx, hits: &mut Vec<Hit>) {
        let txid = display_hex(&tx.txid);
        if let Some(ivk) = &self.sapling {
            for (index, out) in tx.outputs.iter().enumerate() {
                let Some(out) = compact_sapling_output(out) else { continue };
                let domain = SaplingDomain::new(Zip212Enforcement::On);
                if let Some((note, _)) = try_compact_note_decryption(&domain, ivk, &out) {
                    hits.push(Hit { height, txid: txid.clone(), pool: Pool::Sapling, index, value_zat: note.value().inner() });
                }
            }
        }
        if let Some(ivk) = &self.orchard {
            for (pool, actions) in [(Pool::Orchard, &tx.actions), (Pool::Ironwood, &tx.ironwood_actions)] {
                for (index, act) in actions.iter().enumerate() {
                    let Some(act) = compact_orchard_action(act) else { continue };
                    let value = match pool {
                        Pool::Ironwood => try_compact_note_decryption(&IronwoodDomain::for_compact_action(&act), ivk, &act),
                        _ => try_compact_note_decryption(&OrchardDomain::for_compact_action(&act), ivk, &act),
                    }
                    .map(|(note, _)| note.value().inner());
                    if let Some(value_zat) = value {
                        hits.push(Hit { height, txid: txid.clone(), pool, index, value_zat });
                    }
                }
            }
        }
    }

    /// Fully decrypts a `GetTransaction` response body (one gRPC frame holding a
    /// `RawTransaction`) and returns the outputs that paid the viewing key.
    pub fn decrypt_transaction(&self, body: &[u8]) -> Result<Decrypted, Error> {
        let frame = grpc_frames(body)?.into_iter().next().ok_or_else(|| err("empty response"))?;
        let raw = proto::RawTransaction::decode(frame).map_err(|e| err(format!("raw transaction: {e}")))?;
        self.decrypt_raw(&raw.data, raw.height)
    }

    /// Decrypts a serialized transaction mined at `height` (0 if in the mempool).
    pub fn decrypt_raw(&self, data: &[u8], height: u64) -> Result<Decrypted, Error> {
        let at = if height > 0 { height } else { u32::MAX as u64 };
        let branch = BranchId::for_height(&self.network, BlockHeight::from_u32(at.min(u32::MAX as u64) as u32));
        let tx = Transaction::read(data, branch).map_err(|e| err(format!("transaction: {e}")))?;
        let mut outputs = vec![];

        if let (Some(ivk), Some(bundle)) = (&self.sapling, tx.sapling_bundle()) {
            for (index, out) in bundle.shielded_outputs().iter().enumerate() {
                if let Some((note, _, memo)) = sapling::note_encryption::try_sapling_note_decryption(ivk, out, Zip212Enforcement::On) {
                    outputs.push(received(Pool::Sapling, index, note.value().inner(), &memo));
                }
            }
        }
        if let Some(ivk) = &self.orchard {
            if let Some(bundle) = tx.orchard_bundle() {
                for (index, act) in bundle.actions().iter().enumerate() {
                    if let Some((note, _, memo)) = try_note_decryption(&OrchardDomain::for_action(act), ivk, act) {
                        outputs.push(received(Pool::Orchard, index, note.value().inner(), &memo));
                    }
                }
            }
            if let Some(bundle) = tx.ironwood_bundle() {
                for (index, act) in bundle.actions().iter().enumerate() {
                    if let Some((note, _, memo)) = try_note_decryption(&IronwoodDomain::for_action(act), ivk, act) {
                        outputs.push(received(Pool::Ironwood, index, note.value().inner(), &memo));
                    }
                }
            }
        }
        Ok(Decrypted { txid: tx.txid().to_string(), height, outputs })
    }
}

fn received(pool: Pool, index: usize, value_zat: u64, memo: &[u8; 512]) -> Received {
    let end = memo.iter().rposition(|b| *b != 0).map_or(0, |i| i + 1);
    let text = MemoBytes::from_bytes(memo)
        .ok()
        .and_then(|m| Memo::try_from(m).ok())
        .and_then(|m| match m {
            Memo::Text(t) => Some(t.to_string()),
            _ => None,
        });
    Received { pool, index, value_zat, memo: text, memo_hex: hex::encode(&memo[..end]) }
}

fn arr32(b: &[u8]) -> Option<[u8; 32]> {
    b.try_into().ok()
}

fn compact_sapling_output(o: &proto::CompactSaplingOutput) -> Option<CompactOutputDescription> {
    let cmu = Option::from(sapling::note::ExtractedNoteCommitment::from_bytes(&arr32(&o.cmu)?))?;
    Some(CompactOutputDescription {
        ephemeral_key: EphemeralKeyBytes(arr32(&o.ephemeral_key)?),
        cmu,
        enc_ciphertext: o.ciphertext.as_slice().try_into().ok()?,
    })
}

fn compact_orchard_action(a: &proto::CompactOrchardAction) -> Option<CompactAction> {
    let nf = Option::from(orchard::note::Nullifier::from_bytes(&arr32(&a.nullifier)?))?;
    let cmx = Option::from(orchard::note::ExtractedNoteCommitment::from_bytes(&arr32(&a.cmx)?))?;
    Some(CompactAction::from_parts(
        nf,
        cmx,
        EphemeralKeyBytes(arr32(&a.ephemeral_key)?),
        a.ciphertext.as_slice().try_into().ok()?,
    ))
}

/// Block and transaction hashes are shown byte-reversed.
fn display_hex(b: &[u8]) -> String {
    let mut v = b.to_vec();
    v.reverse();
    hex::encode(v)
}

fn parse_display_hex(s: &str) -> Result<Vec<u8>, Error> {
    let mut v = hex::decode(s.trim()).map_err(|e| err(format!("txid: {e}")))?;
    if v.len() != 32 {
        return Err(err("txid must be 32 bytes"));
    }
    v.reverse();
    Ok(v)
}

/// Splits a gRPC (or gRPC-Web) body into its data frames: 1 flag byte, a
/// 4-byte big-endian length, then the message. Trailer frames (flag 0x80)
/// and compressed frames are rejected or skipped.
pub fn grpc_frames(body: &[u8]) -> Result<Vec<&[u8]>, Error> {
    let mut frames = vec![];
    let mut rest = body;
    while !rest.is_empty() {
        if rest.len() < 5 {
            return Err(err("truncated gRPC frame header"));
        }
        let flag = rest[0];
        let len = u32::from_be_bytes([rest[1], rest[2], rest[3], rest[4]]) as usize;
        if rest.len() < 5 + len {
            return Err(err("truncated gRPC frame"));
        }
        let msg = &rest[5..5 + len];
        rest = &rest[5 + len..];
        match flag {
            0 => frames.push(msg),
            0x80 => {} // gRPC-Web trailers
            _ => return Err(err("compressed gRPC frames are not supported")),
        }
    }
    Ok(frames)
}

fn grpc_frame(msg: impl Message) -> Vec<u8> {
    let bytes = msg.encode_to_vec();
    let mut out = Vec::with_capacity(5 + bytes.len());
    out.push(0);
    out.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
    out.extend_from_slice(&bytes);
    out
}

pub const LATEST_BLOCK: &str = "/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock";
pub const BLOCK_RANGE: &str = "/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetBlockRange";
pub const TRANSACTION: &str = "/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTransaction";

pub fn latest_block_request() -> Vec<u8> {
    grpc_frame(proto::ChainSpec {})
}

/// Parses a `GetLatestBlock` response body into (height, hash in display order).
pub fn parse_latest_block(body: &[u8]) -> Result<(u64, String), Error> {
    let frame = grpc_frames(body)?.into_iter().next().ok_or_else(|| err("empty response"))?;
    let id = proto::BlockId::decode(frame).map_err(|e| err(format!("block id: {e}")))?;
    Ok((id.height, display_hex(&id.hash)))
}

/// Compact blocks `from..=to`, with the shielded pools the watcher decrypts.
pub fn block_range_request(from: u64, to: u64) -> Vec<u8> {
    grpc_frame(proto::BlockRange {
        start: Some(proto::BlockId { height: from, hash: vec![] }),
        end: Some(proto::BlockId { height: to, hash: vec![] }),
        pool_types: vec![proto::POOL_SAPLING, proto::POOL_ORCHARD, proto::POOL_IRONWOOD],
    })
}

pub fn transaction_request(txid: &str) -> Result<Vec<u8>, Error> {
    Ok(grpc_frame(proto::TxFilter { block: None, index: 0, hash: parse_display_hex(txid)? }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip() {
        let a = grpc_frame(proto::BlockId { height: 7, hash: vec![1, 2] });
        let b = grpc_frame(proto::BlockId { height: 8, hash: vec![] });
        let trailer = [0x80, 0, 0, 0, 2, b'o', b'k'];
        let body = [a.as_slice(), b.as_slice(), &trailer].concat();
        let frames = grpc_frames(&body).unwrap();
        assert_eq!(frames.len(), 2);
        assert_eq!(proto::BlockId::decode(frames[1]).unwrap().height, 8);
    }

    #[test]
    fn txids_are_reversed_both_ways() {
        let shown = "00".repeat(31) + "ff";
        let wire = parse_display_hex(&shown).unwrap();
        assert_eq!(wire[0], 0xff);
        assert_eq!(display_hex(&wire), shown);
    }

    #[test]
    fn rejects_non_viewing_keys() {
        assert!(Watcher::new("zs1notakey").is_err());
        assert!(Watcher::new("uviewtest1garbage").is_err());
    }

    #[test]
    fn memo_text_and_trimmed_hex() {
        let mut memo = [0u8; 512];
        memo[..11].copy_from_slice(b"EFI:ZEC:abc");
        let r = received(Pool::Orchard, 0, 5, &memo);
        assert_eq!(r.memo.as_deref(), Some("EFI:ZEC:abc"));
        assert_eq!(r.memo_hex, hex::encode(b"EFI:ZEC:abc"));
    }
}

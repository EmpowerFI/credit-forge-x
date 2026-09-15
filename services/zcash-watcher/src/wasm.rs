//! WebAssembly bindings, for the Deno Edge Function that runs the watcher.
//! Deno does the HTTP/2 calls to lightwalletd; this module builds the request
//! bodies and decrypts the responses. Results cross the boundary as JSON.

use wasm_bindgen::prelude::*;

use crate::Watcher;

fn js_err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

fn to_json<T: serde::Serialize>(v: &T) -> Result<String, JsError> {
    serde_json::to_string(v).map_err(js_err)
}

#[wasm_bindgen]
pub struct ZcashWatcher(Watcher);

#[wasm_bindgen]
impl ZcashWatcher {
    #[wasm_bindgen(constructor)]
    pub fn new(ufvk: &str) -> Result<ZcashWatcher, JsError> {
        Watcher::new(ufvk).map(ZcashWatcher).map_err(js_err)
    }

    /// `GetBlockRange` response body → JSON `Scan`.
    #[wasm_bindgen(js_name = scanBlockRange)]
    pub fn scan_block_range(&self, body: &[u8]) -> Result<String, JsError> {
        to_json(&self.0.scan_block_range(body).map_err(js_err)?)
    }

    /// `GetTransaction` response body → JSON `Decrypted`.
    #[wasm_bindgen(js_name = decryptTransaction)]
    pub fn decrypt_transaction(&self, body: &[u8]) -> Result<String, JsError> {
        to_json(&self.0.decrypt_transaction(body).map_err(js_err)?)
    }
}

#[wasm_bindgen(js_name = latestBlockRequest)]
pub fn latest_block_request() -> Vec<u8> {
    crate::latest_block_request()
}

/// `GetLatestBlock` response body → JSON `{ height, hash }`.
#[wasm_bindgen(js_name = parseLatestBlock)]
pub fn parse_latest_block(body: &[u8]) -> Result<String, JsError> {
    let (height, hash) = crate::parse_latest_block(body).map_err(js_err)?;
    to_json(&serde_json::json!({ "height": height, "hash": hash }))
}

#[wasm_bindgen(js_name = blockRangeRequest)]
pub fn block_range_request(from: u64, to: u64) -> Vec<u8> {
    crate::block_range_request(from, to)
}

#[wasm_bindgen(js_name = transactionRequest)]
pub fn transaction_request(txid: &str) -> Result<Vec<u8>, JsError> {
    crate::transaction_request(txid).map_err(js_err)
}

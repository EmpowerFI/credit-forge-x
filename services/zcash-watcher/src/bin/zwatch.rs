//! Native CLI over the watcher, for testing against a real lightwalletd.
//!
//!   zwatch tip
//!   zwatch scan <from> [<to>]     # compact scan, then full decryption of every hit
//!   zwatch tx <txid>
//!
//! The viewing key is read from the file named by ZWATCH_UFVK_FILE, so it never
//! appears on a command line. The server defaults to https://testnet.zec.rocks.

use anyhow::{bail, Context, Result};
use serde_json::json;
use zcash_watcher::{
    block_range_request, latest_block_request, parse_latest_block, transaction_request, Watcher, BLOCK_RANGE,
    LATEST_BLOCK, TRANSACTION,
};

struct Lwd {
    base: String,
    http: reqwest::blocking::Client,
}

impl Lwd {
    fn call(&self, method: &str, body: Vec<u8>) -> Result<Vec<u8>> {
        let res = self
            .http
            .post(format!("{}{method}", self.base))
            .header("content-type", "application/grpc")
            .header("te", "trailers")
            .body(body)
            .send()?;
        if !res.status().is_success() {
            bail!("{method}: HTTP {}", res.status());
        }
        if let Some(status) = res.headers().get("grpc-status").filter(|s| s.as_bytes() != b"0") {
            let msg = res.headers().get("grpc-message").and_then(|m| m.to_str().ok()).unwrap_or("").to_owned();
            bail!("{method}: grpc-status {status:?} {msg}");
        }
        Ok(res.bytes()?.to_vec())
    }
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let lwd = Lwd {
        base: std::env::var("ZWATCH_SERVER").unwrap_or_else(|_| "https://testnet.zec.rocks".into()),
        http: reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(120)).build()?,
    };
    let watcher = || -> Result<Watcher> {
        let path = std::env::var("ZWATCH_UFVK_FILE").context("set ZWATCH_UFVK_FILE")?;
        let ufvk = std::fs::read_to_string(&path).with_context(|| format!("read {path}"))?;
        Ok(Watcher::new(&ufvk)?)
    };

    match args.first().map(String::as_str) {
        Some("tip") => {
            let (height, hash) = parse_latest_block(&lwd.call(LATEST_BLOCK, latest_block_request())?)?;
            println!("{}", json!({ "height": height, "hash": hash }));
        }
        Some("scan") => {
            let w = watcher()?;
            let from: u64 = args.get(1).context("scan <from> [<to>]")?.parse()?;
            let to: u64 = match args.get(2) {
                Some(t) => t.parse()?,
                None => parse_latest_block(&lwd.call(LATEST_BLOCK, latest_block_request())?)?.0,
            };
            let started = std::time::Instant::now();
            let body = lwd.call(BLOCK_RANGE, block_range_request(from, to))?;
            let fetched = started.elapsed();
            let scan = w.scan_block_range(&body)?;
            let scanned = started.elapsed() - fetched;
            let mut txids: Vec<&str> = scan.hits.iter().map(|h| h.txid.as_str()).collect();
            txids.dedup();
            let mut decrypted = vec![];
            for txid in txids {
                decrypted.push(w.decrypt_transaction(&lwd.call(TRANSACTION, transaction_request(txid)?)?)?);
            }
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "scan": scan,
                    "bytes": body.len(),
                    "fetch_ms": fetched.as_millis(),
                    "decrypt_ms": scanned.as_millis(),
                    "transactions": decrypted,
                }))?
            );
        }
        Some("tx") => {
            let w = watcher()?;
            let txid = args.get(1).context("tx <txid>")?;
            let d = w.decrypt_transaction(&lwd.call(TRANSACTION, transaction_request(txid)?)?)?;
            println!("{}", serde_json::to_string_pretty(&d)?);
        }
        _ => bail!("usage: zwatch tip | scan <from> [<to>] | tx <txid>"),
    }
    Ok(())
}

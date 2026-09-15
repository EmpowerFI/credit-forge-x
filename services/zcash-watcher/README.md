# zcash-watcher

A receive-only Zcash watcher. Given a unified full viewing key, it finds the
shielded payments in a range of blocks (trial decryption of compact blocks)
and reads their values and memos (full decryption of each transaction).
Sapling, Orchard and Ironwood (NU6.3) are all read.

It spends nothing, so it keeps no wallet and no note-commitment tree: the
caller keeps the last height scanned. It does no networking either. It builds
lightwalletd gRPC request bodies and parses the responses, so the same code runs
natively and as WebAssembly inside the `zcash-watch` Edge Function
(`platform/supabase/functions/zcash-watch`), where Deno makes the HTTP/2 calls.

See `docs/PRIVACY.md` ("Investing with shielded ZEC") for how EmpowerFI uses it.

## Try it natively

```sh
cargo build --release --features native
ZWATCH_UFVK_FILE=/path/to/ufvk.txt ./target/release/zwatch tip
ZWATCH_UFVK_FILE=/path/to/ufvk.txt ./target/release/zwatch scan <from-height> [<to-height>]
ZWATCH_UFVK_FILE=/path/to/ufvk.txt ./target/release/zwatch tx <txid>
```

The key is read from a file so it never appears on a command line. The server
defaults to `https://testnet.zec.rocks` (`ZWATCH_SERVER` to change it).

## Build for the Edge Function

```sh
rustup target add wasm32-unknown-unknown
./build-wasm.sh
```

`secp256k1-sys`, a dependency of `zcash_primitives`, compiles C, so the build
needs a clang that targets wasm32: [wasi-sdk](https://github.com/WebAssembly/wasi-sdk)
works without root (`WASI_SDK`). It also needs `wasm-bindgen-cli` at the version
in `Cargo.lock` (`WASM_BINDGEN`). The script writes the bindings to
`platform/supabase/functions/zcash-watch/wasm/`, which is committed so that
deploying the function doesn't need the Rust toolchain.

## Tests

```sh
cargo test --release
```

#!/usr/bin/env bash
# Builds the watcher for WebAssembly and installs it next to the zcash-watch
# Edge Function. Needs:
#   rustup target add wasm32-unknown-unknown
#   a clang that targets wasm32, for secp256k1-sys (wasi-sdk works):
#     WASI_SDK=~/.local/opt/wasi-sdk-34.0-x86_64-linux
#   wasm-bindgen-cli at the version in Cargo.lock:
#     WASM_BINDGEN=~/.local/opt/wasm-bindgen-0.2.128-x86_64-unknown-linux-musl/wasm-bindgen
set -euo pipefail
cd "$(dirname "$0")"

WASI_SDK="${WASI_SDK:-$HOME/.local/opt/wasi-sdk-34.0-x86_64-linux}"
WASM_BINDGEN="${WASM_BINDGEN:-wasm-bindgen}"
OUT=../../platform/supabase/functions/zcash-watch/wasm

CC_wasm32_unknown_unknown="$WASI_SDK/bin/clang" AR_wasm32_unknown_unknown="$WASI_SDK/bin/llvm-ar" \
  cargo build --release --lib --target wasm32-unknown-unknown

rm -rf "$OUT" && mkdir -p "$OUT"
"$WASM_BINDGEN" --target deno --out-dir "$OUT" target/wasm32-unknown-unknown/release/zcash_watcher.wasm

# The Edge runtime reads bundled static files from disk; it does not fetch file: URLs.
sed -i 's|await WebAssembly.instantiateStreaming(fetch(wasmUrl), __wbg_get_imports())|await WebAssembly.instantiate(await Deno.readFile(wasmUrl), __wbg_get_imports())|' "$OUT/zcash_watcher.js"
grep -q 'Deno.readFile(wasmUrl)' "$OUT/zcash_watcher.js" || { echo "loader patch did not apply" >&2; exit 1; }
rm -f "$OUT"/*.wasm.d.ts
ls -la "$OUT"

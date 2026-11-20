#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
cargo build --locked -p corvus-browser --target wasm32-unknown-unknown --release
required=$(awk '/name = "wasm-bindgen"/{found=1;next} found && /version =/{gsub(/"/, "", $3); print $3; exit}' Cargo.lock)
if ! command -v wasm-bindgen >/dev/null || [[ "$(wasm-bindgen --version)" != "wasm-bindgen $required" ]]; then
  cargo install wasm-bindgen-cli --version "$required" --locked
fi
wasm-bindgen --target web --out-dir rust/browser/pkg target/wasm32-unknown-unknown/release/corvus_browser.wasm

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
required=$(awk '/name = "wasm-bindgen"/{found=1;next} found && /version =/{gsub(/"/, "", $3); print $3; exit}' Cargo.lock)
if ! command -v wasm-bindgen >/dev/null || [[ "$(wasm-bindgen --version)" != "wasm-bindgen $required" ]]; then
  cargo install wasm-bindgen-cli --version "$required" --locked
fi
if [[ $# -eq 0 ]]; then set -- full core; fi
for profile in "$@"; do
  case "$profile" in full|core|army|battle|compound|impact|interviews|legion|support) ;; *) echo "Unknown browser profile: $profile" >&2; exit 1;; esac
  args=(--locked -p corvus-browser --target wasm32-unknown-unknown --profile browser-release --no-default-features)
  if [[ "$profile" != core ]]; then args+=(--features "$profile"); fi
  cargo build "${args[@]}"
  destination="rust/browser/pkg/$profile"
  if [[ "$profile" == full ]]; then destination=rust/browser/pkg; fi
  wasm-bindgen --target web --remove-name-section --remove-producers-section --out-dir "$destination" target/wasm32-unknown-unknown/browser-release/corvus_browser.wasm
done

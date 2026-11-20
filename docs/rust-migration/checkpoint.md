# Migration checkpoint

Started 20 November 2026 on codex/rust-migration from 0a34bab.

Production unchanged. No production data was written. Full rewrite remains in progress.

Implemented so far: Cargo workspace; official Vercel Rust adapter and native development server; read-only-by-default Redis TCP/REST adapter; compatible HMAC secrets/cookies; OTP login/verify/logout; shared Rust/WASM Plethora destinations, page-tier paths, Compound video codes and impact score/eligibility rules. Browser ritual-time helper compiles to WebAssembly but is not injected into the site yet.

Verified: 598 JS/Rust fixtures; isolated login tests including bidirectional session cookies, CSRF rejection, attempt limits and concurrent OTP consumption. The daily layer handler now passes cross-runtime cookie, shared allowance, timezone pinning and paid-member revocation tests. The actual gate interaction runs in Rust/WASM and passed 390px/1440px browser checks.

First preview: https://loading-website-dlczhhx78-corvus11.vercel.app/api/rust responds with runtime=rust and writeMode=disabled. Critical pages return 200. A source-file exposure was found in that preview and a middleware guard was added locally; redeploy and verify its 404s before using the new deployment. The old preview is not a production candidate.

Next: run expanded parity suite, deploy additive Rust endpoint to preview, verify runtime and source-file privacy, then port routing/layer handlers and each subsystem. Follow README release gates. Do not promote a partial rewrite or remove old handlers.

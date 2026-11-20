# Rust migration inventory

Baseline: `0a34babbba561abcffc1aa7e4356de4d8855adf7`. Production rollback: `loading-website-i0ifimei3-corvus11.vercel.app`.

The inventory records executable legacy sources, including inline browser code. A Rust gateway alone is not a completed rewrite. HTML, CSS, translations, images and video remain content/assets. Generated WebAssembly loader bindings are permitted; hand-written application logic moves to Rust.

| Area | Files | Source lines | State |
|---|---:|---:|---|
| _army | 12 | 971 | Pending |
| _compound | 5 | 395 | Pending |
| _compound-v2 | 28 | 769 | Pending |
| _forms | 4 | 220 | Pending |
| _interviews | 4 | 79 | Pending |
| _legion | 12 | 438 | Pending |
| _og | 4 | 81 | Pending |
| _openrisk | 29 | 90094 | Pending |
| api/root | 65 | 9260 | Pending |
| army | 13 | 325 | Pending |
| build/tools | 120 | 3217 | Pending |
| data | 1 | 3229 | Pending |
| i18n | 3 | 124 | Pending |
| inline-browser | 37 | 1797 | Pending |
| js/root | 81 | 4480 | Pending |
| locales | 7 | 7 | Pending |
| privacy-locales | 7 | 588 | Pending |
| routing | 1 | 154 | Pending |
| site | 19 | 784 | Pending |
| tests | 120 | 5094 | Pending |
| vendor | 4 | 2247 | Pending |

See `rust/migration/inventory.json` for file-level fingerprints. Do not mark a module migrated until its replacement passes parity, security, browser and deployment checks. Source line counts include HTML around inline scripts; they are an inventory, not a progress percentage.

# Compact structure and Sunday target

The target remains Sunday 22 November 2026. The user authorized simplifying structure and retiring redundant old pages, while preserving working flows. This changes the work order, not the release criteria or the definition of a complete migration. Do not label a partial Rust deployment as the entire site migrated.

## Implemented structure

The browser crate has explicit application features: Army, battle, Compound, impact, interviews, Legion and support. The shared public runtime contains language, consent, arrival, navigation, realm, privacy and CV behavior. Unknown and feature-heavy pages retain the full bundle until their smaller profiles have passed compatibility tests.

One document resolves all generated bindings to **one** WASM module via an early import map. That avoids independent copies of locale, consent and authentication state. Page selection lives in `tools/rust/browser-profiles.mjs`. The same policy runs in the browser fixtures and paired performance runner. It is not yet injected into production publishing.

Army challenge/session transport is separated from its profile and administration UI. Realm feathers reuse that transport and never enroll an anonymous visitor. There is one shared proof cache in the selected module, preserving retries, action binding and cookie behavior. The default full build retains every original export for existing feature pages.

`tools/rust/build-browser.sh` builds full and core profiles by default. Individual domains can be compiled explicitly, for example `tools/rust/build-browser.sh battle`; they are not selected for visitors until tested. A browser-only Cargo profile optimizes dependency code size and strips only post-binding debug names/producers. Native server optimization is unchanged.

Initial artifact comparison, using Brotli quality 4: previous combined bundle 1,265,266 bytes; new core 681,962 bytes. This is about 46% less download, **not** a 46% speedup. It still needs the same controlled timing and functionality gates. The full bundle also shrinks to about 1.05 MB compressed. Do not compare an experimental single run with an established percentile or claim the old mobile regression is resolved.

## Retired duplicate

`hack/the-feed/index.html` duplicated the canonical `hack/1/the-feed/index.html`; the latter also contains the current hack ID and script version. The duplicate file and its standalone curated listing are removed. Existing middleware already redirects `/hack/the-feed`, its slash form and `index.html` form to `/hack/1/the-feed` with 301, preserving query attribution. Both Rust and legacy routing contracts cover the alias. The retained page still has the iframe, fallback and feedback controls. The local test server follows the same redirect.

No unrelated archive, contest submission, game, account, translation, photo or private page is removed to make the inventory look smaller. The exact-byte duplicate `forms/index.html` / `tools/forms/page.html` is a generated output/template pair, not two public pages; keep it. Conditional `/people` redirects and `/links/gabe` dynamic rewrites do not make their source templates redundant.

## Revised work order

1. Finish compact browser publication, further reduce shared payload, and test slow/failed loading plus input before hydration. Re-run paired mobile and desktop measurements; keep regressions visible.
2. Finish remaining active runtime modules and current-main integration. Main advanced with Hackers Bay (505de19); its routes, app, releases and tests are preserved by merge 28c66c2 and its executable code must be accounted for in the migration scope.
3. Exercise isolated real storage/provider integration, complete public crawl and protected/write flows, then preview canary and rollback with one webhook/cron writer.
4. Switch production only for the scope whose gates have actually passed. If Sunday arrives with unresolved blockers, explicitly identify what remains; do not silently delete useful features, reset data or claim completion.

No guarantee of zero bugs or performance gain is inferred from Rust. Code volume and raw benchmark evidence remain attached to exact commits in the measurement ledger.

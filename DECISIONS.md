# OpenRisk demo decisions

## Deployment and access

- Start from the current Corvus production revision in an isolated worktree. Use the existing Git to Vercel production integration. The first deployment shipped access control and the atlas before the role workflows.
- Keep all HTML, data and client JavaScript behind the same server function. Use a secret Vercel password and independent random signing key, a seven-day Secure HttpOnly cookie, same-origin writes, private cache headers, noindex meta and response headers, robots exclusion and no public navigation entry.
- Give each password login its own disposable workspace. The signed role is checked in the API for KPI writes, approvals, alert settings and invitation changes. Real identity verification and organization membership belong to the next phase.
- Reuse Corvus Redis with an atomic compare-and-set update and a seven-day workspace TTL. Local development can use an in-memory store. Read PDF and XLSX attachment bytes in the browser, send bounded text for deterministic parsing, and persist only supporting evidence sentences or rows. Email content stays outside third-party models. Real delivery stays simulated.

## Map and evidence

- Use bundled Natural Earth geometry, city insets and a populated-places gazetteer. This keeps the globe and city lookup independent of map tiles, GIS credentials or network availability.
- Put the complete initial catalog behind the authenticated bootstrap so typeahead and warm dossiers are browser-local. Render separate geographic pins and text controls for tightly spaced markets.
- Run a curated six-city seed and add attributed public directory records for the four Belgian cities. Use StartupMap’s public city and company pages, with a modest sample, a robots policy check and spaced detail requests. Avoid its blocked private API. Check company-owned sources for hero facts and Palo Alto additions. Use YC as a research reference, with live bulk import left out given its website terms.
- Use public Greenhouse, Lever, Ashby and Recruitee boards, GitHub, Hacker News search and Wikidata’s documented API. Every adapter has a deadline and partial results survive connector errors. The committed snapshot is the fallback. Cold research uses NDJSON and shows when a source yields no match. It can add a GitHub measurement once Wikidata names an organization. In-flight lookups share results within each warm function instance.
- Belgium’s CBE Public Search restricts reuse. Use company legal pages for verified enterprise numbers and link to the NBB Consult portal. The Deliverect dossier includes a targeted NBB CSV consultation, reference 2026-00308255, with standalone entity scope and original accounting line codes. Bulk ingestion needs the approved NBB web-service route, permitted CBE reuse data and entity-matching checks. Gazette automation is pending. Flanders Dealroom and imec.istart remain research references.
- Show a rule-based evidence score with explicit weights, coverage and the source behind each observed input. Higher scores indicate stronger observed signals. Require 45% weighted coverage. Unknown inputs never count as adverse signals. Mark a previous trend unavailable until a comparable earlier snapshot exists.
- Keep the JavaScript engine bounded by the existing Vercel runtime. Use JSON contracts and move bulk work to a Rust CLI first, per [RUST_PLAN.md](RUST_PLAN.md).

## Product behavior

- Support Founder, Investor and Admin in the same demo account so the presenter can walk through both workflows in a single browser. Investors can write their own follows and alert preferences. Company metrics and proposals require the claimed Founder role. Invites remain restricted to one company and can be revoked.
- Use two labelled sample reporting emails with simple explainable extraction. Review period, value, evidence, confidence and duplicates before confirmation. Recompute runway only when confirmed cash and burn have the same currency and burn is positive. Save only fields edited by the presenter.
- Treat investor fit as a public mandate comparison based on region and sector. Portfolio examples come from fund sources. Responsiveness and follow-on rates are displayed as unavailable until supported.
- Keep startup proposals isolated to the submitting demo workspace. Admin approval enriches public identity and coverage before adding the profile. Add city uses the local gazetteer and reports the number of available directory matches.
- Build the demo around Aikido Security, Deliverect, Stripe and Hugging Face. Use clearly labelled sample numbers for the live founder workflow and a fictitious company for the queue test.

## V1 verification notes

- Vercel’s default static output exposed raw helpers and presenter Markdown under direct file URLs. The production middleware now blocks the internal namespace and canonicalizes trailing slashes. Vercel packaging excludes the demo documentation and screenshots. Screenshot artifacts stay in the local worktree because the GitHub repository is public.
- The six initial cities contain 138 indexed profiles. Mistral AI is an additional searchable fallback with Paris as its home city. Seeded connector health is timestamped in the operations view. Demo workspace jobs stay separate from the baked seed.
- Deep links preserve the requested dossier through password login. The workspace remains private and investor links can only read a company-scoped projection until expiry or revocation.

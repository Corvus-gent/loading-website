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
- Use public Greenhouse, Lever, Ashby and Recruitee boards, GitHub, Hacker News search, Apple’s exact app ID lookup and Wikidata’s documented APIs. Every adapter has a deadline and partial results survive connector errors. The committed snapshot is the fallback. Cold research uses NDJSON and shows when a source yields no match. It can add a GitHub measurement once Wikidata names an organization. In-flight lookups share results within each warm function instance.
- Belgium’s CBE Public Search restricts reuse. Use company legal pages for verified enterprise numbers and link to the NBB Consult portal. Deliverect and Teamleader use targeted NBB CSV consultations, references 2026-00308255 and 2026-00085960, with standalone entity scope and original accounting line codes. Bulk ingestion needs the approved NBB web-service route, permitted CBE reuse data and entity-matching checks. Gazette automation is pending. Flanders Dealroom and imec.istart remain research references.
- Show a rule-based evidence score with explicit weights, coverage and the source behind each observed input. Higher scores indicate stronger observed signals. Require 45% weighted coverage. Unknown inputs never count as adverse signals. Show score changes only when the previous sweep used the same evidence keys and source URLs. Hiring changes compare counts from the same board. Show the prior observation timestamp.
- Keep the JavaScript engine bounded by the existing Vercel runtime. Use JSON contracts and move bulk work to a Rust CLI first, per [RUST_PLAN.md](RUST_PLAN.md).

## Product behavior

- Support Founder, Investor and Admin in the same demo account so the presenter can walk through both workflows in a single browser. Investors can write their own follows and alert preferences. Company metrics and proposals require the claimed Founder role. Invites remain restricted to one company and can be revoked.
- Use two labelled sample reporting emails with simple explainable extraction. Review period, value, evidence, confidence and duplicates before confirmation. Recompute runway only when confirmed cash and burn have the same currency and burn is positive. Save only fields edited by the presenter.
- Treat investor fit as a public mandate comparison based on region and sector. Portfolio examples come from fund sources. Responsiveness and follow-on rates are displayed as unavailable until supported.
- Keep startup proposals isolated to the submitting demo workspace. Admin approval enriches public identity and coverage before adding the profile. Add city uses the local gazetteer and reports the number of available directory matches.
- Build the demo around Aikido Security, Deliverect, Stripe and Hugging Face. Use clearly labelled sample numbers for the live founder workflow and a fictitious company for the queue test.

## V1 verification notes

- Vercel’s default static output exposed raw helpers and presenter Markdown under direct file URLs. The production middleware now blocks the internal namespace and canonicalizes trailing slashes. Vercel packaging excludes the demo documentation and screenshots. Screenshot artifacts stay in the local worktree because the GitHub repository is public.
- The six initial cities contain 219 indexed profiles. Mistral AI is an additional searchable fallback with Paris as its home city. Wikidata Query Service adds attributed organizations with a recorded headquarters, a technology sector and an official domain. Remove reviewed stale, moved or incumbent entities and deduplicate against the curated catalog. Seeded connector health is timestamped in the operations view. Demo workspace jobs stay separate from the baked seed.
- Deep links preserve the requested dossier through password login. The workspace remains private and investor links can only read a company-scoped projection until expiry or revocation.
- The browser reads bounded PDF text and the first XLSX sheet on demand. Text extraction avoids retaining the original files. Investor projections omit private source passages and retain the reference, status and confirmation time.

## European map expansion

- Keep Gent, Brussels, Antwerp, Leuven and Liège as the five Belgian anchors using Dealroom’s combined enterprise-value view as the selection criterion. Add Bruges and the Louvain-la-Neuve science park cluster for the requested coverage in West Flanders and Walloon Brabant.
- Preload Paris, Amsterdam, Rotterdam, Frankfurt, Düsseldorf and Munich in the existing snapshot. Index a small number of directly sourced Liège profiles where the directory search is sparse. Show the actual profile count in each city list.
- Add a nearby Europe inset and password-protected city links. Keep the Bay Area. The presenter guide follows discovery, evidence, founder confirmation and investor review before the operations workflow.

## Score breakdown and investment context

- Put the exact weighted contributions, points below the maximum and rounding next to the overall score. Highlight the largest contribution and the largest gap. For incomplete dossiers, show the evidence coverage and explain the normalization over observed factors.
- Keep investment questions separate from the numerical rubric. Public activity supports an initial screen. Customer economics, financing terms and valuation need their own evidence. The score coefficients and grade thresholds are unchanged.

## Dossier reading order

- Present the company, score and two main drivers in a compact opening. Use one reading column with investment context, the calculation and expandable source evidence. Keep the score math visible and make individual raw-data categories opt-in. Use section links so reviewers can skip directly to a question.

## Four national selections

- Add England, the Netherlands, Germany and France as 100-company snapshots. Allocate places across supported hubs, preserve curated profiles, and use public StartupMap city listing order for the directory candidates within each hub. Fill unused places from the larger hubs. This is a discovery shortlist and carries no national investment rank.
- Use protected country URLs and switch from the national list to a city by selecting a pin. Keep the cap on preloaded country views distinct from session-specific additions.

## Catalog data and company artwork

- Enrich every existing directory profile from its public, attributable individual page, keeping the existing city selection and score rules. Capture sector, founding date, headcount range, financing stage, verifiable links and, when available, directory-reported financing and role count. Label directory observations separately from direct ATS and verified round data.
- Rasterize directory logos or public company favicons during preload. Serve small, individually lazy-loaded images from the private origin and keep initials for unresolved artwork. The bootstrap carries logo IDs so the artwork does not inflate the search index payload.

## Scoring imported profiles

- Use cited directory vacancy counts as a hiring fallback when a direct company board count is unavailable. Keep direct board observations first. Show capped directory results as lower bounds.
- Show a provisional score with 25–44% model coverage and reserve letter grades for at least 45%. Keep profiles below 25% marked as insufficient data. Retain the existing weights and Aikido’s 87.

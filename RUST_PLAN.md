# Rust engine migration

The private Corvus route, signed demo session and role permissions run on the existing Vercel Node.js functions. The engine in `api/_openrisk/engine/` takes public company identifiers and produces JSON dossiers and NDJSON research events. The browser and Redis workspace read those outputs without depending on the scraper implementation. `contracts.d.ts` describes that interface.

1. Create a Rust workspace with a library and an `openrisk` CLI. Translate the contracts with Serde and freeze the current snapshot as a golden fixture. Implement scoring as a pure function with an explicit observation clock. Keep amounts as decimal or integer minor units and preserve unknown values.
2. Port source adapters using reqwest and Tokio. Use per-source concurrency, request deadlines, response limits, retry-after support and a persistent cache. Retain source URLs, timestamps and permitted reuse metadata with each observation.
3. Build the city snapshot in CI using `openrisk preload --city <city>`. Validate the JSON, compare grades and evidence coverage against the previous build, then publish the immutable snapshot alongside a compact local index. This keeps Rust dependencies outside the Vercel bundle.
4. Run the cold path in an Axum service once it needs durable jobs, a shared cache or higher connector concurrency. Keep the Vercel handler as the authentication boundary and forward a short-lived service credential. Preserve the NDJSON contract and retain the last good directory snapshot during outages.
5. Move KPI extraction to the Rust library after fixtures cover reporting periods, currency, unit conversion and corrections. Keep review and tenant authorization transactional in the product API.

## Product data model

V1 uses a seven-day Redis workspace keyed by a signed demo session. Claims, follow relationships, metric definitions and values, proposals, audit events, invitations, requests and jobs are grouped per workspace and company. Invites point to one company and grant a read-only projection. The role switcher simulates roles inside a single workspace.

For real accounts, use `organizations`, `users`, `memberships` and `investments` with organization-qualified keys and database policies. Store public facts and versioned scores separately in `signals` and `risk_scores`. Store `integrations`, `raw_documents` and `extractions` with access policies and retention controls. Give every confirmed `metric_value` a stable source reference, optimistic version and audit event. Keep `cities`, `preload_jobs` and `startup_requests` as organization-aware workflow records. Migrate the API to enforced account and membership roles before accepting customer data.

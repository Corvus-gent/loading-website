# Corvus uptime and Grafana

`https://stats.corvus.gent/uptime` is the canonical service health page. Old `/status` and `/service` bookmarks redirect there, preserving language queries. Snapshot notices link to the visitor map, all stats and uptime; automatic retries remain bounded.

The realm homepage shows visitors for the measured Brussels day and all-time opted-in soldiers. These are different populations, labelled separately. Missing measurements remain unknown.

## Connect an owned Grafana workspace

Grafana Play is a public demo, not an owned workspace. The hosted connection is not configured by this change.

1. Set a dedicated random `GRAFANA_METRICS_TOKEN` of at least 32 characters in Vercel and redeploy. Keep it private; do not reuse another application credential.
2. In your Grafana Cloud workspace, configure the Metrics Endpoint integration to scrape `https://corvus.gent/api/metrics`, with bearer authentication using that token. A five-minute interval matches the monitor cadence.
3. Import `public/observability/corvus-grafana.json` and select the integration's Prometheus datasource.
4. Check sample age and missing data before interpreting reachability. Configure an alert for absent or stale samples.

The exporter reads the cached `health:last` result only. It does not fan out fresh service checks on each scrape. It exposes allowlisted service names, reachability, durations and measurement timestamps, never response bodies, emails or credentials. Missing configuration returns 503; unauthorized callers get 401; skipped services are omitted.

The website's coverage denominator includes expected five-minute slots. Gaps are unknown, never healthy. Average latency is an average of available sampled bucket means, not request-weighted end-user latency. Grafana reachability percentages describe scrape observations, not an SLA or independently verified time-based uptime.

Official setup: https://grafana.com/docs/grafana-cloud/observe-and-act/monitor-infrastructure/integrations/metrics-endpoint-reference-setups/

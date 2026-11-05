# X log → Corvus stats: setup for Gabriel

The code stays on the daily branch / PR. No Notion token or database ID is committed.
The public page is `https://stats.corvus.gent/x`; `https://corvus.gent/stats/x`
redirects there. Full rows and the sync button are inside the existing private
stats login. Missing integration/storage/query/cron configuration shows:
**the log is empty for now**.

## 1. Create and connect the integration

1. Open [notion.so/my-integrations](https://www.notion.so/my-integrations).
   Create a **new internal integration** (called a connection in some Notion UI),
   name it `corvus x log`, and choose the workspace containing the database.
2. Under its capabilities, enable **Read content** and **Update content**.
   No user/email information, comment access or insert-content permission is
   needed. Save. Copy the internal integration token privately.
3. Open the original full-page **X log** database, not just a linked view. In its
   `•••` menu → **Connections** → **Connect to**, select `corvus x log` and confirm
   access. Access to the parent alone may not expose an unshared database.
4. Copy the database link. The database ID is the 32 hexadecimal characters (with
   or without hyphens) in that database's URL path, **not** the `?v=` view ID or
   one row's page ID. Store it as `NOTION_XLOG_DB`. Do not publish the token.
5. Keep **one data source** in this database. The server uses pinned Notion API
   version `2025-09-03`, retrieves the database's data source, and queries that
   source with pagination. Multiple data sources fail clearly rather than choosing
   the wrong table. All ordinary views of the same source are fine.

Official references: [create an integration](https://developers.notion.com/docs/create-a-notion-integration),
[data-source query](https://developers.notion.com/reference/query-a-data-source),
[update page properties](https://developers.notion.com/reference/update-a-page).

## 2. Check the columns (exact lowercase names)

| Column | Notion property type | Who fills it |
| --- | --- | --- |
| `date` | Date | CSV; posting date in **Europe/Brussels** |
| `hour` | Number, integer 0–23 | CSV; posting hour in **Europe/Brussels**, including `sf` rows |
| `region` | Select: `eu`, `sf` | CSV; audience region, not a different clock |
| `type` | Select: `reply`, `post` | CSV |
| `voice` | Select | CSV; public voice label |
| `lane` | Select | CSV; private in this dashboard |
| `campaign` | Text | CSV; bare public slug, e.g. `launch` |
| `target_url` | URL | CSV; private, never in the public JSON |
| `my_url` | URL | CSV; own published post/reply URL |
| `text` | Text (or the database's required Title property) | CSV |
| `link` | URL | CSV; actual link included in the post/reply |
| `link_type` | Select: `corvus`, `pidgy`, `none` | CSV |
| `clicks` | Number | Sync; allocated Corvus arrivals |
| `clicks_pidgy` | Number | Sync; allocated Pidgy outbound clicks |
| `synced_at` | Date (time allowed) | Sync; timestamp of last successful write |
| `clicks_estimated` | Checkbox | Sync; shared-key allocation is an estimate |

The extra checkbox makes estimated numbers visible **in Notion as well as on the
site**. Do not put emails, target handles or visitor identities in campaign/voice
labels: those labels are public. A campaign is lowercase letters/digits separated
by hyphens, maximum 64 characters. `gabe-` is an optional tracking prefix, not part
of the underlying campaign name. Link-free replies may leave campaign/link blank;
they still count as replies. A nonempty valid URL plus `link_type=corvus/pidgy`
counts as one link used. Invalid date/hour/region/type rows are shown privately
and reported as invalid instead of silently assigned to another slot.

Notion requires one Title property. Use `text` as Title, or retain a separate
`entry` Title and make `text` a Text property. The sync never overwrites CSV content,
URLs, titles, selections or dates; only the four sync-owned columns above.

### One crow, two clocks

The public X page and private X log show **BX / Brussels** in amber and
**SF / San Francisco** in blue. Both clocks show their own date and local time;
the gap follows the IANA timezones, including the weeks when Europe and the US
change their clocks on different dates. They work even before Notion is connected.
Open **plan across the pond** to enter a date/time in either city, see the other
city's time, or return to live time. Repeated autumn hours have an explicit
first/second choice; nonexistent spring hours ask for a valid time.

**Import convention, pending confirmation from the actual CSV:** `date` and
`hour` stay in Brussels time for all rows. `region=sf` selects the audience; it
does not silently reinterpret the CSV as Pacific time. Ask Grok to export the
posting date/hour in `Europe/Brussels`, even for the SF audience. If an existing
CSV uses SF-local timestamps, convert those dates/hours before importing and use
the resulting BX hour in the tracking slot. Do not relabel existing rows blindly.
The private table and Gabe's own public posts show the corresponding SF date/time
beside BX. A repeated BX hour without an offset shows both possible SF times.

Today, the weekly boundary, date filter and all-time heat strip remain on the
clearly labeled BX clock. The all-time strip is deliberately not shifted by
"today's offset": historic entries can have different offsets. The planner is a
local browser utility, with no external requests, extra storage or tracking.

## 3. Add Vercel variables and deploy

Project → Settings → Environment Variables, at least **Production**:

- `NOTION_TOKEN`: internal integration token, sensitive.
- `NOTION_XLOG_DB`: database ID, not a view or row ID.
- `CRON_SECRET`: strong random secret (at least 32 random bytes, generated in a
  password manager). Vercel sends it as a bearer token for the cron. The same
  secret protects server-to-server continuation calls. Never add it to a URL.
- Existing `REDIS_URL` (TLS), `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` and
  EU `POSTHOG_HOST` must be configured as in the existing stats setup.

Keep preview tokens scoped deliberately; use a test database for previews rather
than exposing a production log to unrelated branch deployments. Redeploy after
saving variables. `vercel.json` already specifies Frankfurt (`fra1`), one 60-second
function maximum, and the daily backup cron `17 3 * * *` (03:17 UTC; Hobby timing
may be approximate). Enable/confirm Cron Jobs in the dashboard. No separate
scheduler service or browser-side Notion API is needed. The existing `/api/hit`
route now delegates to the stats function, keeping the number of separate API
functions at its previous level.

Then sign in at `https://stats.corvus.gent/private`, open **x log**, and click
**sync now**. Use **filter** to refresh progress/results. Confirm one row's numbers
and `synced_at` in Notion, then visit the public page. An empty database gives
honest zero totals and no best-voice winner. A first 2,000-row write can take around
12–20 minutes because Notion allows about three requests per second; it is a
background job and does not hold the public page open.

## 4. Use attributable links

Log the campaign before posting, run the initial sync, then use:

```text
https://corvus.gent/call/?utm_source=x&utm_medium=post&utm_campaign=gabe-launch&utm_content=eu-9
https://corvus.gent/links/gabe/x/launch?utm_content=eu-9
https://corvus.gent/go/x/pidgy/launch?utm_content=sf-23
```

`region-hour` must match that row. One-digit and zero-padded hours are normalized.
The link hub preserves that slot on onward links; the Pidgy shortcut preserves it
on the redirect and its event. Only campaign slugs already present in the synced
Notion catalog are admitted by the optional browser analytics filter. Arbitrary
visitor-supplied labels remain `other`; arbitrary `utm_content` is dropped.
Unknown or historical campaigns stripped by older privacy code cannot be recovered.

The existing analytics consent still applies. No new tracking cookies or visitor
IDs are introduced. People who refuse analytics are absent from PostHog click
counts. /go navigation still works without analytics; quick redirects may leave
insufficient time for a first-time visitor to opt in. The tiny public footnote
is therefore accompanied by the consent/estimate explanation.

## 5. What the numbers mean

- **Corvus clicks:** X-attributed direct/hub landing pageviews. Internal landings
  tagged `utm_medium=links` and `/go` pageviews are excluded.
- **Pidgy clicks:** `links_click` to `pidgy`/`pidgy-trial`, or `short_link_out` with
  target `pidgy`. Generic `link_click`/`outbound_click` are not added again. These
  are event counts, not unique people. Reloads/repeated visits can count again.
- **Matching:** campaign + click date in Brussels + logged region/hour. Shared
  matching rows that actually contain links split both totals evenly; fractional
  values are intentional, and `clicks_estimated` is checked. This is attribution,
  not proof of which reply a visitor read. The URL has no posting-date tag: late
  clicks cannot reliably be tied back to an earlier dated row. Avoid reusing the
  same campaign/slot across days if precise row attribution matters.
- **Unmatched clicks:** included in global/campaign totals, but never invented as
  voice/region/hour attribution. They are reported separately. Row sums can be
  lower than global totals for that reason.
- **Today:** Brussels calendar day. **Week:** Monday through today in Brussels.
  The heat strip uses the log's posting hour, not the visitor's click time. `sf`
  is an audience label; both regions use the same clock in the CSV.
- **Click-through rate:** `(corvus + pidgy clicks) / links used`. It is not X's
  impressions-based CTR, and can exceed 100%. Zero links shows a dash, not infinity.
- **Own posts:** only rows with `type=post` and a URL for
  `x.com/gabe_maxxing/status/...` (Twitter aliases normalized) are published.
  The public JSON includes the latest 50 own posts, no reply text, target URL,
  private row ID or lane. Private rows are paged 50 at a time with filters.
- `synced_at` changes when a row is first written or its counts/estimate change.
  Unchanged rows are not rewritten every quarter hour. The public snapshot's
  `updated` time records when its analytics cutoff was taken, not a new click.

## 6. Reliability, privacy and operations

A Redis lease serializes Notion work; requests are spaced at least 350 ms and
honour `Retry-After`. One full sync may start at most every 15 minutes (including
manual/cron requests). Active work is resumed, never duplicated. Reading the
Notion database and PostHog aggregate results is paginated. The server checkpoints
small batches and continues through authenticated production calls before its
60-second function limit. A cold public page gets a syncing state immediately;
refresh it after the first snapshot is prepared. Later visits get one cached JSON.

If continuation is interrupted, the next page view/private refresh or daily cron
resumes the durable job. Preview protection can block continuation; refresh the
preview manually. A provider failure is retried after a 15-minute backoff, without
raw response bodies or secrets in logs. Schema/access problems appear by code in
the private dashboard (`notion_schema`, `notion_access`, `notion_data_source`).
Correct the sharing/property/environment issue, then retry after the cooldown.

Public caches/catalogs last 15 minutes; CDN TTL never exceeds the remaining Redis
TTL. A stale public fallback and resumable/private snapshots expire after 24 hours.
Replacing a private snapshot deletes the previous row chunks. All `x:*` keys have
TTLs; no raw IP, visitor-level click record or browser identifier is stored here.
Only the private endpoint can return the source row data, with a valid session and
`no-store`; manual sync also validates the request origin. The public endpoint
constructs an explicit aggregate/own-post shape instead of serializing Notion pages.

**Notion is an additional processor.** Confirm its DPA, workspace retention and
actual data region. Notion's normal storage is US unless an eligible Enterprise
workspace has completed an EU residency migration; EU content storage also has
limits for account/usage/subprocessor data. Do not describe this integration as
unconditionally EU-only. See [Notion data residency](https://www.notion.com/help/data-residency)
and [Notion privacy](https://www.notion.com/privacy).

For a data request, remove/correct the source record in Notion and refresh the
snapshot; inspect the 24-hour stale/job caches as well. Notion source retention is
controlled by Gabriel, separately from the short-lived Corvus copies. Existing
anonymous all-time totals are limited to retained Notion/PostHog history. Confirm
that this retention and public campaign/voice labeling fit the intended purpose.

## Verification performed by the PR

Local fixtures cover empty, one-row and 2,000-row databases; request pacing and
429s; pagination and resumed writes; no unnecessary unchanged-row writes; Redis
leases/TTLs; date/slot matching and fractional estimates; and public/private access
boundaries. Browser tests cover mobile layout, one public JSON request, no public
reply/target data, private filters/pagination/sync feedback, and approved X
attribution only after consent. Live Notion/PostHog sync requires the above account
configuration; fixture success is not proof that production credentials are set.

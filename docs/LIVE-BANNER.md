# Live announcement

Edit **`live.config.js`, line 2** and deploy the branch:

- `export const LIVE = true;` — show the banner everywhere.
- `export const LIVE = false;` — hide it everywhere; the existing home Plethora banner returns, respecting its original dismissal.
- `export const LIVE = 'auto';` — check Twitch server-side when `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` exist. Without credentials or if Twitch cannot be checked, it stays off. Explicit `true`/`false` always override automation.

The default is **off**: adding this feature does not claim Gabe is currently streaming. The announcement links to Twitch, Instagram, and X; automatic detection currently covers **Twitch only**. Instagram/X use the manual switch. No third-party SDK, player or browser cookie is needed to read live status. Twitch app access uses the [client credentials grant](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow).

Dismissals use a separate `corvus.live.dismissed:<Pacific date>:<stream session>` localStorage key. A new day or new detected Twitch broadcast shows it again. For a second manual stream on the same day, change `STREAM_ID` on line 4 (e.g. `2026-11-08-2`). The old Plethora dismissal key is untouched.

Open tabs poll same-origin `/api/live` every 60 seconds and refresh when visible again. The endpoint and Twitch result cache each last 60 seconds, so allow up to roughly two minutes after a deploy/stream state change. No polling while the tab is hidden. The home promo is replaced during a live session even after the live banner is dismissed; other Plethora placements are unchanged.

Tracked 302 redirects (also with a trailing slash): `/go/twitch`, `/go/instagram`, `/go/twitter`. They redirect even if Redis is down. Anonymous aggregate counters use `live:clicks:all` and `live:clicks:YYYY-MM-DD`; daily-salted anti-repeat keys expire after 30 minutes. Preview counters are separate. No IP or credentials are stored in these totals. The terminal command `live` prints the three links.

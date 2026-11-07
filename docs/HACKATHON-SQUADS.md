# Ex-hackathon squads

`/hackathons/` shows teams Gabe was part of. This is separate from the live-build hub at `/hack`.

## Add a team

Append an object to `hackathons/teams.json`: unique `id`, `name`, `event`, `location`, `date` (`YYYY-MM`), `teamSize`, `members` (`name`, `label`, `url`), `build`, optional `repo`, `pitch`, `status`, and a numeric `number`. Confirm membership before adding names. Cards are sorted newest first. An optional ISO `start` switches the status to “Building solo” after the start time. Run `node tools/build-hackathons.mjs`; Vercel also runs this before generating the search index. The static HTML works without JavaScript.

HackTheFeed has five members. Only Gabe and Siebe are currently named, per Gabriel; the page honestly shows three additional teammates without inventing identities or profile URLs. Discord handles supplied privately are not presented as confirmed real names.

## Short link and stats

- `https://corvus.gent/squads` → 307 `/hackathons/?utm_source=share&utm_medium=links&utm_campaign=hack&utm_content=squads`
- `https://corvus.gent/squads?utm_source=linkedin` preserves `linkedin` instead of the default source.
- Incoming query parameters are preserved. The landing page's existing analytics captures approved tags before cleaning them from the address bar.
- PostHog pageviews keep `$pathname=/hackathons/`, `utm_campaign=hack`, `utm_content=squads`, and `short_slug=squads`. The existing stats page/source aggregations therefore include the destination rather than grouping it under `/other/`. There is no new dedicated dashboard or per-person tracking.
- Existing opt-outs/GPC/DNT remain in force. The redirect needs no cookie, Redis write, or third-party request; counts represent landing-page visitors, not raw redirect requests/bots.

Verification: `node tests/hackathon-squads.mjs`, `python3 tools/check-links.py`, plus mobile preview tests and HTTP redirect checks. Screenshots stay in ignored `test-results/`.


## Verification update

- First card's build now opens `/hack/1/`, not the hub; the repository is unchanged.
- Exact event line, product pitch, result and solo #2 card are present. Squad navigation uses `aria-current="page"`.
- Dedicated 1200×630 OG image at `/hackathons/og.jpg` represents this archive rather than the HackTheFeed product page.
- The verification branch includes post-ready so both build destinations are real. PR #38 itself is unchanged, and daily/production have not been updated.
- Preview analytics must use a normal mobile user agent: PostHog intentionally rejects HeadlessChrome and webdriver as bot traffic. The test simulates a normal visitor only in its isolated browser context; production bot filtering is unchanged. Preview events are excluded from production stats by the existing host filter; a production counter check remains a post-deployment step.

# Ex-hackathon squads

`/hackathons/` shows teams Gabe was part of. This is separate from the live-build hub at `/hack`.

## Add a team

Append an object to `hackathons/teams.json`: unique `id`, `name`, `event`, `location`, `date` (`YYYY-MM`), `teamSize`, `members` (`name`, `label`, `url`), `build`, and `repo`. Confirm membership before adding names. Cards are sorted newest first. Run `node tools/build-hackathons.mjs`; Vercel also runs this before generating the search index. The static HTML works without JavaScript.

HackTheFeed has five members. Only Gabe and Siebe are currently named, per Gabriel; the page honestly shows three additional teammates without inventing identities or profile URLs.

## Short link and stats

- `https://corvus.gent/squads` → 307 `/hackathons/?utm_source=share&utm_medium=links&utm_campaign=hack&utm_content=squads`
- `https://corvus.gent/squads?utm_source=linkedin` preserves `linkedin` instead of the default source.
- Incoming query parameters are preserved. The landing page's existing analytics captures approved tags before cleaning them from the address bar.
- PostHog pageviews keep `$pathname=/hackathons/`, `utm_campaign=hack`, `utm_content=squads`, and `short_slug=squads`. The existing stats page/source aggregations therefore include the destination rather than grouping it under `/other/`. There is no new dedicated dashboard or per-person tracking.
- Existing opt-outs/GPC/DNT remain in force. The redirect needs no cookie, Redis write, or third-party request; counts represent landing-page visitors, not raw redirect requests/bots.

Verification: `node tests/hackathon-squads.mjs`, `python3 tools/check-links.py`, plus mobile preview tests and HTTP redirect checks. Screenshots stay in ignored `test-results/`.

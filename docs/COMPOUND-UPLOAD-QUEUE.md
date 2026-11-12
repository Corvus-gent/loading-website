# Compound export upload queue

Open `/compound/v2/stats` with the existing owner password. Each platform/account gets its next ready video, copyable export caption and filename. Expand **up next** to see the rest of that account’s plan. Only `ready` clips without a post URL appear. The planner alternates languages where possible; when only one language remains it says so.

TikTok and Instagram use 60 minutes per account; X uses 45 minutes. Platforms are independent. LinkedIn/Twitch have no requested cooldown. These are planning slots, not automatic publishing: marking a real post always records the truth, even if it was published ahead of the plan. The next slot recalculates from its server-side posting time. Repeating the same mark-posted request preserves that time; correcting an existing post URL uses the full editor.

`compound/v2/upload-queue.js` contains the cadence. Public pages, OG cards, drafts and code input use `LANG-HOOK-N`; older `LANG-HOOKN` inputs remain accepted, case-insensitively.

## Import

Keep the input JSON outside the repository. It must contain the requested export rows, including slug, platform, account (or account_code), lang (or language), hook (or hook_family), vote_code, caption, share_url, download_url and local_path. The last field must reference an existing MP4. A manifest explicitly marked pending is rejected. Do not turn an unfinished audio repair into a ready export.

```sh
node tools/import-compound-exports.mjs /absolute/ready-to-post.json
node tools/import-compound-exports.mjs /absolute/ready-to-post.json --apply
```

Default expected count is 27. Use `--expected-count=N` only for a separately confirmed batch. The default is dry-run. Secrets load from `~/.secrets/corvus-compound.env`. Apply creates a private, mode-600 registry backup under `~/.secrets/corvus-backups/` first. Re-imports preserve existing social metrics, posted URLs/timestamps and vote/event counters. Each row is applied atomically with compare-and-set; a partial network interruption can be resumed by re-running the same file.

Public registry fields are allowlisted. Captions, download URLs and local paths live separately in the private Redis `compound:v2:export-assets` hash and are returned only by authenticated `?private=1` requests. No export paths, secret URLs or tokens are committed.

## Source discrepancy found on 8 November

The current `ghent-sf-journey/release/ready-to-post.json` is empty; all 121 rows in `all-videos.json` say `audio_repair_pending`. The older R03/R04 share logs contain 28 distinct slugs (one repeated export of x-gm-en-a1), rather than the requested 27. Import is waiting for confirmation of the final ready batch; queue functionality can ship independently. The explicitly supplied X post is recorded separately.

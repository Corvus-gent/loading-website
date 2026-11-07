# Changes

## Hookjack /hack

Add a mobile-first static hackathon launch page with a configurable, click-to-load vertical video, three-step playbook, decorative unhinged dial, editable build timeline, build/community links and original 1200×630 OG artwork. No backend or database changes. Desktop Chromium and 375px Chromium/WebKit checks cover layout, keyboard use, empty video, all four media adapters, and no third-party requests before playback. This branch is based on main and is preview-only until reviewed.

Merged Claude commit `7a1ac15` without losing its live.json, 30-second feed polling, dynamic video/GitHub/X links, slider labels, analytics or privacy integration. Codex keeps the responsive design, playbook, separate four-stop timeline, OG art, safe click-to-load video adapters and LinkedIn/army CTAs. Updates now use hack/live.json on codex/hack-page.

## 2026-11-07 · HackTheFeed launch
Renamed Hookjack; retained design, OG art, video adapters and Claude's live.json polling. Added beta app frame, comments/reactions, private feedback, consent-aware aggregate source/funnel stats. Fork hosting keeps upstream feat/onboarding as an exact mirror and isolated default-branch build guards. Generation fails closed without a key/budget; no production change to corvus.gent.

## 2026-11-07 · hosted HackTheFeed iframe
Use the existing hackthefeed-six.vercel.app app directly, with full-viewport iframe, feedback bar and five-second fallback. Attribute app links and keep navigation click tracking alive. No hosting or clone.

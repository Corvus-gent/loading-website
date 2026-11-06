# Codex / Claude contract — 6 November 2026

Integration PR: #18, daily/2026-11-06-redis-restore. Gabriel merges to main.
Normal features do not bypass that review. Already deployed emergency fixes must
be retained when integrating branches; main currently predates those fixes.

Use separate clones/worktrees. Claude must never work in Codex's directory.
New work uses codex/<feature> or claude/<feature>. The content handoff branch is
codex/i18n-split, created directly from latest main. Claude branches from this
explicitly agreed foundation. Codex's WIP is checkpointed on codex/legion.

## Ownership

Codex: APIs, auth, payments, Discord, infra, cron, middleware, dependencies,
analytics/stats, interactive UI wiring, performance, privacy behaviour, tests/CI.
Claude: text, translations, static articles, docs and CV content/PDF.
Claude never edits api/, middleware.js, vercel.json, package.json or tests/.
Codex never rewrites Claude-owned prose except agreed technical wiring. Privacy,
retention, payment and access claims must match the implemented behaviour.

## Feature locales (content files)

- js/i18n/army.<lang>.json: flat UI keys matching data-army attributes.
- js/i18n/mail.<lang>.json: claim.subject/body, confirm.subject/body,
  daily.subject/body, weekly.subject/body, welcome.subject/body,
  reject.subject/body, expiry.subject/body.
- js/i18n/wiki.<lang>.json: flat article keys; start empty. Add the same keys to all
  seven languages; use article-prefixed keys such as diogenes.title.
- Languages: en, nl, es, fr, pt, de, zh. Plain text only, no HTML. Newlines are
  allowed. Keep keys and {placeholders} identical across languages.
- Existing account/mail translations are seeded. See LOCALE-TRANSLATION-TODO.md
  for gate strings still seeded in English; do not mistake them for translations.

Codex owns js/i18n.js and js/i18n/feature.js. Browser consumers await
loadFeature(feature, lang), then use featureText(feature, key, values, lang) and
textContent. The legacy locale files remain intact for existing pages. The event
corvus-language-change supplies detail.lang for feature consumers.

Gate/profile markup for reference is on codex/legion:
join-the-army-now/index.html, army/access/index.html, soldier/index.html,
legion/index.html. Do not copy implementation files into a content branch.
Use existing data-army keys; request new slots instead of changing form IDs.

## Immediate Claude packages

1. claude/legion-copy: army/mail JSON, oath, seven-language wording. Payment buys
   supporter perks only: no rank, priority or admission. Earned rank comes from
   approved help, missions and recruits. Discord is connected. Daily mail about 60 words; no puzzle answer.
2. claude/wiki: wiki/diogenes/index.html, wiki/icarus/index.html,
   wiki/sisyphus/index.html, Corvus cross-links and wiki JSON. Keep the Pidgy
   persona unchanged and preserve hidden eggs. Use sources for factual claims.
3. claude/docs-cv: docs/LINKS.md, docs/FEATURES_FOR_GROK.md, docs/CV-CONTENT.md,
   then cv/gabe.pdf. Label live/review/planned accurately. No secrets, invented
   metrics or hidden-egg solutions in the public feature overview.

## Integration checks

Every branch adds a short dated entry to CHANGES.md. Codex combines concurrent
entries without discarding them. CI: node --check, feature-locale validation,
Playwright smoke, local link validation, generated search-index artifact.
search-index.json is generated from source during CI/build, never hand-edited.
Do not commit personal test fixtures or credentials. Tests use local/mocked APIs.

## Army cache-version rule

Whenever a file under `js/army/` or `js/i18n/` changes, bump the same `?v=` value in all army static/dynamic imports, every army HTML entry script (including legion and soldier pages), and the feature loader reference and JSON URL in `js/i18n/feature.js`. Ship the edit and all version changes in the same commit. Preserve `max-age=0, must-revalidate` for these script/locale paths.

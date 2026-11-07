# OSSMAN — Plethora draft

Pac-Man in an octagon: you're a white belt submitting meme fighters.

Creator: Gabriel Van Langenhove. Original live game: https://corvus.gent/hack/play/

## Delivery

Saved through Plethora's paired-agent draft API on 7 November 2026 (UTC).
Draft ID: `85764f7c-5061-431d-a35b-7a0dfbd29bf9`.
Upload accepted with no notices. Not published. In Plethora, open Create → Drafts → OSSMAN.
The API provides an acknowledgement receipt, not source readback or a hosted preview link.

Package files: `main.js` and `plethora.json`; no assets or external dependencies.
`../ossman-plethora.zip` contains exactly those two files at its root.
The original offline `../whitebelt.zip` is retained unchanged. The live website was not changed.

## Conversion

The original maze, four enemies, techniques, belts, lives, promotions, finish bonuses,
pixel drawing, meme panels and synthesized action sounds remain. Runtime-owned surfaces,
safe-area layout, input, frame loop, cleanup and permission declarations replace browser globals.
Plethora's score record replaces Corvus API calls and device-only bests. Host scene sharing
replaces PNG download/native browser sharing. Spoken browser announcer lines are displayed
visually because speechSynthesis is not a documented Plethora capability. Crowd/action sounds
remain; no new music bed was added to preserve the existing sound design.

Short arcade attempts deliberately start fresh; no mid-run Continue Playing checkpoint.
Mute is remembered as a device preference; personal best reads the authoritative record.
Record identity: score / global / all_time, desc, best_per_user; daily is also declared.
Creator knobs: player speed, black-belt duration, enemy speed increase per round.

## Verification

- Manifest validated against the freshly fetched official JSON schema; `node --check` passes.
- Chromium and WebKit at 390×844 with top/bottom host insets: visible first frame, actual
  first tap, swipe/D-pad, scoring, power collision, pause/resume, mute, game-over, leaderboard
  adapter, native-share adapter, replay, promotion, host suspension, disposal and reopening.
- Screenshots inspected. No console errors in the SDK approximation harness.
- Actual Plethora draft playback, native audio, real account leaderboard persistence and
  publication remain unverified: those are separate from successful draft storage.
- The hackathon listing asks for an album of 3+ Bits. This draft is one game, not a complete
  three-Bit album or proof of a hackathon competition submission.

Official flow: https://agent.plethora.studio/v1/agent/start.md
Context version: plethora-agent-context-2026-10-22.1; SDK 1.8.0.

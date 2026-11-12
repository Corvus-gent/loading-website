# Video share drafts

Owner page: /compound/v2/links (existing password/session).

Edit all share wording in **compound/v2/share-config.js**. Each language has a template and one phrase per hook. The generated text substitutes {hook} and {code}; the tracked short link is appended once. All 20 supported languages and 11 hooks have entries. Arabic and Persian previews use RTL; the external platform receives plain Unicode text.

Per video:
- Post on X: intent/post with text only (one tracked URL).
- Reply on X: paste an X/Twitter post URL; only valid HTTPS X/Twitter status URLs enable the reply link. The post ID remains a string to avoid numeric precision loss.
- LinkedIn: share-offsite with the tracked URL; LinkedIn chooses the link preview and the author can add commentary there.
- WhatsApp: message text plus the tracked URL.

Each destination includes the complete UTM set: source x/linkedin/whatsapp, medium post/comment/dm, campaign compound-v2, content full slug. Existing /v redirects retain the supplied attribution. QR and ordinary/full links keep their previous behavior.

**Copy all links for today** copies the current registry's non-example videos: one slug and X draft URL per entry, headed with today's San Francisco date. It includes unposted videos and already-posted entries so none of the current campaign's slugs disappear from the batch.

These buttons open drafts; they never publish automatically. No new APIs, dependencies, tokens or environment variables. Tests exercise all 880 language/hook/platform combinations, reply URL validation, attribution through the redirect helper, clipboard export, 390px and desktop layouts.

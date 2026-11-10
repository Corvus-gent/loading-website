# Company features: their product, hosted by Corvus

Each dedicated company feature should feel like the company's own product with a small, consistent Corvus host layer. Do not apply one company's palette to unrelated companies. Keep the Corvus navigation, return paths, referral attribution, analytics consent and existing interactive features.

## Current treatments

- Cardneto — `/friends/cardneto/`: blue on white, round product surfaces, actual Cardneto app image, product-first hero, founder story. The hidden business-card dialog and directory cards follow the same identity.
- Plethora — `/plethora/`, public referral stats, `/hack/2/`, and all existing Plethora promo cards/footer placements: black/cream, big sans headings, pixel-style wordmark, restrained green accents. Existing game/download links and QR generation are retained.
- Compound — public `/compound/*` pages: warm paper product masthead, black raised CTA, tightly set sans hero, dark Corvus media/workspace surfaces. Existing reports, videos, feedback, counters and forms are retained. Admin is not rethemed.
- HackTheFeed — `/hack/1/` and its two existing app wrapper routes: white/lilac product surfaces and violet actions matching the live app. Reactions, comments, links and embedded app stay intact.
- Mixed public directories retain Corvus identity; cards pointing at these products use the relevant product treatment. Ordinary company-list links are not presented as official company landing pages. Private client concepts are unchanged.

## Sources inspected

- https://cardneto.com/en — blue, white, rounded surfaces and app illustration.
- https://plethora.studio/ — black/cream, oversized typography, pixel identity and interactive content.
- https://compound.mov/ — warm white, black tactile buttons, rounded media and tight sans typography.
- https://hackthefeed-six.vercel.app/onboarding — white/lilac, violet actions and product wordmark.

Product assets retain source credit. No invented endorsements, official partnership claims, customer results or new pricing. Corvus identifies itself as the featuring site.

## Maintenance

`tools/site/partner-brands.mjs` assigns company identity by route and adds an idempotent masthead. `css/site/partners.css` owns the scoped visual treatments and shared promotional cards. `tools/site/build.mjs` reapplies them after the existing generators; Vercel packaging includes the module. Cardneto's editable content is `friends/cardneto/content.fragment`, also read by the existing pages generator.

For the next company, inspect its official site first, add its own route/theme, and retain all current outbound tracking paths. Avoid global restyling of the homepage or another company's pages.

Validation: existing full site build; partner brand idempotence, admin exclusions, form/referral preservation and deployment-input checks; desktop and 390px browser QA. Local static preview does not supply live counters/APIs; production handlers are unchanged.

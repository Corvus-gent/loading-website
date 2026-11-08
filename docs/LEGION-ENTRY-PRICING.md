# Entry pricing — November 8, 2026

The legion page now states `tiro: $1 once` and `miles: $1/month`, in all seven languages. Other supporter tiers and earned-rank rules are unchanged. Payment still grants perks, not earned rank or automatic approval.

## Gabriel: exact Buy Me a Coffee changes

The existing integration consumes signed webhooks; it does not have a supported API for editing Buy Me a Coffee products or membership prices. The website change does **not** change checkout prices.

1. **Shop:** create a one-time item with the exact title **tiro**, currency **USD**, price **$1**. Use “Corvus entry supporter — one payment, no renewal” as its description. Ask buyers to use their verified Corvus email or include `@username` in their payment message. The page's tiro link opens your Shop.
2. **Memberships → Levels → miles → Edit:** set the monthly price to **$1 USD**, retain the current perks, then save. The page's miles link opens Memberships. Review the effect on existing members in BMC before confirming; the site does not modify subscriptions.
3. **Existing recurring tiro:** unpublish it for new buyers, without deleting payment history. If there are existing tiro subscribers, cancel their *future renewal* in BMC after preserving their one-time entitlement; merely changing this site's text does not stop billing. Do not cancel other levels.
4. Keep **centurio, legatus, senator and consul** prices and terms unchanged. Do not repurpose an existing lifetime level: BMC permits only one such level, so tiro uses a separate one-time Shop item.
5. Retain the existing signed webhook endpoint `/api/bmc-webhook`. Ensure `extra_purchase.created` and `extra_purchase.refunded` are enabled. The new code recognises an explicitly named **tiro** Shop item at ≥ $1 USD, preserves its supporter entitlement without monthly expiry, and revokes that entitlement on refund. Arbitrary donations do not buy tiers. Miles still follows membership renewal/expiry events.

No real purchase was made. The signed webhook, one-time entitlement, refund, replay, unchanged ranks and expiry behavior were checked against the local test database.

Official references:
- https://help.buymeacoffee.com/en/articles/10190368-adjusting-your-membership-pricing-on-buy-me-a-coffee
- https://help.buymeacoffee.com/en/articles/7257236-a-quick-guide-to-lifetime-memberships
- https://cdn.buymeacoffee.com/assets/integrations/bmc-webhooks-openapi.json

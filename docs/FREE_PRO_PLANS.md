# Free and Pro plans

This replaces the early-access pilot model. Public visitors can open Photo Studio, choose a look and prepare an original photo without an account. Generate image opens signup. After signup (or signing in), the prepared photo and settings transfer to the private workspace and the same generation request continues. A cancelled signup keeps the preparation in the current tab. Photos are held in memory until authenticated; closing/reloading the tab before saving discards them. Originals are uploaded unchanged after authentication; image model, quality, compression and export settings are unchanged.

New public accounts receive **five image generations once**, with no expiry and no card requirement. Signup cannot choose a role or allowance. Existing granted allowances and secure invitations/reset links are retained. There is no ten-restaurant limit. The database's legacy restaurant default remains unchanged to avoid rebuilding a populated table; public signup always explicitly sets five. Existing photos and outputs retain their original allowance accounting.

**Pro is $9 USD/month for 50 image generations per paid monthly billing period.** Unused monthly generations do not roll over. The hosted site has Stripe billing enabled. Other environments stay inactive until Stripe is connected and explicitly enabled. The public pricing page and plan dialog show Pro as coming soon while inactive; checkout never simulates a successful purchase. Free accounts work immediately. Email delivery remains deferred at the owner's request.

## What Free and Pro include

Free is meant to be the most generous free plan among AI food-photo tools, and Pro to be the plan for restaurants that market every week ("Keep your restaurant looking its best, every week"). Every limit lives in `lib/plans.ts`; the server, the Pro badges and the pricing copy read it.

| | Free | Pro |
|---|---|---|
| AI photos | 5 to start (`FREE_SIGNUP_IMAGES`): every style, fine-tuning, full quality, no watermark | 50 each paid billing period |
| Restaurant look (colors, fonts, photo style, atmosphere references, tone) | Can be set up and previewed in Restaurant settings; new work uses neutral defaults | Applied to new photos, posts, menus, table cards and captions |
| Saved photo looks and inspiration photos | No | Yes (up to 100 looks) |
| Batches ("Apply to more dishes", older batch tool) | No | Up to 8 dishes |
| Menus | 1 live menu: The Brasserie, light, typography only or featured dish photos, no custom colors; QR code, PDF and table card | All 10 designs, a photo for every dish, dark paper, custom colors; up to 30 live menus |
| Posts and Stories | Just the dish, From the pass and The daily special; one photo; each design's own colors and type | All 10 designs, carousels, multi-dish offers, the restaurant's colors and fonts |
| Campaigns (post, Story, counter sign, menu special) | A preview with the owner's own dish | Yes |
| Downloads | Every size, one photo at a time | Also photo packs and multi-photo ZIPs |
| Staff photo links | No new links | Yes |
| Menu insights | This week's visits and the change; counts of what Pro shows | Order, call and directions taps, QR placements, menus and dishes |
| Guest menu credit | "Made with Menu Material" | Removed |
| Also | Menu import, food-error corrections, weekly suggestions | Automatic credit back on a repeated food-error report; no daily cap on captions and menu reading |

**Pro features are separate from Pro images.** `featureAccess()` in `lib/server/entitlements.ts` gives Pro features while a paid period covers today, for 14 days after a failed renewal while Stripe retries (features only; an unpaid month grants no images), or until an administrator's comp date (`restaurants.pro_until`, "Pro features until" in Administration; it never adds images). `PLAN_LIMITS_ENABLED=false` lifts every Free limit at once, for an emergency or a test.

**The server enforces every limit** when something new is created, saved, published or requested, and answers 402 with `code: "pro_required"` and the feature; the workspace then opens Plans on that feature (once per session when the person didn't click it). Menus are checked on publish (inside the write, so two tabs can't both pass), post drafts on save and copy, campaigns on every write except view, download, unpublish and sold out, batches and staff links on creation, saved looks on the library save and in photo requests (with inspiration photos), and insights and the menu credit on each read. `effectiveStyle()` resolves the restaurant look once for all server work, and `/api/state` sends both the effective and the saved look. Exports drawn in the browser (post and photo-pack ZIPs, PDFs of Pro menu designs) are limited in the page only.

**A downgrade keeps everything.** Nothing is deleted or taken offline: live menus keep the look they were published with and can always be published again (in the basic design), scheduled specials run until they end, saved looks and post drafts stay and can be opened and downloaded, started batches finish, and existing staff links work until they expire. Only new Pro work needs Pro again.

**Signups are limited per network.** Each network can open `SIGNUPS_PER_NETWORK_PER_DAY` (default 5) public accounts a day, counted when an account is created; invitations don't count. This keeps free images from being collected by signing up repeatedly. Email verification remains deferred.

`tests/plan-limits.mjs` covers each limit through the API, two tabs publishing at once, keeping work after a downgrade, the renewal grace, comps, the switch and the signup cap. Suites that exercise Pro features comp their test workspace.

## Stripe activation

1. In the intended Stripe account, reuse the existing Menu Material Pro product and recurring price: USD 9 for 50 image generations, interval month, quantity one, no trial. Configure the customer portal to update payment methods, view invoices and cancel at period end; disable product switches, quantity changes and prorated plan changes for this single-plan integration.
2. Set these secrets/configuration values through Sites runtime settings (never in source or conversation): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`. Keep `STRIPE_BILLING_ENABLED=false` until the test flow has been verified. `APP_ORIGIN` must be the canonical HTTPS site origin.
3. Configure a Stripe webhook at `https://dishlight-studio.cflash7.chatgpt.site/api/billing/webhook`, using API version `2025-06-30.basil`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. In an isolated test environment, enable billing with test keys and verify checkout, the customer portal, cancellation at period end, a successful renewal, a failed renewal, retrying a payment, and signed webhook redelivery. Then set the matching live keys, live price and live webhook secret on production and set `STRIPE_BILLING_ENABLED=true`. Never mix test customers and live credentials in one database.
5. Monitor Stripe webhook delivery and reconcile any failures. Users can refresh payment status from their plan dialog; checkout-return URLs themselves grant no credits.

The server checks that the configured price is exactly USD 900 cents per month. Checkout requires authentication and ignores client-supplied prices/customer IDs. Per-account leases and persisted idempotency keys prevent duplicate checkout creation. Repeated clicks reuse an open session. Canonical Stripe subscriptions are fetched on signed events and account refresh, so reordered event payloads cannot restore an old plan. Grants require a matching paid invoice, the exact price and period, and the authenticated restaurant's customer/subscription relationship. Customer-specific IDs are never accepted from the browser.

Each grant has a unique subscription/period key and invoice ID. Duplicated events cannot refill credits. Every output records its allowance period. New jobs atomically reserve against the active allowance; failed images refund their own original period. Explicit retries reserve the current allowance, even for failures from an earlier month. Unpaid renewals do not grant a new month. Cancellation at period end retains the paid period; immediate cancellation stops Pro entitlement. Existing free credits remain separately available after Pro ends. Saved work is never deleted when a subscription ends.

The shared `lib/plans.ts` definition supplies the price shown in the UI, the server's 900-cent validation, the 50-image paid grant and the schema default. Migration `0018_pro_50_images` changes the default for future billing periods without rewriting previously granted credits or usage. A read-only production check on September 25, 2026 found no existing paid periods. Both live and sandbox Stripe prices already use USD 9/month and 50-image metadata; no Stripe price or product change is required. Historical screenshots may show the superseded offer.

## Validation

`tests/plans.mjs` covers open signup, server-enforced free allowances, concurrent quota reservations, inactive/mispriced checkout, signature expiry/tampering, checkout reuse, confirmed payment grants, duplicate and out-of-order events, renewal failures and recovery, cancellation/resubscription, old-period failures/retries, tenant separation, and the guest-to-account handoff after a lost job response. Stripe and AI are isolated fixtures; these tests do not charge anyone or prove live Stripe configuration. The existing creation, export and launch suites remain applicable.

Email verification and automated password recovery still require the deferred email service. Existing signup/IP limits and AI spending controls remain active. Closed-browser processing still requires the previously supplied always-on runner; this subscription change does not activate that service.

Official implementation references: [Stripe Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [signature verification](https://docs.stripe.com/webhooks/signature).

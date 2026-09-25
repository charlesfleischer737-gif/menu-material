# Stripe sandbox setup

## Plan and environment

Menu Material Pro is **USD $9/month for 50 image generations per paid monthly billing period**, quantity one, without a trial or rollover. Free accounts retain five one-time images. Image usage is enforced by the application rather than billed as metered Stripe usage.

The Stripe plugin and authenticated MCP connection were used to generate and accept implementation guide `iguide_61VSnAvoi2rRZoVc741RryM8f8tHG`. The chosen integration uses hosted Checkout, Stripe Billing subscriptions, the customer portal and verified webhooks. The existing integration was reviewed against that plan. API requests use `2026-08-26.dahlia`.

All account operations below used **Menu Material sandbox**, `acct_1UJP3RRryM8f8tHG`, with `livemode=false`. Sandbox validation uses separate credentials and a separate local database. Production activation requires its own live configuration.

## Configured Stripe objects

| Object | Sandbox ID | Configuration |
| --- | --- | --- |
| Product | `menu_material_pro` | Menu Material Pro, 50 images per paid month |
| Price | `price_1UJPFERryM8f8tHGSEOrBmvp` | USD 900 cents, monthly, inclusive tax behavior |
| Portal configuration | `bpc_1UJPFURryM8f8tHGfeowpX71` | Payment method updates, invoice history, cancellation at period end; plan and quantity changes disabled |
| Test clock | `clock_1UJPI8RryM8f8tHGFrHGsR2c` | Created for subscription lifecycle tests; not yet advanced |
| Renewal test clock | `clock_1UJPagRryM8f8tHGKo0mJedP` | Advanced across successful and failed renewal periods |

Checkout disables Adaptive Pricing, uses flexible subscription billing, and allows Stripe to select applicable payment methods. Automatic tax is not enabled. Live tax configuration still needs to be decided before activation.

## Verification completed

- A sandbox subscription paid its initial **900-cent** invoice: `sub_1UJPIyRryM8f8tHGd3BPPnI6`, invoice `in_1UJPIyRryM8f8tHGnauwk6VJ`.
- Scheduling cancellation kept that subscription active with its paid period. It was subsequently canceled immediately to verify the final state and clean up the test.
- A sandbox card decline left subscription `sub_1UJPMuRryM8f8tHGYl2J2DNU` incomplete with **zero paid**. Cleanup left it `incomplete_expired`.
- The website's **actual browser Checkout** completed a sandbox $9 payment for subscription `sub_1UJPYzRryM8f8tHGT7wEXjRh`. The return to Photo Studio showed **50 of 50 images** and Pro status. The portal displayed the paid $9 invoice. Canceling through the portal retained the 50-image paid allowance and showed the subscription end date on the website.
- Testing exposed and fixed the portal's flexible-billing cancellation format: Stripe may set `cancel_at` to the item period end while leaving `cancel_at_period_end=false`. The server now recognizes both forms. The signup dialog also now reads the public billing-enabled flag correctly.
- A local replay of the actual Stripe responses through the application's signed-webhook handler granted exactly 50 images for the paid period, retained them during scheduled cancellation, restored the free allowance after cancellation, granted no Pro allowance for the declined payment, and prevented duplicate paid-period grants.
- Actual Stripe events were forwarded through the authenticated CLI listener to the local website and accepted with HTTP 200. Simultaneous notifications can return 409 while the per-account lease is held, allowing Stripe to retry; the event that holds the lease reconciles canonical state. The retrieved Checkout event was also signed and redelivered through local HTTP three times: exactly one paid period remained.
- Test-clock subscription `sub_1UJPbhRryM8f8tHGlfRuPYOi` paid its initial invoice, then renewed for **900 cents** with invoice `in_1UJPcXRryM8f8tHGgDP9uoXb`. The website received the renewal webhook and displayed 50 available images.
- The next renewal used a declining test card: invoice `in_1UJPeNRryM8f8tHGSB9wMz8e` remained open with zero paid and the subscription became `past_due`. The website created **no new allowance**. Replacing the payment method and retrying that same invoice paid 900 cents, restored `active` status, and created exactly one 50-image allowance for that period. The test subscription was then canceled for cleanup.
- The billing and plan suite passed **103 checks**, including both cancellation formats. Type checking and the production build passed after the fixes. The build was checked for accidental inclusion of the sandbox API key; none was found.

The test clock advances Stripe time only; the application still uses real wall-clock time. Future paid periods were checked in the database and cannot be spent before they start. Concurrency, tenant isolation, expiry and allowance consumption also have fixture-based coverage. No actual image generation or real payment was performed. Hosted production webhook delivery and live-mode activation remain untested.

## Connect the local website

The private, Git-ignored `.env.stripe-sandbox.local` file is configured with the sandbox key, CLI webhook secret, price and portal configuration, and billing is enabled locally. Its permissions are `0600`. It uses `http://127.0.0.1:5174` and a separate database under `.local-data/stripe-sandbox/app`. Image API access is blank so subscription testing does not spend image-generation credits. Replace the temporary test key with a new restricted sandbox key after testing.

For repeating the setup:

1. In Menu Material sandbox, create a restricted key for this website. The server needs Write access to Customers, Checkout Sessions and Billing Portal, and Read access to Prices, Subscriptions and Invoices. Keep other permissions disabled; verify against actual request failures before adding permissions. Save the `rk_test_` value only in `STRIPE_SECRET_KEY` in the private file.
2. Authenticate the Stripe CLI to the same sandbox and forward the configured subscription events to `http://127.0.0.1:5174/api/billing/webhook`. The local test helper passes the key through the process environment and stores the signing secret without logging it. A local listener secret differs from a hosted endpoint's signing secret.
3. Set billing enabled only in this private local file, start the local server using its environment, and test with a disposable local account and Stripe test cards. Do not use production data or a real card.
4. Verify Checkout return, automatic credit activation, portal cancellation, duplicate event delivery, renewal, failed renewal and successful recovery. A completed return URL alone must never grant credits.

Use a distinct CLI authentication for test-clock administration if the website's restricted key cannot perform that operation. Do not broaden the website key merely to run administrative tests.

## Live activation remains separate

Create corresponding live objects and configure the live runtime and webhook only after sandbox verification. Use live IDs and a live restricted key in production, decide tax handling, publish the reviewed source, and then enable billing. Never copy the sandbox database or sandbox keys into production.

References: [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys), [Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [sandboxes](https://docs.stripe.com/sandboxes).

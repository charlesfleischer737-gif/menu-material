> The October 2026 workflow update is documented in [IOS_IMPROVEMENTS.md](IOS_IMPROVEMENTS.md), including onboarding, Explore Styles, native posts, menu publishing, draft recovery and release checks. It supersedes the original scope notes below.

# Menu Material for iPhone

A native SwiftUI app for iPhone, on the same API and accounts as menumaterial.com. It is the phone-first part of the product: photograph a dish, style it, and share it; keep My Dishes in hand; update menus; post to Instagram. Menu Builder layout editing, campaigns, batches, full insights and administration stay on the web.

## Decisions

| | |
|---|---|
| Stack | Native SwiftUI, in `ios/` in this repository, so API and app changes ship in one pull request |
| Devices | iPhone only; iOS 26 or later |
| Pro in the app | An auto-renewable App Store subscription at **$9.00 a month** for the same Pro plan (50 images each paid month). Apple sets equivalent prices in other storefronts. Stripe stays on the web. |
| Developer account | The owner holds the Apple Developer Program **organization** membership and App Store Connect |
| Sign-in | Email and password, Sign in with Apple (required by App Review because Google is offered), and Google |

## Delivery plan

| Milestone | What | Status |
|---|---|---|
| 1. Server for the app | Native sessions, the version gate, Sign in with Apple, Google from the app, App Store subscriptions, push notifications and Live Activity updates | Done (this document's server sections) |
| 2. App foundation and core screens | Xcode project, API client, design system, sign-in, Photo Studio, My Dishes, Menus, Plans, Account, notifications, macOS CI | Done (see [ios/README.md](../ios/README.md)) |
| 3. Posts and sharing | Post Maker with the web's renderer, Instagram Stories sharing, menu QR and table card | Planned |
| 4. Native extras | Share extension from Photos, widgets, Siri and Shortcuts actions (mark a dish sold out) | Planned |
| 5. Beta and launch | TestFlight with pilot restaurants, physical-device checks (camera, HEIC, Instagram handoff), accessibility and performance passes, App Store listing, review | Planned |

## How the app talks to the server

Every request from the app carries `X-Menu-Material-Client: ios` and `X-Menu-Material-Version: <app version>`. No browser can send those headers to this site without a CORS preflight, which the server never grants, so they also stand in for the Origin check on the app's sign-in routes.

**Sessions.** Signing in from the app (`/api/auth/login`, `signup`, `google/*`, `apple/*`) returns `{ token, deviceToken }` in the body instead of cookies. The app keeps both in the Keychain, sends `Authorization: Bearer <token>` with each request and `X-Menu-Material-Device: <deviceToken>` to sign-in routes (so its sign-ins skip the per-account slowdown, as a browser's device cookie does). App sessions last 90 days and renew themselves once a day while used; browser sessions keep their seven days. A session works only the way it was issued: an app token is refused as a cookie and a browser cookie as a Bearer token (`sessions.client`). Signing out deletes the session; a password reset deletes them all.

**Version gate.** Set `IOS_MIN_VERSION` (for example `1.2`) when a server change needs a newer app. Older apps get `426` with `code: "update_required"` and ask for an update. `GET /api/native/config` stays open to every version and tells the app what's available before sign-in: the minimum version, which sign-in methods are on, the App Store product, and the support, Terms and privacy links.

**Sign in with Apple** (`/api/auth/apple/start`, `credential`, `complete`) follows Continue with Google: `start` returns a nonce and a flow token; the app asks Apple to sign `SHA-256(nonce)`; `credential` verifies Apple's identity token (Apple's keys, issuer, audience = the bundle ID, nonce, 10-minute age) and either signs in, asks for the existing account's password to link a matching email, or asks for the restaurant's name to create an account with the normal free images. Apple has verified the email, private relay addresses included, so no separate email check is needed. With a Sign in with Apple key, the authorization code is exchanged for a refresh token, kept only so deleting the account can revoke the app's access with Apple, as App Review requires.

**The Studio's looks** come from `GET /api/native/styles`, built from the same catalog as the web's (`lib/photo-styles.ts`). Each look carries the exact `photoStyle` and `photoPreset` the web's `styleFor` sends with the original angle kept, so a new or changed look reaches the app without an update. Looks an administrator turns off arrive in `/api/state` (`studioAvailability.disabledStyleIds`).

**Google from the app** uses the same routes as the web with the app's iOS client (`GOOGLE_IOS_CLIENT_ID`); the flow token travels in `X-Menu-Material-Auth-Flow` instead of a cookie.

**Deleting an account in the app** works for every account, as App Review requires. Accounts made with Apple or Google have no password, so typing the account's email confirms instead (`{ confirm: "DELETE", email }`). An App Store subscription that still renews must be turned off in the iPhone's Settings first; the server asks Apple again before refusing, in case the owner just did.

## Pro through the App Store

The app buys with StoreKit 2, passing the restaurant's ID (from `GET /api/billing/app-store`, `appAccountToken`) as the purchase's `appAccountToken`, then sends the transaction ID to `POST /api/billing/app-store/verify`. Apple's App Store Server Notifications V2 arrive at `/api/billing/app-store/notifications`. In both cases the server asks the App Store Server API, with its own key over TLS, what the subscription is now, and records that (`lib/server/app-store.ts`). A request or notification can't change what Apple says, so neither has to be trusted.

- A subscription belongs to the restaurant its newest purchase names; a purchase made for another restaurant can't be claimed (`409`).
- Each paid purchase or renewal is a `billing_periods` row with 50 images, keyed by Apple's transaction ID so nothing is granted twice. Images and Pro features read the same ledger as Stripe (`liveSubscriptionSql` in `entitlements.ts`). A free trial or a refunded month grants nothing; a refund ends its month at the refund.
- Billing retry and the grace period count as `past_due`: Pro features stay for up to 14 days, with no new images, as after a failed Stripe renewal.
- The worker's billing check also asks Apple about live subscriptions whose month has ended, every 10 minutes at first, so a renewal or lapse lands even if a notification is lost.
- One subscription at a time: the app can't buy while a Stripe subscription is live (`canPurchase: false`), and the web's checkout is refused while an App Store one is. The web's Plans says an App Store subscription is managed in the iPhone's Settings.
- Sandbox purchases (TestFlight and App Review) are accepted, because App Review tests against the production server. Set `APP_STORE_ALLOW_SANDBOX=false` only if that ever has to stop.

## Notifications

When a photo finishes, the server queues "Your photo is ready" (or "couldn't be made") for each iPhone that registered with `POST /api/devices`, and ends the photo's Live Activity if the app started one (`POST /api/devices/live-activity`). The job runner delivers them: it claims messages from `/api/internal/push/claim`, sends them to APNs over HTTP/2 with a token-signed `.p8` key (`scripts/apns.mjs`) and acknowledges the results. Phones that no longer have the app are forgotten; network failures, rate limits and refused provider tokens are retried, five times in all. Delivered messages are kept a day so a job that settles twice isn't announced twice. Without APNs settings on the runner, nothing is sent and messages expire after a day.

A continuously running worker matters even more for the app than for the web: iOS suspends an app seconds after it leaves the screen, so the app never makes image calls itself.

## Setting it up

These need the owner's Apple Developer and App Store Connect accounts. Keep every key out of source control and conversations; set them as server secrets.

1. **Enroll** in the Apple Developer Program as an organization (it needs a D-U-N-S number). In App Store Connect, accept the Paid Applications agreement and add banking and tax details; in-app purchases don't work without them. Consider the App Store Small Business Program (15% commission).
2. **Register the app ID** `com.menumaterial.app` in Certificates, Identifiers & Profiles with Sign in with Apple and Push Notifications. Create the app record in App Store Connect.
3. **Create the subscription**: a subscription group "Menu Material Pro" with one auto-renewable subscription, product ID `com.menumaterial.app.pro.monthly`, one month, $9.00 in the United States. No free trial or introductory offer. Add its review screenshot and description.
4. **App Store Server Notifications**: in the app's App Information, set both the production and sandbox URLs to `https://menumaterial.com/api/billing/app-store/notifications`, Version 2.
5. **Keys**, under Users and Access → Integrations and Certificates, Identifiers & Profiles → Keys:
   - In-App Purchase key → `APP_STORE_KEY_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_PRIVATE_KEY` (the `.p8` contents; line breaks may be written as `\n`).
   - A key with Sign in with Apple (primary app ID `com.menumaterial.app`) → `APPLE_SIGN_IN_KEY_ID`, `APPLE_SIGN_IN_PRIVATE_KEY`, plus `APPLE_TEAM_ID`.
   - A key with Apple Push Notifications service → on the **job runner**: `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, and `APNS_TEAM_ID` (or `APPLE_TEAM_ID`).
6. **Server settings**: `APPLE_BUNDLE_ID=com.menumaterial.app` (turns on Sign in with Apple, the App Store and push topics), the keys above, and optionally `APP_STORE_PRO_PRODUCT_ID` if the product ID differs. `SUPPORT_EMAIL`, `TERMS_URL` and `SITE_OPERATOR` must be set too: the app's paywall links the Terms and privacy policy, and App Store Connect asks for a support URL.
7. **Google**: in Google Auth Platform, add an **iOS** client for bundle ID `com.menumaterial.app` and set `GOOGLE_IOS_CLIENT_ID`. The app also needs that client's reversed ID as a URL scheme.
8. **Check it**: `GET /api/native/config` shows what's on. Buy in TestFlight with a sandbox account, then confirm Plans shows Pro, a renewal arrives (sandbox months last minutes), turning off auto-renew in Settings lets the account be deleted, and a notification arrives when a photo finishes.

## Validation

`tests/native-app.mjs` (part of `npm test`) runs 151 checks: native sessions and their separation from cookies, renewal, device tokens and sign-out; the version gate; Sign in with Apple's nonce, audience, signer, one-use flows, account creation, linking by password and token revocation on deletion; Google with the iOS client; App Store purchases with production-then-sandbox lookup, restaurant binding, duplicate and out-of-order notifications, renewals, the reconciliation check, billing retry, refunds, free trials, the Stripe exclusion and deletion while renewing; queued, leased, acknowledged and retried notifications, Live Activity ends and forgotten tokens; and the runner's APNs client against a local HTTP/2 server. Apple, Google and APNs are fixtures: real purchases, Sign in with Apple, and delivery to a phone need the accounts above and a device.

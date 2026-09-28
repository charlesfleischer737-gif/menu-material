# Menu Material food photography and promotion

Menu Material is the restaurant promotion workspace in this codebase. Signup is open: each new account starts with five free images, and administrators can also send email-bound invitations with their own image allowance. It includes saved restaurant styles, a dish library, coordinated special and offer packages, private uploads, image versions, approvals, captions, menu imports, batch recovery, staff photo links, weekly suggestions, and engagement measurement.

Visitors can prepare a photo before signing up; Generate image opens account creation with five free generations. Free keeps full-quality photos in every style, every download size, one live menu and posts in three designs. Pro is $9/month for 50 image generations per paid billing period, plus the restaurant look on everything, every post and menu design, campaigns, more live menus, saved looks, batches, staff links, full menu insights and no "Made with Menu Material" credit. Stripe billing is on only when `STRIPE_BILLING_ENABLED=true` and the Stripe settings and `APP_ORIGIN` are set; otherwise Pro shows as coming soon. See [Free and Pro plans](docs/FREE_PRO_PLANS.md) for the feature split, credit rules and setup.

Start in **Photo Studio**, **Menu Builder**, or **Post Maker**, with **My Dishes** as the shared library. Photo Studio is one calm page: a large canvas for the dish photo beside a compact panel with **Photo**, **Style**, **Format** and **Details**. The Style grid leads with Polish my original (or the restaurant's saved look) and the most relevant looks for that photo, ranked from confirmed photo analysis, the restaurant's cuisine, destination, favorites and recent use, and varied in light and color. **All styles** opens a searchable library of suggestions, saved looks, collections and occasions, built to stay easy as the catalog grows. No photo handy? A clearly labeled sample is one tap away. Fine-tuning, framing, references and immediate quick edits remain available, and the creating and result screens keep the same canvas-and-panel layout. New users open directly in Photo Studio. Returning users reopen their last workspace on this browser, with the latest useful saved draft as the fallback on another device. Each creation tool includes saved-work access; Post Maker offers ten Instagram designs across four stages. Earlier promotion campaigns and pilot tools remain under **More tools**. See [the core experience guide](docs/CORE_EXPERIENCE.md) for the flow, validation and connection status, and [the expansion guide](docs/PROMOTION_EXPANSION.md) for retained pilot tools.

## Run locally

Use Node.js **24 or later** and npm. Local development uses SQLite and filesystem storage, so Cloudflare's native runtime is not required on this Mac.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the local URL printed by the server. Select **Sign in → Open local workspace** for a local administrator workspace. This shortcut is available only through the local Vite runtime adapter; it is not included in the production storage adapter. It creates an empty development restaurant and does not seed fictional customer data or AI results.

Local records and uploads live in `.local-data/`, which is excluded from Git. Restarting the app retains them. Generated migrations in `drizzle/` apply automatically to the local database. Set `MENU_MATERIAL_DATA_DIR` to use a separate local data directory. Back up the SQLite database and objects together.

## Connect image generation and captions

Set `OPENAI_API_KEY` in `.env`, then restart. Keep this key on the server. Images are created by calling the OpenAI Images API directly: `images/edits` with the dish photo, previous result and style references, or `images/generations` from a description alone. The photos go in upload order and the prompt names each one's role. No text model sits in front of the image model. Captions, photo guidance and menu imports use a text-only Responses request. Models are configurable:

- `OPENAI_IMAGE_MODEL`: `gpt-image-2.5-flare`
- `OPENAI_IMAGE_QUALITY`: `medium` (Flare also supports `low`, `high`, `xhigh`, `max`, and `auto`)
- `OPENAI_TEXT_MODEL`: `gpt-4.1-mini`

Flare is the selected image provider; its food fidelity, latency, and cost still require a live pilot. New jobs request JPEG at 95% quality for faster delivery, retaining the existing delivery, social, and menu dimensions. Model, rendering quality, format, and dimensions are saved with each job so configuration changes cannot alter a queued request. Previously submitted PNG jobs still recover normally. Your API account must have access to the configured models. Calls can incur provider charges, including for free accounts' images. See [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation).

Without a key, AI buttons explain that the service is disconnected. Saving dishes, uploading photos, writing captions manually, approving source photos, and building menus still work. No mock generation is presented as a live result.

**Daily AI budgets.** Each AI call first reserves an estimate against the site-wide daily budget (Administration → AI operations, $100 by default) and its restaurant's ($20 by default); both reset at midnight UTC. Reservations are $2 for an image, $0.01 for a caption, photo check or rewrite and $0.05 for a menu reading (`AI_*_RESERVE_USD`). A finished call then counts its measured cost, never more than its reservation: text calls at `AI_TEXT_*_USD_PER_MILLION_TOKENS`, and images at `IMAGE_COST_ESTIMATE_USD` when it is set, otherwise at the usage the Images API reports, priced with `AI_IMAGE_*_USD_PER_MILLION_TOKENS`. Those default to gpt-image-1's list prices and must be set to `OPENAI_IMAGE_MODEL`'s price sheet. An image without reported usage keeps its $2. Guests and restaurants without an active paid plan together use at most `AI_FREE_BUDGET_SHARE_PERCENT` (default 70) of the site-wide budget, so paid plans always have the rest; an alert says when that share is used up. A text call keeps running to its settlement if its page closes. Menu readings may take 120 seconds and other text calls 25. A call cut off anyway, for example by a stopped Worker, is counted by the worker's housekeeping twice its timeout later: as uncertain, at no more than the most a finished call of its kind cost that day. Before signup, visitors' photo checks share `AI_GUEST_DAILY_CALLS` (500) a day, and each network gets 20 an hour and `AI_GUEST_DAILY_CALLS_PER_NETWORK` (60) a day. The sample photo has a built-in reading, and a photo read in the past week is answered from that reading, so neither calls OpenAI.

These budgets are estimates, not invoice amounts. Raw provider usage is retained per output, caption, menu import and photo analysis. Failed or uncertain provider calls can still have provider costs; review those records against invoices. The dashboard tracks approved images, failures, reservations, estimated image cost and manually logged support time.

## Background worker and recovery

Set a strong `JOB_RUNNER_SECRET` in both the app and a trusted worker process:

```sh
npm run worker
```

The worker polls the protected `/api/internal/tick` endpoint every two seconds. A check that starts an image stays open for the whole render, so up to four checks overlap and a long render never delays the next one. On a stop signal the worker starts no new checks and lets running image calls finish; a second signal exits at once. `compose.worker.yaml` allows four minutes for that. Set `APP_ORIGIN` to the application origin. A scheduler can instead run `node --env-file=.env scripts/job-runner.mjs --once` once per minute. Run this in a persistent process manager or server scheduler; an ordinary terminal must stay open.

The browser also advances jobs while the workspace is open. Each image call stays open for the whole render, up to 150 seconds. There is no provider job to reconnect to, so whoever makes the call must stay connected. While the worker is healthy, it makes every image call and an open page only refreshes progress, so people can close the page. Without a healthy worker, the open page makes the calls. Closing it leaves a call only a short grace period, so the photo waiting screen asks people to keep the page open. It only tells them they can leave while the worker has checked in within `WORKER_STALE_AFTER_SECONDS` (default 180). **A continuously running worker is required for image creation while all browsers are closed.** The hosting platform does not provision that separate scheduler automatically. Jobs submitted before direct image calls ran as OpenAI background responses; they are still retrieved by their stored response IDs.

**Readiness.** `GET /api/health` is a cheap liveness check. `GET /api/health/ready` checks the database, file storage, the worker heartbeat, the oldest waiting image job (`QUEUE_ALERT_AFTER_MINUTES`, default 10), the site-wide AI budget and billing (settings missing while `STRIPE_BILLING_ENABLED=true`, or paid months that ended without a renewal on record), and returns 200 or 503. Point an uptime monitor at it every minute or so. The public response only says `ok` or `degraded` per check; send `Authorization: Bearer <JOB_RUNNER_SECRET>`, or sign in as an administrator, for details. Administration → AI operations shows the same results, plus launch settings to confirm: `APP_ORIGIN`, whether visitors' networks arrive in `cf-connecting-ip`, the OpenAI key and daily budget, billing and Stripe's last notification, the support email, Terms and operator, and leftover setup switches. They are advice and don't change the status.

**Alerts.** Set `ALERT_WEBHOOK_URL` to a Slack incoming webhook or a Discord webhook (it receives `{"text": "..."}`). You are alerted when the worker is stale while jobs are waiting (and again when it recovers), when a job has waited past the queue threshold, when today's site-wide AI budget reaches `AI_BUDGET_ALERT_PERCENT` (default 80) and when it is used up (once per UTC day each), and when `ERROR_BURST_COUNT` server errors happen within `ERROR_BURST_MINUTES`. Conditions are checked at most once a minute by the worker's tick, open workspaces and readiness probes, so an uptime monitor still catches a dead worker. Each condition is sent at most once per `ALERT_REPEAT_MINUTES` (default 60). Alert state lives in `app_settings` and `rate_limits`; delivery never delays or fails a request.

**Errors.** Unexpected server errors (5xx), background job dispatch and retrieval failures, and browser errors (posted to `/api/client-errors`) are each written as one JSON log line (`"type":"server_error"`, `"job_error"` or `"client_error"`) with the route, status and restaurant ID, never passwords, tokens, cookies or request bodies. Set `ERROR_WEBHOOK_URL` (defaults to `ALERT_WEBHOOK_URL`) to also receive each distinct error, by message and top stack frame, at most once per `ALERT_REPEAT_MINUTES` and 30 posts an hour.

Each new core request atomically reserves one image unit by default (legacy explicit two-output requests remain supported) using the output records themselves as the allowance ledger. Failed outputs stop counting against allowance; completed outputs keep counting even if the owner deletes them. Revisions create new jobs. Idempotency keys deduplicate repeated requests, including concurrent submissions. Per-output leases prevent duplicate dispatch. For earlier background responses, transient retrieval failures retry using the stored provider ID. An interrupted image call cannot be resumed. It fails at once, its reservation is restored and it is never automatically reissued. Its possible provider cost remains a reconciliation item (`ai_spend` status `uncertain`). An image that arrives while workspace storage is full cannot be fetched again later, so it fails and is not counted.

## Administration

On the hosted site, the Site owner can select **Sign in → Set up your administrator account**, then choose a restaurant name and password. The one-time bootstrap checks the Sites-authenticated email against `BOOTSTRAP_OWNER_EMAIL` on the server. It becomes unavailable after an administrator exists.

For alternative hosted setup, configure a random `ADMIN_SETUP_KEY` as a server secret, then create the first administrator invitation:

```sh
ADMIN_SETUP_KEY='<server secret>' APP_ORIGIN='https://your-site.example' \
  node scripts/bootstrap-admin.mjs your-email@example.com
```

The command prints a private one-use invitation. Open it, choose a password, and name your restaurant. Remove `ADMIN_SETUP_KEY` after creating the first admin. This command creates an invitation only; it does not send email.

Administrator controls are at the bottom of the workspace. Administrators can create email-bound invitations, set total image allowances, pause generation, log support minutes, issue one-use password-reset invitations, and delete an owner's account by typing the owner's email (the owner's own deletion rules apply). Invitations expire in seven days. Share them directly with the intended owner. Password resets revoke existing sessions and trusted devices. Passwords are salted with scrypt; sessions, device cookies and invitation tokens are stored as hashes. Session and device cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.

**Sign-in limits.** Each network gets 10 sign-in attempts per email every 15 minutes. After 20 attempts for one email from anywhere, further ones wait longer and longer, and the message doesn't say how long. A browser that has signed in to the account before carries a device cookie (a year, sent only to `/api/auth`, replaced at each sign-in) and skips that slowdown, so someone who knows an owner's email can't keep them out; its network's 10 attempts still apply. A new device still waits.

**Signup limits.** Each network can open `SIGNUPS_PER_NETWORK_PER_DAY` (default 5) public accounts a day, and each IPv6 /48 `SIGNUPS_PER_WIDE_NETWORK_PER_DAY` (default 8) in all, since one /48 holds 65,536 /64s. Invitations don't count. Site-wide, the first `FREE_SIGNUP_GRANTS_PER_DAY` (default 300) new accounts of a UTC day get their free images at once; later accounts still open, and their images arrive oldest first as later days allow (the owner is told when), with an alert naming the setting. A deleted account leaves a one-way hash of its email for a year, so its free images aren't granted twice. See [Free and Pro plans](docs/FREE_PRO_PLANS.md).

### Continue with Google

Create a **Web application** client in Google Auth Platform. Use **External** for the audience, set the homepage to `https://menumaterial.com`, the privacy policy to `https://menumaterial.com/privacy`, and the authorized domain to `menumaterial.com`. Add `https://menumaterial.com` as an **Authorized JavaScript origin**. Add other origins only if they actually serve the sign-in page. This integration uses Google's popup JavaScript callback; no redirect URI or client secret is used. Basic `openid`, `email`, and `profile` authentication is sufficient; no Gmail or Drive permissions are needed. Complete Google's branding/domain verification if requested by the console.

Set the public runtime value `GOOGLE_CLIENT_ID` to the issued `….apps.googleusercontent.com` ID and redeploy. Without it, the Google option stays hidden and the server refuses Google sign-in. Test with the real Google account on the configured origin before opening it to customers.

The backend verifies Google's signature, issuer, audience, expiration, verified email, and a browser-bound nonce. Proofs expire after 10 minutes, are consumed once, and never persist Google's raw token. Returning users are identified by Google's stable `sub`, not email. Matching existing emails require the current Menu Material password before linking; linking preserves the same restaurant, role and credits. Each account can link one Google identity. Newly created Google accounts have no usable password, receive the normal free allowance, and can set a password using email recovery. Non-Gmail/non-Workspace Google identities must first create a password account and confirm its password to link. Administrator invitations and reset links continue through the existing email flow.

Validation: `npm run test:google-auth` exercises signed-token verification, browser binding, replay/expiry, concurrent completion, account linking, free-account limits, and password recovery. Google's real popup requires a configured client and an interactive account sign-in.

### Password recovery

**Sign in → Forgot password** requests a one-use email link. Enable delivery by setting `RESEND_API_KEY` (a server secret), `PASSWORD_RESET_FROM` (for example `Menu Material <accounts@menumaterial.com>` on a Resend-verified domain), and the public HTTPS `APP_ORIGIN`. Configure SPF/DKIM in the domain's DNS using the records from Resend; disable click/open tracking for recovery emails. See [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction) and [the sending API](https://resend.com/docs/api-reference/emails/send-email). No new authentication provider or database migration is required. Without this configuration the form explains that email recovery is unavailable; administrator-issued links still work.

Email links expire after 30 minutes. Only their SHA-256 hashes are stored in the existing `invites` table. Requests are limited per network (10 per 15 minutes) and per address (3 per hour), with the same public response for existing and unknown accounts. Lookup and delivery run through the Worker's `waitUntil` helper. Delivery failures revoke the undelivered link and produce a sanitized error report. Requests do not change passwords or cancel earlier emailed links; redeeming one changes the scrypt hash, closes all previous sessions, and voids every other reset link. The page removes the link credentials from the address bar after reading them.

Run `npm run test:password-reset` for isolated recovery tests. Before calling delivery live, verify the sender and exercise a real inbox: request a link, set a new password, confirm the old password/session and reused link fail. This provider/inbox check requires configured credentials; test fixtures do not establish deliverability.

## One restaurant look

In **Restaurant settings**, choose one of six complete restaurant looks, preview it across photos, menus and Instagram designs, and fine-tune its colors, typography or photographic style. Applying the look to new work is part of Pro; on Free it is saved and previewed, and new work uses neutral defaults. **Start new creations with this look** controls automatic use. New photos use the saved look as their first recommendation. New posts inherit the palette and typography across template changes, with individual overrides available. Digital and printed menus use the same branding. Existing post drafts keep their saved design; published menus update only on republish. Saving a finished Photo Studio result as the restaurant look also stores its lighting, surface, plate, angle and composition choices.

## Menus and privacy

Save dishes, including prices and availability, then organize them into menu sections. Save draft, preview, publish, republish, or unpublish. Copy the menu link or download its QR code after publishing. Photos are optional and must be approved for the corresponding dish. Menu prices are stored as integer hundredths of the selected currency.

Published menus read a snapshot; updates to shared dish records do not change a live menu until republishing. Public asset routes only serve assets referenced by the current published snapshot, backed by a separate `public/` object copy. Source uploads, normalized references, generated versions, drafts, and captions require the restaurant's authenticated session. Deleting an image removes its menu references and denies further delivery. Previously downloaded customer copies cannot be recalled.

Anonymous customer access requires **public** access at the hosting boundary; the workspace itself still requires a signed-in restaurant account. The sharing panel checks the published JSON endpoint without owner credentials and confirms whether guests can open it. It offers a stable link, high-resolution QR download, a branded 4 × 6 inch table-card PDF, native link sharing, and an explicit take-offline action. Table cards use the published restaurant look. Public menu responses exclude private photographic prompts, reference IDs and restaurant brand notes.

Post Maker prepares reviewed PNG files before the Share tap to preserve mobile share-sheet activation. Choose a post (4:5 or tall 3:4), Story or carousel, copy the caption, then share files or download individual images. Story text and logos stay clear of Instagram's own controls. Unsupported sharing falls back to saving. HEIC uploads try the device decoder first and then the bundled converter; originals are retained. Physical iPhone/Android camera capture, HEIC variants and Instagram handoff remain device-validation tasks.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The integration suites pass 240 API/timezone checks and 18 post-flow assertions, plus explicit persistence and flow assertions. The original suite contains 89 API assertions and creates and removes its own temporary database and object store. It checks invitation reuse and email matching, password reset/session revocation, tenant isolation, upload privacy, photo approval, atomic allowance reservations, concurrent idempotency, partial-success refunds, revisions, editable captions, immutable published menus, republishing, unpublishing, deletion from menus, and cross-origin write rejection.

Provider HTTP calls are deterministic test fixtures in the test process only. Live API calls, real image quality, HEIC conversion across iPhone variants, phone download behavior, background job latency, and actual provider billing require connected-device pilot testing. The expansion’s core browser flow and representative phone/desktop/export views are verified in isolated local tests. The older WebMCP helper has not been fully verified. See `docs/PILOT_VALIDATION.md` for the launch checks.

## Deployment

`npm run build` creates a Cloudflare-compatible Worker and client assets. The retained Sites manifest declares the `DB` and `BUCKET` bindings; Sites provisions them and applies the checked-in Drizzle migrations. The Node SQLite adapter is excluded from the production build. Do not copy `.local-data/`, `.env`, or local test sessions into production.

`next.config.ts` sets two things for every environment. `experimental.serverActions.bodySizeLimit` is 32 MB: the app has no server actions, but vinext applies that limit to every multipart POST before the route handler runs (1 MB by default), so it must stay above the 30 MB upload cap. Its `headers()` send `nosniff`, a strict referrer policy, a Permissions-Policy that turns off camera, microphone and geolocation, and HSTS on every route, and refuse framing everywhere except guest menus (`/m/…`, which restaurants may embed) and imported menu originals under `/api/imports/` (shown in a same-origin frame). There is no script-src policy because pages carry inline React Server Components scripts. Set `APP_ORIGIN` so canonical links, link previews and the sitemap use your public address; without it they use the request's host.

Configure secrets through the hosting provider, deploy the saved build, bootstrap the admin, and run the background worker against the hosted origin. Stripe billing for Pro is on only when `STRIPE_BILLING_ENABLED=true` and `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` and `APP_ORIGIN` are all set; otherwise Pro shows as coming soon ([Free and Pro plans](docs/FREE_PRO_PLANS.md)). Set the contact and legal details below before opening signup. There is no order processing, POS integration, automatic social publishing, inventory management, full staff accounts, or native app. Staff use expiring upload-only links; ordering links point to the restaurant’s existing ordering service.

## Contact, Terms and account deletion

Four server settings hold details only the owner can supply. A setting shows nowhere until it is set, and pages keep their earlier wording until then.

- `SUPPORT_EMAIL`: the footer's Contact link, the `/contact` page (what to include in a message, and how to report a guest menu), the privacy page, the pricing questions, sign-in (email for a secure reset link), the error page and the account-deletion message. Unset, `/contact` is a 404 and isn't in the sitemap.
- `SITE_OPERATOR`: the operator's legal name and postal address, on `/contact` and the privacy page.
- `TERMS_URL`: where the owner's Terms of Service are published. `/terms` redirects there (a 404 until it is set) and is linked from the footer, a consent line under signup ("By creating an account you agree to the Terms and the Privacy policy"), beside Get Pro and in Stripe Checkout.
- `REFUND_POLICY_URL` (optional): linked beside Get Pro, in the pricing questions and in Stripe Checkout. Without it, the Terms are linked for refunds.

The Terms and any refund policy are the owner's own documents; the site only links to them. Beside Get Pro and under Stripe Checkout's pay button, the site states what the code does: Pro renews monthly until cancelled, and cancelling in Plans → Manage billing keeps Pro to the end of the paid month. Checkout doesn't require Terms consent: `consent_collection[terms_of_service]` also needs the Terms URL in Stripe's own settings.

Owners delete their account in Settings → Details, and administrators can from Administration. A live subscription (active, past due, unpaid, trialing, incomplete or paused) must be cancelled first. Otherwise, with billing on, deletion expires any open checkout and deletes the Stripe customer (Stripe keeps its invoices), then removes the billing rows with the rest of the account; if Stripe can't be reached, nothing is deleted. With billing off, the last known subscription state decides and Stripe isn't contacted, so any customer left in Stripe must be deleted in its dashboard.

## Project map

- `app/page.tsx`: the homepage; signed-out visitors get the server-rendered marketing page, and `app/components/home-client.tsx` opens the guest Photo Studio or the signed-in workspace (Photo Studio, My Dishes, Menus, Post Maker, Explore, settings and administration)
- `app/components/`: accessible dialogs and customer menu
- `app/api/[...path]/route.ts`: authenticated API entry
- `lib/server/api.ts`: account, dish, file, caption, menu, and admin operations
- `lib/server/generation.ts`: durable image job dispatch and recovery
- `lib/server/core.ts`: authorization, storage helpers, sessions, and limits
- `db/schema.ts` and `drizzle/`: shared model and migrations
- `lib/local-runtime.ts`: local SQLite and object-storage adapter
- `tests/integration.mjs`: isolated core-flow checks

The inspiration photo is by [Adrian Vieriu on Pexels](https://www.pexels.com/photo/pasta-on-a-plate-11654225/) under the [Pexels license](https://www.pexels.com/license/). It is labeled as a real inspiration photo. The hero burger is [“Burger” by cyclonebill](https://commons.wikimedia.org/wiki/File:Hamburger_(5).jpg) on Wikimedia Commons, under [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/); its studio version is an AI edit of that photo, shared under the same license (`docs/burger-image-provenance.json`). The style gallery's cheesecake is [by Pilauricey](https://commons.wikimedia.org/wiki/File:Carnegie_Deli_Strawberry_Cheesecake.jpg), under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The original and studio-styled comparison is a clearly labeled illustrative AI edit, generated for this design demonstration. It is not a benchmark or a verified result from the live pilot API. Food textures can change, so owner review remains required. See `docs/MENU_MATERIAL_DESIGN.md` for the asset record and prompt.

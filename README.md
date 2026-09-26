# Menu Material food photography and promotion

Menu Material is the restaurant promotion workspace in this codebase. Signup is open: each new account starts with five free images, and administrators can also send email-bound invitations with their own image allowance. It includes saved restaurant styles, a dish library, coordinated special and offer packages, private uploads, image versions, approvals, captions, menu imports, batch recovery, staff photo links, weekly suggestions, and engagement measurement.

Visitors can prepare a photo before signing up; Generate image opens account creation with five free generations. Pro is $9/month for 50 image generations per paid billing period. The hosted site uses the existing live Stripe price; see [Free and Pro plans](docs/FREE_PRO_PLANS.md) for the flow, credit rules and setup.

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

Flare is the selected image provider; its food fidelity, latency, and cost still require a live pilot. New jobs request JPEG at 95% quality for faster delivery, retaining the existing delivery, social, and menu dimensions. Model, rendering quality, format, and dimensions are saved with each job so configuration changes cannot alter a queued request. Previously submitted PNG jobs still recover normally. Your API account must have access to the configured models. Calls can incur provider charges even though the pilot is free to restaurants. See [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation).

Without a key, AI buttons explain that the service is disconnected. Saving dishes, uploading photos, writing captions manually, approving source photos, and building menus still work. No mock generation is presented as a live result.

`IMAGE_COST_ESTIMATE_USD` is an optional per-completed-image estimate for the admin dashboard, not an invoice amount. Raw provider usage is retained per output, caption, menu import and cached photo analysis. Failed or ambiguous provider calls can have provider costs; review those records against invoices. The dashboard tracks approved images, failures, reservations, and manually logged support time.

## Background worker and recovery

Set a strong `JOB_RUNNER_SECRET` in both the app and a trusted worker process:

```sh
npm run worker
```

The worker polls the protected `/api/internal/tick` endpoint every two seconds. A check that starts an image stays open for the whole render, so up to four checks overlap and a long render never delays the next one. On a stop signal the worker starts no new checks and lets running image calls finish; a second signal exits at once. `compose.worker.yaml` allows four minutes for that. Set `APP_ORIGIN` to the application origin. A scheduler can instead run `node --env-file=.env scripts/job-runner.mjs --once` once per minute. Run this in a persistent process manager or server scheduler; an ordinary terminal must stay open.

The browser also advances jobs while the workspace is open. Each image call stays open for the whole render, up to 150 seconds. There is no provider job to reconnect to, so whoever makes the call must stay connected. While the worker is healthy, it makes every image call and an open page only refreshes progress, so people can close the page. Without a healthy worker, the open page makes the calls. Closing it leaves a call only a short grace period, so the photo waiting screen asks people to keep the page open. It only tells them they can leave while the worker has checked in within `WORKER_STALE_AFTER_SECONDS` (default 180). **A continuously running worker is required for image creation while all browsers are closed.** The hosting platform does not provision that separate scheduler automatically. Jobs submitted before direct image calls ran as OpenAI background responses; they are still retrieved by their stored response IDs.

**Readiness.** `GET /api/health` is a cheap liveness check. `GET /api/health/ready` checks the database, file storage, the worker heartbeat, the oldest waiting image job (`QUEUE_ALERT_AFTER_MINUTES`, default 10) and the site-wide AI budget, and returns 200 or 503. Point an uptime monitor at it every minute or so. The public response only says `ok` or `degraded` per check; send `Authorization: Bearer <JOB_RUNNER_SECRET>`, or sign in as an administrator, for details. Administration → AI operations shows the same results.

**Alerts.** Set `ALERT_WEBHOOK_URL` to a Slack incoming webhook or a Discord webhook (it receives `{"text": "..."}`). You are alerted when the worker is stale while jobs are waiting (and again when it recovers), when a job has waited past the queue threshold, when today's site-wide AI budget reaches `AI_BUDGET_ALERT_PERCENT` (default 80) and when it is used up (once per UTC day each), and when `ERROR_BURST_COUNT` server errors happen within `ERROR_BURST_MINUTES`. Conditions are checked at most once a minute by the worker's tick, open workspaces and readiness probes, so an uptime monitor still catches a dead worker. Each condition is sent at most once per `ALERT_REPEAT_MINUTES` (default 60). Alert state lives in `app_settings` and `rate_limits`; delivery never delays or fails a request.

**Errors.** Unexpected server errors (5xx), background job dispatch and retrieval failures, and browser errors (posted to `/api/client-errors`) are each written as one JSON log line (`"type":"server_error"`, `"job_error"` or `"client_error"`) with the route, status and restaurant ID, never passwords, tokens, cookies or request bodies. Set `ERROR_WEBHOOK_URL` (defaults to `ALERT_WEBHOOK_URL`) to also receive each distinct error, by message and top stack frame, at most once per `ALERT_REPEAT_MINUTES` and 30 posts an hour.

Each new core request atomically reserves one image unit by default (legacy explicit two-output requests remain supported) using the output records themselves as the allowance ledger. Failed outputs stop counting against allowance; completed outputs keep counting even if the owner deletes them. Revisions create new jobs. Idempotency keys deduplicate repeated requests, including concurrent submissions. Per-output leases prevent duplicate dispatch. For earlier background responses, transient retrieval failures retry using the stored provider ID. An interrupted image call cannot be resumed. It fails at once, its reservation is restored and it is never automatically reissued. Its possible provider cost remains a reconciliation item (`ai_spend` status `uncertain`). An image that arrives while workspace storage is full cannot be fetched again later, so it fails and is not counted.

## Administration

For this private hosted review, the Site owner can select **Sign in → Set up your administrator account**, then choose a restaurant name and password. The one-time bootstrap checks the Sites-authenticated email against `BOOTSTRAP_OWNER_EMAIL` on the server. It becomes unavailable after an administrator exists.

For alternative hosted setup, configure a random `ADMIN_SETUP_KEY` as a server secret, then create the first administrator invitation:

```sh
ADMIN_SETUP_KEY='<server secret>' APP_ORIGIN='https://your-site.example' \
  node scripts/bootstrap-admin.mjs your-email@example.com
```

The command prints a private one-use invitation. Open it, choose a password, and name your restaurant. Remove `ADMIN_SETUP_KEY` after creating the first admin. This command creates an invitation only; it does not send email.

Administrator controls are at the bottom of the workspace. Administrators can create email-bound invitations, set total image allowances, pause generation, log support minutes, and issue one-use password-reset invitations. Invitations expire in seven days. Share them directly with the intended owner. Password resets revoke existing sessions. Passwords are salted with scrypt; sessions and invitation tokens are stored as hashes. Session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.

## One restaurant look

In **Restaurant settings**, choose one of six complete restaurant looks, preview it across photos, menus and Instagram designs, and fine-tune its colors, typography or photographic style. **Start new creations with this look** controls automatic use. New photos use the saved look as their first recommendation. New posts inherit the palette and typography across template changes, with individual overrides available. Digital and printed menus use the same branding. Existing post drafts keep their saved design; published menus update only on republish. Saving a finished Photo Studio result as the restaurant look also stores its lighting, surface, plate, angle and composition choices.

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

Configure secrets through the hosting provider, deploy the saved build, bootstrap the admin, and run the background worker against the hosted origin. Stripe billing for Pro is built but stays off until `STRIPE_BILLING_ENABLED=true` and its Stripe settings are configured ([Free and Pro plans](docs/FREE_PRO_PLANS.md)). There is no order processing, POS integration, automatic social publishing, inventory management, full staff accounts, or native app. Staff use expiring upload-only links; ordering links point to the restaurant’s existing ordering service.

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

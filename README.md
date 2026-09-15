# Plateworthy restaurant promotion pilot

Plateworthy is the existing branding in this codebase (the expansion brief calls the product Plated). It is a free, invitation-only restaurant promotion workspace, capped at 10 restaurant workspaces including outstanding invitations. It includes saved restaurant styles, a dish library, coordinated special and offer packages, private uploads, image versions, approvals, captions, menu imports, batch recovery, staff photo links, weekly suggestions, and engagement measurement.

Start in **Photo Studio**, **Menu Builder**, or **Post Maker**, with **My Dishes** as the shared library. Each tool guides owners from their source material to reviewed, usable output. The overview resumes saved work, Photo Studio offers immediate quick edits, and Post Maker combines dish details, design, formats/caption and review into four stages. Earlier promotion campaigns and pilot tools remain under **More tools**. See [the core experience guide](docs/CORE_EXPERIENCE.md) for the rebuild, validation and connection status, and [the expansion guide](docs/PROMOTION_EXPANSION.md) for retained pilot tools.

## Run locally

Use Node.js **24 or later** and npm. Local development uses SQLite and filesystem storage, so Cloudflare's native runtime is not required on this Mac.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the local URL printed by the server. Select **Sign in → Open local pilot workspace** for a local administrator workspace. This shortcut is available only through the local Vite runtime adapter; it is not included in the production storage adapter. It creates an empty development restaurant and does not seed fictional customer data or AI results.

Local records and uploads live in `.local-data/`, which is excluded from Git. Restarting the app retains them. Generated migrations in `drizzle/` apply automatically to the local database. Set `DISHLIGHT_DATA_DIR` to use a separate local data directory. Back up the SQLite database and objects together.

## Connect image generation and captions

Set `OPENAI_API_KEY` in `.env`, then restart. Keep this key on the server. The default adapter uses OpenAI Responses with background image generation and a text-only caption request. Models are configurable:

- `OPENAI_IMAGE_MODEL`: `gpt-image-2`
- `OPENAI_ORCHESTRATOR_MODEL`: `gpt-6-astra`
- `OPENAI_TEXT_MODEL`: `gpt-4.1-mini`

These are initial integration candidates, not a quality benchmark winner. Your API account must have access to the configured models. Calls can incur provider charges even though the pilot is free to restaurants. See [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation) and [background mode](https://developers.openai.com/api/docs/guides/background).

Without a key, AI buttons explain that the service is disconnected. Saving dishes, uploading photos, writing captions manually, approving source photos, and building menus still work. No mock generation is presented as a live result.

`IMAGE_COST_ESTIMATE_USD` is an optional per-completed-image estimate for the admin dashboard, not an invoice amount. Raw provider usage is retained per output, caption, menu import and cached photo analysis. Failed or ambiguous provider calls can have provider costs; review those records against invoices. The dashboard tracks approved images, failures, reservations, and manually logged support time.

## Background worker and recovery

Set a strong `JOB_RUNNER_SECRET` in both the app and a trusted worker process:

```sh
npm run worker
```

The worker polls the protected `/api/internal/tick` endpoint every five seconds. Set `APP_ORIGIN` to the application origin. A scheduler can instead run `node --env-file=.env scripts/job-runner.mjs --once` once per minute. Run this in a persistent process manager or server scheduler; an ordinary terminal must stay open.

The browser also advances jobs while the workspace is open. Once submitted, OpenAI's background job continues if the browser closes. Durable response IDs allow later retrieval. **A continuously running worker is required for reliable dispatch and result archival while all browsers are closed.** The hosting platform does not provision that separate scheduler automatically.

Each new core request atomically reserves one image unit by default (legacy explicit two-output requests remain supported) using the output records themselves as the allowance ledger. Failed outputs stop counting against allowance; completed outputs keep counting even if the owner deletes them. Revisions create new jobs. Idempotency keys deduplicate repeated requests, including concurrent submissions. Per-output leases prevent duplicate dispatch. Transient retrieval failures retry using the stored provider ID. Ambiguous submissions are never automatically reissued; after 30 minutes their reservations are restored and their unknown provider costs remain a reconciliation item.

## Pilot administration

For this private hosted review, the Site owner can select **Sign in → Set up your pilot administrator account**, then choose a restaurant name and password. The one-time bootstrap checks the Sites-authenticated email against `BOOTSTRAP_OWNER_EMAIL` on the server. It becomes unavailable after an administrator exists.

For alternative hosted setup, configure a random `ADMIN_SETUP_KEY` as a server secret, then create the first administrator invitation:

```sh
ADMIN_SETUP_KEY='<server secret>' APP_ORIGIN='https://your-site.example' \
  node scripts/bootstrap-admin.mjs your-email@example.com
```

The command prints a private one-use invitation. Open it, choose a password, and name your restaurant. Remove `ADMIN_SETUP_KEY` after creating the first admin. This command creates an invitation only; it does not send email.

Pilot admin controls are at the bottom of the workspace. Administrators can create email-bound invitations, set total image allowances, pause generation, log support minutes, and issue one-use password-reset invitations. Invitations expire in seven days. Share them directly with the intended owner. Password resets revoke existing sessions. Passwords are salted with scrypt; sessions and invitation tokens are stored as hashes. Session cookies are HttpOnly, SameSite=Lax, and Secure on HTTPS.

## Menus and privacy

Save dishes, including prices and availability, then organize them into menu sections. Save draft, preview, publish, republish, or unpublish. Copy the menu link or download its QR code after publishing. Photos are optional and must be approved for the corresponding dish. Menu prices are stored as integer hundredths of the selected currency.

Published menus read a snapshot; updates to shared dish records do not change a live menu until republishing. Public asset routes only serve assets referenced by the current published snapshot, backed by a separate `public/` object copy. Source uploads, normalized references, generated versions, drafts, and captions require the restaurant's authenticated session. Deleting an image removes its menu references and denies further delivery. Previously downloaded customer copies cannot be recalled.

**Current hosting access is private.** Anonymous customer access requires public access at the hosting boundary while the app continues to enforce invitation-only workspace authentication. Automatic approval review blocked that hosting audience expansion, so it remains pending user approval. Until then, customer-facing QR codes and links still encounter the hosting platform's private-site gate.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The integration suites pass 231 API/timezone checks and 18 post-flow assertions, plus explicit persistence and flow assertions. The original suite contains 80 API assertions and creates and removes its own temporary database and object store. It checks invitation reuse and email matching, password reset/session revocation, tenant isolation, upload privacy, photo approval, atomic allowance reservations, concurrent idempotency, partial-success refunds, revisions, editable captions, immutable published menus, republishing, unpublishing, deletion from menus, and cross-origin write rejection.

Provider HTTP calls are deterministic test fixtures in the test process only. Live API calls, real image quality, HEIC conversion across iPhone variants, phone download behavior, background job latency, and actual provider billing require connected-device pilot testing. The expansion’s core browser flow and representative phone/desktop/export views are verified in isolated local tests. The older WebMCP helper has not been fully verified. See `docs/PILOT_VALIDATION.md` for the launch checks.

## Deployment

`npm run build` creates a Cloudflare-compatible Worker and client assets. The retained Sites manifest declares the `DB` and `BUCKET` bindings; Sites provisions them and applies the checked-in Drizzle migrations. The Node SQLite adapter is excluded from the production build. Do not copy `.local-data/`, `.env`, or local test sessions into production.

Configure secrets through the hosting provider, deploy the saved build, bootstrap the admin, and run the background worker against the hosted origin. There is no billing, order processing, POS integration, automatic social publishing, inventory management, full staff accounts, or native app. Staff use expiring upload-only links; ordering links point to the restaurant’s existing ordering service.

## Project map

- `app/page.tsx`: studio, library, menu editor, pilot admin
- `app/components/`: accessible dialogs and customer menu
- `app/api/[...path]/route.ts`: authenticated API entry
- `lib/server/api.ts`: account, dish, file, caption, menu, and admin operations
- `lib/server/generation.ts`: durable image job dispatch and recovery
- `lib/server/core.ts`: authorization, storage helpers, sessions, and limits
- `db/schema.ts` and `drizzle/`: shared model and migrations
- `lib/local-runtime.ts`: local SQLite and object-storage adapter
- `tests/integration.mjs`: isolated core-flow checks

The inspiration photo is by [Adrian Vieriu on Pexels](https://www.pexels.com/photo/pasta-on-a-plate-11654225/) under the [Pexels license](https://www.pexels.com/license/). It is labeled as a real inspiration photo. The hero photograph is by [Valeria Boltneva on Pexels](https://www.pexels.com/photo/close-up-photo-of-burger-1639562/), also under the Pexels license. The original and studio-styled comparison is a clearly labeled illustrative AI edit, generated for this design demonstration. It is not a benchmark or a verified result from the live pilot API. Food textures can change, so owner review remains required. See `docs/PLATEWORTHY_DESIGN.md` for the asset record and prompt.

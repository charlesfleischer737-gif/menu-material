# Plated / Plateworthy promotion expansion

## Implementation and daily use

The established Plateworthy branding, React/Vinext application, invitation/password sessions, D1-compatible SQLite model, private object storage and durable generation service are preserved. The expansion adds no production mock provider or seeded customer data.

1. **Reusable restaurant and dish data.** Restaurant settings save a logo, colors, tone, photo style, up to three atmosphere references, timezone, opening hours and an existing ordering link. Dishes retain their category, price, availability, preservation notes, originals, image versions and approvals. New creations inherit the profile; each promotion can override its colors, tone and photo style.
2. **Promote tonight’s special.** Select or create a dish, optionally upload a fresh original, set price/description/availability and choose or create its food image. Review the original and result together. Approve the coordinated package, download clean photos or feed/Story/sign graphics, copy the caption, and separately publish the special to the hosted menu. Text, prices, logo and layout are drawn locally in the export renderer, not generated into the food image. A price change requires review again and never requests another food image.
3. **Preserve my dish.** The generation prompt constrains ingredients, count, portions, plating and packaging, including dish-specific owner notes. References for atmosphere are identified separately from the actual dish. Revisions carry forward the original when it remains available. Description-only generation is retained and labeled. Food changes are not reliably detected automatically; owners remain the final reviewers. Capture assistance detects small images and extreme overall exposure, with conservative retake advice.
4. **Complete the menu.** Upload JPEG/PNG/PDF menus, read them into editable drafts, or enter a draft manually. Reading has a 4 MB / 60-dish limit, missing prices remain blank, and review is required to add records to the library and menu draft. Nothing is published by importing. Upload up to five originals for a selected dish. Generate batches of up to five dishes; durable per-dish records survive refresh. Retry only failed output slots, preserving successful images and their allowance records. Expiring staff links are upload-only, restaurant-scoped and revocable. Their submissions require owner review.
5. **Reusable offers.** The same editor supports lunch combos, family meals, catering and happy hour. Select up to six dishes and explicit quantities. Approved photos appear in separate tiles with accurate quantity labels; the app does not invent a combined photograph or silently multiply portions inside an image.
6. **Weekly assistance and measurement.** Rule-based suggestions use actual available dishes, approved photos, regular prices, opening hours and the chosen goal. They return up to three editable suggestions and never publish. A catering suggestion starts with one menu portion and explicitly asks the owner to adjust quantity and price. Engagement counts menu visits, visible dish views and existing-ordering-link clicks; it does not claim sales attribution.

## Persistence and publication rules

- Promotion drafts are saved to the restaurant database after edits. Pending browser-tab drafts provide recovery during the short save window; the server remains authoritative. Reopening fetches the current saved version. Concurrent edits use revision checks; stale approvals/publications are rejected.
- A promotion stores a separate approved content hash and published snapshot. Draft changes do not alter the published copy. Price or design edits invalidate approval. Changing restaurant name, currency, timezone or logo also invalidates draft approvals. Existing published snapshots remain intact until an explicit publish action.
- Local restaurant times convert to UTC instants on the server. Nonexistent spring-forward times are rejected. The owner can choose the first or second occurrence of repeated fall-back times. New offers use saved opening hours when available.
- Every public menu and public special-image request checks start, end, sold-out state, selected-dish availability and photo approval/deletion. End time is exclusive. Expiry does **not** require a scheduler, browser session or database cleanup. Open customer pages hide expired specials using a server-synchronized clock and refresh every 20 seconds for availability/publication changes.
- Publishing a special without a published menu creates a menu shell with only that special. It does not publish unrelated menu drafts. Sold out, republish and unpublish preserve the restaurant slug and QR destination. Unpublishing the entire menu hides its specials too.
- Staff tokens are random, hashed in the database, expire after seven days and reveal only that restaurant’s dish names and IDs. They cannot read private photos, approve, publish, or submit to another restaurant’s dishes. Submitted `kind` values cannot turn staff uploads into logos or approved images.
- Imports retain their source privately. Reviewed imports are idempotent and append drafts in a database transaction. Interrupted extraction can be retried after two minutes; it is never automatically resubmitted to the provider. Database migrations are additive (`0001`, `0002`).

## Exports and current provider guidance

- Feed: 1080 × 1350 PNG. Story: 1080 × 1920 PNG. Counter sign: 1700 × 2200 PNG tagged at 200 dpi, for 8.5 × 11 inch printing. Both preview and download use the same canvas renderer.
- Clean square and landscape JPEGs contain no logo or promotional text and are not enlarged beyond the source crop. For offers with multiple dishes, these clean exports use the first dish; the other clean images are available from the dish library.
- DoorDash item crops use 1424 × 801 (16:9) with a 2 MB ceiling. Small sources are rejected instead of being enlarged. Keep the entire item visible; crop tools cannot determine that reliably. **Acceptance is not guaranteed.** DoorDash’s official guidance specifies at least 1400 × 800, no text/overlays, and no upscaling; parts of that guidance give different maximum file sizes, so the implementation uses the stricter 2 MB ceiling. [Official DoorDash photo guidance](https://help.doordash.com/en-us/merchants/article/common-rejection-reasons), checked September 15, 2026.
- The existing GPT Image 2 adapter now requests 1536 × 1536 images at medium quality to leave room for the delivery crop. Other configured image models retain the prior 1024-square request. Image 2 processes inputs at high fidelity automatically, so the adapter does not send an unsupported `input_fidelity` setting. [Official image generation documentation](https://developers.openai.com/api/docs/guides/image-generation). Increased output size can affect latency and provider cost; the existing per-output allowance still bounds requests.
- Menu extraction sends actual JPEG/PNG data or PDF file input to the existing configured text/vision model. [Official file-input documentation](https://developers.openai.com/api/docs/guides/file-inputs). Account/model access and OCR quality still need a connected pilot test.

## Measurement definitions

- Active time to approval counts seconds with a visible editor and an interaction in the previous 30 seconds; time in a pending action is excluded. Generation wait is recorded separately from request to archived result, including queue time. Active editing while a background generation is in progress can overlap the generation interval. These measures are not a claim that the two-minute target has been met by real owners.
- First-result acceptance evaluates the first photo request for a dish. An approval before another request counts as acceptance; an explicit rejection or another request makes it reviewed. Untouched results are excluded. Revisions, exports, caption copies, hosted publication and return weeks are recorded separately.
- Customer menu visits, dish views and ordering clicks are deduplicated per browsing session, dish and action. They are engagement signals, not orders. Downloads count prepared exports whose download action was initiated; browser/device completion is not observable.
- No restaurant activity, results, sales, or engagement counts are fabricated. The browser and provider fixtures in tests use a separate temporary database.

## Verification

- `npm test`: 80 existing API assertions and 89 expansion API/timezone checks, plus assertions for persistence, approvals, mutable prices, immutable published copies, exact expiry, DST gaps/folds, fractional timezone offsets, foreign-restaurant denial, staff links, draft imports, engagement deduplication and partial batch recovery.
- `npm run typecheck`: passes.
- Browser checks create a special, change and approve its price, export feed/Story/sign files, explicitly publish, reload and retain the price, check phone overflow, generate weekly suggestions and inspect the customer menu. Desktop (1440 px) and phone (390 px) screenshots plus exported assets were visually inspected.
- Pixel comparison verifies that changing the price changes the export while preserving all photo and branding pixels. Export dimensions are verified separately.
- `npm run lint` is also run. The repository already has 34 lint errors in authentication, the landing page, existing menu/page code, generic row types, local storage adapter and generation helpers. A clean HEAD comparison confirms those pre-existing errors. New expansion modules add no lint errors; non-blocking image and hook warnings remain. This work does not silently change the existing lint rules.

### Repeating browser checks

Use Node 24+, an installed Chrome, and Playwright available either as a package or via `PLAYWRIGHT_MODULE`. Start a separate local preview with an empty data directory; never use a real restaurant database:

```sh
DISHLIGHT_DATA_DIR=/tmp/plated-browser-check OPENAI_API_KEY='' \
  node node_modules/vite/bin/vite.js --port 5174
# In another terminal, with Playwright available:
PLATED_QA_ORIGIN=http://localhost:5174 node tests/browser.mjs
```

Screenshots and files go to ignored `outputs/promotion-qa/`. Tests identify their restaurant as `QA · Orchard Kitchen` and make no live AI requests. API tests create and remove their own temporary storage.

## Specific remaining setup and limits

- The hosted environment currently has model names, application origin and owner bootstrap identity, but **no `OPENAI_API_KEY`**. Add the provider key as a server secret with access to the configured models. Until then, AI image creation, AI captions and automatic menu reading are disabled with a clear message. Uploads, original-photo approvals, manual captions/imports, exports, weekly rule-based suggestions and menu publication work without that key.
- Configure `JOB_RUNNER_SECRET` and run the existing trusted worker against `APP_ORIGIN` for dispatch/recovery while all owner browsers are closed. Hosted secrets alone do not provision a running worker. This requirement applies to image work, not special expiry.
- Hosting currently allows only the Site owner. Customer menu and staff links are implemented but external visitors still meet the hosting access gate. Public hosting access (while retaining app-owned invitation-only owner authentication) is a separate hosting audience change. The current audience is preserved by this update.
- Live image fidelity, provider billing/latency, OCR quality on real menus, HEIC variations and mobile OS sharing/printing still require connected-device pilot validation. No automated food-change detector or delivery-platform acceptance guarantee is claimed.
- POS, payments, inventory, automatic social publication, sales attribution and full staff account management remain outside scope.

# Menu Material launch improvements — September 16, 2026

Implements the selected work from the public-launch audit: 1–4, 7, 8, 10 and 12. The public site remains a controlled early-access pilot. Email delivery is deliberately deferred at the owner's request. No live AI generation, customer-data edits or price changes were used for validation.

## Delivered

- **1 — Acquisition:** homepage calls to action open a working access-request form. Requests are stored once per email and appear in the administrator's review list, with a prepare-invitation action. The existing invitation and password-reset invitation flows remain available. Request confirmations explicitly do not claim that an email was sent. Signup and login retain their existing authentication boundaries.
- **2 — Queue reliability:** new submissions and response recovery have separate processing lanes. Per-restaurant concurrency is two, global active generation is capped at six, and each tick dispatches at most two new outputs with bounded recovery concurrency. Persisted polling backoff prevents constant checks of the same slow response. Atomic claims use the returned current row, protecting against stale response IDs and duplicate submission races. Paused work can still recover a result already submitted. Known response IDs expire after 60 minutes; unknown interrupted submissions after 30 minutes. Failures restore image allowance without pretending that uncertain provider costs vanished. Owners can cancel work that has not started. Photo-guidance failures can be retried after backoff. An external runner is supplied; activation is still pending (below).
- **3 — Operational controls:** administrators can pause all new AI work and adjust daily estimated budgets globally and by restaurant. Every provider POST requires a budget context; image generation, captions, guidance and menu reading reserve against the same atomic budget ledger. Definitively rejected requests release their reservation; uncertain costs stay counted. New work checks current pause state at submission. Upload, import and local-edit requests are rate-limited and buffered only up to their route limit, including chunked requests. JPEG/PNG headers are checked for oversized pixel dimensions without decoding them in the server. HEIC originals remain intact; their normalized JPEG is checked. Storage reservations include historical objects and room for public copies. Deletion releases storage. The runner records a heartbeat and periodically removes expired limits, sessions, reset invitations and abandoned storage reservations.
- **4 — Saved-work recovery:** failed initial loads offer Retry. Failed saves expose Retry, Save my changes as a copy, and Keep a copy & open latest. The latter preserves this window's work before loading the other version. Identical-content retries remain idempotent after a lost save response. Unsaved work has a temporary, account-scoped session backup and an unload warning. Normal persistence remains on the server.
- **7 — Performance with image quality preserved:** lossless responsive hero variants; original full-resolution files retained; authenticated editors/admin are loaded on demand; interactive marketing canvases initialize near the viewport; WOFF2 fonts preserve character maps, widths and outlines; original TTFs remain for exports/tests. Classic guest menus do not emit hidden dish images; featured menus emit only their featured photo. Visible menu images load lazily. Promotion availability checks use bounded batches rather than two database lookups per item. Published base-menu asset authorization avoids rebuilding specials, while keeping access revocation and no-store behavior.
- **8 — Offer and trust:** public pilot, photo-privacy and usage-guideline pages explain included tools, allowances, failure behavior, manual invitations, current help/recovery, AI processing, private drafts, publishing, originals, retention/deletion and platform review. No paid plan, operator identity, testimonials or support email was invented. These factual pages and usage guidelines do not substitute for final reviewed legal terms before a broad launch.
- **10 — Mobile/accessibility:** mobile homepage login stays visible alongside the early-access action. Dark-menu prices have a light, legible foreground; guest menus expose a main landmark. Hours controls use weekday names. Saving changes announce status. Recovery and saved-work actions are keyboard-accessible; mobile menus have explicit button semantics; reduced-motion preferences are honored in the affected surfaces.
- **12 — Saved-work management:** per-tool pages of 30 drafts replace the shared latest-100 ceiling. Direct ID retrieval reopens remembered older work. Drafts support names, search, favorites, duplication, archive and restore, with edited timestamps. Archiving a draft does not unpublish a menu or delete its assets. My Dishes now exposes confirmed photo deletion with the existing server-side cleanup of public references.

## Quality and performance evidence

- `npm test`: 240 existing API/timezone checks, post-flow and catalog assertions, and 83 new launch checks pass. Provider calls are fixtures.
- `npm run test:exports`: 124 PDF/image/export checks pass. The export rendering pipeline and original image files are retained.
- `npm run test:web-assets`: eight checks confirm exact pixel equality against the resized reference at every new display size, plus smaller files.
- Font preparation verifies all character maps, glyph widths and outlines after WOFF2 conversion. Five web fonts total 654,792 bytes versus 2,664,928 bytes for the TTFs (about 75% smaller); canvas demo fonts are also deferred.
- At the 640-pixel display variants, the two hero photos total 752,530 bytes versus 3,251,099 original bytes. The browser selects larger sources for larger or denser screens. The before-photo's original JPEG is used where a lossless WebP would be bigger.
- Production page entry chunk: 28,252 bytes raw / 8,980 gzip. This is the page chunk only, not all initial JavaScript, network transfer or a Core Web Vitals score. Authenticated editors remain available in deferred chunks.
- Type check and the Sites production build pass. Focused lint checks for new standalone server helpers, public pages, canvas module, scripts and tests pass; the repository's previously documented broader lint debt was not part of this change.
- Local browser checks at 390px and 1280px: access request confirmation; authenticated lazy loading; rename/duplicate/archive/restore; forced load failure and successful retry; real revision conflict followed by preserving a copy and reopening the server version; administration controls; public dark-menu contrast and no horizontal overflow. Real iPhone/Android camera/share tests and live food-fidelity testing remain separate audit items.

## Defaults and interpretation

Daily estimated AI budget: **$100 globally**, **$20 per restaurant**, reset at midnight UTC. Per-call reservations: image $2, caption $0.10, analysis $0.10, import $0.50. `AI_*_RESERVE_USD` settings tune these estimates. These controls bound reserved estimated spend, not an exact provider invoice; set conservative values using real usage records. The quality/model/dimension/compression settings are unchanged.

Workspace storage defaults to 2,048 MiB. Reservations conservatively include room for published copies. Existing private objects are accounted for through object metadata before accepting new storage. The new administrator budgets do not charge customers or change their total image allowance.

Database migrations `0005_melodic_saracen.sql` and `0006_boring_maddog.sql` are additive. Previously deployed migrations are unchanged. No existing photos are recompressed or replaced.

## Pending activation

### Email

The owner explicitly deferred a support mailbox and transactional email setup. Access requests are stored for manual review; the existing administrator can create a secure reset invitation. Do not advertise automated reset delivery or a support inbox until those services are configured and tested.

### Always-on background processing

Sites does not provision a scheduler for this app. The protected worker endpoint and ready-to-run process/container are included, but **closed-browser operation is not active until an external runner is configured**. A local desktop process is not a substitute for an always-on service.

1. Choose the always-on host. Use Node 24 or the included `Dockerfile.worker` / `compose.worker.yaml`.
2. Generate an independent, high-entropy `JOB_RUNNER_SECRET`. Set the same secret on the Sites runtime and the runner using their secret-management controls. Do not commit it or paste it into conversation.
3. Set runner `APP_ORIGIN` to `https://menu-material-studio.cflash7.chatgpt.site`. The runner needs only this origin and its runner secret, never the OpenAI API key.
4. Start the container with `docker compose -f compose.worker.yaml up -d --build`, or run `node scripts/job-runner.mjs` under the host's process supervisor. `--once` is available for a scheduler; invoke at least once a minute. The continuous runner checks every two seconds after completion and backs off to one minute during failure.
5. Check Pilot administration for a fresh heartbeat. Verify an actual image completes with every browser closed, then verify the runner restarts after a host restart. Monitor container health / the heartbeat and provider failures externally.

The runner supports graceful shutdown, request timeouts, failure backoff, health checks and bounded logs in the supplied Compose configuration. Do not describe it as activated until steps 1–5 are complete.

## Asset maintenance

`node scripts/prepare-web-images.mjs` rebuilds display variants from the unchanged source images and discards variants larger than the original. `python3 scripts/prepare-web-fonts.py` requires `fonttools[woff]` and rebuilds/verifies the lossless web fonts. Neither is invoked at runtime or changes customer exports.

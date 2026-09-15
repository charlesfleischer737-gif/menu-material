# Core creation experience — September 15, 2026

The existing Plateworthy brand and stack are preserved. The Plated requirements document supplied by the owner guides the core experience.

## What changed

- **Photo Studio:** upload/camera/drop zone, original retention and normalized working image, optional name, no-photo illustration path, destination-first framing, 28 visual presets in seven collections, optional lighting/surface/plate/angle/reference controls, one explicit result, before/after/history, fidelity approval, quick local adjustments saved as separate versions, restaurant look saving, and reuse into menus, posts and clean delivery exports.
- **Menu Builder:** photo/PDF import or manual/saved dishes, explicit content review, Classic text/Photo grid/Featured dish previews, optional sample-first batches, phone and actual PDF previews, A4/Letter PDFs with embedded text/fonts, effective PPI warnings, stable publication and QR. Newer shared dish details are flagged before an older menu draft can overwrite them.
- **Post Maker:** approved dish, showcase/special/combo/event, ten photographic Instagram designs with licensed display fonts, photo-only/minimal/full text controls, optional branding and example/customer previews, independent feed/story framing and simple carousel, editable factual caption starter, optional AI caption, final review, individual PNGs, campaign ZIP and native share when the device supports it.
- **My Dishes:** reusable approved photos, source and version history, editable dish facts, individual/bulk exports, and one-step handoffs. Prior promotion campaigns, staff upload links and other pilot tools remain under More tools.

The expanded photo collections and social designs are documented in [Creative collections](CREATIVE_COLLECTIONS.md).

## Usability refinement

The overview now presents three visual starting points and direct links to the latest useful saved work. Tool navigation survives refresh and browser history. Resuming a specific draft flushes pending edits before loading its current revision.

Post Maker uses four visible stages: **Dish & details → Design → Formats & caption → Save & share**. Existing drafts retain their place. Automatic captions follow confirmed price, date and dish changes; custom wording is preserved and marked for review when facts change. Combo quantities are included, and removing the second dish removes the unavailable carousel format. Caption typing and background state refreshes no longer repaint unchanged image previews.

Photo Studio offers quick edits directly after upload and shows all five stages through review and reuse. Phone layouts have larger inputs and tap targets, a compact progress bar, and a fixed bottom action row.

## Persistence and generation

Creation drafts are stored per restaurant with revision checks. Originals and successful outputs remain private and immutable. Quick edits create new asset records and preserve original identity through an asset lineage table. Browsing looks, adjusting crops, editing layouts/text and exporting do not invoke the image model.

A submission reserves one output by default; legacy explicit two-output requests remain supported. Request keys prevent duplicate jobs. Identical completed jobs are reused within the same restaurant with source, parent, settings, model and pipeline version in their identity. Failed batch slots have bounded explicit retries. A batch must approve its first sample before submitting exactly the selected remainder, using the sample's captured settings.

Optional photo guidance detects a broad family, obvious quality issue and menu documents. Analysis is cached per source/model/pipeline within the restaurant and its raw provider usage is retained. A guidance failure does not prevent ordinary photo editing. Dish owners can correct the category.

New migrations `0003` and `0004` only add creation drafts, edit lineage and batch settings. Existing accounts, dishes, publications, assets, jobs and pilot limits are retained.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 231 API/timezone checks (80 original, 89 expansion, 62 creation), 18 post-flow assertions, plus assertions for one-result default, duplicate submissions, allowance, cache, private approvals, draft conflicts, photo lineage, no-model quick edits, sample failure retry, approved continuation, immutable batch settings, analysis cache/usage and tenant isolation.
- `npm run test:exports`: 57 export checks, including all three menu layouts at A4 and US Letter, embedded-text prices, all ten new post designs and legacy mappings, feed/story dimensions, carousel ZIP contents, and clean delivery JPEG.
- Browser review in an isolated local restaurant: opening saved drafts, original/quick-edit history, visual look and crop steps, keyboard adjustment, photo-to-menu reuse, menu content review/layouts/optional photos, actual PDF canvas preview, publication, factual special caption, channel crop independence, sharing approval and ZIP creation. Phone-width DOM checks found no horizontal overflow. Desktop screenshots and rendered export artifacts were inspected.
- Export fixtures and QA restaurant records are isolated from production. New style images are explicitly labeled reference examples, never presented as generated customer results. Asset prompts are in `STUDIO_IMAGE_PROMPTS.json`.

## Service connection and practical limits

At this release, OpenAI Developers was offered for installation but was still not installed at the final connection check. The hosted `OPENAI_API_KEY` remains unconfigured. Real image creation, automatic menu transcription, automatic photo analysis and AI-written captions therefore show their disconnected state. Original-photo adjustments, manual menus, factual caption starters and exports work without that connection.

Live provider image fidelity, model access, latency and actual billing are not verified by fixture tests. Follow the Sites OpenAI Developers key-setup workflow before live testing. The existing protected job runner also needs its secret and an external persistent scheduler for reliable dispatch and archival while all browsers are closed. Browser polling and persisted response IDs support reopening work; hosting does not automatically provision the external runner.

HEIC conversion and native save/share still require physical phone checks across supported devices. The bundled print font covers its supported scripts; unsupported characters produce a clear print warning rather than silently losing original text. PDFs use safe home-print margins; professional full-bleed printer profiles are not supplied. Social accounts are not connected for automatic publishing. Private Sites access still applies to hosted menu links and QR destinations until the site audience is intentionally changed.

## Delivery profiles

Profiles are versioned in `lib/studio.ts`, last checked September 15, 2026. Delivery JPEGs omit text/logos added by the editor, require the owner to check the whole dish, and reject insufficient crop pixels rather than artificially enlarging them. These profiles assist preparation and do not guarantee platform acceptance.

- DoorDash item photo: 16:9, at least 1400 × 800, maximum 2 MB. [Official guidance](https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained).
- Uber Eats item photo: 3:2 within the recommended 5:4–6:4 range, at least 550 × 440, maximum 10 MB. Creative Hub can impose a separate 5 MB cap. [Official guidance](https://help.uber.com/merchants-and-restaurants/article/merchant-submitted-menu-catalog-photo-guidelines?nodeId=6985355b-0426-4523-94f2-89bb9b0566e9).

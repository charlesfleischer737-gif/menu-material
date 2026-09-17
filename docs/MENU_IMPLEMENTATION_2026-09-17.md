# Menu Studio implementation and validation

The Menu workspace now composes editable restaurant content into seven distinct print and phone designs. The collection includes **Street Kitchen**, a casual food-truck and counter-service design with condensed headings, strong section bars, and highlighted prices.

- [Food-truck example PDF](evidence/menu-food-truck-2026-09-17.pdf)
- [Food-truck example image](evidence/menu-food-truck-2026-09-17.png)
- [Seven-design comparison](evidence/menu-design-collection-2026-09-17.jpg)
- [Measured print results](evidence/menu-design-validation-2026-09-17.json)

Examples use fictional restaurant content. They are layout proofs, not customer menus or claims of customer adoption.

## Delivered

- Named, independent menus with menu-specific wording, prices, visibility, availability, photos, and publication history. Migration preserves the prior public snapshot and existing restaurant QR address.
- Three content-aware recommendations plus the full seven-design collection, actual PDF previews, page navigation, zoom, and direct dish selection in print or phone previews.
- File import, pasted text, and dish-library entry; original-source comparison, retained uncertainty flags, and explicit import confirmation before publication.
- Single prices, named size/price options, market-price labels, included dishes, fixed menu prices, add-ons, section introductions, dietary notes, and footers.
- Measured pagination, complete items, continued section headings, intentional section breaks, one/two-column controls, and page preferences that preserve the text-size floor.
- Shared design tokens, restaurant/custom/designer palettes, typography-only or approved-photo treatments, crop controls, and transparent logos.
- Independent draft saving, browser recovery, revision conflicts, undo/redo, duplication, archival/restoration, and restoration of a prior publication as a private draft.
- Explicit dish-library updates. Editing a saved menu never silently changes other menus or the shared dish facts.
- Reviewed publishing, named guest URLs, a stable restaurant entry point, menu switching, QR images, and table cards. Older guest renderers remain supported until republishing.
- Optional shorter-wording suggestions through the existing OpenAI connection. Suggestions require an explicit Apply action; longer results retain the original. No new API key or model was configured.
- Searchable vector PDF text, embedded fonts, Letter/A4, optional 1/8-inch bleed/crop marks, final cropped-photo resolution warnings, and RGB labeling.
- Background PDF composition on supported browsers, a two-worker limit, shared requests and bounded result caching, full-proof priority, and termination of previews with no remaining viewers. Downloads reuse the exact reviewed PDF. Browsers without worker/canvas support retain the same renderer as a fallback.

## Validation completed

| Check | Result |
|---|---|
| Menu API suite | 67 request checks passed, including atomic migration and retry after a simulated failure, snapshot/source-text privacy, tenant ownership, revision conflicts, stable QR routing, publication and archival recovery, library usage, retired-client write protection, and preserving concise originals. Secondary-menu photos are publicly accessible only after publication; removal prunes drafts, publications, and history and can be retried. Concurrent publication and photo-removal regressions preserve newer main-menu choices. Each newly fixed failure was reproduced against its prior implementation. |
| Print fixture matrix | 42 compositions passed: seven styles × 12/30/60 dishes × Letter/A4. Every visible dish appears exactly once. Text bounds, measured text collisions, heading placement, and the readability floor are checked. |
| Longer content | Seven additional design cases passed with long restaurant names, section names, dish names, and fixed-price labels. |
| Production output | Crop-adjusted low-resolution warnings, 300-PPI raster dimensions, transparent logo alpha, continuous masthead bleed, trim/bleed dimensions, price variants, add-ons, page breaks, and unsupported-character diagnostics passed. |
| Preview work | Queue tests verify bounded work/cache, independent subscribers, cancellation, priority, and retry. A real worker-thread harness composes a 30-item photographic print-shop menu with identical layout, warnings, and page count; it checks worker reuse, termination, recovery, export reuse, fallback, and review gating. Browser checks cover all seven picker previews and download of the reviewed print-shop proof without console errors. |
| Full existing regression suite | `npm test` passed, including restaurant isolation, imports, image/privacy controls, quota/idempotency, plans, saved work, and Photo Studio behavior. Provider responses in this suite are fixtures. |
| Type checking and new-module lint | Type checking passed. New modules have no lint errors; the five existing-pattern native-image notices remain. |
| Production build | Sites/vinext build passed. Existing large-chunk and route-classification advisories remain. |
| Browser workflow | Pasted import review, full design selection, phone preview, decimal price editing, explicit library saving, wording Apply/Undo, local publication, guest access/QR, publication restoration, and PDF export exercised. |
| Phone view | Street Kitchen inspected at 320, 390, and 430 CSS pixels with no page-width overflow; descriptions/prices are 16 px and section controls at least 44 px tall. Guest search passed. |
| Live AI connection | Two small synthetic wording requests succeeded using the already configured API key. No customer content was sent. |

The measured local PDF runs averaged about 178 ms, with a 558 ms maximum in the recorded matrix. This measures local composition/export, not full phone-device interaction latency or a customer performance SLA.

## Remaining field validation and deliberate scope

Physical paper/color proofs, text-only browser enlargement, broader physical-device coverage, and the five-owner in-service pilot remain to be performed. No restaurant adoption, task-time target, or physical-print quality has been claimed as validated.

AI reference interpretation, translations, scheduled publication, and printer-specific CMYK/PDF-X output are later work. Recommendations currently use deterministic content/purpose rules; layout and routine editing work without an AI call. Unsupported print characters are diagnosed instead of silently substituted. Worker cancellation stops in-progress composition; the fallback checks cancellation between asynchronous stages but cannot interrupt synchronous JavaScript already running. The worker harness uses a canvas adapter and does not establish physical-device latency.

The software is ready for review and the first owner pilot. Broader rollout should follow the pilot and physical-print checks described in the [original plan](MENU_FEATURE_PLAN_2026-09-17.md).

## Requirement audit

| Plan requirement | Current evidence and remaining gate |
|---|---|
| Distinct professional compositions, including casual service | Seven measured designs and an actual one-page Taco Local food-truck proof are delivered. Visual evidence is linked above. Physical print/color review remains open. |
| Correct structured content and legible pagination | The 42-case print matrix, seven long-content cases, and mixed-price/photo cases pass. Every style has generic dinner coverage; purpose-specific café, wine, and tasting-menu examples are not yet a complete visual benchmark set. |
| Guided generation and routine editing | Import review, purpose/paper/page brief, three recommendations, full collection, all-page inspection, print/phone editing, undo, export, and reviewed publication are delivered and exercised. Owner task-time targets have not been measured. |
| Independent menus and safe migration/publication | API checks cover menu-specific edits, exact legacy public snapshots, atomic migration, named URLs, primary routing, recovery, privacy, and concurrent changes. These are automated/local results, not production usage observations. |
| Phone accessibility and responsiveness | Street Kitchen passed the documented widths and readable-content checks. Text-only 200% enlargement, the full style/purpose/device matrix, and screen-reader review remain open. Local PDF timings do not establish browser/device latency. |
| AI-assisted design and wording | Existing extraction and reviewed shortening use the configured connection. Deterministic recommendations work without AI. Optional visual-reference interpretation and translations remain unimplemented; no broader AI design capability is claimed. |
| Efficient preview architecture | Shared prepared-PDF caching, debounce, a bounded worker queue, and cancellation of already-running worker computation are delivered. Browser checks and the worker harness pass; timing on an agreed ordinary device remains open. |
| In-service validation | Five owner trials, physical print proofs, initial/repeat task timings, and evidence of return use remain external release gates. No owners have been recruited or contacted by this task. |
| Public release | The owner approved public publication and the seven-design release was confirmed live on September 17. Subsequent refinements follow the same validation and publishing process. |

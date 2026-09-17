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

## Validation completed

| Check | Result |
|---|---|
| Menu API suite | 57 request checks passed, including migration, snapshot privacy, source-text privacy, tenant ownership, revision conflicts, stable QR routing, publication recovery, archival recovery, library usage, retired-client write protection, and preserving concise originals. A concurrent publication/main-menu regression fails against the previous implementation and passes with transaction-time routing. |
| Print fixture matrix | 42 compositions passed: seven styles × 12/30/60 dishes × Letter/A4. Every visible dish appears exactly once. Text bounds, measured text collisions, heading placement, and the readability floor are checked. |
| Longer content | Seven additional design cases passed with long restaurant names, section names, dish names, and fixed-price labels. |
| Production output | Crop-adjusted low-resolution warnings, 300-PPI raster dimensions, transparent logo alpha, continuous masthead bleed, trim/bleed dimensions, price variants, add-ons, page breaks, and unsupported-character diagnostics passed. |
| Full existing regression suite | `npm test` passed, including restaurant isolation, imports, image/privacy controls, quota/idempotency, plans, saved work, and Photo Studio behavior. Provider responses in this suite are fixtures. |
| Type checking and new-module lint | Type checking passed. New modules have no lint errors; the five existing-pattern native-image notices remain. |
| Production build | Sites/vinext build passed. Existing large-chunk and route-classification advisories remain. |
| Browser workflow | Pasted import review, full design selection, phone preview, decimal price editing, explicit library saving, wording Apply/Undo, local publication, guest access/QR, publication restoration, and PDF export exercised. |
| Phone view | Street Kitchen inspected at 320, 390, and 430 CSS pixels with no page-width overflow; descriptions/prices are 16 px and section controls at least 44 px tall. Guest search passed. |
| Live AI connection | Two small synthetic wording requests succeeded using the already configured API key. No customer content was sent. |

The measured local PDF runs averaged about 178 ms, with a 558 ms maximum in the recorded matrix. This measures local composition/export, not full phone-device interaction latency or a customer performance SLA.

## Remaining field validation and deliberate scope

Physical paper/color proofs, text-only browser enlargement, broader physical-device coverage, and the five-owner in-service pilot remain to be performed. No restaurant adoption, task-time target, or physical-print quality has been claimed as validated.

AI reference interpretation, translations, scheduled publication, printer-specific CMYK/PDF-X output, and a dedicated preview worker are later work. Recommendations currently use deterministic content/purpose rules; layout and routine editing work without an AI call. Unsupported print characters are diagnosed instead of silently substituted. The preview cache shares prepared PDFs and ignores superseded results, but in-progress PDF computation itself is not cancelled.

The software is ready for review and the first owner pilot. Broader rollout should follow the pilot and physical-print checks described in the [original plan](MENU_FEATURE_PLAN_2026-09-17.md).

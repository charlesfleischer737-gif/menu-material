# Core creation experience — September 15, 2026

The existing Plateworthy brand and stack are preserved. The Plated requirements document supplied by the owner guides the core experience.

## What changed

- **Photo Studio:** a guided upload → three recommended styles → create flow, with camera/drop zone, original retention and normalized working image, optional name, no-photo illustration path, 28 visual presets in seven optional collections, optional framing/lighting/surface/plate/angle/reference controls, one explicit result, before/after/history, fidelity approval, quick local adjustments saved as separate versions, restaurant look saving, and reuse into menus, posts and clean delivery exports.

Photo generation preserves the food’s identity, ingredient counts, portion and arrangement while rebuilding the scene in the chosen style. New photos default to **Match the style** for serving ware; **Keep my plate** and **Change to a simple white plate** remain explicit overrides. The legacy `As shown` surface/lighting values mean the chosen style card, not the uploaded photograph. Takeout styling retains the actual packaging. Existing drafts and saved plate choices are preserved; selecting a preset again adopts its new defaults. The generation pipeline version was advanced to avoid returning results cached with the former preservation-heavy prompt. Prompt and API regression checks use fixtures; the new prompt has not yet been validated with live image generation.

Drink photographs retain the original glass, cup, bottle or can and its visible branding, liquid level, foam/head, layers, ice and garnish. This exception applies across all styles, including saved looks and plate overrides, while allowing a complete background and lighting change. All Beverage and Bar & Lounge prompts reinforce it. Revisions use the original upload to recover glass or branding details lost in an earlier result. Existing product logos are permitted; invented logos and branding copied from atmosphere references are prohibited. The pipeline version advances again so prior cached outputs do not bypass this update. Exact logo reproduction still requires visual review of the generated result.
- **Menu Builder:** photo/PDF import or manual/saved dishes, explicit content review, Classic text/Photo grid/Featured dish previews, optional sample-first batches, phone and actual PDF previews, A4/Letter PDFs with embedded text/fonts, effective PPI warnings, stable publication and QR. Newer shared dish details are flagged before an older menu draft can overwrite them.
- **Post Maker:** approved dish, showcase/special/combo/event, ten photographic Instagram designs with licensed display fonts, photo-only/minimal/full text controls, optional branding and example/customer previews, independent feed/story framing and simple carousel, editable factual caption starter, optional AI caption, final review, individual PNGs, campaign ZIP and native share when the device supports it.
- **My Dishes:** reusable approved photos, source and version history, editable dish facts, individual/bulk exports, and one-step handoffs. Prior promotion campaigns, staff upload links and other pilot tools remain under More tools.

The expanded photo collections and social designs are documented in [Creative collections](CREATIVE_COLLECTIONS.md).

## Usability refinement

The overview now presents three visual starting points and direct links to the latest useful saved work. Tool navigation survives refresh and browser history. Resuming a specific draft flushes pending edits before loading its current revision.

Post Maker uses four visible stages: **Dish & details → Design → Formats & caption → Save & share**. Existing drafts retain their place. Automatic captions follow confirmed price, date and dish changes; custom wording is preserved and marked for review when facts change. Combo quantities are included, and removing the second dish removes the unavailable carousel format. Caption typing and background state refreshes no longer repaint unchanged image previews.

New accounts without food photos land directly in Photo Studio. Its three visible stages are **Upload a photo → Choose a style → Create & review**. Upload advances automatically to three existing style presets, chosen by food family and intended use. The optional photo analysis can improve the suggestions without delaying the flow; it cannot override a chosen style, manual fine-tuning, or a submitted request. Browsing the full 28-style catalog and adjusting framing remain optional. Existing saved drafts keep their original internal step numbers and resume normally.

The upload screen includes a labeled, interactive before/after example and simple photo tips. The three style photographs sit beside a persistent original-photo summary and Create action on desktop. The full catalog remains one click away; format and fine-tuning are grouped inside “Make it your own.” Phone layouts use stacked photo cards, readable text, large tap targets, a compact progress bar and a bottom Create action with its image allowance visible.

Creation shows the actual queue or processing state with the original and chosen style, without a simulated countdown. Result review opens with a draggable, keyboard-accessible comparison of the full original and edited images. Individual original/result views and zoom remain available. After naming and fidelity approval, “Save & download” saves the image and starts its download in one action; delivery exports still require the full-dish crop check. Quick adjustments must be saved as a new version first. If a download fails after approval, the approved photo remains in My Dishes and the download can be retried.

## Restaurant look and customer sharing

Restaurant settings now include a visual preview, brand and accent colors, three typography choices, all 28 photographic presets, and an explicit automatic-look setting. Saving a finished studio result stores its references and photographic controls and turns on automatic use. New uploads show that saved look first without later analysis overriding it. New posts preserve the saved palette when changing templates; custom typography and color overrides remain available. Restaurant look changes do not overwrite existing post drafts. Digital menus and embedded-font print PDFs use the selected typography, primary color and accent.

Published menus have a stable guest URL, downloadable 1,000 px QR code, native link sharing and a take-offline action. A server check requests the public menu endpoint with no owner credentials or redirect following; a failed check never claims guest access. Public menu data excludes photo-style prompts, private reference IDs and brand notes. Drafts, source images, settings and publishing actions remain authenticated. Guest access also requires the Sites audience to be public.

Post Maker's final step prepares reviewed PNG files before the share tap, offers feed/Story/carousel selection, caption copying and native sharing where supported, and keeps individual image downloads as the fallback. It never automatically posts to social accounts. Upload normalization tries native HEIC decoding before conversion and retains the original. Download object URLs remain available long enough for mobile save dialogs.

### Restaurant look and sharing refinement

The look editor offers six complete, editable brand starting points. Each combines a distinct photographic style, palette and typography. The preview switches between the style reference, actual menu layout and actual social renderer; approved customer photos are used when available and sample content is labeled. A categorized photo gallery, editable hex colors, and one-step undo replace the text-only photo picker. Bright brand colors get readable heading ink on light menus.

Menu sharing separates links for online use from a branded 4 × 6 inch table-card PDF and a standalone QR PNG. Cards use the published restaurant name and style, keeping private draft changes out of printed materials. Guest checks can be repeated and show their check time. Post sharing uses format cards, prepared-file thumbnails and sizes, caption-copy completion, a selectable-text fallback, separate rendering/action errors, and format-specific Instagram guidance. Carousel slides can also be saved with the caption as a ZIP. Prepared files are cached by visual content; caption edits do not rerender images.

Validation includes the existing API/privacy suites, brand-bundle schema checks, export identity checks, published-snapshot isolation, and 124 PDF/image export checks. All three branded QR card PDFs were rendered; dimensions, text, links, and long-name bounds were checked. A rendering defect in variable-font PDF embedding was fixed with bundled static print-font instances, also used for printed menus. No new physical-phone or Instagram-app validation was performed.

## Persistence and generation

Creation drafts are stored per restaurant with revision checks. Originals and successful outputs remain private and immutable. Quick edits create new asset records and preserve original identity through an asset lineage table. Browsing looks, adjusting crops, editing layouts/text and exporting do not invoke the image model.

A submission reserves one output by default; legacy explicit two-output requests remain supported. Request keys prevent duplicate jobs. Identical completed jobs are reused within the same restaurant with source, parent, settings, model and pipeline version in their identity. Failed batch slots have bounded explicit retries. A batch must approve its first sample before submitting exactly the selected remainder, using the sample's captured settings.

Optional photo guidance detects a broad family, obvious quality issue and menu documents. Analysis is cached per source/model/pipeline within the restaurant and its raw provider usage is retained. A guidance failure does not prevent ordinary photo editing. Dish owners can correct the category.

New migrations `0003` and `0004` only add creation drafts, edit lineage and batch settings. Existing accounts, dishes, publications, assets, jobs and pilot limits are retained.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 240 API/timezone checks (89 original, 89 expansion, 62 creation), 18 post-flow assertions, plus assertions for one-result default, duplicate submissions, allowance, cache, private approvals, draft conflicts, photo lineage, no-model quick edits, sample failure retry, approved continuation, immutable batch settings, analysis cache/usage and tenant isolation.
- `npm run test:exports`: 124 export checks, including all three menu layouts at A4 and US Letter, embedded-text prices, all ten new post designs and legacy mappings, feed/story dimensions, carousel ZIP contents, and clean delivery JPEG.
- Browser review in an isolated local restaurant: opening saved drafts, original/quick-edit history, visual look and crop steps, keyboard adjustment, photo-to-menu reuse, menu content review/layouts/optional photos, actual PDF canvas preview, publication, factual special caption, channel crop independence, sharing approval and ZIP creation. Phone-width DOM checks found no horizontal overflow. Desktop screenshots and rendered export artifacts were inspected.
- Additional browser checks: restaurant-look settings save with blank opening hours; JPG upload selects the saved look; menu publication confirms anonymous access; template changes retain restaurant typography and colors; reviewed post download works; Story files prepare independently. Menu and post sharing fit a 390 px viewport without horizontal overflow or broken preview images. Physical phone camera and Instagram handoff were not available for this validation.
- Export fixtures and QA restaurant records are isolated from production. New style images are explicitly labeled reference examples, never presented as generated customer results. Asset prompts are in `STUDIO_IMAGE_PROMPTS.json`.

## Service connection and practical limits

OpenAI Developers is installed, and the owner's existing API key is stored as a hosted secret. The live site's state endpoint confirmed the connection. GPT Image 2.5 Flare at high quality completed one real burger edit through the app's generation code in 31 seconds; JPEG storage, review approval and download were verified in an isolated local restaurant. That single result is not a latency or fidelity guarantee across dishes.

Fixture tests do not measure live image quality or billing. Wider food-fidelity, latency and cost testing remains a pilot task. The existing protected job runner also needs its secret and an external persistent scheduler for reliable dispatch and archival while all browsers are closed. The creation screen asks users to keep the tab open; persisted response IDs support reopening work. Hosting does not automatically provision the external runner.

HEIC conversion and native save/share still require physical phone checks across supported devices. The bundled print font covers its supported scripts; unsupported characters produce a clear print warning rather than silently losing original text. PDFs use safe home-print margins; professional full-bleed printer profiles are not supplied. Social accounts are not connected for automatic publishing. The sharing panel checks anonymous menu access; private hosting gates are reported instead of being mistaken for a working guest link.

## Delivery profiles

Profiles are versioned in `lib/studio.ts`, last checked September 15, 2026. Delivery JPEGs omit text/logos added by the editor, require the owner to check the whole dish, and reject insufficient crop pixels rather than artificially enlarging them. These profiles assist preparation and do not guarantee platform acceptance.

- DoorDash item photo: 16:9, at least 1400 × 800, maximum 2 MB. [Official guidance](https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained).
- Uber Eats item photo: 3:2 within the recommended 5:4–6:4 range, at least 550 × 440, maximum 10 MB. Creative Hub can impose a separate 5 MB cap. [Official guidance](https://help.uber.com/merchants-and-restaurants/article/merchant-submitted-menu-catalog-photo-guidelines?nodeId=6985355b-0426-4523-94f2-89bb9b0566e9).

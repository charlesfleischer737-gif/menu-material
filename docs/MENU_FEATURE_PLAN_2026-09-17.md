**Menu feature review and product plan**

September 17, 2026. Assessment of the current local implementation and freshly regenerated menu exports. Recommendations and acceptance targets below are proposed, not validated customer outcomes.

The Menu feature has a useful foundation, but its output does not yet justify a broad promise of professional menu design. My recommendation is to make the product responsible for composing a finished menu from the restaurant's content, identity, and intended use. Owners should be able to choose a strong result, make routine edits, and confidently print or publish it.

The first target should be independent restaurants and cafés with roughly 15–60 items, usually needing a printed menu and a readable phone menu. Start with Letter/A4 dinner, brunch, and café menus. Validate that focus with restaurant owners before expanding into additional formats.

The current implementation already provides manual entry, reuse from My Dishes, photo/PDF import with source comparison and uncertainty flags, contextual dish editing, section reordering, bulk price changes, four designs, photo controls, actual PDF previews, embedded fonts and searchable text, pagination, resolution warnings, saved drafts, public snapshots, stable links, QR codes, and table cards. Large guest menus have section navigation and search. These are worth retaining. The earlier September 16 review's five-step workflow and missing import comparison are no longer accurate descriptions of this version.

The remaining weaknesses are concentrated in the following areas.

| Finding | Current evidence | Consequence for an owner |
|---|---|---|
| The designs have a narrow visual range. | Fresh exports show Brasserie, Atelier, and Counter Club sharing a dark copper-textured masthead. Paper textures and cream reading surfaces recur across the collection. | The restaurant's identity can feel secondary to the product's house style. The collection needs stronger differences in typography and page architecture. |
| Composition is driven by fixed rules. | The renderer selects columns by design/item counts and estimates column balance. There is no target page count or page-break control. The same 12-dish fixture produces one page in three designs and two in Atelier. | A design can unexpectedly change paper use. Two pages can be appropriate, but that should be an intentional choice visible before selection. |
| The hierarchy favors decoration over reading. | Print prices and descriptions are generally 9.5 pt. The first-page header is at least 130–164 pt without a photo, and often 225–252 pt with one. | Large headers coexist with small essential text. A menu that looks attractive as a thumbnail may be uncomfortable at the table. |
| Branding is only partially applied. | Logos and primary colors are used, but template fonts and many colors are hard-coded. Print uses its own font/color rules; browser CSS has separate overrides and texture treatments. | The same restaurant can lose its identity between designs or destinations. |
| Choosing a design can change an unrelated preference. | `menuDesignPreset` forces `featured` whenever any item has a photo ID, even when the owner selected the text-only layout. | Trying a new design can turn photos back on unexpectedly. |
| The feature does not yet compose designs from a brief. | AI transcribes menus and supports photo work; menu design is selection among four presets plus manual settings. Thumbnails show only the first PDF page. | The owner still has to work out which design fits the content and purpose. |
| Restaurant content is too limited. | Items have one numeric price and one description. The schema lacks sizes, add-ons, market-price labels, section descriptions, and structured owner-confirmed dietary notes. | Coffee sizes, wine glass/bottle prices, supplements, tasting menus, and footer notes require workarounds. |
| Saved drafts are not independent published menus. | The restaurant record has one `menu_draft`, one `published` snapshot, and one primary menu URL, although the creation system can save multiple drafts. | Dinner, brunch, and drinks cannot operate as independently published menu documents. |
| Some production checks miss the final output. | A fresh Letter print-shop proof embeds its hero/masthead at 1,224 px across 8.5 inches: 144 PPI. No low-resolution warning is emitted for that sample. The bleed area is filled with a flat color while textured artwork ends at trim. | A source photo can pass the check and still be downsampled too far. Small trimming shifts could reveal a mismatched strip. |
| Preview work can become expensive. | The design picker queues full PDF generation for each design and then rasterizes page one; the current print preview is generated separately. | There is an architectural responsiveness risk as menus grow. Device latency still needs measurement. |

The refreshed [template comparison](evidence/menu-current-templates-2026-09-17.jpg) records the present visual range. The [photographic comparison](evidence/menu-current-photo-templates-2026-09-17.jpg) uses the same approved-photo fixture across the four designs. These are test fixtures, not customer results.

**The desired experience should begin with a finished proposal.** A new owner brings an existing menu, pastes menu text, chooses saved dishes, or enters items. The app confirms uncertain content beside the source. It then asks only what materially affects composition: menu purpose, print size/page preference, and whether to use photos. Saved restaurant branding is the default. Owners can optionally supply a visual reference; references inform broad design choices while the owner's confirmed menu remains the source of facts.

The app presents three complete options using the actual restaurant name, logo, dishes, prices, and available photos. Each option shows every page, page count, and a short explanation such as “Two columns keep your dinner menu on one page.” The recommendations should differ in composition, not merely color. The full collection remains secondary.

Choosing a result opens the existing workspace, improved around the selected destination. Print opens a large page canvas with page thumbnails and zoom; phone opens the actual guest view. Clicking a dish on either preview selects its editor. The section outline remains useful. Provide direct Export PDF and Publish actions, undo/redo, clear saved/publication state, and a single review of relevant issues. Returning owners reopen their menu immediately.

Common adjustments should express an outcome: “Try one page,” “Give this more space,” “Use fewer photos,” “Move this section,” or “Shorten this description.” Show a preview and an undo action. If one page would compromise readability, offer two pages or an owner-approved content change. Do not silently shrink essential text or remove items.

Export and publishing use the same confirmed content revision. Printing does not require publishing. A digital update still requires the owner's Publish action; printed copies naturally require reprinting. Preserve the stable QR workflow and the current private-draft/public-snapshot boundary.

**Use AI for bounded assistance, backed by predictable layout software.** AI can extract and organize content, suggest suitable design families, interpret a style brief, and propose shorter copy or translations. Names, prices, ingredients, sizes, and dietary/allergen statements remain owner-confirmed facts. Any wording change must be inspectable and reversible. A design request should not invent dishes or prices.

The layout engine should measure actual font metrics, allocate columns and pages, place optional photos, and enforce output rules. Text stays editable and searchable. AI-generated artwork, if useful, is a separate decorative asset; it does not contain the menu's working text. Repeated edits should preserve the chosen design instead of requiring a fresh model request. A curated recommendation and rendering path should remain usable when AI is unavailable.

**Develop a small collection with distinct structures.** Start with three production-quality families, then expand to six after the first families pass real-menu review. Each family should define heading hierarchy, type sizes, price formatting, section treatment, spacing, allowed photo placements, page-break behavior, and phone adaptation. Include an economical print treatment in every family.

| Family | Composition | Best initial use |
|---|---|---|
| Classic editorial | Compact wordmark, restrained serif, aligned prices, balanced columns, fine rules, plain paper | Neighborhood restaurants and dinner menus |
| Modern café | Clear sans-serif hierarchy, structured size/price columns, compact groupings, limited accent color | Coffee, bakery, breakfast, and lunch |
| Bold neighborhood | Strong display headings, readable item type, flexible columns, one or two deliberate photo placements | Casual dining and counter service |
| Refined dining | Quiet branding, generous but controlled space, course groups, optional fixed-price block | Seasonal and tasting menus |
| Bar and wine | Structured glass/bottle or size pricing, high information density with readable hierarchy | Drinks lists |
| Specials sheet | Small masthead, focused feature block, date/service details, optional single photo | Daily or seasonal inserts |

The first three are the initial design deliverable. The later families should be justified by pilot demand. Neutral surfaces, clear hierarchy, deliberate spacing, and faithful branding should establish quality. Texture, photographic backgrounds, and dark print treatments should be optional choices. Menus must look complete with zero photos, mixed photo coverage, or no logo. Avoid invented decorative monograms unless the owner chooses one.

**Give the content model enough structure for restaurant work.** Introduce a versioned menu document with a name, purpose, language, sections, design recipe, output settings, and revisions. Keep shared dishes, but give each menu entry a stable identity and explicit overrides for menu-specific names, descriptions, prices, visibility, and photos. Distinguish “Change on this menu” from “Update the dish library.” The current `Review & use` path saves shared dish facts before the final review, so this distinction matters even for owners who only print.

Support a single price, named size/price variants, a fixed-price menu, an owner-supplied market-price label, and simple add-ons. Support section introductions and footer notes, including owner-supplied dietary legends and service notices. Store these as structured content with explicit ordering, not text squeezed into dish descriptions. Allergen information must be confirmed; the system should not infer it from photos or generic recipes.

Named Dinner, Brunch, and Drinks documents can then be duplicated, archived, and published independently. Keep `/m/:restaurant` as the stable restaurant entry point so existing QR codes survive. Preserve existing published snapshots during migration. Offer a menu switcher when more than one document is published; schedule automation can follow later.

**Build in this order, with a quality gate at each stage.**

| Stage | Concrete deliverable | Gate before moving on |
|---|---|---|
| 1. Establish the output standard and fix verified defects | Three finished reference compositions using representative restaurant content; fix template selection resetting photo mode, final-image resolution reporting, and artwork bleed. | The print proof reflects the actual exported resolution and continuous bleed. Reference menus establish the visual standard at actual size. |
| 2. Build the composition foundation | Versioned document/design schema, core price variants and notes, shared design rules, content measurement, page allocation, three production design families, faithful brand mapping. | 12-, 30-, and 60-item fixtures preserve every fact; target page count is either met legibly or explicitly declined. Text-only and mixed-photo examples both pass. |
| 3. Deliver the guided generation and editing experience | Import/paste/library entry, concise brief, three recommended compositions, all-page comparison, destination-aware editor, direct export/publish actions, undo/redo. | Owners can reach an acceptable first menu without touching font sizes, manually positioning items, or repairing page breaks. Print and phone edits stay consistent. |
| 4. Make routine operations reliable | Independently named menus, explicit per-menu overrides versus shared-dish updates, publication revisions, stable QR routing, rollback, richer import handling. | Updating a brunch price does not silently change dinner. Draft changes stay private; rollback and old QR links work after migration. |
| 5. Validate in service and release incrementally | Pilot with five restaurant owners, physical print proofs, phone/device checks, measured task times, expanded template/content fixtures. | Owners actually use the output in service and return to update it. Resolve layout and printing failures before widening access. |

Stages 1–3 form the first coherent product slice. Stage 2 includes the document schema needed by Stage 4, so richer menu operations do not force another renderer rewrite. Start the owner/reference collection alongside Stage 1; the final pilot should not be the first customer exposure. Calendar estimates should follow a short layout-engine prototype and staffing decision.

**Implementation should share design decisions while respecting each medium.** Retain the existing PDF tooling initially, but extract a typed `MenuDocument`, a versioned `MenuDesignSpec`, and a measured print layout plan from the branching renderer. The plan should contain page/column assignments, text runs, photo placements, and diagnostics. The PDF exporter and its preview consume that same plan. HTML remains the accessible phone renderer and uses the same semantic content and design tokens, with intentional responsive behavior.

Separate content, style, measurement, and export. Cache fonts and prepared images; run expensive layout/export work away from the interaction thread where supported. Cancel superseded preview work. Cache previews by document revision and output profile, and avoid preparing every full PDF after each edit. Measure performance before deciding whether a server rendering service is necessary; the existing hosting runtime has memory constraints and should not receive an untested heavy renderer.

Migrate existing drafts to the new document model with their present settings preserved. Pin existing published designs to their prior renderer/design version until an owner adopts the new version and republishes. Continue the existing tenant, photo-approval, snapshot, asset-access, and concurrent-edit protections. A multi-item save should be revision-checked and atomic rather than leaving a partly updated menu after a failed sequence of dish writes.

The main implementation seams are [menu-builder.tsx](../app/components/menu-builder.tsx), [menu-design.ts](../lib/menu-design.ts), [menu-print.ts](../lib/menu-print.ts), [menu-view.tsx](../app/components/menu-view.tsx), [menu-template-preview.tsx](../app/components/menu-template-preview.tsx), [menu-templates.css](../app/menu-templates.css), [the API schemas and publishing routes](../lib/server/api.ts), [menu import handling](../lib/server/menu-tools.ts), and [the database schema](../db/schema.ts). Keep the existing sharing and approved-photo integrations.

**Professional output needs explicit acceptance targets.** These are product targets to validate, rather than claims that one universal type size or print profile works everywhere.

| Dimension | Proposed acceptance target |
|---|---|
| Accuracy | Every confirmed item, variant, note, and price is retained; no accidental duplication, omission, invented claim, or silent truncation. Extraction uncertainty is surfaced. |
| Print legibility | Target 11–12 pt descriptions/prices and 13–16 pt item names in ordinary full-page menus; review at 100% physical size. No automatic reduction below an agreed floor to force a fit. |
| Composition | No isolated section heading, clipped text, name/price collision, accidental split item, or nearly empty continuation page without a visible reason. Owners can control deliberate page breaks. |
| Page count | Show every page before selection/export. Meet a requested page target when it is feasible at the readability floor; otherwise explain the constraint and offer a useful alternative. |
| Photography | Evaluate effective resolution after crop and rasterization. Aim for 300 PPI for print-shop photographs; surface lower resolution with a smaller-placement or replacement action. Preserve intentional focal points. |
| Print production | Embedded fonts, selectable text, correct physical dimensions, safe margins, continuous artwork through the configured bleed, and optional printer-required marks. Validate against the selected printer's requirements. |
| Phone use | Readable primary content without zooming, useful content near the top, clear section navigation, large touch targets, acceptable contrast, and keyboard/screen-reader support. Validate at 320, 390, and 430 px and 200% text enlargement. |
| Brand fidelity | Same logo and intentional palette/type relationships across print and phone. No template silently replaces the owner's explicit photo/background choice. |
| Initial task | After content confirmation, target an acceptable designed result in under 2 minutes. Pilot target: at least 4 of 5 owners can export/use a menu without staff help or manual layout repair. |
| Repeat task | Target a price edit and reviewed publication in under 30 seconds. Track later return-and-update behavior and actual use in service, not only downloads. |
| Responsiveness | Benchmark a 30-item menu: target visible edit feedback within 250 ms and an updated print proof within 2 seconds on an agreed ordinary device. Do not assume current performance meets those numbers. |

The benchmark set should include short and long menus; uneven sections; long names; long descriptions; mixed prices and sizes; no photos, sparse photos, and many photos; dark/light logos; long restaurant names; Latin diacritics; unavailable dishes; and supported multilingual content. Add unsupported-script diagnostics early, then add fallback fonts/shaping for languages the product explicitly supports. Test every page, not only the first thumbnail. Include ordinary and grayscale office printing as well as a commercial print sample.

The current print-shop mode is RGB with fixed 1/8-inch bleed and crop marks. Retain clear labeling while fixing bleed continuity and raster resolution. Add color conversion, output intent, or PDF/X only for a tested printer profile; those features should not be implied by the presence of crop marks. Adobe's [print-PDF guidance](https://helpx.adobe.com/indesign/desktop/print/print-production-and-file-creation/produce-print-ready-pdf-files.html) treats printer settings and color profiles explicitly, and its [bleed guidance](https://www.adobe.com/learn/indesign/web/set-print-bleed) requires artwork to extend beyond trim. Canva likewise distinguishes safe areas, trim, and background extension in its [print setup guidance](https://www.canva.com/help/margins-bleed-crop-marks/).

Restaurant-specific competitors already position menu data, brand consistency, and updates across outputs as core capabilities. For example, [MustHaveMenus describes that workflow](https://www.musthavemenus.com/feature/restaurant-menu-management.html). That is vendor positioning, not independent evidence of usability. Our proposed advantage is a faster path from confirmed dishes and existing food photography to a small number of excellent, maintainable designs.

**Keep the first release focused.** Defer POS integrations, ordering/payment, digital signage, multi-location administration, a general-purpose drag-anything canvas, a large template marketplace, and automatic sales-optimization claims. Also defer folded takeout layouts and arbitrary custom sizes until the flat-page engine is dependable. Preserve current capabilities while improving this specific menu workflow.

**Review evidence and limits.** The existing `tests/template-quality.mjs` suite passed on the current source, including 48 combined composition/export cases, eight menu/pagination proofs, and four photographic menu proofs. Fresh export contact sheets and the second Atelier page were visually inspected. A separate print-shop proof was rendered with Poppler and its PDF image objects inspected; the 144 PPI masthead and flat-color bleed findings are recorded in [the print audit](evidence/menu-print-audit-2026-09-17.json). Passing these checks demonstrates useful mechanics, not restaurant adoption or good design across every case.

The review did not exercise the live hosted editor, call the AI provider, perform physical printing, or interview owners. Interface observations come from the current source. No product code or deployment was changed. The assessment was made against source revision `76ec8770f5d5956689598b210368aba529b3675b`.

The recommended first implementation is one complete dinner-menu flow: confirmed content into three excellent compositions, accurate page-aware editing, and a reliable Letter/A4 PDF with a matching guest view. That creates a concrete quality standard for the rest of the feature.

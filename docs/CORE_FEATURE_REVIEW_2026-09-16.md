# Core feature review — September 16, 2026

## Assessment and scope

Menu Material has a substantial foundation: original-photo retention, approved reusable images, restaurant looks, saved drafts, recovery, social exports, actual PDF previews, and stable menu sharing. The next leap is to make the product exercise better creative judgment on the customer's behalf. Customers should receive a strong first result and make small adjustments, with advanced controls available when needed.

This review covered the current source and logged-in desktop screens in an isolated copy of local workspace data. The copy contained representative saved photo, dish, post, and menu records. No application implementation was changed, no production records were edited, and no paid image or caption generation was run. Existing export contact sheets were also inspected by the Post Maker reviewer; they were not regenerated for this review. Physical-phone sharing, current hosted-worker activation, and live AI fidelity were not independently validated.

The recommendation is an evolution of the current brand and tools. Preserve the homepage direction, existing capabilities, and useful safeguards. Concentrate effort on finished-output quality, the prominence of the customer's work, and fewer decisions in the common path.

## One coherent product

| Feature | Customer promise | Recommended common path |
| --- | --- | --- |
| Photo Studio | My actual dish, photographed beautifully | Add photo → choose recommended treatment → inspect result → use photo |
| My Dishes | Every dish and its best assets, ready to reuse | Find dish → choose approved version → make something |
| Post Maker | A finished, credible restaurant promotion | Choose dish and purpose → select a composed design → export post and Story |
| Menus | A professionally designed menu, easy to maintain | Import or select dishes → review → choose design → print or publish |

Extend the existing restaurant look into a shared creative brief: photo treatment, palette, typography, logo behavior, and optional writing voice. New work should inherit it quietly. Existing drafts should retain their saved design, with an explicit way to adopt a revised look.

Use a common editor pattern: a compact header with document name, save status, saved work, and one primary completion action; a large working preview; and contextual editing controls. Use the same terms for drafts, approved assets, downloads, and published work across tools. Simplify the navigation label and page title to “Menus.”

The workspace should feel like a place to make things. My Dishes currently spends much of its first viewport on an aspirational headline, explanatory copy, a separate shortcut, and a permanent batch-download hint. Replace these with a compact title and useful content. Preserve spaciousness while increasing the size of the customer's photographs and designs. Use the existing green as a purposeful accent, stronger text contrast, fewer nested cards, and readable control labels.

On phones, show the preview and one main action first, with editing controls in a sheet and a persistent completion action. Validate real device input, uploads, save dialogs, and sharing rather than relying solely on narrow desktop layouts.

## Photo Studio

### Current strengths

- 56 visual styles across seven collections, including drink-specific treatments.
- Source-photo guidance, saved restaurant looks, optional advanced photographic controls, and original retention.
- Before/after review, versions, free local adjustments, destination-specific exports, and reuse in other tools.
- Detailed generation instructions about food identity, ingredient counts, portions, drinks, and branding.

### Current friction and quality risks

The default workbench privileges the style gallery. For an account without an already chosen style, upload is gated by style selection, so recommendations based on the actual dish arrive after the first important choice. A saved restaurant look improves this path, but the gallery still dominates the customer's image.

Preset selection can change serving ware and camera angle. The warning about reconstructing unseen food is inside collapsed controls. These creative choices should be clear to the customer, particularly for delivery and menu photography.

Completed images are checked for valid file structure and size, but the completion pipeline does not compare their content against the original. Fidelity is supported by prompts and customer approval, not an independently validated quality gate. The “Something changed in my food” action leads to the ordinary revision path, which consumes another image.

The finishing experience is long: approval, destination cards, another preview, fit/position/zoom controls, another accuracy confirmation, download instructions, and cross-feature suggestions. Some of these are useful safeguards, but they can be consolidated.

### Recommendations

1. **Make upload immediately available.** Keep style browsing as a useful alternative, but let customers bring in their dish before choosing. After upload, show three recommendations: the restaurant's saved look, a faithful enhancement, and a relevant creative treatment. Keep all 56 styles under Explore styles and preserve favorites/recent choices.
2. **Make authenticity an explicit default for menu and delivery work.** Retain food identity, portion, original angle, and serving ware unless the owner deliberately chooses a transformation. Summarize meaningful changes before creation, such as “New background · original plate and angle.” Creative campaigns can use more adventurous treatments.
3. **Add a real image-quality evaluation loop.** Compare original and result for changed ingredients, portions, plate/glass shape, labels, unnatural texture, and unusable crops. Treat automated checks as assistance, with owner review remaining authoritative. Investigate subject-preserving editing where supported; validate it rather than assuming a prompt protects the food.
4. **Support correction of product failures.** Distinguish “Fix something that changed” from “Try another creative direction.” Provide a bounded correction or recredit policy for verified fidelity failures, with costs and abuse limits designed before release. Offer specific repair choices and keep the original as the identity reference.
5. **Finish on one large result.** Put before/after, zoom, a few adjustments, approval, and the main download action around the image. Carry fidelity approval forward. Ask for crop confirmation only when the destination crop introduces a new concern. Remember the last destination and keep alternatives compact.
6. **Make multi-dish consistency dependable.** Extend the existing sample-first batch approach: approve one look, apply its actual settings to the remaining dishes, and compare a contact sheet for consistent light, scale, framing, and background. Avoid implying that using the same preset alone guarantees matching outputs.

**Proposed acceptance bar:** the default result should be both appetizing and recognizably the same served dish. Evaluate on a varied set of ordinary restaurant photos, including soups, glossy sauces, salads, stacked sandwiches, mixed platters, pastries, branded cans, and layered drinks. Measure first-result acceptance, fidelity rejection, corrective attempts, useful export rate, latency, and cost per accepted asset. Establish baselines before setting numerical promises.

**Immediate code issue:** Toast appears in the generation format selector, while the generation request schema excludes `toast`. This is a code-level incompatibility; no paid request was submitted to reproduce it. Existing Toast download support is a separate path and should be preserved.

Evidence: `app/components/studio-workbench.tsx:207`, `:438`, `:624`, `:689`; `app/components/photo-studio.tsx:119`, `:384`, `:859`, `:959`; `lib/server/generation.ts:135`, `:412`; `app/components/photo-downloads.tsx:250`.

## My Dishes

### Current strengths

The library ties dish facts to originals, approved versions, local edits, downloads, posts, and menus. Name search and batch downloading already work. The central reusable dish model is the right foundation for the product.

### Current friction

Clicking a dish appends its detail panel below the entire grid. In the reviewed desktop screen, clicking the card produced no visible change in the current viewport. With a larger library this becomes a serious discoverability problem.

Cards show persistent selection boxes and multiple actions. The page is organized partly around downloading, although a dish's broader value is reuse. A dish without any photo can be labeled “Ready for review,” and its action says “Review photo.” “Add a dish” opens Photo Studio rather than offering direct dish creation.

The default asset is the first approved photo found in the returned list. There is no explicit preferred-photo choice for the owner. Picking a different approved image for each destination is difficult to discover. Search covers names only, and there are no visible section/status filters or sorting controls.

### Recommendations

1. **Open the dish where the customer expects it.** Use a spacious detail drawer or dedicated dish page with a large main photo. On mobile, make this a full-screen detail view. Preserve the library's scroll and search when closing it.
2. **Let the owner choose the main photo.** Retain all approved versions, label the preferred image clearly, and allow an alternate when making a post or menu. Store simple version information such as Original, Approved, style, and creation date. Keep detailed history secondary.
3. **Simplify the grid.** Show image, dish name, section, and one meaningful status. Use accurate states: No photo, Needs review, Ready to use. Reveal selection controls in a Select mode and show bulk actions only after selection.
4. **Make reuse the main action.** A compact Use photo menu can offer Make a post, Add to menu, and Download. Use the selected version and existing facts directly, without another upload or unnecessary generation.
5. **Support a growing restaurant library.** Add lightweight section/status filters and sorting. Introduce multi-photo import with a simple review queue. Add a dish without requiring a photo. Keep price, description, and availability in compact optional details.
6. **Show consequences of shared edits.** Indicate which saved posts and menus use a dish. A price or description change should flag affected work for review, while published menus remain unchanged until explicit publication. Offer archive/restore for dishes and undo for reversible organization changes.

**Proposed acceptance bar:** in a library of 100 dishes, a returning owner can find a dish, identify its preferred photo, and start a post within about ten seconds. This is a proposed usability target, not a measured result. A customer should never need to remember which tool originally created an asset.

Evidence: `app/components/core-workspace.tsx:348` onward; library selection/detail/default-photo logic in that component; `lib/server/api.ts:650` and `:654` for newest-first records; `db/schema.ts:91` for the shared dish model.

## Post Maker

### Current strengths

Ten tasteful photographic designs, licensed fonts, brand inheritance, approved photos, separate feed/Story framing, factual caption updates, saved drafts, and usable downloads already exist. The existing design collection should be refined rather than discarded.

### Current friction and quality risks

The normal workflow has four stages. The design gallery defaults to sample dishes even after the owner has chosen a real dish. Large sample designs compete with the smaller customer preview. The gallery, categories, format switch, sample/photo switch, text amount, branding, headline, colors, and typography create many decisions.

The renderer uses fixed text positions over full-frame photos and gradients. It does not understand where the food is or whether a text area is visually busy. Existing exports show some aggressive Story crops and small supporting text. Text can shrink to 18 pixels in a 1080-pixel-wide export, far below a comfortable reading size when displayed on a phone.

Carousel is tied to combo offers, with shared text and crop settings that limit its usefulness for menu launches or a sequence of dishes. The last step repeats readiness messages and combines small previews with a large sharing panel, multiple save/download/share choices, caption instructions, and a manual save button despite autosave.

### Recommendations

1. **Start from composed results using the real photo.** Choose dish and purpose, then show three suitable designs using the restaurant's look. Present one large selected canvas with a small alternatives strip. Keep the full collection under More designs and editing under Details, Design, and Photo.
2. **Make layout respond to the photograph.** Choose text placement based on food position, contrast, and negative space. Add layouts with separate text areas so a dark gradient is not the only readability solution. Preserve the subject when adapting from feed to Story, with an independently adjustable crop for each output.
3. **Enforce a visible readability floor.** Evaluate text at phone size, contrast over the actual image, source resolution, safe areas, and crop completeness. If a headline is too long, suggest a shorter version or move information to the caption instead of shrinking indefinitely. Show issues only when they need attention.
4. **Offer a coordinated output set.** A polished feed post and Story should be ready together, with format-specific composition. Let owners create a carousel independently of offer type, with a cover, per-dish slides, and optional closing invitation. Allow each slide its own headline and crop while retaining shared design.
5. **Make captions sound like the restaurant.** Extend the existing factual controls with an optional saved voice, one strong default, and simple Shorter/More inviting actions. Preserve confirmed prices, dates, quantities, and dish facts. Do not invent ingredients, awards, or dietary claims.
6. **Consolidate completion.** A large preview, editable caption, Copy caption, and Save/share should be sufficient for the default view. Make all-format download secondary and keep platform-specific instructions expandable. Distinguish “Design saved” from “File downloaded” and “Posted.”

**Proposed acceptance bar:** from an approved dish, produce a credible post and matching Story in approximately one minute without needing to change font, color, or crop. Evaluate the design on ordinary customer photos, long dish names, awkward crops, pale/dark food, varied logos, and real offer details. Review every carousel slide.

**Immediate code issue:** combo selection rejects a fifth dish, but the add control is disabled only at six. Align the visible limit with the actual limit.

Evidence: `app/components/post-maker.tsx:102`, `:108`, `:150`, `:478`, `:514`, `:791`, `:995`; `lib/post-render.ts:29`, `:137`, `:198`, `:307`, `:329`; `lib/server/creation.ts:96`; `app/components/post-sharing.tsx`.

## Menus

### Current strengths

Manual entry, saved dishes, reviewed photo/PDF imports, three layouts, optional sample-first photo batches, restaurant branding, actual PDF previews, embedded text/fonts, resolution warnings, stable public links, QR codes, table cards, and private draft/published separation are all implemented.

### Current friction and quality risks

The five-step flow repeatedly exposes dish forms and includes an optional photo stage even for text menus. Editing facts and judging the final composition happen in separate places. Three structural layouts offer a useful start, but customers have limited access to distinctive, professionally typeset menu designs.

The phone preview has smaller type and different spacing from the live customer menu. The digital photo grid uses square crops while the PDF uses uncropped image placement. Thus customers cannot assume the preview or crop choices will correspond across destinations.

Imported content asks for comparison against the original without keeping that original beside the review fields. The published menu is a long sequence of sections without contextual navigation for larger menus. The underlying dish model has one price and availability flag per dish.

### Recommendations

1. **Make the actual menu the workspace.** Use a compact collapsible section list beside a large menu preview. Select an item to edit its details in a contextual panel; support clear reordering and keyboard alternatives. Returning users should open directly into their menu, with Publish and Export always easy to find. First-time setup can remain short and guided.
2. **Develop a small collection of exceptional menu designs.** Start with a few strong directions such as Bistro, Modern Café, Fine Dining, and Casual Kitchen. Each should define a coherent hierarchy, price alignment, spacing, section rules, photograph treatment, and pagination. Offer simple design and density controls; handle the typography professionally underneath.
3. **Make preview accurate.** Render the real guest menu at an actual phone width. Keep the actual PDF preview. Share image focal points and design rules where appropriate, while treating print and phone as intentionally adapted formats. Let owners choose featured dishes rather than assuming the first item in a section is the hero.
4. **Make import review confident and fast.** Show source and extracted content together. Highlight uncertain prices/names, duplicates, and section ambiguity, then provide bulk corrections. Never infer dietary or allergen claims from photography; only use owner-confirmed facts.
5. **Make publication state unmistakable.** Show a concise count and review of unpublished changes, particularly prices and availability. Preserve the existing stable QR and explicit republish behavior. Keep download assets for a restaurant's existing platform distinct from publishing a hosted Menu Material menu.
6. **Finish both print and guest use.** Add automatic checks for awkward page breaks, isolated section headings, text overflow, weak contrast, image resolution, and unsupported characters. Add printer-specific trim/bleed profiles only when exports actually support them. For longer guest menus, introduce sticky section navigation and optional search. Consider price/size variants and service-period menus after the core workflow is excellent.

For comparison, [Canva's official print guidance](https://www.canva.com/help/margins-bleed-crop-marks/) explicitly covers safe margins, bleed, crop marks, and proofing. Those are concrete production concerns to address if Menu Material offers professional print output; a PDF download alone is not that full promise.

**Proposed acceptance bar:** an owner can import a 30-item menu, verify its contents, choose a design, and obtain a readable phone menu and well-composed PDF without manually adjusting typography. Routine price edits should take seconds, and the owner should understand exactly when they become public. Validate mixed photo coverage, long names, many sections, multilingual content, and 60-item menus as stress cases.

Evidence: `app/components/menu-builder.tsx:459`, `:598`, `:621`, `:748`, `:903`; `app/components/menu-view.tsx:190`, `:209`; `app/creation.css:1729`, `:2074`; `app/globals.css:1176`; `lib/creation-export.ts:188`, `:363`; `app/components/menu-sharing.tsx:112`.

## Implementation sequence

1. **Correct trust and usability defects.** Resolve Toast format validation, combo limits, misleading dish statuses, below-grid details, customer-photo preview defaults, inaccurate menu preview sizing, and redundant save/completion actions. These changes are relatively contained and make current functionality more trustworthy.
2. **Raise the output-quality floor.** Begin the live food-fidelity benchmark; improve photo-preserving crops, text placement/readability, menu typography, and cross-format rendering. Establish how corrective generation is handled. Project notes still list always-on processing as pending activation; verify current deployment status and then demonstrate completion with all browsers closed before relying on that promise.
3. **Simplify the primary workspaces.** Introduce the larger preview and contextual editing model, preferred dish assets, recommended styles/designs, and a common completion pattern. Preserve draft recovery, originals, approval history, and published snapshots during this work.
4. **Expand repeat-use value.** Improve consistent batch photography, real carousel composition, import proofing, and multiple menu formats after the common single-dish path meets its quality bar.

Avoid making template count, number of controls, or generation volume the main success measures. Track time to a usable result, acceptance without repair, successful reuse, export quality, repeat use, and customer confidence. Broader scheduling, video, and restaurant-management features can be evaluated separately once these four core promises are dependable.

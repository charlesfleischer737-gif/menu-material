# Menu Material — Photo Studio requirements and acceptance criteria

Version: 1.0  
Status: Proposed implementation and release contract  
Audience: Product, design, engineering, QA, and restaurant pilot participants

Read the [experience contract](#3-experience-contract) for the intended product, [functional requirements](#4-detailed-functional-requirements) for implementation, [design and usability gates](#6-design-and-usability-acceptance-bar) and [live-image qualification](#7-live-image-and-reliability-qualification) for the quality bar, and [acceptance execution](#10-acceptance-execution-and-definition-of-done) for release evidence. [Product policies](#9-product-policies-and-validation-dependencies) identifies the proposed defaults that need cost and operational validation.

## 1. Product outcome and scope

Photo Studio must help a restaurant owner turn an ordinary photograph of a real dish into an attractive, accurate image they can confidently use. Success means a useful image reaches its intended destination; generation completion alone is insufficient.

The experience must support inspiration, component customization, occasions, and consistent restaurant photography through one coherent flow:

**Add your photo → Choose a look → Create photo → Review and use**

The default flow must work without prompts, photography knowledge, a tutorial, or adjustment of advanced settings. Owners who want creative control must be able to discover it without confronting a complex editor on arrival.

This specification defines the requested target experience. It does not assert that requirements are implemented or that acceptance tests have passed. Numerical targets below are proposed product release thresholds, not measured performance or marketing claims. Automated checks, screenshots, and mocked provider responses cannot substitute for the live-image and physical-device gates.

### Scope

Included: guest and signed-in entry; upload and camera capture; recommendations; style discovery and search; visual customization; reference matching; occasions; reusable restaurant looks; generation; result review and correction; exports; contextual handoff to existing tools; consistent multi-dish work; persistence; accessibility; performance; and operational measurement.

Preserve existing useful capabilities, source photos, saved work, versions, approved assets, formats, and connections to My Dishes, menus, and Post Maker. Existing description-only illustration remains a secondary route with its distinct provenance and existing eligibility restrictions. It must not be presented as a photograph of the actual dish or included in real-photo fidelity claims.

Outside scope: a general design canvas, a layer editor, mandatory conversational prompting, direct social publishing, new POS integrations, new billing plans, and changes to the marketing homepage beyond entry links needed by this flow.

### Delivery sequence

| Release | Scope | Completion rule |
| --- | --- | --- |
| R0: Remove immediate barriers | Guest button visibility; directly reachable upload; clear recovery from unavailable generation. | Relevant functional, visual, keyboard, and phone checks pass. Does not constitute the full redesign. |
| R1: Excellent single-photo experience | Requirements PS-01–PS-14, PS-17–PS-22, PS-24–PS-30. Includes search, favorites, visual customization, reference matching, and simpler download. | All R1 criteria and common release gates pass before broad availability. |
| R2: Creative range and repeat use | PS-15 occasions, PS-16 named restaurant looks, PS-23 batch consistency. | R1 remains passing; each added capability passes its own and the common gates. |

R1 must preserve the existing single restaurant look and ability to reuse it. R2 expands it into a named collection. Features may be released progressively, but the complete recommendation is not finished until R2 is accepted. Release labels identify sequence, not permission to waive quality.

### Interpretation

- Every numbered acceptance criterion is mandatory for the release containing its requirement unless explicitly marked optional.
- A criterion ID consists of its requirement and suffix, for example **PS-03.4**. Test results must use these IDs.
- Product, design, engineering, and QA record acceptance against one release candidate and its exact image-generation configuration.
- An unresolved item cannot be marked passed. A narrower supported scope must be deliberately specified and reflected in the UI before testing; it cannot be introduced after a failed test to improve the score.
- Proposed business defaults in section 9 require an accountable owner and economic validation before customer-facing rollout.
- An **allowance-consuming job** uses one of the owner's included or purchased images. A **charge/debit** in the customer ledger includes free-plan allowance consumption; complimentary correction is available to eligible free-plan and paid-plan users alike. Provider spend is a separate internal cost.

## 2. Users and critical journeys

| Journey | User need | Observable success |
| --- | --- | --- |
| First photo | A busy owner has a phone photo and wants a better menu image. | Uploads, understands the selected look and cost, creates, checks the food, and saves a usable file without assistance. |
| Inspiration first | A visitor wants to see what is possible before uploading. | Browses examples, chooses one, adds a photo, and retains the chosen look throughout. |
| Specific creative intent | An owner wants a dark table, white plate, or a particular atmosphere. | Finds or assembles that treatment without writing a prompt. |
| Occasion | An owner needs a Christmas or game-day photo. | Finds the occasion, chooses a restrained treatment, and creates an accurate image; optional promotional text follows in Post Maker. |
| Repeat restaurant work | An owner wants another dish to match an existing menu. | Reuses a saved look without reconstructing settings or altering prior photos. |
| Recovery | An upload, generation, or download fails, or the output changes the food. | Understands what happened, retains valid work, knows the credit consequence, and can take the appropriate next action. |

## 3. Experience contract

### Information architecture

The main studio shows the owner's photo, three relevant starting choices, a selected-look summary, **Browse all looks**, **Customize**, and one primary action appropriate to the current state. Controls appear only when relevant; the initial empty state emphasizes **Add a photo** and a secondary **Explore styles** link.

The style browser contains **All looks / Occasions / Saved**. Occasions contains collections, not a competing creation workflow. In R1, omit the Occasions destination until it contains released, validated collections. Saved initially contains favorites, recent looks, and the existing restaurant look; R2 adds named custom looks.

Customization contains **Setting / Serving dish / Light / Framing**. The serving-dish label adapts to Plate, Bowl, Glass, or Packaging. A reference-photo entrance is also discoverable from the browser. All routes produce the same editable look configuration.

On desktop, use a large photo area beside a compact decision area. On phones, show the photo above the current decision and provide a persistent primary action. Browse and Customize use focused overlays or sheets, returning users to the same draft and photo.

### Default and override rules

| Situation | Required behavior |
| --- | --- |
| First upload with no explicit style choice or restaurant default | Select **Polish my original** visibly as the safe starting choice; show two suitable alternatives. Selection requires no extra confirmation. |
| An applicable restaurant default is enabled | Select that saved look visibly; include Polish and a distinct relevant alternative. Preserve the owner's ability to choose differently. |
| Owner selected a style before uploading | Preserve that choice and show relevant alternatives separately. |
| Subject analysis completes late | Update suggestions only; never change the selected look, manually corrected subject, or controls. |
| Owner changes style after customization | Apply the new style defaults to untouched controls; retain explicit overrides and identify any incompatibility inline. Provide Undo. |
| Owner selects Reset to this look | Remove overrides for this image and restore the selected style's settings. Do not change the saved look. |
| Owner applies an occasion | Change this draft only; do not change restaurant defaults. |
| Owner changes restaurant defaults elsewhere | Existing drafts and queued jobs retain their saved settings. Offer explicit adoption where useful. |

### Shared state and fidelity rules

Source photo, reference photo, selected look, explicit overrides, intended use, crop, job, output, approval, and export are distinct concepts. The UI must never use a style example as the owner's actual preview. The original is immutable; every generated or saved edited version has identifiable provenance.

Food identity, ingredients, visible quantities, portion, and meaningful branding are protected requirements. Serving ware and camera angle may change only through an explicit, visible selection that communicates the change. A preset that changes these properties must disclose it before generation. An owner selecting a preset is not permission for undisclosed changes to food.

## 4. Detailed functional requirements

### PS-01 — Immediate entry and navigation [R0/R1]

**Requirement:** An owner can begin with a photo or inspiration immediately, with no unnecessary setup.

Acceptance criteria:

1. On a fresh guest or signed-in draft at the tested phone and desktop sizes, **Add a photo** is visible in the first viewport without selecting a style, dismissing a tour, or scrolling through the catalog.
2. Upload, primary actions, and mobile action-bar buttons have readable text and visible boundaries in default, hover, focus, disabled, loading, and error states. The observed white-on-white guest action defect is covered by a regression check.
3. **Explore styles** is available before upload. Selecting a look there returns to an immediately usable upload state with that look preserved.
4. Signed-in users can start from My Dishes without reuploading or duplicating an existing source. Empty library state offers upload directly.
5. Closing Browse or Customize, browser Back, and returning from sign-in retain valid draft state. Navigation never starts generation.
6. Returning users with a recoverable draft see Resume and Start new; starting new does not overwrite the previous draft. Users arriving through an explicit dish/style link receive that context rather than an unrelated prior draft.

### PS-02 — Focused working surface [R1]

**Requirement:** The photograph and current decision dominate the studio.

Acceptance criteria:

1. After upload, the owner's image is the largest photographic element in the main studio. Style examples remain visibly distinct and smaller; the complete catalog is not rendered as the dominant default surface.
2. There is one high-emphasis primary action per visible state: Add a photo, Create photo, or Use photo. On mobile, a duplicate inline action is removed or made secondary when the persistent primary is visible.
3. The primary action and a summary of its consequence are available without traversing the full gallery or expanded custom controls.
4. The standard path requires no prompt, manual subject classification, component editing, dish naming, or destination change before creation. Valid defaults exist for each.
5. The main workspace has one document scroll. Overlays may scroll internally; the desktop main flow does not require independent gallery and settings scrolling to locate its primary action.
6. The source/result position and selected look remain recognizable across state transitions. Unexpected automatic scrolling does not move a keyboard user away from their active control.

### PS-03 — Upload and camera capture [R1]

**Requirement:** Ordinary restaurant phone photos upload reliably with useful feedback.

Acceptance criteria:

1. Support JPEG, PNG, HEIC, and HEIF up to an explicitly defined 20 MB limit. UI, client, and server use the same byte limit and accepted-format contract. Validate at limit minus one byte, the limit, and limit plus one byte.
2. File picker and desktop drag-and-drop produce equivalent drafts. A non-drag alternative is always available. Phone camera capture works when supported and falls back to the device's chooser without blocking upload.
3. Show progress or an honest preparing state during transfer/conversion. Do not show a fake upload percentage. Duplicate taps cannot attach the same selection twice.
4. Preserve the original file and normalize a separate working copy. EXIF orientation, portrait/landscape rotation, transparency handling, and visible color are correct across the required fixture set.
5. Corrupt, unsupported, excessively large, or undecodable files produce a specific remedy and preserve the prior valid photo. Server validation does not trust the extension alone; decode/resource limits prevent one image from exhausting the service.
6. A network interruption offers retry without losing the selected look. Cancelled file selection leaves the draft unchanged. Retrying a transferred asset reuses the successful transfer where possible.
7. Multiple files dropped on the single-photo entry are handled explicitly: use one identified file and explain the limit, or offer the released batch path. Do not silently combine food from several photos.
8. Phone tests include actual HEIC originals and actual camera capture. Desktop conversion fixtures alone do not satisfy this criterion.

### PS-04 — Source identity and replacement [R1]

**Requirement:** Replacing or recovering a photo never mixes the identities of different dishes.

Acceptance criteria:

1. The source is labeled **Your original** and remains accessible after generation. A normalized source, generated result, and style reference are never mislabeled as the untouched original.
2. Replacing a photo retains a deliberately chosen look and compatible overrides, invalidates source-specific analysis and crops, and keeps historical results attached to their own source.
3. A delayed analysis or upload response for photo A cannot update the preview, advice, identity, or recommendations for replacement photo B.
4. If the replacement fails, photo A remains selected and usable. A loading placeholder never becomes the saved source.
5. Any generation already submitted retains its original source/settings snapshot. Editing the working draft cannot redirect that job or attribute its output to a different dish.

### PS-05 — Photo suitability guidance [R1]

**Requirement:** Guidance helps users recover from unsuitable photos without adding mandatory work for suitable ones.

Acceptance criteria:

1. Show advice only when actionable: severe blur, missing dish edges, very low light, multiple unrelated subjects, or a menu/document image. Explain the improvement in plain language.
2. Low-confidence or failed analysis never confidently names ingredients or a dish. A suitable uploaded photo remains usable without analysis.
3. Offer optional manual correction using broad food/drink categories. The owner can correct the answer without reuploading; that answer outranks late automated analysis.
4. A menu/document suggestion provides an explicit handoff to the existing menu tool and preserves the upload; do not navigate automatically.
5. An image that cannot be decoded is blocked. A readable but imperfect food photo receives guidance, not an unexplained disabled Create action. If proceeding is allowed, explain the relevant limitation before spending an image.
6. Guidance neither claims to establish ingredients/allergens nor invents dish facts for another tool.

### PS-06 — Relevant recommendations [R1]

**Requirement:** Offer a small number of sensible looks based on the owner's photo and restaurant context.

Acceptance criteria:

1. Show three distinct, eligible starting choices when three exist. Never pad the set with duplicates, incompatible serving vessels, or irrelevant subjects. With fewer eligible choices, show fewer and retain Browse.
2. Apply the default/override rules in section 3. A saved everyday look, faithful enhancement, and a relevant creative treatment are preferred over three visually indistinguishable options.
3. Each recommended card has one defensible reason, such as **Your restaurant look**, **Keeps your setting**, or **Good for drinks**. Claims of popularity or personalized performance require supporting data.
4. Drink examples remain drink-relevant even when the intended use is a delivery listing. Classification and destination are separate inputs.
5. While analysis is pending, unavailable, or uncertain, show honest general starting choices rather than labeling them personalized recommendations. Browsing and creation remain usable.
6. Guests receive useful general choices and an optional broad subject chooser. Under the default privacy design, their photos are not sent to an analysis service before account transfer; the interface states this accurately.
7. The recommendation regression set includes every supported food family and drink subtype, invalid/missing classifications, multiple subjects, saved-look eligibility, stale responses, and manual corrections. All expected compatibility and non-overwrite checks pass.

### PS-07 — Selection and change transparency [R1]

**Requirement:** Owners know what is selected and which visible aspects may change.

Acceptance criteria:

1. The selected card, selected-look name, summary, and submitted settings agree. Exactly one base look is selected; examples and filters cannot appear as additional selected styles.
2. Selection and customization never submit an image-generation job. Only the explicit creation/revision action can do so.
3. The summary communicates setting, lighting, serving ware, and any changed angle in ordinary language. Material changes cannot be disclosed solely in a collapsed panel or tooltip.
4. Polish my original retains the scene, vessel, and camera angle while improving light/color/clarity. It does not borrow food or plating from an example.
5. For menu/delivery defaults, preserve serving ware and angle. A selected creative preset with a different vessel or angle exposes that choice before creation and makes **Keep mine** easy to choose.
6. Switching styles retains explicit compatible overrides, identifies incompatible ones without silently discarding them, and offers one-step Undo. Undo restores the entire prior configuration without generating an image.

### PS-08 — Style library [R1]

**Requirement:** The full library is discoverable without becoming the default task.

Acceptance criteria:

1. Browse opens from the main studio in one action. The active draft and source remain intact when it closes.
2. All looks uses stable editorial ordering for a catalog version. Uploading, selecting, changing filters, and reopening do not randomly shuffle cards. Optional future random discovery is explicitly labeled.
3. Use All looks, Saved, and the released Occasions collection browser. Do not duplicate the main recommendations in an indistinguishable For you tab.
4. Filters change the visible collection only. They never select a style, reset customization, or consume an image.
5. Preserve query, filter, and scroll position when a user inspects a card and returns. Clear filters is always available when filters are active.
6. Maintain access to the existing 56 styles subject to the quality qualification rules. A retired or unqualified style remains identifiable in prior work; explain its status and provide a compatible alternative for new generation.

### PS-09 — Plain-language search [R1]

**Requirement:** Owners can find a look using the words they naturally use.

Acceptance criteria:

1. Search indexes names, descriptive synonyms, mood, colors, setting/surface, subject compatibility, and released occasions. It does not require exact catalog terminology.
2. Match common variations and misspellings in the golden-query set, including **football**, **game day**, **foodball**, **Christmas**, **holiday**, **white marble**, **dark background**, **warm wood**, and **keep my plate**, when the relevant capability is released.
3. Search scope is explicit. All looks searches the catalog; Occasions searches collections; Saved searches the user's saved entries. An empty scoped result offers **Search all looks** without silently switching tabs.
4. A capability query such as **keep my plate** can return a clearly labeled control shortcut as well as suitable looks. It must not invent a preset that does not exist.
5. Results do not imply exact matches where only related looks exist. No-result state offers clear filters, related looks where relevant, and Customize; it retains the source and selected style.
6. For at least 30 prewritten representative queries, an acceptable result or appropriate capability shortcut appears within the first five results for at least 90%. Every exact valid style-name query resolves first. No result points to a broken or unreleased selection.
7. Matching and result rendering meet the performance budgets in PS-27. Searching does not call image generation or spend image allowance.

### PS-10 — Examples and style content [R1]

**Requirement:** Examples explain the photographic treatment honestly and beautifully.

Acceptance criteria:

1. Each available look has an intact thumbnail, readable descriptive name, concise cue, accurate compatibility metadata, and a detail view showing what changes. Placeholder assets cannot ship as finished examples.
2. Cards prioritize the image and name; show at most one relevance/category cue. Avoid simultaneous category, popularity, new, premium, and recommendation badges on every card.
3. Example imagery is labeled **Style example** in the selection/detail context. It cannot be displayed in the owner's main canvas as an actual result before a successful job.
4. Main-flow recommendations use subject-relevant examples where available. Generic examples are labeled; the product does not suggest the sample's food will replace the uploaded dish.
5. Each released style is qualified with representative source/output pairs under the live-image protocol. Examples must reflect the treatment that the released configuration can actually produce, not an untested aspirational image.
6. Detail views provide a short reason to choose the look and show two subjects where this materially clarifies its range. Essential selection and detail controls work without hover.

### PS-11 — Favorites and recent looks [R1]

**Requirement:** A useful look is easy to find again.

Acceptance criteria:

1. A labeled favorite action is available in the card/detail context. It is separate from selection: favoriting does not change the current photo or spend an image.
2. Signed-in favorites persist per restaurant with correct authorization; local guest favorites transfer once on sign-in without duplicating entries or overwriting existing favorites.
3. Recent looks are ordered by actual use in a submitted creation, not every card viewed. Repeated use updates the entry rather than duplicating it.
4. Saved has distinct, compact groupings for the restaurant look, favorites, and recently used looks. Empty state offers browsing and explains saving in one sentence.
5. A favorite referencing a retired style remains understandable and cannot submit invalid settings. Previous assets and draft history remain accessible.

### PS-12 — Visual component customization [R1]

**Requirement:** An owner can build or refine a look with visual choices and sensible defaults.

Acceptance criteria:

1. Customize is reachable in one action from the main selected-look summary. It opens one consistent editor for presets, references, and custom looks; no separate mandatory mode-selection screen is introduced.
2. Initial groups are Setting, context-sensitive Serving dish, Light, and Framing. Only one group is expanded initially; every group inherits a valid value from the selected look.
3. Setting initially combines surface and surrounding background. Optional deeper controls separate them without forcing that distinction on every owner.
4. Visual options include text labels and visibly selected states. Color swatches alone, unlabeled icons, and dropdown-only creative controls do not satisfy this requirement.
5. **Keep mine** and **Match this look** are available where meaningful. A drink offers glass-specific controls; in R1, glass/label preservation stays locked unless a separately qualified capability explicitly supports changes.
6. A compact summary updates immediately and distinguishes overrides from style defaults. Swatch selection changes the configuration, not the uploaded photo's pixels; the UI says the look is applied when created.
7. Advanced angle controls explain that unseen parts may need reconstruction. Compatibility rules prevent impossible or contradictory settings from reaching generation; owners can resolve them inline without losing valid choices.
8. Reset to this look affects this draft only. Closing with Done applies edits; explicit Cancel/Escape discards unapplied sheet edits. This behavior is consistent across desktop and phone and tested with browser Back.
9. An optional plain-language note remains available after the visual controls. It is not required for any standard scenario or used to hide missing controls.

### PS-13 — Food-preservation constraints [R1]

**Requirement:** Styling changes the presentation while protecting the identity of what the restaurant serves.

Acceptance criteria:

1. Generation and revision retain the original source as the food-identity reference. A style/reference image contributes atmosphere, not additional ingredients, portion, food geometry, logos, or promotional claims.
2. Preserve visible ingredient types and counts where discernible, portion, meaningful arrangement, cooking appearance, and existing packaging unless an allowed transformation was explicitly selected. Never add implied included sides or drinks.
3. Drinks preserve vessel shape, liquid level, visible branding, ice, foam, layers, and garnish. A plate control cannot override those rules.
4. Retouching must not replace ordinary food texture with visibly plastic, painted, or impossible surfaces. Natural shadows, vessel contact, and reflections must be coherent.
5. Owner-entered notes cannot silently disable the core requirement to represent the actual dish. Unsupported requests are explained and remain editable before submission.
6. Automated quality checks may flag concerns but cannot claim to certify accuracy or bypass owner review. A result flagged for a material concern is clearly marked Needs review and excluded from automatic reuse.
7. Live first-result and correction benchmarks in section 7 pass. Prompt wording and fixture tests alone do not count as evidence of fidelity.

### PS-14 — Reference-photo matching [R1]

**Requirement:** Owners can use an image as visual inspiration without confusing it with the dish source.

Acceptance criteria:

1. **Use a photo as inspiration** is discoverable from the style browser and customization. Both entrances open the same reference workflow.
2. Source and reference are separately labeled and visible. Replacing or removing either never changes the other's identity or historical provenance.
3. A reference supplies lighting, setting, color, and mood only. Text, brand marks, people, and food from the reference are not copied into the restaurant's dish unless a separately specified feature permits the relevant scene element.
4. Upload validation, privacy, recovery, and non-generation-on-selection rules apply equally to references. A missing or failed reference blocks only that reference-based request and offers a normal style alternative.
5. Existing serving-dish and fidelity constraints outrank the reference. Conflicts are explained before submission rather than silently changing protected details.
6. Reference matching is qualified on at least 12 varied source/reference pairs, including different cuisines, drinks, branded packaging, busy references, and conflicting vessel types, under the same fidelity rubric.

### PS-15 — Occasions and seasonal collections [R2]

**Requirement:** Owners can find timely, tasteful treatments without entering another product workflow.

Acceptance criteria:

1. Release at least Christmas, Game day, Valentine's dinner, and Summer drinks as explicit collections, each with three meaningfully different, qualified looks. Include at least one understated treatment per collection.
2. Choosing a collection shows its looks; choosing a look returns to the standard selected-look state. Collection navigation retains the source, overrides, and browser position.
3. Seasonal accents affect the scene, not the served food. Tests reject invented edible garnishes, additional servings, implied included drinks, and decoration placed on the food without an explicit supported request.
4. Menu/delivery intent prioritizes clear product presentation. If a selected treatment conflicts with a supported destination's verified rules, explain the conflict and offer an eligible version or alternate destination before generation/export; do not promise platform acceptance.
5. Timely suggestions use the restaurant's configured locale/timezone and explicit occasion metadata. Featured order can change intentionally; an active selection and an open browsing session do not reorder unexpectedly.
6. Applying or saving an occasion does not make it the everyday restaurant default. Default changes require the separate explicit action in PS-16.
7. Occasion copy and imagery avoid invented prices, dates, offers, affiliations, or team marks. Promotional wording is added in Post Maker, with the approved image and occasion carried forward.

### PS-16 — Named restaurant looks [R2]

**Requirement:** Owners can repeat successful photography consistently across dishes.

Acceptance criteria:

1. Provide separate actions for **Use this look again**, **Save this look**, and **Make this my default**. None implies the others. Saving alone does not change future defaults.
2. A saved look has an editable name, representative approved image, compatible subject types, and a versioned configuration. It records settings and permitted reference context, not the original dish as the next dish's food identity.
3. Owners can save, rename, duplicate, and archive looks. Renaming/archiving does not break existing assets, drafts, menus, posts, or queued work. Archive is reversible.
4. Applying a look to a new dish reproduces the saved settings and uses the new source as the only food identity. Incompatible serving-vessel settings resolve explicitly without copying food from the saved example.
5. The default action states its exact scope before saving. R2's Photo Studio action changes the photo default only; extending it to menus or Post Maker requires a separately labeled, deliberate broader-brand action.
6. Existing single restaurant defaults migrate to a named look with their prior behavior retained and understandable. Migration does not silently change existing cross-tool brand settings.
7. Editing a saved look creates a version. Existing drafts/jobs retain their captured version; owners can explicitly adopt the updated version in editable drafts.
8. Use this look again starts another draft with the settings but no duplicated food, dish name, price, or promotional text. Multi-dish consistency passes PS-23 and the visual rubric.

### PS-17 — Creation preflight and cost clarity [R1]

**Requirement:** One deliberate action creates one correctly configured request at a known allowance cost.

Acceptance criteria:

1. The visible primary is **Create photo**. Immediately adjacent copy states **Uses 1 image · N remaining**, using the actual current entitlement. Free actions are not described as costing an image.
2. Preflight checks source/reference readiness, compatible settings, supported output format, connectivity/service availability, and allowance. Every unavailable action has a readable reason and a usable next step.
3. Every format offered in the UI is accepted and correctly handled across validation, request creation, provider mapping, saved results, and export. Tests include Toast and all other existing destinations; a selector option alone is not implementation.
4. Double clicks, touch repetition, concurrent browser tabs, request timeout/retry, and sign-in replay create at most one logical job and one allowance reservation for the same intent.
5. The server captures source, reference, look version, overrides, intended use, model/pipeline configuration, and cost policy before dispatch. Later client or configuration changes do not alter the submitted request.
6. Allowance is validated atomically on the server. If another device uses the last image first, preserve the draft and explain the changed balance without submitting an unfunded job.
7. Cached/reused results are disclosed and do not create a second generation charge. Optional additional variations show their count and total cost before submission; no automatic extra candidates are created.

### PS-18 — Guest continuity and account transition [R1]

**Requirement:** Trying the studio before account creation is useful, honest, and recoverable.

Acceptance criteria:

1. Guests can browse, upload locally, choose looks, customize, and inspect the selected recipe before sign-up. The need for an account to generate and the actual free allowance are disclosed before the Create action.
2. Guest photo, reference, selection, overrides, and favorites survive refresh and the supported account flow on the same device when local storage is available. Restore is tested with actual binary photos, not only text settings.
3. The default local guest draft expires after 24 hours of inactivity and is cleared after verified transfer or explicit discard. Copy says **Saved on this device** only after durable local storage succeeds; no cloud or cross-device promise is made.
4. If private browsing, quota, or browser eviction prevents durable recovery, show a concise, accurate current-tab limitation and preserve in-memory work while possible. The product does not falsely report a durable save.
5. Sign-up cancellation returns to the intact draft. Failed authentication does not clear photo data or submit a job. Switching identity requires an explicit destination restaurant before transferring a guest draft when more than one is available.
6. The account action states **Create account & create photo** when it resumes an already requested generation. Resume occurs once and only with the same disclosed settings/cost; an expired intent or changed terms returns to preflight.
7. Partial transfer retries reuse successful asset/draft IDs. A lost server response cannot produce duplicate dishes, assets, jobs, or allowance charges.
8. Until transfer, local photo pixels and reference pixels are not sent to analytics or an AI analysis service under the default design. Any future anonymous analysis must change this contract and the visible privacy explanation first.

### PS-19 — Job status and background completion [R1]

**Requirement:** Creation remains understandable and reliable beyond the current browser tab.

Acceptance criteria:

1. Distinguish queued, creating, delayed, completed, failed, and unresolved-provider states. The UI shows a success/result state only after a valid output is durably saved and retrievable.
2. Do not present time-driven lighting/texture stages as actual processing telemetry. Avoid percentage progress unless the service reports meaningful progress. Estimated waiting ranges are labeled and derived from measured completed jobs.
3. After a queued request is acknowledged, close every browser. The independent worker must dispatch/retrieve/archive it, and another authenticated device must later retrieve the result. This must pass in the target hosted environment.
4. Reloading or reconnecting resumes the same job. A delayed job message preserves the original and settings, provides a status refresh, and does not invite an unsafe duplicate request.
5. Transient retrieval failures use bounded retries/backoff. Ambiguous provider submission must reconcile the existing request; it cannot automatically issue a new paid request merely because the first response was lost.
6. Set an explicit maximum unresolved-job window of 30 minutes for the initial release. At that point show a recoverable failure/unresolved state and release the user's reservation once. A later recovered output must not re-debit the user automatically. Provider cost reconciliation remains internal.
7. Cancelling undispatched work releases its reservation once. After provider acceptance, the UI distinguishes leaving the screen from cancellation; it cannot promise to cancel external work or refund provider spend unless that capability is verified.
8. Operational measurements separate upload, queue wait, provider time, archival, and display time. Broad rollout requires the latency and reliability gates in sections 6 and 7.

### PS-20 — Result review and truthful approval [R1]

**Requirement:** Owners enjoy the result, verify the actual dish, and remain in control of reuse.

Acceptance criteria:

1. The completed image is shown fully and prominently by default. Compare original, zoom, and version history are clearly available without a tutorial.
2. Provide both a usable comparison slider and discrete Original/Result views. Keyboard and touch users can compare without precise dragging. Differing image ratios are labeled and never imply exact spatial alignment where none exists.
3. **Use photo** opens a compact finish sheet with a relevant export preview and one fidelity confirmation for the selected version. Unapproved generated photos are not automatically inserted into menus or posts.
4. Approval attaches to the exact asset/version, not the dish generally. Selecting an unreviewed revision cannot inherit another version's approval.
5. Crop-only derivatives can inherit food-content approval through lineage but require a new crop check when they introduce meaningful clipping. Generated revisions and edits changing food appearance require their own review. A repeated identical export does not ask for the same confirmation again.
6. A temporary, editable asset label allows saving/downloading without inventing a dish name. Naming a menu item can be required at the menu handoff instead. Generated names do not introduce ingredients, prices, or other unconfirmed facts.
7. A food-issue action is visible near review and invokes PS-22. Reporting a concern does not destroy the image, original, or prior approved versions.

### PS-21 — Local adjustments and version history [R1]

**Requirement:** Simple edits are quick, reversible, and clearly free of image-generation charges.

Acceptance criteria:

1. Crop, brightness, and warmth are accessible beside the result through Adjust. They update a real local preview and display **No image allowance used**.
2. Saving creates a new version with source/parent lineage. It never overwrites the original or previous approved output. Cancel restores the previous visible version and values.
3. Version history identifies original, generated versions, local edits, approval status, and creation time with usable thumbnails. Reopening a version loads its matching settings and preview.
4. AI setting changes are a distinct action showing their cost before submission. Clicking a free slider or saving a crop cannot call the generation service.
5. During an unsaved edit, the primary action either saves that exact visible edit before finishing or clearly requires Save this version. It must never export an older version while showing the edited preview.
6. Full-quality export, destination crops, and approval status reference the chosen version consistently. Undo and cancellation consume no credits and retain access to all successfully saved versions.

### PS-22 — Food-error correction and allowance recovery [R1]

**Requirement:** Correcting a product failure is distinct from buying another creative direction.

Acceptance criteria:

1. **Something changed in my food** offers Ingredients, Portion/quantity, Plate/packaging, Branding, and Looks artificial, with optional brief detail. A report attaches to the exact result and original.
2. The next screen says whether correction is complimentary, under review, or unavailable and why. It must not route silently into a charged restyle action.
3. Under the proposed default policy, a qualifying report receives one complimentary correction attempt for the original charged job; that attempt can run when ordinary allowance is zero. The server enforces eligibility and prevents duplicate correction chains.
4. If the complimentary correction fails or the owner reports it still materially inaccurate, restore the original image credit once, subject to the disclosed bounded policy in section 9. Rejecting multiple siblings cannot restore multiple credits for one original charge.
5. Correction uses the untouched original for food identity and keeps the requested scene as far as compatible. The previous result remains in history; the corrected output requires review.
6. Creative preference changes such as **Try a blue background instead** are priced normally and described before submission. A mixed food-fix/restyle request separates the free correction from the optional paid creative change.
7. Beyond automatic policy limits, preserve the report and offer a real support/review path without silently charging, endlessly retrying, or promising an unimplemented refund.
8. Rejected versions are marked Needs correction and excluded from default reuse. Prior approved images remain available; no food-error report changes a published menu automatically.

### PS-23 — Consistent multi-dish application [R2]

**Requirement:** Owners can create a coherent set from a successful look with controlled cost and review.

Acceptance criteria:

1. **Apply to more dishes** starts from a saved or approved look, shows the exact selected source count, identifies ineligible inputs, and displays total image cost before submission.
2. Generate and approve one representative sample before submitting the remaining set. Do not charge for the remaining images until the owner explicitly continues with the displayed remaining count/cost.
3. The captured look version applies across the batch. Each output retains its own source identity; one dish cannot borrow another's food. Later edits to the saved look do not change an active batch.
4. A contact sheet supports individual inspection, approval, correction, and removal from export. Approving the sample does not approve every output automatically.
5. Partial successes remain available. Failed slots release allowance once and retry individually; retry does not regenerate or charge for successful slots. Continuation after browser closure resumes the same batch.
6. For three restaurant-look test sets of eight varied dishes each, at least seven of eight outputs per set meet the fidelity/usability rubric and the consistency rubric on first attempt. There are zero critical food-identity errors; failures can be corrected independently.
7. The consistency rubric scores background family, light direction/color, subject scale, framing, and vessel policy from 1–5; every accepted set scores at least 4 on each dimension. Consistency does not require identical food geometry or an unsuitable common crop.

### PS-24 — Export and use in existing tools [R1]

**Requirement:** A reviewed photo becomes a usable file or a correctly contextualized draft with minimal repetition.

Acceptance criteria:

1. After Use photo, present the remembered destination and crop preview in one compact sheet, with Download as primary. More sizes, Full-quality image, menu handoff, and Post Maker remain secondary choices.
2. Preserve existing supported destinations, including Toast, DoorDash, Uber Eats, website/menu, Instagram post/Story, print where supported, and full-quality master. A versioned destination registry records dimensions, format/size limits, verification date, and an authoritative source for any claimed third-party requirement.
3. The preview and delivered file use the same asset version, dimensions, crop transform, and color handling. Export is tested by decoding and visually inspecting the actual file, not only a canvas preview.
4. Full-quality image returns the saved master at its original dimensions and format without cropping or recompression. Preserve or clearly explain its actual file extension; never label an upscaled image as more original detail.
5. Output filenames are readable, collision-resistant, and valid with Unicode dish names. Files have correct MIME types and open on required devices. No unrequested watermark, text, props, or branding is added.
6. If a destination crop clips the dish or protected packaging, default to an eligible fit or ask for adjustment. No new AI generation occurs during a normal crop/resize/export. Any paid generative expansion would require a separate disclosed action and is outside this release.
7. Approval is saved before export; a failed download leaves the approved image in My Dishes and offers retry without generation or extra charge. Repeated identical exports do not repeat fidelity confirmation.
8. Native sharing is used only when supported, with download fallback. UI and analytics distinguish file preparation, browser download initiation, native share completion/cancellation, and confirmed user success; they never claim social publication from a download.
9. Handoff to menus/Post Maker passes the exact approved asset, dish identity, selected look, and relevant occasion. It does not regenerate the photo, publish content, change an existing live menu, or require reselection of the image.
10. After a successful finish, offer **Add another photo** and **Use this look again**. Cross-tool suggestions must not interrupt or obscure the file-saving action.
11. Print exports identify available resolution at the intended physical size and show a useful low-resolution warning when needed. Resizing cannot be described as recovering original detail. Print framing must match the actual delivered image.

### PS-25 — Drafts, autosave, and recovery [R1]

**Requirement:** Normal interruptions do not erase work or produce contradictory saved states.

Acceptance criteria:

1. Signed-in drafts persist source/reference IDs, settings, explicit overrides, look version, intended use, selected version, crop, and job linkage. UI-only state such as an open tooltip need not persist.
2. Show Saving, Saved, Offline, or Couldn't save accurately. Saved appears only after durable acknowledgement. Autosave starts within two seconds of a settled edit under normal connectivity.
3. A failed initial draft load offers Retry and Start new while preserving recoverable local work. It cannot trap the user indefinitely in a loading screen.
4. Reconnect retries valid unsaved work. Cross-device/version conflicts offer **Load latest** or **Keep my changes as a copy**; neither option first repeats the same failing save. Never silently overwrite another editor's newer version.
5. Saving a draft does not approve an image, consume allowance, change a restaurant default, or publish anything. Resume reaches the correct creation/result/export state without submitting a job.
6. Draft lists support pagination or equivalent complete retrieval so older Photo Studio work cannot disappear behind a latest-100 limit shared with other tools. Direct resume by ID remains authorized and available.
7. Sign-out removes local account-scoped private caches from subsequent users of that browser. A source belonging to restaurant A cannot be restored into restaurant B through a remembered UI preference.

### PS-26 — Accessibility and responsive behavior [R1; applies to R2]

**Requirement:** The complete journey is usable with touch, keyboard, screen reader, enlarged text, and reduced motion.

Acceptance criteria:

1. Conform to WCAG 2.2 AA across the studio and dependent account/finish dialogs. Test labels, contrast, keyboard access, focus, reflow, errors, and status announcements manually as well as automatically. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
2. Normal text contrast is at least 4.5:1; large text and essential control boundaries/states meet their applicable 3:1 requirements. Selection never depends on color alone. Disabled states remain understandable even where standards permit exemptions.
3. Every function works with keyboard alone. Dialogs manage and restore focus; Escape has the documented non-destructive behavior; focus is not hidden beneath sticky UI. Single-selection groups have appropriate accessible semantics.
4. Announce upload, save failure, generation completion, and meaningful errors politely or urgently as appropriate. Do not repeatedly announce timers, every slider tick, or decorative animation.
5. Product targets exceed minimum touch criteria: common controls have at least 44 × 44 CSS px effective targets, with no overlapping hit areas. Body and editable input text are at least 16 px; ordinary labels at least 14 px; metadata below 12 px is prohibited. These are product choices, not claims that WCAG mandates those font sizes.
6. At 320 CSS px width, 200% text size, and 400% desktop zoom where applicable, critical actions, labels, selections, and dialogs remain usable without two-dimensional page scrolling, clipping, or obscured focused fields.
7. Safe-area insets, the virtual keyboard, portrait/landscape rotation, long translated-length labels, long restaurant names, and visible validation errors do not cover the primary action or selected photo context.
8. Honor reduced-motion preferences. No essential function requires hover, precision dragging, color perception, or automatic animation.

### PS-27 — Responsiveness and performance [R1; applies to R2]

**Requirement:** The studio feels immediate and stays responsive while photos and jobs load.

Acceptance criteria:

1. Target Core Web Vitals at the 75th percentile separately for phone and desktop: LCP ≤2.5 seconds, INP ≤200 ms, CLS ≤0.1. These are established good-experience thresholds; prelaunch lab results are proxies, not a claim of field compliance. [Web Vitals](https://web.dev/articles/vitals)
2. Under the laboratory profile below, visual acknowledgement of selection occurs within 100 ms at p95; local search/filter results within 300 ms at p95 for 200 styles and 100 saved looks; Browse/Customize opens with usable controls within 300 ms at p95 after app readiness.
3. A normalized preview for a supported 12-megapixel JPEG/HEIC appears within five seconds at p95 on the reference midrange phone, excluding network transfer. Preparing status appears within 200 ms. Larger supported files remain cancellable and cannot freeze the main interface.
4. Test interactive budgets with ten runs per action on a clean session and an existing-draft session. Use a physical midrange phone identified in the report and a desktop lab profile of 4 Mbps down, 1 Mbps up, 150 ms RTT, four-times CPU slowdown, cold cache, and a production build.
5. Load thumbnails sized for their rendered use; lazy-load offscreen catalog images and reserve layout dimensions. Browse must not download all full-resolution examples on initial studio entry.
6. Crop/brightness/warmth manipulation maintains responsive input with visible updates at least 30 frames/second on the reference phone, with at most 200 ms p95 input-to-preview delay. Throttle rendering rather than queueing stale frames.
7. On a 20-minute phone session with ten source replacements, repeated browsing, and ten comparisons, there are no crashes, blank canvases, runaway retained image objects, or lost draft state. After settling, retained memory is no more than 20% above the same fixture's post-first-upload baseline where browser tooling can measure it; on platforms without reliable memory metrics, use repeated stress runs and record the limitation rather than claiming a measured pass.
8. Live creation targets are p50 ≤60 seconds and p95 ≤120 seconds from acknowledged submission to retrievable result under the tested supported load. Never advertise this range until measured. Missing the target blocks broad rollout or requires an explicit product rebaseline before release; it cannot be hidden by excluding queue time.

### PS-28 — Privacy and restaurant isolation [R1; applies to R2]

**Requirement:** Photos, references, drafts, and restaurant styles stay within the owner's intended context.

Acceptance criteria:

1. Private source, reference, draft, result, and history endpoints require authorization for the owning restaurant. Direct asset URLs, guessed IDs, alternate export routes, and resumed jobs are included in cross-restaurant tests.
2. Creating, saving, approving, favoriting, and exporting do not make an image publicly accessible. Public exposure remains an explicit downstream publication action using existing controls.
3. Customer copy accurately identifies whether files are local, uploaded, or sent for processing. Stored originals preserve provenance; public/exported derivatives remove location metadata by default without changing visible image quality.
4. Source images, reference images, freeform notes, dish/restaurant names, and raw search text are excluded from ordinary analytics/error logs. Sanitized IDs and approved categories suffice for funnel analysis.
5. User-supplied references cannot become shared catalog examples without a separate explicit permission workflow. No cross-restaurant recommendation or cache path leaks another restaurant's private image or look.
6. Existing retention/deletion behavior remains functional and documented. Archived looks preserve historical work; deleting an asset uses existing explicit consequences rather than silently breaking related approved publications.

### PS-29 — Measurement and operational visibility [R1; applies to R2]

**Requirement:** Measure real customer progress and detect failures of the core promise.

Acceptance criteria:

1. Implement the event/outcome contract in section 8 with stable draft, source-version, job, asset-version, and export-attempt identifiers. Events deduplicate correctly on refresh, retry, and account transition.
2. Report the full funnel from usable upload to selection, acknowledged generation, available result, approval, prepared export, and download/share initiation. Observed or voluntarily confirmed file receipt is a separate outcome.
3. Measure first-result usefulness, fidelity reports, charged generations per accepted photo, complimentary corrections, time to first usable photo, and reuse of restaurant looks. Break down by source cohort, style/version, destination, guest/signed-in, and device class where privacy permits.
4. Separate active decision time from upload, sign-up, queue, generation, and export wait. A prettier loading screen cannot count as improved creation performance.
5. Monitor worker heartbeat, queue age, stuck requests, provider/retrieval failure, storage failure, duplicate submission, allowance reconciliation, and abnormal fidelity reports. Alert routing and response ownership are tested before broad rollout.
6. Fixture tests cannot emit production funnel success or quality metrics. Internal QA, sample imagery, recovered jobs, and cached output reuse are identifiable and reported separately.

### PS-30 — Compatibility, migration, and release safety [R1; applies to R2]

**Requirement:** The redesign improves the experience without losing existing restaurant work.

Acceptance criteria:

1. Open legacy pre-creation drafts at the new unified working surface with equivalent source, style, overrides, crop, and notes. Result/export drafts reopen at their appropriate state with no new charge.
2. Preserve legacy style IDs through explicit mappings and versioning. Unknown or unavailable styles show a recoverable state; never silently substitute a substantially different look.
3. Existing original/generated/local-edit lineage, approvals, download destinations, restaurant defaults, and menu/Post Maker references remain valid after migration.
4. Migration is repeatable and restartable. Test partially migrated and mixed-version records. Rollback restores a functioning experience and does not double-submit jobs or alter the credit ledger.
5. Ship behind scoped release controls that allow disabling a failing style, generation configuration, or new flow while retaining access to existing assets, approvals, and downloads.
6. No production release is accepted solely from unit tests or an attractive screenshot. All applicable evidence and sign-offs in section 10 are required.

## 5. Required states and recovery behavior

Every state below needs a designed desktop and phone treatment, suitable copy, accessible status, and a tested exit. Failure states must preserve all successfully saved work.

| State | What the owner sees | Available next action | Credit consequence |
| --- | --- | --- | --- |
| Empty | Upload first; one small credible example; Explore styles. | Add photo, camera, browse, or signed-in library. | None. |
| Preparing/uploading | Actual progress when available, otherwise Preparing your photo. | Cancel or wait; valid previous image remains recoverable. | None. |
| Upload rejected | Specific format, size, decode, or transfer issue. | Retry or select another photo. | None. |
| Source ready, analysis pending | Actual source and general starting choices. | Select, browse, customize, create. | None until Create. |
| Analysis uncertain/unavailable | General choices with optional subject correction. | Continue normally or identify photo. | No generation allowance used by guidance. |
| Ready | Selected look, material changes, intended use, cost. | Create photo. | Disclosed reservation on acknowledged submission. |
| Sign-up/sign-in | Account requirement and retained-draft context. | Complete, retry, or return to draft. | No charge from merely opening or cancelling auth. |
| Service unavailable | Saved choices and a truthful availability message. | Retry status, save/leave, or free local adjustments when usable. | None without accepted request. |
| No allowance | Actual balance and available choices. | Existing plans route or free adjustments; qualified correction still works. | No silent purchase or job. |
| Queued/creating | Original, selected look, truthful status. | Leave safely once acknowledged; revisit. | One reservation. |
| Delayed/ambiguous | Still processing or checking request status. | Refresh status; recover later. | No duplicate request or reservation. |
| Terminal generation failure | Specific recoverable message and allowance outcome. | Retry as a new explicit intent, change settings, or use original. | Failed reservation released once. |
| Result ready | Full result, Compare original, Use photo, Adjust, food-issue action. | Review and use or correct. | Existing completed generation accounted once. |
| Correction reported | Clear eligibility and cost policy. | Complimentary fix or support review. | As PS-22; never an undisclosed debit. |
| Unsaved local edit | Edited preview and unsaved status. | Save version or cancel. | None. |
| Approved/exporting | Actual destination preview and preparation status. | Download/share when ready; change destination. | None for ordinary export. |
| Export failure/cancellation | Image remains saved; delivery not claimed. | Retry, alternate format, or device fallback. | None. |
| Autosave conflict | Both newer saved state and recoverable local changes identified. | Load latest or keep a copy. | None; no job replay. |
| Completed | Saved photo and truthful file action confirmation. | Add another photo, reuse look, or optional handoff. | None until another explicit creation. |

## 6. Design and usability acceptance bar

### Visual craftsmanship gate

Review the actual production build, including empty, loading, populated, disabled, error, long-content, and recovery states. A design file alone does not pass.

| Dimension | Required observable outcome |
| --- | --- |
| Hierarchy | The owner can identify their photo, selected look, and next action at a glance. No competing high-emphasis action obscures the task. |
| Restraint | The standard flow shows only relevant decisions; advanced controls are discoverable without filling the page with settings. |
| Image presentation | Correct aspect ratio, intentional crops, no stretching, broken images, blurry thumbnails at intended size, or decorative treatment that misrepresents a result. |
| Typography | Consistent hierarchy and spacing; no clipped/truncated essential instructions; readable size, weight, and contrast. |
| Layout | Shared alignment and spacing tokens; no accidental overlaps, duplicate containers, nested scrolling traps, or floating controls disconnected from their action. |
| Interaction | Visible selection/focus/loading feedback; stable control placement; predictable Back, Cancel, Undo, and Done. |
| Language | Concrete restaurant vocabulary; no unexplained terms such as prompt, inference, seed, token, or model. Costs and changes are stated where the decision occurs. |
| Mobile | The complete job works one-handed where practical; virtual keyboard and system save flows remain usable; essential actions are never hover-only. |

Product design and QA score each dimension independently from 1–5: 1 broken, 2 materially confusing, 3 functional with obvious friction, 4 polished with no material friction, 5 exceptionally clear and refined. Every dimension must score at least 4 from both reviewers. A low dimension cannot be hidden by averaging. Concrete defects take precedence over scores.

Zero known instances of invisible primary actions, illegible essential text, misleading sample previews, lost selections, unannounced charges, or clipped essential controls are allowed in a release candidate.

### Owner usability study

Run an initial moderated discovery round with six to eight restaurant owners/managers to identify friction. After fixes, run a separate acceptance round with at least 12 participants who did not design or build the product. At least eight use phones; at least six describe themselves as having little experience with image-editing tools. Include more than one restaurant type and participants' own suitable photographs.

Use neutral task instructions, not interface labels. Moderator hints count as assistance. Record unsuccessful attempts and abandonments; do not restart the timer or replace participants to improve results. Use a standard live/provider condition, and report it.

| Task | Acceptance threshold |
| --- | --- |
| Improve a photo for the owner's menu and save the actual file. | At least 11/12 complete without moderator help; median active effort ≤90 seconds, p90 ≤180 seconds. Measure waiting separately. |
| Find a particular mood/setting and make one component change. | At least 11/12 complete without a prompt or help; median discovery/customization effort ≤45 seconds. |
| Reuse the restaurant look for another dish. | At least 11/12 complete without rebuilding the settings; median active effort before Create ≤30 seconds. In R1 use the existing restaurant look; R2 also tests named looks. |
| Find and create a game-day or Christmas treatment [R2]. | At least 11/12 find an appropriate released treatment without help; no participant mistakenly changes the everyday default. |
| Explain the pending action. | All 12 correctly identify which image is theirs, whether the next action spends allowance, and whether the action publishes externally. Any interface-caused misunderstanding is fixed and retested. |
| Compare and assess the result. | At least 11/12 find comparison and the food-correction route without instruction. Every exported test image receives an actual owner food review. |

For small studies, report counts and timing distributions; these results do not establish population-wide conversion rates. If a task fails, investigate and repeat the affected task with a fresh participant set after changes. Do not declare success from aesthetic preference alone.

Active effort is the sum of intervals in which the user is making a task decision, entering information, or acting in the product. Record account setup separately and include it in total first-use elapsed time. Do not exclude time spent searching or recovering from confusing UI.

## 7. Live-image and reliability qualification

### Representative image benchmark

Use real, consented or appropriately licensed ordinary restaurant photographs with an unaltered source and documented visible facts. Do not use only professional source photographs, select only successful generations, or substitute illustrative marketing edits for production output.

Initial core set: **60 distinct source photos, five in each of 12 cohorts**:

| Cohort | Required coverage within the set |
| --- | --- |
| Burgers and sandwiches | Stacked layers, visible fillings, cut and uncut sandwiches. |
| Pizza and flatbread | Discernible toppings, partial vs complete serving, browned texture. |
| Pasta and noodles | Glossy sauces, tangled strands, countable accompaniments. |
| Soup, stew, and curry | Bowls, reflections, subtle surface texture, visible garnish. |
| Salads and grain bowls | Mixed ingredients, irregular shapes, small visible toppings. |
| Meat and poultry | Cooking appearance, sauce, bones or skin where present. |
| Seafood | Delicate geometry, shell-on or whole items, distinguishable portions. |
| Mixed platters and takeout | Multiple components, actual containers, paper liners, portion counts. |
| Plated desserts | Sauce, fragile garnish, glossy/frozen elements. |
| Bread and pastry | Crumb, crust, flakes, frosting, irregular handmade form. |
| Hot coffee and tea | Handles, foam/latte art, transparent vs opaque vessels. |
| Cold/bar/branded beverages | Beer foam, ice/layers, cocktail garnish, recognizable package/label. |

Across cohorts, include several cuisines, reflective/dark/light vessels, indoor mixed lighting, clutter, phone portrait/landscape shots, and at least 12 difficult-but-usable inputs. Maintain a separate set of at least 12 unsuitable or ambiguous inputs to test guidance and rejection; exclude them from generation-quality denominators only because that classification was established before testing.

Generate three preassigned treatments per core source: Polish my original, a recommended look, and a supported customized look. For R2, the third treatment includes occasion looks. This produces **180 first outputs**. Assign configurations before running the benchmark and record every outcome, including failures.

Holdout validation: reserve another **24 untouched source photos**, two per cohort, and apply the same three-treatment protocol after the candidate is frozen. Report its **72 outputs** separately. Improvements made after viewing holdout outcomes require new holdout images for the changed candidate.

These are test-plan quantities; no such generations have been run for this specification. Calculate and record the live-test budget before execution, including retries, corrections, and per-style qualification beyond the core set.

### Per-image rubric

Two independent reviewers inspect every original/result pair at normal display size and 100% detail. At least one reviewer must have restaurant/food expertise; they should not know which candidate configuration is expected to win. Disagreements are adjudicated and retained, not silently averaged away.

| Dimension | Pass definition |
| --- | --- |
| Food fidelity | No material change to the visible identity, ingredients, portion, count, or cooking appearance. |
| Serving/branding fidelity | Serving-vessel policy is obeyed; meaningful labels, branding, liquid levels, layers, and garnish are preserved as required. |
| Realism | Physically credible geometry, shadows, reflections, textures, edges, and interactions with the setting. |
| Appetite appeal | Natural, attractive light and color; readable texture; the result improves presentation without making the food implausible. |
| Requested look | Clearly reflects the selected treatment and explicit overrides while obeying protected food constraints. |
| Destination usefulness | Food is legible at the destination's typical viewing size and the eligible crop preserves the intended serving. |

Fidelity dimensions are pass/fail. Score the other dimensions 1–5 using anchored examples established before testing: 1 unusable, 2 major defect, 3 usable only with noticeable compromise, 4 restaurant-ready, 5 exceptional. A **usable first result** passes both fidelity dimensions and scores at least 4 on every other dimension. Owner approval is still required in the actual product.

Critical errors include a different dish, invented prominent ingredient/side, material portion/count change, materially altered branded product, copied food from a reference, or an output from another source/restaurant. Cosmetic preference disagreement alone is not a critical error.

### Quantitative release gates

| Gate | Required result |
| --- | --- |
| Core-set fidelity | At least 95% of first outputs pass both fidelity dimensions; at least 90% within each cohort. |
| Core-set usability | At least 90% usable first results overall; at least 80% within each cohort. |
| Holdout | Same overall and per-cohort percentage thresholds, evaluated separately and rounded up to whole passing outputs. |
| Critical errors | Zero unresolved critical errors in the final qualification run. Diagnose and fix or disable the specific unsupported style/capability before a new complete affected run; retain failures in the candidate history. |
| Catalog qualification | Every released style is checked on at least three compatible sources with two independent first generations each. All six pass fidelity, at least five are usable, and all depict the claimed treatment. Benchmark outputs may count when their configuration matches. Failed styles do not ship as qualified choices. |
| Correction quality | On at least 12 documented real failed outputs covering at least four failure types, at least 10 corrections become usable with no new critical error. If the candidate produces fewer failures, use preserved real failures from earlier development configurations and identify them; do not claim synthetic fixtures prove live repair quality. |
| Batch [R2] | The three eight-dish sets in PS-23 pass, including the consistency rubric. |
| Reliability pilot | At least 100 distinct live single-photo jobs across at least ten workspaces and the required device mix: ≥98% reach a retrievable result without an owner retry; latency meets PS-27; every unsuccessful job has a correct visible outcome and reconciled allowance. Benchmark jobs may count if they use this environment and instrumentation. |
| Negative-path correctness | All deterministic interruption, duplicate-intent, isolation, and ledger tests pass with zero unexplained debits, duplicated submissions, or lost acknowledged outputs. |

Finite test success is evidence for a release candidate, not a promise that generative errors can never occur. Maintain owner review, detect regressions, and record quality by style and pipeline version after release. Do not publish a 95%/98% claim from this qualification sample without separate substantiation.

### Configuration and regression control

Record source IDs, style/version, overrides, model/version where available, pipeline version, quality, dimensions, seed if supported, timestamps, cost, result IDs, reviewer scores, and adjudication. Protect private source data in the evidence store.

Changes to model, prompts, preservation logic, reference behavior, preprocessing, or output resizing require all affected benchmark cohorts and a fresh affected holdout before promotion. Shared/global changes require the full benchmark. A single attractive burger output cannot approve a cross-cuisine release.

## 8. Measurement contract

Use existing event infrastructure where possible. These names describe canonical semantics; rename existing events or map them explicitly so dashboards do not double-count old and new signals.

| Canonical event | Exact trigger and deduplication |
| --- | --- |
| studio_opened | One eligible studio entry per session/draft context; identify guest vs signed-in and entry route. |
| source_ready | A usable normalized source is attached; once per source version. |
| look_selected | An explicit user selection or a separately labeled default application; include origin, style/version, and suggestion eligibility. |
| style_search_used | Search performed; record approved intent category, scope, result count, and selected result rank, not raw private query text. |
| customization_applied | Done applies a changed configuration; record changed control categories, not private notes. |
| generation_requested | The server acknowledges a logical job/reservation; once per job, not button click. Record allowance-consuming, complimentary, or reused. |
| generation_completed / generation_failed | One terminal transition for the logical output; late recovery is a separate event linked to the original state. |
| result_approved / fidelity_reported | Approval or report for an exact asset version; reason codes and state transitions are deduplicated. |
| export_prepared | A valid output file is ready; once per asset/version + destination + transform identity. |
| download_started | Browser download initiation; dedupe retries by attempt while retaining the count of retries. Does not prove the file was saved. |
| share_completed / share_cancelled | Supported native share outcome as reported by the platform. Does not prove publication or recipient delivery. |
| file_receipt_confirmed | Observed during usability testing or voluntarily confirmed by the owner; never inferred from a click alone. |
| look_saved / look_reused | Named look saved, or a new job uses it; distinguish default, favorite preset, and named restaurant look. |
| handoff_started | Existing tool opens with the exact approved asset; separate from publishing or export there. |

Primary product outcome: **a reviewed, useful photo successfully obtained by the owner or deliberately carried into a usable downstream draft**. For production reporting, use approved + export prepared + download/share initiated as an explicitly labeled proxy unless actual receipt is observable. Report stronger confirmed outcomes separately.

Metric definitions:

- **First-result usability:** usable first outputs / all first outputs attempted in the qualified test set, including technical generation failures in the denominator. Also report fidelity among rendered results separately.
- **Photo-to-use conversion:** distinct eligible source drafts reaching approved + export/handoff proxy / distinct source-ready drafts, within seven days. Segment guest/authenticated; report pending cohorts separately.
- **Charged generations per accepted photo:** debited logical allowance-consuming jobs net of credits restored / distinct approved usable asset families. Include free-plan and paid-plan usage; exclude complimentary corrections from customer debits. Show provider cost including complimentary and failed attempts separately so recredits cannot conceal economics. An asset family groups a source's original generation with its local edits and corrections, so exporting three crops does not create three accepted photos.
- **Time to first useful photo:** source selection through observed receipt in studies; source_ready through the labeled export/handoff proxy in product data. Publish both elapsed time and its component waits.
- **Saved-look reuse:** returning active restaurants with at least one new creation using a saved look / returning active restaurants with at least one new creation during a 30-day window. Report simple preset reuse separately.
- **Fidelity-report rate:** unique first allowance-consuming results with a food-accuracy report / unique completed first allowance-consuming results. Segment by style, source cohort when known, and pipeline version; distinguish late reports.

Analytics delivery failures never block creation or export. Every dashboard states its window, denominator, exclusions, sample size, and whether an outcome is observed or inferred.

## 9. Product policies and validation dependencies

These defaults make implementation concrete. They are recommended product decisions, not statements of an existing customer entitlement. Resolve the listed evidence requirements before advertising or rolling out the corresponding behavior.

| Decision | Proposed baseline | Evidence/owner required before rollout |
| --- | --- | --- |
| Complimentary food-error correction | One complimentary correction per original charged job for a material fidelity report. A still-unusable correction permits one recredit of that original job. | Product + finance/engineering validate cost model, ledger behavior, and the live repair benchmark. |
| Automatic recredit bound | Up to three original-job recredits per restaurant in a rolling 30-day window; additional cases receive human review. Explain limits in context, not a surprise after consuming allowance. Confirmed service failures have their normal reservation release and do not count as fidelity recredits. | Support owns a working review path and a response commitment before release. No arbitrary rejection or hidden automatic charge when the bound is reached. |
| Guest recovery | Local durable draft for 24 hours of inactivity; honest fallback where storage is unavailable. No anonymous photo analysis by default. | Engineering demonstrates recovery/expiry/transfer and product verifies privacy copy. |
| Saved-look scope | Photo Studio's new default action controls future photos only. Existing broader brand preferences remain intact and separately managed. | Product signs off migration examples; QA verifies photo, post, and menu behavior before/after. |
| Generation timing | p50 ≤60 s, p95 ≤120 s, with a 30-minute maximum unresolved reservation window. | Operations provides measured target-environment evidence at supported concurrency and a reconciliation procedure. |
| Supported load | Initial qualification: ten concurrently active restaurant workspaces, up to two outstanding single-image requests per workspace, with documented fair queuing and service limits. | Engineering demonstrates load and queue behavior without relying on browser activity; product sets truthful limits if capacity is lower. |
| Platform-specific exports | Preserve current export choices; verify any third-party acceptance claim against official documentation for the release. | Export owner records registry sources/date and actual-file checks. No guarantee that a platform will approve a particular image. |
| Style availability | Retain existing styles that qualify; keep historical access for any retired/unqualified ones. | Design + food reviewer record qualification and replacement messaging. |

An unresolved decision is a named release dependency, not a hidden implementation TODO. If a baseline changes, update affected copy, acceptance criteria, metrics, and tests together before release evaluation. Do not silently weaken a quality threshold after observing a failed candidate.

## 10. Acceptance execution and definition of done

### Required test matrix

Freeze exact OS/browser versions and representative devices in each acceptance report. Browser support includes current stable Chrome, Safari, Edge, and Firefox on desktop, current and previous supported iOS Safari, and current Android Chrome. Identify any unsupported combination explicitly before release; capability detection must provide a truthful fallback.

Layout checks: 320, 390, 430, 768, 1024, and 1440 CSS px widths; short laptop height; phone portrait/landscape; 200% text; 400% desktop zoom. Physical completion tests must include an iPhone with HEIC/camera capture and a midrange Android phone. Screen-reader checks must include VoiceOver/Safari and NVDA with a supported Windows browser. All critical tasks also run keyboard-only.

| Case | Scenario and expected evidence | Requirements covered |
| --- | --- | --- |
| QA-01 | Fresh guest and new signed-in owner can upload immediately; action contrast and next-step visibility pass at all widths. | PS-01, PS-02, PS-26 |
| QA-02 | Inspiration-first style selection → upload → settings preserved → no accidental job. | PS-01, PS-07, PS-08 |
| QA-03 | Actual iPhone HEIC/camera, Android capture, PNG transparency, rotated JPEG, size boundaries, corruption, interrupted upload. | PS-03, PS-28 |
| QA-04 | Replace source during slow upload/analysis; late responses cannot contaminate the current dish. | PS-04, PS-05, PS-06 |
| QA-05 | Every family/drink subtype, uncertain analysis, manual correction, invalid response, service timeout, guest fallback. | PS-05, PS-06 |
| QA-06 | Three recommendations, truthful reasons, saved defaults, compatible serving ware, no analysis-driven reselection. | PS-06, PS-07 |
| QA-07 | Stable library, exact-name search, golden natural-language queries, zero results, scoped search, filters, back/scroll recovery. | PS-08, PS-09, PS-27 |
| QA-08 | All released examples, card/detail accessibility, subject relevance, and actual treatment qualification. | PS-10, PS-13 |
| QA-09 | Favorite/unfavorite, guest transfer, recents after use, retired preset, empty Saved, account isolation. | PS-11, PS-18, PS-28 |
| QA-10 | Visual customization, drink controls, override retention, incompatible options, reset, undo, cancel, no paid calls. | PS-07, PS-12, PS-13 |
| QA-11 | Reference source separation, invalid/removed reference, protected branding, cross-cuisine matching. | PS-14, PS-13, PS-28 |
| QA-12 | Christmas/game-day discovery, subtle vs bold styles, destination compatibility, no default contamination. | PS-15, PS-09, PS-24 |
| QA-13 | Save/rename/duplicate/archive look, explicit default scope, original migration, saved-version reuse on a different dish. | PS-16, PS-30 |
| QA-14 | Create preflight for every format, last-credit race, duplicate taps, two tabs, timed-out response, cached result reuse. | PS-17, PS-19 |
| QA-15 | Guest refresh, local storage failure/expiry, sign-up cancel/failure/success, partial transfer and duplicate replay. | PS-18, PS-25 |
| QA-16 | Close all browsers immediately after accepted submission; recover on another device; independent worker evidence. | PS-19, PS-29 |
| QA-17 | Delayed job, provider ambiguity, 30-minute unresolved policy, cancellation, late result, storage failure. | PS-19, PS-17, PS-29 |
| QA-18 | Full result, slider and toggles, zoom, version-specific approval, unnamed direct export, accessible food report. | PS-20, PS-26 |
| QA-19 | Free adjustments, actual preview/export identity, save version/cancel, lineage, approval rules, AI-edit cost. | PS-21, PS-20, PS-24 |
| QA-20 | Every correction reason, zero remaining credits, duplicate requests, failed repair, single recredit, policy boundary/support. | PS-22, PS-17 |
| QA-21 | Sample-first batch, exact remaining cost, mixed failures, retry only failed, interrupted recovery, consistency contact sheet. | PS-23, PS-16, PS-19 |
| QA-22 | Actual decoded export for every format, crop clipping, full-quality identity, failed download, iOS/Android save/share fallback. | PS-24, PS-20, PS-26 |
| QA-23 | Menu/Post Maker handoff retains exact image/context with no new generation or publication. | PS-24, PS-15, PS-16 |
| QA-24 | Offline save, failed initial load, cross-device conflict/copy, older-than-100 draft, correct resume, sign-out cleanup. | PS-25, PS-28 |
| QA-25 | Keyboard, screen readers, contrast, text/zoom/reflow, reduced motion, touch targets, safe areas, virtual keyboard. | PS-26, PS-02 |
| QA-26 | Cold-load, action/search/canvas timings, ten-replacement phone stress, live latency, supported concurrent load. | PS-27, PS-19 |
| QA-27 | Cross-restaurant access/cache tests, private reference handling, derivative metadata, no private analytics payloads. | PS-28, PS-29 |
| QA-28 | Funnel semantics, retry deduplication, no false download/publication success, alert delivery and owner response. | PS-29, PS-24 |
| QA-29 | Legacy draft/style/result/approval migrations, partial migration, rollback, release controls, retained existing-tool use. | PS-30, PS-16, PS-25 |
| QA-30 | Full source/result benchmark, independent holdout, catalog/reference/correction qualification, owner usability acceptance. | PS-10, PS-13, PS-14, PS-20, PS-22, PS-23 |

Each QA case expands into executable checks linked to the individual acceptance IDs it covers. A passing case summary without that criterion-level evidence is insufficient. Automation should focus on contracts, races, persistence, calculations, and regressions; visual taste, food truth, and real-device completion require human evidence.

### Defect severity and release rules

| Severity | Examples | Release treatment |
| --- | --- | --- |
| S0 — Critical | Cross-restaurant disclosure, unrecoverable original loss, wrong customer's output, systematic duplicate debit. | Stop rollout, contain immediately, reconcile affected data/allowance, and require regression evidence. |
| S1 — Major | Invisible primary action, inability to complete a core journey, job lost after acknowledgement, critical food-identity error in the candidate, falsely reported successful save/export. | Blocks release of the affected experience or capability. |
| S2 — Material friction | Misleading label, lost filter/override, substantial unnecessary repetition, degraded supported-device behavior, important discoverability failure. | Blocks broad launch of the affected core journey. Fix and retest; a feature flag may hold back an optional capability while a complete core ships. |
| S3 — Minor | Cosmetic issue with no readability, interaction, trust, or completion impact. | May be logged with an owner and date only if the craftsmanship gate still passes. |

A high average quality score cannot offset a privacy failure, incorrect charge, critical food error, or unusable phone flow. Disabling a failing optional capability is acceptable only when the remaining released scope is coherent, accurately described, and fully qualified.

### Evidence required for acceptance

The release record must contain:

1. Release candidate identifier, feature scope, exact browser/device matrix, and generation/configuration versions.
2. A criterion-level pass/fail/not-run register covering every requirement in the release, with links to test evidence and unresolved defects.
3. Screenshots or short recordings of desktop and actual-phone entry, selection, customization, generation status, review, finish, and representative failure states.
4. Actual exported files for each destination and their decoded dimensions/format/crop checks; original/result pairs and review scores for the image benchmark.
5. Complete benchmark denominators, failures, cohort results, holdout results, adjudications, latency distribution, and cost per usable output.
6. Owner usability notes, assistance counts, completion counts, active/elapsed times, and resulting fixes.
7. Duplicate-intent, ledger, source-identity, cross-restaurant isolation, offline/conflict, migration, and closed-browser completion evidence.
8. Accessibility and performance results with limitations stated; no unsupported claim of WCAG compliance or field performance.
9. Tested monitoring/alert route, worker ownership, customer recovery policy, and a practiced disable/rollback procedure.
10. Product, design, engineering, and QA acceptance; a food/restaurant reviewer accepts the image-quality evidence. These are project release responsibilities, not a request for conversational approval at every implementation step.

### Controlled rollout

Start with the internal acceptance environment, then a small restaurant pilot, then broader availability. Advance only after the applicable gates pass. In the first pilot, manually review the first ten results per restaurant where consent permits and inspect any food-error reports promptly.

Immediately pause affected generation on a confirmed privacy/source-identity/duplicate-charge incident. Pause a style or configuration after a confirmed critical food error pending review. Trigger investigation if completion falls below 98% or reported fidelity issues exceed 5% over the latest 100 eligible jobs; account for small samples and compare like-for-like style cohorts. Monitoring thresholds are investigation controls, not an assertion that unreported images are correct.

Keep approved assets, history, free adjustments, and downloads available during a generation pause wherever safe. Re-enable only with a diagnosed cause, corrected candidate, reconciled customer outcomes, and passing affected regression evidence.

### Definition of done

Photo Studio is complete when every in-scope requirement is demonstrably satisfied, the applicable quality gates pass on the release candidate, and real restaurant owners can obtain accurate, attractive, usable photographs without assistance or unexpected consequences. A beautiful page, a successful API response, or a passing build is necessary evidence in its own area, but none constitutes acceptance of the whole experience.

## 11. Baseline and source notes

The recommendations are grounded in the prior review of the local desktop/phone guest interface and the implementation of the authenticated flow. That review did not establish current production behavior, live image fidelity, provider latency, or physical-phone completion. Historical project audits are context, not proof that a previously reported issue remains present.

Relevant implementation anchors:

- Entry, selection, and controls: `app/components/studio-workbench.tsx`.
- Authenticated generation, review, edits, and saved-look behavior: `app/components/photo-studio.tsx`.
- Guest draft/account transfer: `app/components/guest-studio.tsx`, `lib/guest-studio.ts`.
- Catalog and recommendations: `lib/photo-styles.ts`, `lib/studio-onboarding.ts`.
- Formats, export identities, and destination definitions: `lib/studio.ts`, `lib/photo-destinations.ts`, `app/components/photo-downloads.tsx`.
- Existing broader product review: `docs/CORE_FEATURE_REVIEW_2026-09-16.md`.

External design/quality references inform the acceptance contract; they do not demonstrate compliance by the existing app:

- [Apple — Discoverable design](https://developer.apple.com/videos/play/wwdc2021/10126/): prioritize essential actions and expose meaningful capability through the interface.
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessibility conformance reference for PS-26.
- [Google — Web Vitals](https://web.dev/articles/vitals): field performance thresholds used in PS-27.

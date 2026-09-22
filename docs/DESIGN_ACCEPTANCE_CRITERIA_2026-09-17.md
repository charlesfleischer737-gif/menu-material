**Menu Material — design acceptance criteria and Codex handoff**

Prepared September 17, 2026. Source: [the 30-point design review](DESIGN_REVIEW_2026-09-17.md).

**Status: implementation in progress under the user's subsequent implementation goal.** Acceptance status is maintained in the linked tracker. Publication, purchases, and changes to production data remain outside this implementation handoff.

**User-directed deferral, September 17, 2026:** Account-recovery integration is on hold. UX-29.5 and UX-29.6 are explicitly deferred, not passed. Continue all independent account-entry and design work. Do not invent a recovery contact, introduce a nonfunctional recovery action, or repeatedly request the deferred integration.

The intended result is a cohesive, photography-first product with clear actions, comfortable controls, readable artwork, and purposeful spacing. Preserve the successful food imagery, restrained branding, aligned Explore grid, and restaurant-specific artwork. Improve the application around them.

A passing build cannot establish that a site is beautiful or easy to use. Acceptance requires measurable checks, working interactions, and inspection of the actual rendered screens. Passing this specification provides a strong, documented quality baseline; it does not substitute for observing customers use the product.

**How to use this specification**

- `UX-01` through `UX-30` correspond exactly to the numbered findings in the source review. Each numbered subcriterion is independently verifiable.
- The shared gates apply to every affected surface, in addition to its individual criteria.
- Pixel measurements are CSS pixels at 100% browser zoom and default text size unless the criterion explicitly tests enlargement. Above-the-fold targets use the named fixture and viewport, without an open software keyboard.
- These are proposed acceptance thresholds for the redesign, not measurements of the current implementation. Do not shrink text, conceal required information, remove supported features, or loosen thresholds to manufacture a pass.
- Implementation choices such as a drawer versus a switchable pane are flexible where the criteria describe an outcome. Record the chosen pattern so other pages use it consistently.
- Record each criterion as **Not started**, **In progress**, **Passed**, **Failed**, **Blocked**, or **Deferred by user**, with evidence. Untested and blocked criteria do not count as passed. Scope exclusions must be explicit; they cannot disappear from the completion report.
- Use the accompanying [acceptance tracker](DESIGN_ACCEPTANCE_TRACKER_2026-09-17.md) as the starting checklist. Its status describes verification, not whether matching code already exists. Recheck existing work before changing it.

**Shared visual and interaction contract**

| Area | Required baseline |
| --- | --- |
| Interface typography | One UI font family for working controls; 16px body/input text, at least 14px action/field labels, and 12–13px only for secondary metadata. Body line height 1.45–1.65. Long reading pages may use 1.5–1.7. |
| Working titles | Shared desktop scale of 28–32px and mobile scale of 24–28px; consistent weight, line height, and header spacing. Explicit editorial/restaurant-artwork exceptions are permitted. |
| Buttons | Standard height at least 44px; prominent actions 48px; a documented 52px marketing variant is permitted. Use an 8px control radius, consistent horizontal padding, and 8px icon/label spacing. Height may grow for enlarged or wrapped text. |
| Icon controls | At least 44 × 44px non-overlapping hit areas; visible icons can remain 16–20px. Inline links within prose are a separate pattern. |
| Spacing and alignment | Use a shared scale based on 8px, with 4px for small internal adjustments. Prefer 8/16/24/32px gaps, 16px phone gutters, and 24–32px desktop gutters. Equivalent edges, baselines, and grid-row footers align within 2px. Document optical exceptions. |
| Corners and elevation | Shared 8px control and 12px panel radii. Reserve pills for deliberate chips/badges. Use one restrained elevation system; do not stack borders and shadows without a functional purpose. |
| Colors | Shared semantic tokens for action, text, muted text, canvas, surface, border, selected, focus, warning, error, disabled, and loading states. Tokens resolve on public pages and in portals. Restaurant artwork uses a separate palette. |
| Action hierarchy | Each task/action group has one clearly dominant next step. Secondary actions remain discoverable. Destructive actions do not resemble the routine primary action. |
| Dialogs and sheets | Visible title and close control, a predictable scroll region, visible prerequisites, and persistent actions for long forms. No nested scrolling unless the content genuinely requires it. |
| Interaction feedback | Hover, focus, pressed, selected, disabled, loading, success, and error states are distinct where applicable. Loading does not resize the button or allow duplicate submissions. |

Normal text must reach 4.5:1 contrast; large text may use 3:1 under the [W3C contrast definition](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Necessary control boundaries, icons, and state indicators must reach 3:1 against adjacent colors under [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Do not assume every decorative border needs that ratio. For this product, keep disabled labels at least 3:1 and explain important disabled actions in normal-contrast text; that disabled-label threshold is a design choice, not a WCAG requirement.

The 44px hit-area baseline is a product usability standard aligned with [enhanced target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), not a claim that all smaller controls violate WCAG AA. At 320px width, ordinary page content must reflow without page-level horizontal scrolling. A deliberately pannable menu/artwork canvas can be an exception, but its surrounding controls must reflow. See [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

**Required review matrix**

Use stable local or isolated preview fixtures. Do not alter live restaurant data, publish a real menu, purchase a plan, send recovery messages to real customers, or consume paid generation credits merely to obtain acceptance evidence.

| Check | Required coverage |
| --- | --- |
| Reference desktop | 1280 × 720: every affected page, dialog, and primary state. |
| Reference phone | 390 × 844: every affected public page and workflow, including open sheets/dialogs and persistent actions. |
| Small phone | 320 × 740: shell/navigation, authentication, settings, My Dishes, Post Maker, Menus, and customer menus. Verify wrapping and overflow. |
| Tablet | 768 × 1024 and 1024 × 768: navigation, menu selection/editing, Post Maker inspector, library, and dialogs. |
| Larger desktop | 1440 × 900: main workspace pages and public layouts; check overly long text measures and excessively stretched panels. |
| Breakpoint edges | Resize continuously through changed breakpoints; inspect immediately below and above them. Include the previous menu transitions near 1050, 1100, and 1250px if retained. |
| Text and input | 200% text enlargement on representative public, workspace, and dialog screens; keyboard-only traversal of each changed interaction. Test long values and validation errors. |
| Browser coverage | Full reference checks in Chromium; affected-layout and interaction smoke checks in Safari and Firefox. Record browser versions. |
| Device behavior | On iOS Safari and Android Chrome, check software keyboard, safe areas, scrolling sheets, and any changed upload/share/download flow. Browser emulation alone cannot pass a device-specific criterion; record unavailable device coverage as unverified. |

Do not take the full Cartesian product of every fixture and browser. Use the reference widths for comprehensive visual review, and the additional sizes/browsers for the specified risks. Expand coverage when a defect or changed behavior justifies it.

| Fixture | Required content/states |
| --- | --- |
| Library | Empty; one dish; at least 12 mixed dishes; one-, two-, and three-line names; a name at the existing maximum length; short and wide supported prices; photos and missing photos; mixed approval/archive states. |
| Restaurant settings | Short and two-line restaurant names; square and wide logos; existing settings populated; unsaved edits; validation and save failures. |
| Menus | At least five menus and six sections in the customer-menu fixture; a multi-page food menu; a drink menu with multiple size/price columns; a long item name and description; draft, published, and edited-since-publication states. |
| Photo Studio | Empty/start state; existing successful photo; required crop confirmation unchecked/checked; processing and failure states; styles with short and long names; no search results. |
| Post Maker | Every built-in design in each format it supports; bright, dark, and visually busy existing photos; square, portrait, and landscape sources; short and maximum-supported headlines; photo-free designs where supported. |
| Plans and account | Logged out; existing Free account with its actual allowance; currently unavailable Pro; available Pro state only through a safe test fixture if supported; login/signup errors and a recovery test account. |
| Operational screens | More tools with each available task; populated/empty activity; staff upload through an isolated test link; administration using a test account with the required role. |

**Acceptance criteria by recommendation**

**UX-01 · P1 — Restore pricing calls to action**

Public pricing and the account plan dialog.

- [ ] **UX-01.1** On both reference widths, every available plan action is visibly styled before hover. Its text reaches 4.5:1 contrast, its hit area meets the button baseline, and its label is fully visible.
- [ ] **UX-01.2** Default, hover, keyboard-focus, and pressed states work when the pricing component renders outside the workspace and inside its dialog. Computed action colors resolve without depending on a missing ancestor variable.
- [ ] **UX-01.3** The Free action opens the intended signup or Free-plan continuation path. Keyboard activation produces the same result as pointer activation; the user does not land at a dead end.
- [ ] **UX-01.4** Unavailable Pro has a legible unavailable treatment and an adjacent availability explanation. It cannot look like an enabled purchase action or silently do nothing when presented as a link.
- [ ] **UX-01.5** The pricing cards preserve a clear plan-name → price → benefits → action hierarchy on desktop and mobile.

Evidence: Paired desktop/phone captures of standalone pricing and the plan dialog, computed text/background contrast, and a Free-path interaction check. Use UX-23 for plan-state truthfulness.

**UX-02 · P1 — Make photo-download prerequisites obvious**

Photo finish/download sheet and its share/download actions.

- [ ] **UX-02.1** At 390 × 844, the crop confirmation control, its essential explanation, and the download action are visible together without scrolling. Keep the optional reuse actions after the required flow.
- [ ] **UX-02.2** Before confirmation, Download and any equally gated Share action look disabled, are programmatically unavailable, and have a nearby explanation such as “Confirm the crop to download.” The explanation is not only a tooltip.
- [ ] **UX-02.3** Confirming the crop enables the appropriate actions immediately, without moving the footer. Existing crop/confirmation rules remain intact; the redesign cannot bypass the prerequisite.
- [ ] **UX-02.4** The preview and its crop controls remain usable at all required phone widths. The footer never covers the checkbox, crop controls, error message, or last optional action.
- [ ] **UX-02.5** A successful download uses the selected photo/crop and starts once per activation. A failure leaves the user in the sheet with a clear retry path and preserves the selected crop.

Evidence: Unchecked, checked, loading, and failure captures at 390 × 844; one isolated export check and the existing relevant crop/export regression tests.

**UX-03 · P1 — Reveal menu editing controls on tablets**

Menu dish selection and inspector at intermediate widths.

- [ ] **UX-03.1** At 768 × 1024 and 1024 × 768, selecting any visible dish reveals that dish’s name and price controls inside the current visible viewport after the opening transition. No discovery scroll or second “Edit” activation is required.
- [ ] **UX-03.2** The selected outline row, highlighted proof item, and inspector heading identify the same dish. Selecting a second dish updates all three without showing stale values.
- [ ] **UX-03.3** A drawer, pane switch, or deliberate scroll/focus pattern clearly identifies where editing happens. Selection does not unexpectedly open the software keyboard before the user chooses a text field.
- [ ] **UX-03.4** Changing the name or price updates the corresponding preview and persists through the existing save mechanism. Returning to preview preserves the selection and current edits.
- [ ] **UX-03.5** Resizing into and out of the tablet layout does not hide unsaved edits, strand keyboard focus, or require reloading the document.

Evidence: A recording at 1024 × 768 showing selection → visible controls → edit → preview, plus the portrait-tablet and breakpoint-edge checks.

**UX-04 · P1 — Enlarge icon hit areas**

Close, reorder, remove, undo/redo, zoom, and comparable icon actions.

- [ ] **UX-04.1** All audited standalone icon buttons meet the 44 × 44px hit-area baseline at each applicable breakpoint, including the Post Maker sheet controls that previously measured 14 × 36px and 16 × 16px.
- [ ] **UX-04.2** Hit rectangles do not overlap neighboring actions. Clicking/tapping the padded edge triggers only the intended action.
- [ ] **UX-04.3** Every icon-only button has a specific accessible name. Repeated actions identify their item where needed, such as “Remove Marinated olives,” rather than several indistinguishable “Remove” buttons.
- [ ] **UX-04.4** Keyboard focus is visible and not clipped by rounded containers. Hidden or inactive responsive copies are not keyboard-focusable.
- [ ] **UX-04.5** Larger hit areas do not distort the icon, misalign adjacent text, or create wrapping/overflow at 320px.

Evidence: A measured target inventory for affected icon controls, phone captures, and a keyboard traversal.

**UX-05 · P1 — Improve contrast of active menu actions**

Add dish and small green/gray interface actions.

- [ ] **UX-05.1** “Add dish” uses at least 14px text with at least 4.5:1 foreground/background contrast in default and hover states, and meets the shared hit-area baseline.
- [ ] **UX-05.2** Audit the actual rendered foreground/background pairs of equivalent active commands in menu outline, inspector, and preview controls; all meet the relevant text/non-text thresholds.
- [ ] **UX-05.3** Active, disabled, selected, and destructive states remain distinguishable without relying on green-versus-gray hue alone.
- [ ] **UX-05.4** The contrast fix uses shared action/state tokens rather than an isolated color that introduces another button family.

Evidence: A compact contrast table with selectors, actual colors, ratios, and screenshots of active versus unavailable actions.

**UX-06 · P1 — Make restaurant settings manageable**

Restaurant settings dialog.

- [ ] **UX-06.1** Settings are grouped into Restaurant details, Restaurant look, and Ordering & hours, or equivalently clear groups. Each group is directly reachable through one visible navigation action.
- [ ] **UX-06.2** The title/Close area and Save/status area remain visible while the active group scrolls, at desktop and phone widths. There is one primary body scroll region.
- [ ] **UX-06.3** Field groups use the shared spacing scale. Routine adjacent fields do not retain the approximately 40px gaps observed in the original dialog unless a clear section boundary warrants them.
- [ ] **UX-06.4** Moving between groups preserves all unsaved values. Closing with unsaved edits provides an explicit keep-editing/discard path; saving successfully clears the unsaved state.
- [ ] **UX-06.5** Validation identifies the field and opens/focuses the relevant group when necessary. Saving and save failure are visible near the action; failure does not erase input or claim success.
- [ ] **UX-06.6** Opening the mobile keyboard keeps the focused field reachable and the dialog dismissible. The final field can be scrolled entirely above the action footer.

Evidence: All three groups on desktop/phone, one scroll recording, and save/validation/failure checks using isolated settings.

**UX-07 · P2 — Create a shared button family**

All application buttons, public CTAs, and dialog actions.

- [ ] **UX-07.1** Primary, secondary, quiet, destructive, disabled, and loading variants share one component contract or equivalent reusable style contract. Same-role controls have matching computed typography, radius, height, icon gap, and focus treatment.
- [ ] **UX-07.2** Standard, prominent, and marketing sizes follow the shared baseline; any additional size is documented with a concrete use case. No legacy 41px primary actions or unexplained primary-action pills remain.
- [ ] **UX-07.3** Labels and icons are optically centered. Adjacent controls of the same size align within 2px, including mixed link/button implementations.
- [ ] **UX-07.4** Loading preserves the original button footprint and meaningful label. Disabled actions cannot execute; errors re-enable retry when retry is valid.
- [ ] **UX-07.5** Public pricing, workspace pages, and portal dialogs render the same variants correctly. Wrapping at enlarged text sizes increases height instead of clipping labels.

Evidence: A state/size contact sheet from actual components, plus representative public, workspace, and portal screenshots.

**UX-08 · P2 — Unify working-screen headings**

Photo Studio, My Dishes, Post Maker, Menus, Explore, and More tools.

- [ ] **UX-08.1** Standard working screens use the same title scale, header padding, status position, and action alignment at a given breakpoint.
- [ ] **UX-08.2** Title/content edges line up within 2px across standard working screens. Corresponding top spacing follows the same token; longer titles may grow the header rather than overlap actions.
- [ ] **UX-08.3** Each screen has one unambiguous primary heading. Document names, eyebrows, and supporting subtitles do not compete with it at the same visual weight.
- [ ] **UX-08.4** Explore may retain an editorial serif title, but its gutter and relationship to navigation/actions remain consistent. Document this exception; do not extend it arbitrarily to ordinary form headings.
- [ ] **UX-08.5** Long document names and 200% text enlargement wrap cleanly, with status and actions remaining readable and reachable.

Evidence: A matched-viewport contact sheet of all six page headers, with title/gutter measurements.

**UX-09 · P2 — Consolidate interface colors**

Application chrome, public controls, dialogs, and operational pages.

- [ ] **UX-09.1** Define one semantic interface palette covering the roles in the shared contract. Equivalent roles use the same resolved tokens across all in-scope pages.
- [ ] **UX-09.2** No unresolved variable, accidental transparent fill, or fallback color changes the visibility of a control when it moves between public layout, workspace, and portal.
- [ ] **UX-09.3** Canvas/surface/border hierarchy clearly separates the workspace from cards and overlays without adding competing cream, gray, or green families for the same role.
- [ ] **UX-09.4** Warning, error, selected, and success treatments include text, icon, or shape cues where they convey state; color alone is insufficient.
- [ ] **UX-09.5** Changing application tokens does not recolor restaurant-defined menus, post artwork, uploaded logos, or photos. Their editing controls still use the interface palette.

Evidence: A token-to-role inventory and cross-page color contact sheet, including a custom-colored restaurant menu and post.

**UX-10 · P2 — Apply a consistent spacing rhythm**

Headers, forms, panels, grids, toolbars, and dialog interiors.

- [ ] **UX-10.1** Repeated page gutters, panel padding, field gaps, and section gaps use named shared spacing values. One-off values have an identifiable layout or optical reason.
- [ ] **UX-10.2** Across comparable workspace screens, the left edges of titles, introductory text, toolbars, and content align within 2px unless the layout deliberately uses separate columns.
- [ ] **UX-10.3** Form labels sit consistently near their own fields, related controls form visible groups, and section gaps are larger than within-group gaps.
- [ ] **UX-10.4** Buttons, input baselines, icon labels, and card footers do not appear slightly staggered in matched screenshot review. Check long text as well as short placeholder content.
- [ ] **UX-10.5** Reducing excessive whitespace does not make touch targets smaller, merge unrelated groups, or remove useful breathing room around the central photo/menu/post.

Evidence: Annotated before/after captures for settings, a workspace header, a card grid, and an editor toolbar; list any intentional spacing exceptions.

**UX-11 · P2 — Compact mobile navigation**

The signed-in mobile shell and its five primary destinations.

- [ ] **UX-11.1** Choose and consistently use one phone navigation pattern. At 390 × 844, combined brand/navigation chrome occupies no more than 112px, excluding the device safe-area inset.
- [ ] **UX-11.2** All five main destinations remain available in one tap. Visible labels fit on one line at default text size, use consistent short names, and match their accessible names.
- [ ] **UX-11.3** Each destination meets the hit-area baseline. Current location has a visible non-color-only indicator and the appropriate current/selected semantics.
- [ ] **UX-11.4** Account, settings, and utility actions remain discoverable in a separate utility area; compacting navigation does not remove access to them.
- [ ] **UX-11.5** If using bottom navigation, reserve its actual height plus safe-area inset and coordinate it with task footers. Rotation and text enlargement do not hide a destination or create page-level horizontal scrolling.

Evidence: Each active destination at 390px, a 320px capture, and safe-area/keyboard checks for the selected pattern.

**UX-12 · P2 — Reduce mobile menu toolbar height**

Phone menu editor and preview controls.

- [ ] **UX-12.1** Using the standard populated food-menu fixture at 390 × 844, the actual menu proof begins at or above y=380px, and at least 300px of its vertical area is visible initially above persistent bottom chrome.
- [ ] **UX-12.2** The primary action is clearly named and reachable. Less frequent actions can move into a labeled overflow menu, but publish/export/design functions remain available with no more than one extra activation.
- [ ] **UX-12.3** Workspace mode, Print/Phone preview, and zoom controls have distinct purposes and selected states; redundant labels and hints do not consume separate permanent rows.
- [ ] **UX-12.4** Preview controls retain adequate hit areas and labels. Meeting the fold target by shrinking controls or rendering an unusably tiny proof does not pass.
- [ ] **UX-12.5** Switching modes, opening overflow, and returning from an inspector preserve the selected menu, edits, and sensible preview position.

Evidence: A measured initial phone screenshot and a brief edit → preview → export/publish-control walkthrough in an isolated fixture.

**UX-13 · P2 — Give the desktop menu proof room**

Laptop/desktop menu workspace and responsive panel transitions.

- [ ] **UX-13.1** At 1280 × 720, the default preview region has at least 480px of usable horizontal space. A focus/preview arrangement with at least 640px is available in no more than one action; measure the region, not a paper page intentionally reduced by Fit page.
- [ ] **UX-13.2** Outline and inspector visibility can be changed without losing selection or edits. Their reopen controls remain labeled or accessibly named and visible.
- [ ] **UX-13.3** Fit page, zoom in/out, and any existing fit-width behavior remain predictable. Zoom changes do not distort the artwork or misalign item selection overlays.
- [ ] **UX-13.4** The outline, preview, and inspector each scroll only when needed. Users do not have to scroll the entire document to locate the inspector after selecting an item.
- [ ] **UX-13.5** Continuous resizing and breakpoint-edge checks reveal no sudden unreachable control, horizontal page overflow, or panel that retains focus while becoming hidden.

Evidence: Default and focus-mode screenshots with widths, one zoom/selection check, and recordings across the affected laptop/tablet breakpoints.

**UX-14 · P2 — Align dish cards**

My Dishes grid and card content.

- [ ] **UX-14.1** Prices occupy the same dedicated location on every card, instead of sitting beside short titles but below long titles. Wide supported prices remain complete.
- [ ] **UX-14.2** Cards in each grid row align their name region, price region, and status/action footer within 2px using one-, two-, and three-line names.
- [ ] **UX-14.3** Visible dish-name text stays at the shared readable size. If names are truncated, the full name is available through a tap/keyboard-accessible detail view, not only a hover tooltip.
- [ ] **UX-14.4** Photo, missing-photo, selected, archived, and approval states do not unexpectedly change card alignment or the position of neighboring actions.
- [ ] **UX-14.5** The two-column phone presentation passes at 390px; at narrower widths, a deliberate single-column/list fallback is acceptable if it preserves readability and navigation.

Evidence: Mixed-name/photo/status grid captures on desktop, 390px, and 320px; open a truncated name’s full details.

**UX-15 · P2 — Simplify mobile library filters**

My Dishes search, filtering, sorting, archive, and selection.

- [ ] **UX-15.1** Search remains directly visible. Secondary filter/sort controls use a compact grouping with a visible active-filter count and clear reset action.
- [ ] **UX-15.2** With the populated default fixture at 390 × 844, the first dish card begins at or above y=320px. Do not meet this by reducing text or control targets below the baseline.
- [ ] **UX-15.3** Archived is an explicit, labeled toggle/filter state. Its visible state matches the results and the active-filter summary.
- [ ] **UX-15.4** Applying, closing, and reopening filters preserves the choices. Result counts and the zero-results state accurately describe the filtered collection.
- [ ] **UX-15.5** Selection mode has a distinct entry/exit treatment and selection count. Entering or leaving it does not silently clear the user’s search or filters.

Evidence: Default, filtered, no-results, and selection captures plus a filter reopen/reset interaction check.

**UX-16 · P2 — Standardize tabs and segmented controls**

Inspector tabs, Post/Story, Print/Phone, account entry, and More tools.

- [ ] **UX-16.1** Document two reusable patterns: tabs for switching substantial views and segmented controls for compact mutually exclusive choices. Use each consistently where its purpose applies.
- [ ] **UX-16.2** Within each pattern, selected, unselected, hovered, focused, and disabled styles are consistent and visibly different.
- [ ] **UX-16.3** Semantics match behavior: navigation links identify the current destination; tabs expose their selected panel and support tab keyboard behavior; other choices use appropriate button/radio semantics.
- [ ] **UX-16.4** Arrow keys, focus order, and activation do not unexpectedly move into hidden panels. Hidden responsive duplicates are absent from keyboard navigation.
- [ ] **UX-16.5** Labels remain legible, targets meet the baseline, and selected indicators do not jump or clip when labels wrap at enlarged text sizes.

Evidence: A cross-component state contact sheet and keyboard checks covering each pattern.

**UX-17 · P2 — Remove duplicate Post Maker editing controls**

Post Maker desktop inspector and mobile editing sheet.

- [ ] **UX-17.1** At widths where the inspector is permanently visible, redundant “Edit design” and “Done editing” controls are absent visually and from the keyboard/accessibility navigation.
- [ ] **UX-17.2** At widths where editing uses a sheet, one clear Edit design entry opens it and one clear dismissal action returns to the preview.
- [ ] **UX-17.3** Inspector tabs remain available on desktop. Removing the duplicate controls does not remove any actual editing capability.
- [ ] **UX-17.4** Opening, closing, and resizing the editor preserve current design settings and return focus to an appropriate visible control.

Evidence: Matched desktop/mobile captures and one responsive editing interaction recording.

**UX-18 · P2 — Use a shared mobile action footer**

Persistent primary actions in Photo Studio, Post Maker, Menus, and long sheets.

- [ ] **UX-18.1** Persistent task actions use one shared spacing, surface, border, and button hierarchy. Every participating screen clearly identifies its primary next step.
- [ ] **UX-18.2** The content area reserves the footer’s actual rendered height, including safe-area padding and any separate bottom navigation. The last card, template choice, and field can be fully scrolled above it.
- [ ] **UX-18.3** No floating action covers template thumbnails, menu content, checkboxes, or errors. Two competing persistent primary-action regions are not shown for the same task.
- [ ] **UX-18.4** Required confirmation and actionable error text remain visible adjacent to the relevant action, including when labels or messages wrap.
- [ ] **UX-18.5** Software-keyboard opening/closing, rotation, and sheet presentation do not leave duplicate footers, trap a focused field underneath them, or strand the action offscreen.

Evidence: Bottom-of-content screenshots for all participating tools and a device recording of keyboard/safe-area behavior.

**UX-19 · P2 — Make post artwork reliably legible**

Built-in post designs, crop/fit controls, and exported images.

- [ ] **UX-19.1** Each built-in design is reviewed in every format it supports with bright, dark, and busy photo fixtures. Default text placement uses a dependable text-safe surface, scrim, or image region.
- [ ] **UX-19.2** Default text has measured contrast of at least 4.5:1 for normal text and 3:1 for large text at its intended displayed size. For text over photography, assess the actual region behind the glyphs, not an average color of the whole image.
- [ ] **UX-19.3** Short and maximum-supported headlines fit without clipped letters, collisions, accidental single-word fragments caused by poor wrapping, or text covering the dish’s essential focal point. If custom settings produce an unsafe layout, provide a visible adjustment/validation path.
- [ ] **UX-19.4** Crop and Fit choices are discoverable and their effect is apparent. Empty bands appear only when intentionally part of a template or the user’s Fit choice; no unintended letterboxing or stretched food images remain.
- [ ] **UX-19.5** Post and Story previews and exported files agree on crop, line breaks, alignment, fonts, and artwork colors. UI safe-area padding and editing overlays are excluded from the export.
- [ ] **UX-19.6** Review representative exports at actual phone display size as well as full resolution. Legibility cannot be accepted only from a magnified editor preview.

Evidence: An all-design contact sheet using existing images, bright/dark/busy stress cases, contrast notes, and representative exported Post/Story files. Preserve supported formats; do not add new ones solely for this review.

**UX-20 · P2 — Clarify save, approval, and publication state**

Shared status presentation, especially menus and photos.

- [ ] **UX-20.1** Define a small status vocabulary that distinguishes saving, saved draft, save failed, processing, needs review, approved, and publication state wherever those states actually exist.
- [ ] **UX-20.2** Status appears in consistent locations relative to the title or action. Related states can coexist without appearing contradictory, such as “Draft saved” with “Live menu has an older version.”
- [ ] **UX-20.3** A successful save is shown only after persistence succeeds. Save failures remain visible with a retry path and preserve the user’s edits.
- [ ] **UX-20.4** Approval does not imply publication, and publication does not imply that later edits are live. Displayed status reflects the actual document/photo state after reload.
- [ ] **UX-20.5** Meaning is available through text and appropriate accessible announcements, not only color or a transient toast. Do not invent a progress percentage or completion state.

Evidence: A state/copy table and an isolated menu sequence covering save, save failure, published fixture, later edit, and reload; include photo approval states.

**UX-21 · P2 — Unify style discovery**

Explore and the Photo Studio style browser.

- [ ] **UX-21.1** Explore retains its aligned two-column gallery and large imagery. Captions do not create staggered image edges or turn it into an unintended masonry layout.
- [ ] **UX-21.2** Each style has a restrained visible name/category treatment that works on touch as well as pointer devices. Essential identification is not hover-only.
- [ ] **UX-21.3** Provide lightweight search/category discovery or one obvious action into the existing searchable style browser. Do not create competing style names or incompatible filter taxonomies.
- [ ] **UX-21.4** The same style uses the same name, preview identity, and selection outcome in Explore and Photo Studio. Selecting it carries the correct style into the next workflow.
- [ ] **UX-21.5** Keyboard and touch users can open style details, choose the style, and return without losing the previous gallery context. Empty search/filter results give a useful reset path.

Evidence: Explore desktop/phone captures and an Explore → details → style selection walkthrough using a style also present in Photo Studio.

**UX-22 · P2 — Show useful style results sooner**

Photo Studio inspiration/style-browser dialog.

- [ ] **UX-22.1** At 1280 × 720, the initial dialog shows at least two complete style cards with their images and names above the footer. At 390 × 844, at least one complete card is visible initially.
- [ ] **UX-22.2** Do not satisfy the first-row goal with tiny thumbnails: style images in these reference views have at least 140px of width. Maintain the relationship between image, style name, and selected state.
- [ ] **UX-22.3** Search remains directly available. Optional category/mood filters can be grouped, with applied values visible and removable.
- [ ] **UX-22.4** Favorites, supported occasions/categories, saved styles, result count, and explicit selection retain their existing functionality. Searching/filtering does not silently change the selected style.
- [ ] **UX-22.5** The selection action and selected-style summary remain clear while results scroll. The final row can be fully exposed above the footer, and no-result/loading/error states use the same layout.

Evidence: Measured initial desktop/phone dialog captures, a favorites/filter/selection check, and a final-row scroll capture.

**UX-23 · P2 — Make plan availability truthful and consistent**

Workspace upgrade prompts, pricing copy, and plan dialogs.

- [ ] **UX-23.1** One authoritative availability state determines the upgrade message and CTA behavior across every entry point.
- [ ] **UX-23.2** While Pro is unavailable, every relevant surface explicitly says so; none promises an immediate upgrade, payment, or Pro continuation. The available Free path remains prominent.
- [ ] **UX-23.3** No waitlist, checkout, or notification CTA appears unless that workflow actually exists and provides a confirmed outcome.
- [ ] **UX-23.4** Plan prices, allowances, and account-specific balances come from the existing authoritative data. Do not replace an existing account’s allowance with the marketing trial amount.
- [ ] **UX-23.5** Desktop plan-card action regions align within 2px despite different feature/explanation lengths; phone cards read in a clear sequential order.
- [ ] **UX-23.6** If an available-Pro state is supported, verify it with safe fixtures and ensure it changes all entry points consistently. No real purchase is required for acceptance.

Evidence: An inventory of plan entry points with matched availability copy, account allowance checks, and aligned plan-card captures.

**UX-24 · P2 — Modernize More tools**

More tools, import/batch tools, staff upload, and activity views.

- [ ] **UX-24.1** Use the shared compact working header and one clear task selector. Remove redundant introductory/section headings that separate the user from the actual task.
- [ ] **UX-24.2** On the default task, its first useful input or action begins at or above y=300px at 1280 × 720 and y=360px at 390 × 844.
- [ ] **UX-24.3** Every existing available task is discoverable at phone width. A scrolling selector must visibly indicate more choices; a compact menu/select is an acceptable alternative.
- [ ] **UX-24.4** Switching tasks shows a clear current selection and follows the shared tab/selector semantics. Unsaved form input is not silently discarded by incidental resizing.
- [ ] **UX-24.5** Import, batch, staff, weekly assistant, activity, and other existing tool capabilities remain accessible as applicable. Their forms/actions use the shared controls and state patterns.
- [ ] **UX-24.6** Staff upload is rendered and exercised through an isolated test link, including empty, selected-file, and validation/failure states; source inspection alone cannot pass this item.

Evidence: Task-selector captures on desktop/phone, a feature-access checklist, and staff-upload state captures with no production submission.

**UX-25 · P2 — Compact customer-menu navigation**

Customer-facing food/drink menus with multiple menus and sections.

- [ ] **UX-25.1** At 390 × 844 with five menus, six sections, and a one- or two-line restaurant name, the first actual food/drink item starts at or above y=420px.
- [ ] **UX-25.2** The menu selector is compact, identifies the current menu, and exposes every available menu without a three-row permanent list of buttons.
- [ ] **UX-25.3** Section navigation clearly indicates additional horizontal choices when they overflow and exposes the current section. Search and menu switching work together without stale results.
- [ ] **UX-25.4** Food names, descriptions, prices, and drink size/price columns remain readable and correctly associated. Long names wrap without colliding with prices; price columns align consistently.
- [ ] **UX-25.5** Restaurant typography, imagery, and colors retain their intended identity. Application navigation improvements do not impose workspace styling on the menu artwork.
- [ ] **UX-25.6** Existing public links, menu selection, and supported ordering/contact actions still work. At 320px and enlarged text sizes, ordinary menu content reflows without page-level horizontal scrolling.

Evidence: Initial food/drink menu captures, a measured five-menu phone fixture, and search/menu/section navigation checks on a public preview link.

**UX-26 · P3 — Reduce the weight of missing photos**

Library empty-photo cards and dish details.

- [ ] **UX-26.1** An all-missing-photo collection uses compact cards or a list treatment instead of repeating large blank image squares. A missing photo is clearly identified without dominating the screen.
- [ ] **UX-26.2** In the dish-detail drawer at 390px, the default empty-photo treatment occupies no more than 120px vertically; dish name and price editing are readily visible.
- [ ] **UX-26.3** “Add photo” is a clear, reachable action with the normal target size. The empty state does not suggest that a photo already exists or insert invented food imagery.
- [ ] **UX-26.4** In mixed libraries, populated photo cards retain their intended imagery and grid alignment. Changing photo state does not unexpectedly reorder the collection or move unrelated actions.
- [ ] **UX-26.5** Empty library, missing photo on an existing dish, and no results from filtering have different, useful messages and appropriate next steps.

Evidence: Empty, all-missing, and mixed-photo captures plus a dish-detail drawer screenshot.

**UX-27 · P3 — Tighten homepage emphasis**

Homepage hero, comparison, decorative imagery, and use-case cards.

- [ ] **UX-27.1** At 1280 × 720, the before/after comparison image frame begins at or above y=440px and at least 240px of its image area is visible on the first screen.
- [ ] **UX-27.2** The headline, concise value proposition, and Free CTA remain readable and prominent. Reducing spacing does not crowd these elements or push them behind decorative imagery.
- [ ] **UX-27.3** Decorative food bubbles are visually subordinate and never overlap text, obscure controls, or create horizontal overflow at required widths.
- [ ] **UX-27.4** Comparison interaction, labels, and underlying images remain understandable on touch and keyboard. The before/after result remains the main visual proof.
- [ ] **UX-27.5** Use-case cards preserve their aligned structure, image treatment, and action placement. The free-image offer remains accurate and consistent with pricing.

Evidence: Measured desktop hero capture, phone hero/comparison captures, and interaction checks for the comparison and primary CTA.

**UX-28 · P3 — Create a compact public reading layout**

Privacy, guidelines, pricing introduction, and public footers.

- [ ] **UX-28.1** Privacy/guidelines use a compact informational title scale, approximately 32–40px desktop and 28–32px phone. Pricing can use a documented larger title without inheriting excessive hero spacing.
- [ ] **UX-28.2** Long-form copy uses 16–18px text, comfortable line height, and a desktop measure of approximately 55–75 characters. Phone text respects at least 16px side gutters.
- [ ] **UX-28.3** Headings, paragraphs, lists, and inline links have consistent spacing and visible hierarchy. Links are identifiable without relying on subtle color differences alone.
- [ ] **UX-28.4** Long pages have a concise summary or useful in-page navigation when their section count warrants it; anchored headings are not obscured by persistent headers.
- [ ] **UX-28.5** Homepage and information pages share one consistent brand/footer treatment and working destination links. Preserve the actual policy/guideline content while adjusting presentation.

Evidence: Privacy and guidelines rendered on desktop/phone, pricing introduction, and a cross-page footer contact sheet.

**UX-29 · P2/P3 — Simplify account entry and make recovery actionable**

Login/signup dialogs and supported account recovery.

- [ ] **UX-29.1** At 390 × 844 in the standard signup state, required credential fields and the primary action are visible without scrolling. The logo, title, copy, and mode controls no longer dominate the form.
- [ ] **UX-29.2** Optional restaurant setup follows the required credentials or moves to a later supported setup step. Optional fields are clearly labeled and are not silently made mandatory.
- [ ] **UX-29.3** Mobile inputs use at least 16px text. Field labels remain visible, password-manager/autocomplete behavior is preserved, and validation appears next to the relevant field.
- [ ] **UX-29.4** Login/signup switching, errors, and loading do not clear valid input unnecessarily or move the primary action unpredictably. The keyboard does not hide the focused field or prevent submission.
- [ ] **UX-29.5** Login provides a functioning supported recovery route: an existing password-reset flow or a verified, monitored support/contact path with a clear next step. Merely saying reset is unavailable does not pass.
- [ ] **UX-29.6** Test the recovery path with an isolated account/channel. Do not invent a support address, promise delivery without confirmation, or add a nonfunctional recovery CTA. If no operational path exists, mark this criterion Blocked and identify the required product/backend work.

Evidence: Signup/login/error phone captures, keyboard behavior, and a verified recovery outcome or an explicit unresolved dependency.

**UX-30 · P3 — Unify loading, empty, and operational screens**

Route transitions, shared fallback states, administration, and operational forms.

- [ ] **UX-30.1** After the app shell has loaded, route loading preserves navigation and a recognizable page structure. A solitary loading sentence on a blank canvas is not the standard transition.
- [ ] **UX-30.2** Skeletons reserve the expected media/panel area. The stable header and navigation do not shift more than 4px when content arrives; content loading does not push an already-visible action out from under the pointer.
- [ ] **UX-30.3** Loading, empty, permission, and failure states have distinct copy and a valid next step where one exists. Retry preserves useful context and does not produce a duplicate operation.
- [ ] **UX-30.4** Reduced-motion preferences suppress nonessential loading/transition animation. Progress text describes the actual state rather than fabricated percentages.
- [ ] **UX-30.5** Administration uses shared headings, form alignment, spacing, and grouped actions. Operational explanations remain available, but nested panels and long secondary paragraphs do not obscure the next action.
- [ ] **UX-30.6** Existing role restrictions and operational capabilities remain intact. Check populated, empty, and failure states using appropriate isolated test roles/data.

Evidence: Representative loading → loaded recordings, empty/error captures, and matched administration/standard-workspace screenshots.

**Shared completion gates**

All individual criteria and all applicable gates below must pass before reporting the redesign complete. A gate cannot pass solely because its component-level checks pass.

- [ ] **G-01 — Complete coverage.** Every UX subcriterion has a status and evidence. Review every page in the reference matrix, including offscreen content, dialogs, and operational states. A previously fixed finding may pass without new code, but only with current verification.
- [ ] **G-02 — No unresolved visual defects.** At the required widths there is no unintended overlap, clipping, page-level horizontal overflow, missing text, invisible action, awkward card misalignment, footer-covered content, or unexplained style mismatch. Deliberate canvas scrolling and documented artwork differences are acceptable.
- [ ] **G-03 — Keyboard and enlargement.** Each changed flow works with keyboard alone. Focus is visible, ordered, and never trapped in hidden content; modal focus stays within the open modal and returns appropriately on dismissal. Escape dismisses dismissible overlays, respecting unsaved-edit protection. At 200% text enlargement, content and actions remain available without clipping or loss of functionality.
- [ ] **G-04 — Actual visual review.** Inspect desktop and phone contact sheets alongside full-size screenshots. Include initial views, scrolled content, and open overlays. Apply the rubric below to every major surface; generated screenshots that nobody inspected are not evidence of visual acceptance.
- [ ] **G-05 — Working task flows.** Complete the isolated workflow checks below. A control that looks correct but leads nowhere, loses state, or misrepresents availability fails acceptance.
- [ ] **G-06 — Responsive and device behavior.** Complete the prescribed breakpoint/browser coverage and the applicable device-specific checks. Mark unavailable physical-device evidence explicitly; do not describe emulation as physical-device testing.
- [ ] **G-07 — Technical verification.** Run the existing build/type/lint checks and relevant regression suites. New failures caused by the changes must be resolved. Pre-existing unrelated failures require baseline evidence and explicit disclosure, not an unsupported “all checks passed.”
- [ ] **G-08 — Evidence and scope integrity.** Deliver the criterion tracker, visual artifacts, verification results, and remaining limitations. The implementation preserves existing content, permissions, business rules, supported formats, and restaurant data. No feature is silently removed to simplify a layout.
- [ ] **G-09 — Independent design and customer acceptance.** Complete the human sign-off below using the final candidate. Codex can prepare the tasks, evidence, and fixes, but its own visual ratings or simulated users cannot pass this gate. Record the reviewer and participant outcomes; if people are not available, report this gate as pending rather than claiming the UX has been validated with customers.

**Visual review rubric**

Rate each major surface from 1–5 on each applicable dimension. Use **1 = broken**, **2 = visibly inconsistent**, **3 = usable but ordinary/uneven**, **4 = cohesive and polished**, **5 = exceptionally clear and refined**. Every dimension must score at least 4, and each major surface must average at least 4.5. Explain the scores with concrete observations; they are structured design judgments, not objective measurements or a guarantee of customer preference.

| Dimension | What a passing review demonstrates |
| --- | --- |
| Hierarchy | The page purpose and next action are apparent immediately; headings, status, and secondary controls do not compete. |
| Composition and spacing | Content has intentional density, aligned edges, balanced whitespace, and enough room for the actual photo/menu/post. No distracting dead zones or crowded clusters. |
| Typography | Type families and scales express clear roles; line breaks, labels, prices, and long names look intentional at actual viewing size. |
| Color and component consistency | The page belongs to the same product as its neighbors; color, borders, radii, and control states follow the shared system. |
| Photography and artwork | Relevant images are sharp and well cropped; food remains the focal point; text is readable; empty states do not overwhelm completed work. |
| Responsive composition | Phone and tablet layouts feel deliberately arranged; controls remain comfortable and useful content appears promptly. |
| Interaction clarity | Selection, availability, loading, errors, saved state, and the result of each action are understandable before and after interaction. |

Apply the rubric to homepage, pricing/account entry, Photo Studio, Explore/style discovery, My Dishes, Post Maker, Menus, settings, More tools/administration, customer menus, and public information pages. Mark an inapplicable dimension with a reason rather than assigning it an automatic 5. A defect cannot be averaged away by giving unrelated dimensions high scores.

**Human sign-off for confidence in the finished experience**

This is the final acceptance stage after Codex has completed and verified the implementation. It is included because attractive screenshots and automated checks do not establish that customers understand the product. These are proposed product acceptance targets, not claims of statistical certainty or industry certification.

| Review | Procedure and pass threshold |
| --- | --- |
| Independent visual sign-off | The product owner or a designated designer who did not implement the changes inspects the running candidate and matched desktop/phone contact sheets. Every major surface meets the visual rubric: no dimension below 4/5, average at least 4.5/5. Each score has a concrete reason. Record reviewer, date, candidate revision, and remaining observations. |
| Restaurant workflow check | At least five representative restaurant operators who have not been coached on the redesigned interface attempt: find an existing dish and edit its price; choose a photo style; review a crop and download an existing result; edit and export a post; edit a menu and identify whether the latest changes are live. Use isolated fixtures and plain task goals that do not name buttons or teach the route. At least four of five complete each task without moderator assistance, and no participant loses work or unintentionally publishes/purchases anything. |
| Customer-menu check | At least three representative diners use a phone to switch menus, find a named dish, and identify a drink size and its price. All three complete those tasks without moderator assistance or a wrong price association. |
| Clarity and ease | After each task, ask participants to rate ease from 1 (very difficult) to 5 (very easy); the median for every task is at least 4. Restaurant operators can correctly explain the difference between saved, approved, and published when those states appear. Record observed hesitation and wrong turns rather than relying only on ratings. |
| Resolve and retest | A blocker, accidental irreversible action, data loss, or the same material confusion observed in two or more sessions must be fixed. Retest affected tasks with people unfamiliar with the fix; do not count a coached second attempt as an unassisted pass. Recheck relevant technical and visual criteria after the fix. |

Codex must finish all independent implementation and verification work while this sign-off is pending. It should deliver a reviewable candidate and a short task script, identify exactly what a human must verify, and avoid repeatedly asking for approval during routine implementation. No participant recruitment, outbound messages, or production actions are authorized by this specification.

**Required workflow verification**

Use existing assets and isolated accounts/data. Respect actual service availability; a mocked visual state is useful evidence of layout but does not prove the integration works.

| Flow | Passing outcome |
| --- | --- |
| Account entry and recovery | Signup/login UI validation works; successful test authentication reaches the intended workspace; the supported recovery path has a verified outcome or remains explicitly blocked. |
| Photo Studio | Choose a style, inspect an existing result, adjust crop, confirm it, and download. Selection and crop persist, and the resulting file is correct. Exercise relevant error/retry states without paid generation. |
| Library | Search/filter, open long-name details, edit name/price, change selection mode, and use existing archive/approval actions on fixtures. Results and saved data agree. |
| Post Maker | Choose a design and supported format, edit text/crop, leave and reopen editing, then export. Preview and file agree; no editing overlay enters the artwork. |
| Menu editor | Select/edit dishes at desktop and tablet widths; check multi-size prices and a multi-page proof; save and reload; inspect an isolated published fixture and later draft state. Existing export/publication tests must still pass. |
| Customer menu | Follow a preview/public fixture link, switch menus, search, navigate sections, and read size/price associations on a phone. |
| Settings and operations | Save settings through each group; test validation/save failure; access every existing More tools destination, staff-upload states, and administration with the appropriate test role. |
| Navigation and overlays | Move between main tools, open/close relevant dialogs, and resize while editing. Unsaved data, focus, selection, and scroll position behave predictably. |

Run `npm run typecheck`, `npm run lint`, and `npm run build` using the project’s supported runtime. Run the existing relevant suites once after the corresponding changes: `npm test`, `npm run test:menus`, `npm run test:templates`, and export suites as applicable (`test:exports`, `test:workspace-exports`, `test:photo-preview`). The `npm test` script already includes `test:studio`; do not repeat it without a reason. Re-check the scripts if the repository has changed since this document was written.

Use browser measurements and visual inspection for spacing/color adjustments instead of adding tests that merely mirror CSS declarations. Add focused behavioral regression coverage when changing selection, save state, filtering, confirmation gating, focus, or export behavior. Broaden or repeat testing only for new changes, failures, or unresolved risks.

**Implementation order**

1. Capture the current baseline and identify which reviewed defects still exist. Preserve work already completed since the review.
2. Establish shared button/color/typography/spacing/state primitives and fix the critical pricing, download, target-size, contrast, settings, and tablet-selection problems. Avoid separately restyling every page before the shared contract is stable.
3. Apply responsive navigation, editor layouts, card/filter alignment, dialog behavior, and mobile footer patterns across the main workflows.
4. Refine artwork, discovery, customer menus, marketing/information pages, and operational states.
5. Run the verification matrix, inspect visual contact sheets, address remaining defects, and complete the evidence tracker. Deployment is a separate action requiring authorization.

**Traceability to the shorter recommendation list**

The earlier conversational summary combined several findings. This mapping makes that list fully traceable to the 30-item report.

| Earlier list item | Acceptance IDs |
| --- | --- |
| 1 — Pricing actions | UX-01 |
| 2 — Download requirement | UX-02 |
| 3 — Tablet menu editing | UX-03 |
| 4 — Icon targets | UX-04 |
| 5 — Contrast | UX-05 |
| 6 — Settings | UX-06 |
| 7 — Buttons | UX-07 |
| 8 — Typography | UX-08 |
| 9 — Colors | UX-09 |
| 10 — Spacing | UX-10 |
| 11 — Mobile navigation | UX-11 |
| 12 — Mobile/desktop menu preview space | UX-12, UX-13 |
| 13 — Dish-card alignment | UX-14 |
| 14 — Library filters | UX-15 |
| 15 — Tabs | UX-16 |
| 16 — Post editing controls and action footer | UX-17, UX-18 |
| 17 — Post artwork | UX-19 |
| 18 — Explore | UX-21 |
| 19 — Style browser | UX-22 |
| 20 — Status messages | UX-20 |
| 21 — Plan availability | UX-23 |
| 22 — More tools and administration | UX-24, UX-30 |
| 23 — Customer menus | UX-25 |
| 24 — Empty states and account entry | UX-26, UX-29 |
| 25 — Homepage and information pages | UX-27, UX-28 |

UX-30 also explicitly covers loading transitions, which the full report described separately.

**Evidence package and final implementation report**

Store review artifacts under a clearly named directory such as `docs/design-acceptance-evidence/`. Keep private account details and real customer data out of shared screenshots.

The tracker must contain one row per subcriterion and shared gate: ID, status, environment/revision, fixture, viewport/browser, evidence link, and any remaining issue. Reuse evidence across related criteria where it directly proves each one; do not produce redundant screenshots just to increase artifact counts.

Include:

- A baseline/after contact sheet at matched viewports and fixtures, plus full-size images for each major page and important dialog.
- Measured geometry and contrast where this document specifies numerical thresholds.
- Short recordings or step/result notes for behaviors that static screenshots cannot prove.
- Post/menu export samples where relevant, with preview-versus-export comparison.
- Visual rubric scores with concise reasons, test commands/results, and browser/device coverage.
- Independent visual sign-off and customer-task observations, or an explicit pending status for G-09.
- An explicit unresolved-dependency list, especially recovery operations and unavailable physical-device verification.

The final implementation summary should state: **criteria passed / total; gates passed / applicable; visual review result; workflows verified; technical checks; human sign-off status; outstanding failures or blocked items.** Distinguish implementation verified from customer validated. Do not use “complete,” “all passed,” or “top-tier UX verified” while applicable checks remain failed, blocked, or untested.

**Copyable implementation handoff**

> Implement the improvements in docs/DESIGN_ACCEPTANCE_CRITERIA_2026-09-17.md, using docs/DESIGN_REVIEW_2026-09-17.md for the original findings and docs/DESIGN_ACCEPTANCE_TRACKER_2026-09-17.md for verification tracking. First inspect the current repository and rendered site, since some findings may already be fixed. Preserve existing features, content, restaurant artwork, and unrelated work. Follow the shared visual contract, implement all 30 recommendations, and maintain the tracker for every numbered subcriterion and shared completion gate. Verify actual rendered desktop, tablet, and phone layouts with the prescribed fixtures, inspect the visual evidence, and run relevant existing checks. Continue fixing failures until the applicable criteria pass; report external dependencies honestly and complete independent work while they remain blocked. Provide the evidence package, a reviewable candidate, the G-09 human task script, and final results. Do not claim human sign-off or customer validation from your own review. Do not deploy, make real purchases, alter production customer data, recruit or message participants, or consume paid generation credits as part of this implementation.

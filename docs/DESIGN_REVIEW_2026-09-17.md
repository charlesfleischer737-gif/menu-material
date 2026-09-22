**Menu Material — design and UX review**

Reviewed September 17, 2026. Recommendations only; no application changes or deployments were made for this review.

The food photography, restrained branding, homepage comparison, and aligned Explore gallery provide a strong foundation. The largest opportunity is to make the working screens feel like one product: common controls, predictable spacing, clear action states, and more room for the actual work. Several findings below are verified rendering or interaction problems, rather than subjective styling preferences.

The published public site was reviewed directly. Signed-in workflows were reviewed in the current local preview with its existing sample dishes, photos, posts, and menus. Local findings therefore describe the current working copy, which contained menu changes already in progress. Viewports inspected were 1280 × 720, 1024 × 768, and 390 × 844 CSS pixels. Screenshots, rendered DOM measurements, and source inspection were used together; transient opening animations were allowed to settle before identifying layout defects.

| Surface | Coverage |
| --- | --- |
| Homepage | Desktop and mobile; hero, before/after, use cases, style gallery |
| Pricing | Desktop and mobile, including computed CTA colors |
| Account access | Desktop login and mobile signup, without submission |
| Public information | Privacy rendered; guidelines and shared layout inspected in source |
| Photo Studio | Guest upload/start state, saved result, style browser, download dialog |
| Explore | Desktop/mobile grids and style detail dialog |
| My Dishes | Desktop/mobile cards, filters, dish detail drawer |
| Post Maker | Existing desktop/mobile draft and mobile editing sheet |
| Menus | Desktop/mobile editor, design controls, tablet item selection |
| Restaurant settings | Rendered dialog, form spacing, style cards, scroll measurements |
| More tools and administration | Rendered screens; retained workflow components inspected |
| Customer menus | Existing food and drink menus at phone width |
| Staff upload | Source review only; no upload link created |

This was a design review, not an end-to-end generation, billing, publishing, physical-device, or full accessibility certification exercise. No account was created and no photo, menu, or post was published. Existing sample content was used to exercise long names and populated states; placeholder restaurant names and test-dish names are not being treated as product defects.

The recommendations are ordered by impact. **P1** means a visible obstacle to understanding or completing a task; **P2** means a substantial consistency or efficiency improvement; **P3** means additional polish. Effort estimates are relative: **S** is a focused component/style change; **M** affects several layouts or states; **L** needs broader product or workflow work.

1. **P1 · S — Restore the pricing calls to action.** On the published pricing page, “Try it free” renders as white text over a transparent background on the Free card. “Pro is coming soon” has the same styling issue. The Free link is technically present but nearly invisible on both desktop and mobile. Give the cards explicit, complete button styles that work outside the signed-in workspace. The shared button currently depends on a missing `--cx-green` variable; the Free card also uses `secondary` where the styled variant is `cx-secondary`. Check the account plan dialog because it reuses this component. Acceptance: each available CTA is immediately visible in its default, hover, and keyboard-focus states, and unavailable actions have a distinct, legible treatment.

2. **P1 · S–M — Make the photo-download requirement obvious.** In the mobile download dialog, the required crop-review checkbox begins near the bottom of the scroll area, with part of its explanation below the persistent footer. Meanwhile, the disabled “Download photo” button is fully opaque, dark green, and white, just like an enabled primary action. Give disabled actions a visibly different treatment and put a brief instruction beside the action, such as “Confirm the crop to download.” Reduce the preview/header height or position the required check directly above the footer. Keep optional reuse actions below the essential download flow.

3. **P1 · M — Reveal menu editing controls when a dish is selected on tablets.** At 1024 × 768, selecting “Marinated olives” highlights the row and proof, but the editing panel starts approximately 1159px below the top of the viewport. The user must discover and scroll to it. Use an inspector drawer, switchable editing pane, or deliberate scroll-and-focus behavior at this breakpoint. Acceptance: selecting a dish makes its editable name and price visible immediately.

4. **P1 · S–M — Enlarge small icon targets.** In the mobile Post Maker sheet, move/remove controls measured 14 × 36px, and the close control measured 16 × 16px. Keep the icons visually compact but give their buttons approximately 44 × 44px hit areas and clear accessible names. Apply this consistently to close, reorder, remove, undo/redo, and zoom controls. This is a recommended usability target consistent with [WCAG's enhanced target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html); the AA minimum has separate spacing exceptions, so small size alone is not being reported as a blanket conformance failure.

5. **P1 · S — Increase contrast for usable menu actions.** “Add dish” is 12px text in `#899c78` on the very pale outline panel, approximately 2.9:1 contrast. It looks unavailable even though it is active. Use the normal action color and at least 14px text for frequently used commands. Verify other small green/gray controls rather than assuming the entire green palette is low contrast. Normal-size text should reach 4.5:1 under [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

6. **P1 · M — Shorten settings and keep Save and Close available.** The settings dialog measured 2898px of content within a 646px viewport. Its first screen contains only basic fields and the logo uploader; the restaurant-look options and save action require substantial scrolling, and the close icon scrolls away. Separate “Restaurant details,” “Restaurant look,” and “Ordering & hours,” reduce the excessive gaps between fields, and keep a header/close control and save footer visible. Show unsaved status where relevant.

7. **P2 · M — Establish one shared button family.** Primary buttons currently range from nearly square to rounded rectangles to pills; observed examples include 41px menu buttons, 48px studio actions, and 52px marketing/style actions. Define primary, secondary, quiet, destructive, disabled, and loading variants with shared typography, icon spacing, and focus treatment. A practical baseline is 44px standard actions, 48px important actions, and an 8px radius, with an explicitly larger marketing variant. Ensure portal-rendered dialogs inherit the same complete tokens.

8. **P2 · M — Establish one working-screen heading system.** Photo Studio uses a bold 28px sans-serif heading; My Dishes and Post Maker use a 30px serif; Explore uses a substantially larger serif; Menu Studio uses a document title and uppercase eyebrow. At desktop width, page-title top positions also shift noticeably. Use a common task-header height, title scale, status location, and action alignment. Serif display type can remain in the editorial gallery, brand storytelling, and customer artwork, provided the distinction is deliberate.

9. **P2 · M — Consolidate the interface palette.** The homepage uses charcoal, the photo workspace uses deep green, menu controls introduce a different green and warmer backgrounds, and older dialogs use another cream/gray treatment. Keep one brand action green, one text color, one muted text color, one workspace background, and one border system. Use the food imagery for variety; keep restaurant-defined menu and post colors independent from application controls. Consolidating tokens also addresses the kind of missing-variable failure seen on pricing.

10. **P2 · M — Create a consistent spacing rhythm.** Use an 8px base with 8/16/24/32px gaps, 16–24px panel padding, and shared content gutters. At 1280px, Photo Studio starts around x=284/y=27, whereas Explore's title starts around x=298/y=58; Menu Studio has another header arrangement. Alignment need not be mechanically identical, but transitions between tools should feel intentional. Remove repeated one-off margins and large form gaps before adding new decorative treatments.

11. **P2 · M — Make mobile navigation more compact.** The workspace brand row and five navigation items consume approximately 138px at 390px width, with labels such as Photo Studio and Post Maker wrapping. Use a compact header and a consistent navigation treatment; a bottom navigation bar is worth prototyping. If labels are shortened, use the same short labels everywhere. Preserve sufficient touch areas and keep utility/account options separate from the five main destinations.

12. **P2 · M — Reduce mobile menu toolbar height.** At 390 × 844, the print preview begins around y=526, after the global navigation, document heading, status, action row, workspace tabs, preview tabs, hint, and zoom controls. Make less frequent actions available through a clear overflow menu, shorten the publish/export labels on mobile, and combine compatible preview controls. Bring a useful portion of the menu into the first screen while keeping the main action clear.

13. **P2 · M — Give the desktop menu proof more room.** At 1280px the global sidebar, menu outline, and right inspector leave a relatively narrow proof. Make the outline and inspector collapsible or resizable, and consider a compact application sidebar on smaller laptops. Retain obvious “Fit page” and zoom controls. Validate the transition through 1250/1100/1050px carefully so shrinking the window does not make essential editing controls harder to find.

14. **P2 · S–M — Align dish-card content across long and short names.** In My Dishes, long names push prices onto another line and move the status/action row downward. This is especially apparent in the two-column phone grid: one price sits next to its title while another sits beneath it. Use a predictable name area, a dedicated price placement, and a footer anchored to the card bottom. Keep the full name accessible; do not solve the problem solely by reducing font size. Recheck names of one, two, and three lines.

15. **P2 · S–M — Reduce mobile library filter clutter.** Search, section, photo status, sort, Archived, and Select occupy three rows before the first card. Keep search visible and group secondary filtering/sorting behind a Filters button with an active-filter count. Present Archived as an explicit state or menu option; its current bare text treatment does not clearly communicate a toggle. Keep selection mode visually separate from filtering.

16. **P2 · M — Standardize tabs and selected states.** The site mixes underlined inspector tabs, filled green Post/Story segments, white selected menu segments, and gray inset tabs in authentication and More tools. Define when to use navigation tabs versus a compact segmented choice, then reuse the same selected indicator within each family. Selected controls should look distinct from disabled controls. Use the existing semantic primitives consistently and preserve keyboard behavior.

17. **P2 · S — Remove duplicate desktop editing controls.** Post Maker shows both “Edit design” in the preview toolbar and “Done editing” above its already-visible desktop inspector. Those controls make sense for the mobile sheet, but compete with the permanent desktop panel. Restrict them to the layout where they actually open or close editing controls; retain the inspector tabs on desktop.

18. **P2 · S–M — Use one mobile action-footer pattern.** Photo Studio has a wide bottom action bar; Post Maker uses a small floating “Review & export” button that overlaps the lower content region; Menus places its main actions near the top. Use a shared persistent action area with reserved page space and safe-area padding when persistence is appropriate. Keep required confirmation/error text visible near that area. Avoid covering template choices while scrolling.

19. **P2 · M — Improve post artwork legibility on real photos.** In the existing sample draft, the pale headline crosses a light part of the image and the top of the dish, while the crop produces large bands above and below the photo. This is an observed sample issue, not a claim that every template fails. Prioritize usable text-safe areas, offer a clearly visible crop/fit choice, and tune overlays so the food remains the focal point. Review both Post and Story at actual display size with long headlines, bright plates, dark scenes, and different photo proportions.

20. **P2 · S–M — Clarify save, approval, and publication states.** “All changes saved,” “Unpublished changes,” “Approved photo,” “Ready to use,” and “Content ready” describe different stages but use inconsistent positions and visual treatments. Establish a small, shared status pattern with concise explanations. For menus, “Draft saved · Live menu has an older version” is easier to understand than two apparently conflicting messages. Keep approval distinct from publication.

21. **P2 · M — Make style discovery consistent between Explore and Photo Studio.** Explore has an appealing aligned two-column gallery but no visible style names, search, or category controls; the Photo Studio browser has those functions plus favorites. Preserve the Explore grid and large imagery. Add restrained names/category labels and lightweight discovery controls, or a clear route to the existing searchable browser. On touchscreens, do not rely only on hover to explain what a tile represents.

22. **P2 · S–M — Show more useful style results above the fold.** In the desktop style-browser dialog, title, subtitle, tabs, search, mood chips, category selection, and result count leave only the upper part of the first image row visible; the first card captions fall below the initial view. Reduce the header/filter stack, make the image/title relationship visible together, and group optional filters. Keep the current search, favorites, and explicit style selection capabilities.

23. **P2 · S — Correct plan availability messaging.** The workspace says “Get Pro · $9.99/month,” and pricing describes continuing with Pro, while the actual Pro action says it is coming soon. Use an explicit availability label everywhere until subscriptions open, and make the currently available Free path the prominent action. Do not introduce a waitlist CTA unless a real waitlist workflow exists. Align desktop card action regions and keep unavailable-plan explanations readable.

24. **P2 · M — Modernize More tools using the same workspace components.** The large “Keep your kitchen moving” introduction, another heading, older tab styling, and a nested content card push the actual import controls far down the page. Use a compact “More tools” header and a clear task selector. At phone width, later tabs are clipped horizontally with little indication that more options exist; provide visible scrolling affordances or a compact selector. Apply the same controls to staff uploads and activity views.

25. **P2 · M — Compact customer-menu navigation.** With several menus, the menu switcher wraps into three rows, followed by search and another horizontal category row. On the sampled phone menus, food content starts more than halfway down the initial viewport. Use a concise menu selector, smaller header spacing, and clear category-navigation affordances. Preserve the distinct restaurant typography, legible item descriptions, and the drink menu's separate size/price columns. Do not carry workspace styling into restaurant artwork indiscriminately.

26. **P3 · S–M — Reduce empty-photo visual weight.** Dishes without photos receive the same large image block as dishes with photos, producing large gray areas. The dish-detail drawer also reserves a large square even when the main job is editing a name or price. Use a more compact, helpful empty state or offer a list presentation for incomplete libraries. Keep “Add photo” prominent and avoid rearranging populated cards unexpectedly.

27. **P3 · S — Tighten homepage emphasis.** The hero, food imagery, and before/after comparison work well. On a 720px-tall desktop, much of the comparison begins below the first screen. Modestly reduce vertical hero spacing so more of the proof is visible, and soften the decorative food bubbles if they compete with the central message. Preserve the aligned use-case cards and the clear free-image offer; a wholesale visual redesign is unnecessary.

28. **P3 · S–M — Give public information pages a compact reading layout.** Pricing and privacy reuse a large display headline and generous introductory space. Keep the brand header, but use a smaller title for informational pages, a comfortable reading measure, and concise summaries or in-page navigation for longer material. Use one footer treatment consistently; the homepage has a logo lockup while the information-page footer uses plain brand text.

29. **P2/P3 · M — Simplify account entry and provide actionable recovery.** The signup dialog devotes substantial height to the logo, headline, descriptive copy, and tabs before reaching fields; an optional restaurant-name field appears before the required credentials. Tighten the header, make optional setup less prominent, and use comfortable mobile input text. The login dialog currently explains that automated reset emails are unavailable but offers no actual recovery action; provide a supported recovery/contact path when operationally available. This last part is a product dependency, not a styling-only change.

30. **P3 · M — Unify loading, empty, and operational screens.** Some route transitions show a solitary loading sentence on a blank canvas while others preserve the workspace shell. Reuse compact skeletons and consistent status placement to reduce visual jumps. Administration uses nested white panels, generous padding, and dense secondary paragraphs; give it the same page header, form alignment, and grouped-action conventions as the rest of the workspace. Retain operational details there, where they are useful.

The proposed visual baseline is **photography first, restrained color, consistent controls, and purposeful density**. A starting specification for a later implementation pass is:

| Element | Proposed baseline |
| --- | --- |
| Main interface text | 16px body, 14px labels/actions, 12–13px only for genuinely secondary metadata |
| Working-screen titles | One shared 28–32px scale with matching header spacing |
| Display typography | Serif permitted in editorial/gallery contexts and restaurant artwork |
| Buttons | 44px standard / 48px prominent, 8px radius, common icon spacing; explicitly defined marketing variant |
| Icon controls | Approximately 44 × 44px hit area, even when the icon is 16–20px |
| Spacing | 8px base; 8/16/24/32px gaps; 16–24px panel padding |
| Colors | Shared action green, charcoal text, neutral canvas, white surface, restrained borders, semantic warning/error colors |
| Corners | One compact control radius and one slightly larger panel radius; use pills deliberately |
| Status | Common locations and treatments for saved, processing, needs review, approved, and unpublished |
| Dialogs | Clear header/close area, scrollable body, persistent actions when needed, visible prerequisites |

For the future implementation, start with findings 1–6, then establish the shared controls and tokens before adjusting every page. After those changes, verify the affected screens at phone, tablet, and desktop widths, with long names and populated/empty states. Include keyboard operation, 200% text enlargement, and physical-phone testing where camera, keyboard, sharing, or safe-area behavior matters. These are recommended follow-up checks, not claims about tests completed during this review.

Source locations for a later implementation pass:

| Findings | Primary files |
| --- | --- |
| Pricing actions and availability | `app/components/plan-cards.tsx`, `app/components/plan-dialog.tsx`, `app/launch.css`, `app/creation.css` |
| Photo download and style-browser dialogs | `app/components/photo-finish-sheet.tsx`, `app/components/photo-inspiration-sheet.tsx`, `app/studio-experience.css` |
| Shared controls and page headers | `app/components/creative-header.tsx`, `app/components/core-workspace.tsx`, `app/globals.css`, `app/creation.css`, `app/creative-workspace.css` |
| Menus and customer menus | `app/components/menu-studio.tsx`, `app/components/menu-studio-controls.tsx`, `app/components/menu-document-view.tsx`, `app/menu-studio.css` |
| Dish cards and drawer | `app/components/dish-library.tsx`, `app/creative-workspace.css` |
| Post Maker | `app/components/post-maker.tsx`, `app/components/workspace-controls.tsx`, `app/creative-workspace.css`, post composition/export modules |
| Explore | `app/components/explore-gallery.tsx`, `app/explore.css` |
| Settings, authentication, administration | `app/components/account-panels.tsx`, `app/components/auth.tsx`, `app/components/restaurant-look-editor.tsx`, corresponding shared/dialog styles |
| Homepage and information pages | `app/components/plateworthy-landing.tsx`, `app/components/public-information.tsx`, `app/homepage.css`, `app/plateworthy.css`, `app/launch.css` |
| Secondary tools and staff upload | `app/components/menu-tools.tsx`, `app/components/staff-upload.tsx`, `app/workspace.css` |

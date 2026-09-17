# Photo Studio accessibility and responsive review

September 17, 2026. Local candidate, isolated QA workspace, existing pasta original. No provider requests or production publication. This is partial evidence for PS-02, PS-08, PS-15, PS-21, PS-25 and PS-26; it is not a WCAG conformance statement.

## Problems found and corrected

| Finding | Change | Verification |
| --- | --- | --- |
| At 320 × 568, the fixed catalog controls left only 22 px for the gallery and pushed the footer below the viewport. | The catalog tools and gallery share a scrolling body. Short viewports can scroll the complete dialog, with the footer retained. | Catalog, examples and footer are reachable; the dialog ends at 568 px and content width stays inside its 318 px interior. |
| Entering a style detail removed the focused card and left focus on the dialog container. | The detail heading receives focus. Returning restores the exact image or text trigger and its scroll position. | Keyboard-only checks returned to `catalog-image:delivery-daylight` and `catalog-image:menu-wood`, including a filtered search with enlarged text. |
| Entering an occasion could leave its newly focused heading above the viewport. | Focus moves to the occasion heading with native reveal behavior; All occasions returns to the originating collection card. | Game day heading appeared at 282–309 px, above the footer at 493 px. Returning focused the Game day card with its title visible. |
| Several secondary controls were 32–42 px high; some narrow labels were less than 44 px wide. | Common Studio buttons, selects and crop sliders receive at least 44 px targets. Small action labels are raised to 14 px. | No undersized visible catalog controls in the six-width check. The main working surface also had none at 1440 px. Expanded finish sliders measured 44 px high; the filename field measured 46 px. Checkbox targets are their enclosing labels, not the 20 px visual box. |
| The catalog kicker had 4.14:1 text contrast against white. | Its text color is darker. | The affected color was changed from `#73816a` to `#65745d`; this is a targeted correction, not a complete contrast audit. |
| Fixed pixel type, nonwrapping filter tabs and long detail titles resisted text enlargement. | Studio type uses relative units, tabs wrap, dialog headings can shrink within their layout, and detail columns allow wrapping without widening the dialog. Dialog descriptions are 16 px at the default text size. | A temporary root-size test used 32 px instead of 16 px. The search and detail interior remained 318 px wide at a 320 px viewport. The temporary override was removed. |
| A tall mobile action bar covered part of the focused Browse control with enlarged text. | The bar moves into normal document flow when it occupies more than 28% of the available visual viewport. It observes both content and viewport changes. | Enlarged text produced an in-flow bar. Restoring normal text restored the fixed bar at about 118 px high. |
| Inherited transitions animated dialog dimensions during viewport changes, temporarily shrinking controls and moving the dialog outside the viewport. | Layout dimensions update immediately; only opacity may transition. Reduced-motion styles also cover the dialog itself and its overlay. | Repeated viewport changes produced the exact final bounds in the table below. Reduced-motion behavior still needs a real preference and assistive-technology pass. |
| Cancelling unchanged adjustments could leave the status at “Saving…” indefinitely. | Draft changes ignore identical content and recognize a return to the saved content, while retaining the saving state during an in-flight write. | Cancelling unchanged adjustments and cancelling a brightness change from 100 to 101 both returned to “All changes saved.” No new photo version or generation was required. |

## Catalog layout results

Normal text, all-look catalog open, current source and saved restaurant look. Measurements include offscreen rendered catalog controls. Every row had zero visible button/input/select targets below 44 × 44 CSS px. The page width equaled the viewport width and catalog scroll width equaled its interior width.

| Viewport | Dialog interior / content width | Dialog top–bottom |
| --- | --- | --- |
| 320 × 568 | 318 / 318 px | 22.7–568 px |
| 390 × 844 | 388 / 388 px | 33.8–844 px |
| 430 × 932 | 428 / 428 px | 37.3–932 px |
| 768 × 1024 | 702 / 702 px | 32–992 px |
| 1024 × 768 | 958 / 958 px | 32–736 px |
| 1440 × 900 | 1058 / 1058 px | 32–868 px |

The 768 px catalog was visually inspected after layout settled. Earlier transient measurements during resizing were not used as final geometry evidence.

## Keyboard and larger-text checks

- Enter opens the style browser. Shift+Tab from Close reaches its last action; Tab from that action wraps to Close. Closing returns to Browse all looks.
- Search for “football Sunday” returns three looks. During the enlarged-text check, the focused search field remained at 259–331 px, above the footer at 439 px. Typing no longer resets the scroll position.
- Opening a filtered style focuses its heading. Returning restores the exact catalog trigger. With enlarged text, the returned Neighborhood table image control was visible at 229–362 px, above the footer.
- Occasion collection entry, style detail return, and return to the collection list preserve a meaningful focus target. The final normal-text check verifies that the collection heading is visible.
- The customizer and its nested save-look dialog remained within the 320 px page at the enlarged root size. Leaving the save dialog restored focus to Save as a restaurant look. This does not validate all server-error and long-name cases.
- At 320 × 568 with normal text, the finish sheet interior and content widths were both 318 px. Its footer occupied 493–567 px. Filename entry, crop disclosure, fit controls and keyboard sliders remained reachable. A horizontal-position arrow key changed the value from 50 to 51. The focused Adjust crop button remained above the footer.
- Cancelling finish adjustments did not create an image or spend allowance. Cancelling quick adjustments retained the original and showed the correct saved state.

The 32 px root setting is a CSS text-enlargement test. It is useful for finding reflow defects but does not certify browser-native 200% text enlargement, 400% zoom, operating-system text settings, or a physical phone's virtual keyboard. The final dialog-description typography was also checked at the restored normal size. No temporary text setting remains in source.

## Remaining acceptance work

1. VoiceOver/Safari and NVDA, complete reading order, single-selection semantics, live status announcements and all keyboard-only journeys.
2. Browser-native text enlargement and 400% zoom, physical keyboard/safe-area/rotation behavior, long restaurant/look names, all validation and recovery states.
3. A complete contrast and effective-target audit, including reference imagery, selected/disabled states, source/result controls, drafts, account dialogs, correction and multi-dish sheets.
4. Reduced-motion preference verification, short-landscape testing, physical camera/HEIC and actual download/share receipt.
5. The PS-27 production lab, real-device responsiveness, memory stress, and restaurant-owner study. These layout checks do not establish performance or usability percentiles.

The implementation status document remains the release handoff. No requirement is fully accepted merely because its layout or a subset of its keyboard checks passed.

Final validation after these changes: full regression tests, type checks, the Sites build helper and whitespace checks passed. The normal 16 px root size and the original photo were verified in the restored preview; the temporary viewport override was reset. The build still reports large optional-library chunks, so production performance remains unmeasured.

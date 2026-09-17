# Photo Studio: focused adjustment review

Date: September 17, 2026. Scope: the local implementation candidate, using the isolated signed-in QA restaurant and its existing pasta image. The image provider was disabled. No production publication or live generation was performed.

## Finding and change

The prior Quick adjustments section appeared below the result. On a phone, moving a brightness slider meant leaving the photo behind. The controls also modified the main saved draft during editing, and the quick-edit surface was absent from the sheet navigation history.

Quick adjustments now opens a focused dialog from either **Just crop or brighten** in the style workspace or **Quick adjustments** beside a result. Opening the source editor keeps the style workspace in place. Desktop uses a large preview beside the controls. Phone uses a fixed preview above the controls, with a persistent Save/Cancel footer. Only the controls scroll. Short landscape viewports put the preview and controls beside each other.

Two keyboard-accessible tabs expose **Crop** and **Light & color**. Crop includes destination size, Fit whole dish / Fill frame, position, zoom and rotation. Light & color includes brightness, contrast and warmth. The controls show current values. Reset adjustments restores the values present when the editor opened. The dialog states that no image allowance is used and that saving creates a separate version.

## Edit and save contract

- Adjustments live in the dialog's temporary state. Changing a slider, format or rotation does not change the main draft or start generation.
- Cancel, the close button, Escape and browser Back discard unsaved settings. Browser Forward reopens the editor with its opening settings, rather than resurrecting discarded changes.
- Focus starts on the dialog title. Closing returns focus to the exact opening button when it remains in the page. Saving from the source workspace transitions to result review and focuses Use photo because the source trigger is no longer present.
- Save is unavailable while the photo has not been successfully painted or its preview has failed. Loading and retry states cannot leave an enabled Save action attached to an invisible image.
- Save captures the parent asset, format and a copy of all adjustment values before asynchronous work begins. Controls and close actions disable during the save.
- Retry identity is retained per exact settings payload within the edit session. An unchanged retry uses the same request identifier; changed settings use a different identifier. The existing server still enforces immutable versions and parent/source lineage.
- The source, previously saved versions and existing approvals are not overwritten. A new local edit starts unapproved.
- A save failure appears inside the dialog and retains its controls and preview. A successful photo save is not incorrectly reported as a failed photo save merely because a subsequent page/draft refresh fails.
- Browser Back can dismiss a save that has already started. Completion is retained in history, and the implementation checks whether that edit session is still active before replacing the current draft. This in-flight timing branch was code-reviewed, but was not exercised by a deliberately delayed browser save in this review.

## Browser checks and observations

The UI was exercised through the in-app browser against localhost with the provider disabled. These are viewport checks, not physical-device acceptance.

| Viewport | Observation |
| --- | --- |
| 320 × 568 | Dialog fits the viewport with no horizontal overflow. Preview and footer remain visible. The controls have their own scroll region. Save and Cancel are 44 px tall. A portrait-source failure uses the full preview area so its message and 58 × 44 px Retry button fit; Retry was wholly inside the preview stage. |
| 390 × 844 | Preview and controls remain visible together. A square preview measured approximately 223 × 223 px; control scroll area approximately 326 px high. |
| 542 × 748 | The phone layout has visible primary action, source preview and scrollable controls. The initial missing portal button color was corrected by applying the existing workspace dialog palette. |
| 768 × 1024 | Preview and controls sit side by side. Preview measured 312 × 312 px with a 340 px control column. No horizontal overflow. |
| 1440 × 900 | The 1060 × 760 px dialog presents the large photo and control column together. Footer actions stay visible while the control column scrolls. |
| 568 × 320 | Landscape layout uses two columns with a 168 × 168 px square preview. Save remains within the viewport at y=263–307. No horizontal overflow. |

Observed interactions:

1. From the style workspace, changed brightness to 120, format to Instagram Story and rotation to 90°. Cancel returned to the same source, QA evening menu look and Menu & website destination, with focus on Just crop or brighten and All changes saved.
2. Changed brightness, then used browser Back. The dialog closed and focus returned to its opening button. Forward reopened clean crop settings; brightness was subsequently observed at 100, contrast at 100 and warmth at 0.
3. Pressing ArrowRight on the Crop tab selected Light & color. Native range controls remained labeled. The underlying page was modal/inert while editing.
4. Saved an actual local version with Story format, rotation 90 and brightness 120. The editor closed, result review displayed the saved edit, and focus moved to Use photo. The saved JPEG was visually inspected and decoded at 1400 × 2489 pixels.
5. Opened the saved result's editor, changed brightness and selected Reset adjustments. Brightness returned to 100 relative to that saved image. Escape preserved the saved result and returned focus to Quick adjustments.
6. Temporarily made that QA edit unavailable on disk, then opened its editor. The preview displayed a recoverable error and Save was disabled. After the file was restored byte-for-byte, Retry loaded the image, retained focus on Photo preview and enabled Save. The temporary held file no longer exists.
7. Temporarily caused local QA edit inserts to fail. Save showed the existing friendly request error inside the dialog while retaining brightness 80 and the preview. The failed attempt created no new edit. After removing the temporary failure, retry succeeded once, closed the dialog and preserved source/parent lineage. The temporary database trigger no longer exists.

## Saved-file and lineage evidence

Before this review's saves, the isolated restaurant contained two local edits and zero generation jobs. After the normal save it contained three edits; after the failed save it still contained three; after retry it contained four. Generation jobs remained zero throughout. The visible allowance remained 20 during the desktop review.

- First new edit: `2f02857b-5d85-4e5a-a3b8-1d4ec09fd6ea`; parent and original source both `106b91ac-e12a-40c6-b582-7272fb27f417`; Story, x/y 50, zoom 1, rotation 90, brightness 120, contrast 100, warmth 0, fit true; unapproved.
- Retried successor: `a9792452-3257-444e-9f17-42a11e34fe33`; parent is the first new edit; original source remains the same; Story, x/y 50, zoom 1, rotation 0, brightness 80, contrast 100, warmth 0, fit true; unapproved.
- The original working JPEG's SHA-256 remained `5418ad99a238c6d1714bdd7a6b3d564615e7471d8aa37c8519c7053f54509877` across the first save.

These are local QA identifiers, not customer or production results. No downloaded-file receipt or AI food-fidelity claim follows from these checks.

## Regression validation

- `npm test`: passed all existing integration, expansion, creation, post, catalog, launch, plan, workspace and Studio suites, including preview lifecycle checks. Provider/payment calls were isolated fixtures.
- `npm run typecheck`: passed.
- `npm run test:exports`: passed 128 output checks.
- `npm run test:photo-preview`: all 48 pre-change pixel cases matched for both cached preview and export, with image-layer reuse/cleanup checks passing.
- Sites production build helper: passed; the existing large-chunk warning remains. This does not establish production-network performance.
- `git diff --check`: passed.

The rendering/export formulas were not changed in this review. The shared preview gained a readiness callback; the shared crop controls gained optional tab filtering and displayed values. Existing callers retain their prior default behavior.

## Requirement coverage and remaining limits

This improves PS-02 working-surface focus, PS-21.1–2 and PS-21.4–6 local editing/version safety, and PS-26 keyboard/reflow behavior. It resolves the previously recorded separation between the phone preview and its quick controls. It does **not** accept the entirety of those requirements.

Still required: the in-flight Back/save timing and uncertain-response replay browser matrix; native VoiceOver/NVDA and text enlargement; actual iPhone/Android interaction and safe areas; real-device 30 fps / input latency and sustained-memory tests; physical save/share receipt; independent owner comprehension and visual acceptance. The larger live-image, measurement and release gates remain as listed in the implementation status. The temporary viewport override was reset after review.

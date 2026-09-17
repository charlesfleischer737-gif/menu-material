# Photo Studio inspiration — implementation and review

September 17, 2026. Local candidate only. This review covers the reference-photo workflow in PS-14, with related continuity, accessibility and recovery behavior. It does not qualify generated-image fidelity or accept PS-14 as a whole.

## What changed

The style-browser entry previously selected the reference look before a photo was chosen. Cancelling the file picker could therefore leave an incomplete reference request. Customization had no equivalent entry, and the original and reference were not presented together for review.

Both entrances now open one focused sheet. **Your dish** identifies the food source; **Inspiration** identifies setting, light and color. The owner chooses and reviews a reference, then explicitly selects **Use this inspiration**. Choosing a file prepares a temporary local preview; it does not upload, change the draft or create an image. Signed-in upload occurs only on application. Guest application retains a separate binary copy for existing local recovery and account transfer.

The sheet also supports replacement and removal. Cancel, Escape and browser Back discard temporary inspiration while retaining the existing recipe and any open customizer choices. Applying from customization keeps those choices and closes the two sheets. Removing inspiration detaches it from the recipe, keeps the original/result assets, and opens an unfiltered style browser. The missing-reference state no longer substitutes an unrelated catalog example.

Reference uploads use a stable request identifier across retries. Late preparation/upload responses check the opening session before updating the draft. Temporary preview URLs and binary selections are released after closure. An unchanged existing reference preserves the current named look and captured style. The main workspace names a reference look **Your inspiration** and exposes **Edit inspiration photo** beside its thumbnail.

The guest-account handoff now replaces the local reference identifier in the captured reference list with the uploaded asset identifier. Missing guest reference data is rejected before account writes. Retry retains the separate original/reference identities and does not reserve another image.

## Evidence against the acceptance criteria

| Criterion | Local evidence | Remaining qualification |
| --- | --- | --- |
| PS-14.1: same workflow from browsing and customization | Both entrances were used in the browser and opened the same sheet. The customizer entry retained a temporary Pale stone selection. | Independent owner findability and comprehension. |
| PS-14.2: distinct source/reference identity and provenance | Labeled images displayed together. Apply, failed replacement, successful replacement and removal preserved the original source and existing result identifiers. Removing inspiration did not delete either reference asset. Helper assertions prevent source/dish/result/job fields from entering a reference patch. | Full cross-device recovery and source-replacement matrix with a reference attached. |
| PS-14.3: reference supplies atmosphere, not food/branding | The sheet explains the image roles. This change does not alter the existing source/reference prompt roles or image pipeline. | The 12-pair live reference benchmark, independent food/branding/people review, and conflicting-reference qualification remain unrun. Interface copy and existing prompts are not fidelity evidence. |
| PS-14.4: validation, recovery and no generation on selection | An unreadable JPEG produced a recoverable error. A controlled reference-save failure retained the replacement and existing attachment; retry succeeded. Cancelling temporary selection left reference asset count at zero. Removal opened normal styles. A later stored-file failure was detected before creation; replacement, recheck and ordinary-style recovery were reviewed. Fifty-four API checks cover availability, ownership, quota, queued-file loss and replay. The QA workspace still has zero generation jobs. | Real HEIC/camera/large-file cases, corrupted stored bytes beyond metadata validation, storage-disabled guest recovery, and in-flight navigation/uncertain-response browser stress. |
| PS-14.5: protected dish and owner choices outrank reference | The guidance explains serving-dish, camera-angle and custom-choice priority. Applying inspiration preserved Pale stone. Assertions cover explicit plate, angle, note, crop and setting overrides, plus empty reference lists overriding restaurant defaults. | Live conflicting-vessel and packaging/branding cases. Existing glass-conflict handling still needs independent owner testing. |
| PS-14.6: representative reference qualification | No additional live reference generation was attempted. | All 12 varied source/reference pairs and the common fidelity rubric remain required. |

## Browser observations

The local browser used the isolated QA restaurant with provider access disabled. The existing `public/pasta.jpg` fixture served as the reference; the matching food in the two previews is test data, not a quality comparison.

- From the style browser, Cancel returned focus to **Use a photo as inspiration** and left the selected named look unchanged.
- In customization, Pale stone remained selected after browser Back from the inspiration sheet. Forward reopened a clean reference selection, with **Use this inspiration** disabled until a photo was chosen again.
- Selecting the local file created no reference asset. Explicit application created one reference asset, closed both sheets, restored focus to Customize, and retained Pale stone.
- An unreadable replacement showed “This photo couldn’t be opened.” Cancelling retained the attached reference and returned focus to **Edit inspiration photo**.
- A temporary database failure was scoped to reference creation in isolated QA. Failed application kept the old reference identifier and one reference asset. After removing the failure condition, retry saved the replacement and the sheet reopened with its new identifier.
- Removing the replacement opened the All looks browser with an empty search and focus in **Search all looks**. Returning to the main workspace showed Add inspiration photo and explained why that incomplete reference look could not create an image.
- At 320 × 568, page width was 320 pixels and the primary action occupied y=508–552. At 390 × 844, page width was 390 and the action ended at y=828. At 768 × 1024, page width was 768 and the action ended around y=844. Desktop layout was also visually reviewed at 1440 × 900. These are browser viewport checks, not physical-device certification.

After the initial review, the saved **QA evening menu** look, Menu & website format and normal browser viewport were restored. The original source and existing local-edit result remained unchanged. Two local reference assets were retained as QA history. No QA failure triggers remained, and the temporary unreadable-file fixture was removed. The recovery follow-up below adds one further reference fixture and again restores the workspace.

## Stored-reference recovery follow-up

Code inspection found that reference ownership and review status were validated at submission, but the working image file could be missing without blocking the new job. The file failure was discovered later in the worker. A saved reference could also lose its accuracy approval after the job was queued.

The signed-in Studio now checks all captured references, including secondary references in older restaurant recipes. This is a private, read-only check of eligibility, object existence and the worker's supported byte-size limit. It uses object metadata instead of downloading the images. The request is bounded to three identifiers, checks restaurant ownership before looking in storage, and returns no private storage paths. Storage interruptions are distinguished from unavailable images.

While a check is pending, the current reference-based Create action is disabled. An unavailable reference has **Replace inspiration photo**, **Check again** and **Choose another look** actions. The normal style route opens an unfiltered browser. The main source, existing result, saved crop and customization remain intact. Pending checks time out after ten seconds, cancel when the recipe or active workspace changes, and cannot apply their answer to a different recipe. Returning focus to the browser or reconnecting starts another check. Wait time is excluded from decision-time estimates.

The server performs its own eligibility/storage check before reserving any new job, output, recent-use record or image allowance. Accepted request replay and completed-result reuse remain recoverable without re-reading the old inspiration. Before dispatch, the worker checks reference eligibility again, so removal or a newly flagged accuracy problem prevents provider submission. A queued failure reports the unavailable inspiration and restores the reserved allowance. This leaves a small unavoidable interval between checking and reading storage; the existing image-read error path still prevents dispatch if the object disappears in that interval.

The dedicated `studio-references` suite passed **54 API checks**, plus assertions for:

- Empty, duplicate, single and three-reference requests; malformed and oversized request lists.
- A missing normalized image even when its original remains; empty/oversized stored objects; restoration and transient storage failure.
- Missing, deleted, foreign, unapproved and accuracy-flagged references. Foreign identifiers never cause a probe of another restaurant's storage.
- No changes to quota, jobs, outputs or recent-use receipts on preflight rejection.
- One accepted retry, replay after a reference disappears, queued-file loss, allowance restoration and zero provider submissions.
- Completed-result reuse after its reference is deleted, and prevention of dispatch when an approved result used as inspiration later needs correction.
- Ordinary-style creation retaining the original source without the unavailable reference.

This suite is included in the default Studio and full regression commands. No external service is permitted in the test.

Browser review temporarily held only the working file of a new isolated reference fixture. Reload detected it as unavailable, disabled Create and kept the original visible. The reference sheet showed a recoverable missing-image state with its Apply action disabled. The first 320-pixel review exposed a clipped error message; the final design uses a shorter visible label and lets the error frame grow with its content. The corrected message had equal client/scroll heights of 120 pixels, page width stayed 320, and the disabled Apply action ended at y=552 in a 568-pixel viewport. Desktop review at 1440 × 900 confirmed matched 225-pixel image frames and a centered error label.

After restoring the exact file bytes, **Check again** removed the warning and returned focus to **Edit inspiration photo**. A separate unavailable-file test used **Choose another look → Clean & craveable**; the reference warning disappeared and the original/result identifiers stayed unchanged. Every temporary file hold was restored and verified by SHA-256. The final workspace again uses **QA evening menu**, Menu & website and the normal viewport, with three reference fixtures and zero generation jobs. No file holds or QA failure triggers remain.

Full regression, type checks, the final Sites build and whitespace checks passed. The existing large-chunk warning remains. Browser timeout/offline races, actual corrupted stored-file decoding, screen readers, enlarged system text and physical devices are still unqualified; this work does not replace the live reference-fidelity benchmark.

## Automated and build verification

- The full regression command passed during this change. The plans suite now reports 91 checks and exercises missing-reference preflight, separate uploaded identities, captured reference remapping and repeat-safe guest handoff. Provider and payment responses remain fixtures.
- The final Studio suites passed after the reference-preservation changes: 60 experience API checks, 40 release checks, 40 measurement checks, 50 progress checks, search/deferred/preview checks and 51 recent-use checks, plus the new reference recipe assertions. The deliberate receipt-failure log belongs to a passing rollback fixture.
- Type checks and the Sites build passed. The existing large-chunk build warning remains; no production performance pass is claimed.
- No model, prompt, API credential, production data or production deployment changed. The candidate pipeline identifier remains `studio-2026-09-17-studio-v6`.

Physical-device input and sharing, screen readers, independent owner tasks, representative image fidelity, production timing and the broader release gates remain outstanding in the implementation-status document.

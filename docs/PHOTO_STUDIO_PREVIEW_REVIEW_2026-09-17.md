# Photo Studio preview performance and recovery

September 17, 2026. Local evidence for PS-21, PS-25 and PS-27 in the [Photo Studio requirements](PHOTO_STUDIO_REQUIREMENTS.md). The whole experience remains under acceptance review.

## Changes

Crop, position, brightness, contrast and warmth updates reuse a prepared image layer. Changing the source or its rotation replaces that layer. Cleanup reduces the previous canvas to one pixel and releases the reference, so a preview retains at most one full-size prepared layer. Export rendering releases its temporary layer after painting.

Preview updates are scheduled for the next animation frame. Multiple inputs before that frame replace the pending value; they do not create a queue of obsolete drawings. Source changes and unmounting cancel and invalidate the scheduled callback.

The photo request now accepts an abort signal. Replacement, retry and unmount cancel its fetch. If bitmap decoding finishes after cancellation, the late bitmap is closed before the request rejects. The component also guards callbacks with the request's own abort state, so an older request cannot change the current photo's loading/error state.

An unavailable preview hides the old canvas and shows a readable message with **Try again**. The frame reserves its space while loading. Retry keeps focus on the stable Photo preview group; dragging is enabled only when the current image is ready. Cancel retains the pre-edit controls and does not create an image version.

The crop/lighting formulas, output dimensions, export quality settings and generation configuration did not change. Pixel compatibility was checked against references captured before this refactor.

## Pixel and resource evidence

The fixture contains **48 cases**: two existing project photos, two output frame shapes, four rotations, and three sets of crop/position/light settings. The source file hashes and expected RGBA pixel hashes were captured before the change. Both the export renderer and cached preview match every reference exactly under the native canvas test engine: **96 renderer/reference comparisons passed**.

The native suite also verified:

- Twenty adjustments use one prepared source layer.
- Changing the output size or using an equivalent rotation does not create another source layer.
- A new rotation or source releases the previous full-size layer.
- Cleanup can run twice safely and releases the final full-size layer.

The lifecycle suite verified that a burst of 100 inputs creates one scheduled frame and paints the newest value. A cancelled callback cannot paint after a later input has been scheduled. An already-aborted request makes no fetch, a late download is not decoded after cancellation, and a decode that finishes after cancellation closes its bitmap exactly once. A successful bitmap remains owned by its caller until cleanup.

The pure lifecycle suite runs in the default regression command. The native pixel/resource suite runs with `npm run test:photo-preview`, alongside the existing native export validation. The pixel references are engine-specific evidence; they do not establish browser-wide pixel identity or independent food-quality acceptance.

## Local raster workload

This test uses the project's pasta image resized to a 4,000 × 3,000 test canvas, an 800 × 800 output, a 90-degree rotation, and 20 changing brightness/position settings. Each timed sample includes drawing **and synchronous pixel readback**. Garbage collection runs before each sample outside the timer. The uncached path runs first, followed by the cached path. The first frame is included in each sample set and reported separately.

| Native canvas measurement | Uncached rendering | Cached preview |
| --- | ---: | ---: |
| Median | 74.97 ms | 12.02 ms |
| p95 | 86.83 ms | 12.86 ms |
| First frame | 140.52 ms | 73.98 ms |

These are local native-canvas measurements, not browser animation rate, input-to-paint latency, a cold-start comparison or physical-phone performance. The resized test image is a workload fixture, not a qualifying smartphone source. An earlier exploratory measurement omitted pixel readback and was excluded from this report because it could count queued drawing work incompletely.

[All samples, test environment, source fingerprints and reviewed build fingerprint](evidence/photo-preview-raster-2026-09-17.json).

## Browser recovery and visual checks

The isolated local QA workspace had provider calls disabled throughout. Its original source was verified to match the existing public pasta test image. No live generation was performed.

1. Opened quick adjustments and verified a visible 800 × 800 canvas, ready state and no preview alert.
2. Set Brightness to 120 with the keyboard and rotated the photo 90 degrees. The actual browser canvas displayed the brighter, rotated source. There was no preview alert. The desktop page remained within 1,440 pixels.
3. Cancelled the changes and returned to the original. No new image version was saved.
4. Temporarily held only the isolated QA working-image file; the original source and metadata remained in place. Reopening the preview showed **This photo couldn’t be opened. Please try again.** The previous canvas was hidden. The retry target measured 57.8 × 44 pixels.
5. Restored the working file and verified its bytes against its pre-test hash. **Try again** produced a visible 800 × 800 canvas, no alert, and focus on **Photo preview**. No held file or recovery record remains.
6. At 320 × 568, the recovered preview measured 286 pixels wide, page width stayed 320, and the ready state had no alert. Temporary viewport sizing was reset after review.

The full regression command, 48-case native preview suite, **128 export checks**, type checking and final Sites build passed. The existing large-chunk build warning remains. No new dependency, API credential, image charge or production publication was introduced.

## Remaining acceptance work

- **Adjustment layout:** the phone view places controls well below the photo. A focused editor should keep the image and the active controls together while preserving Cancel, original/history access and one clear Save action. The faster renderer does not resolve that usability gap.
- **PS-27.3–4:** actual 12-megapixel JPEG/HEIC preparation and cancellation on the reference phone, plus the required production-build/network/CPU test profile and ten-run action samples.
- **PS-27.6:** physical-phone frame rate and p95 input-to-preview delay. The native raster workload does not prove the 30 fps / 200 ms target.
- **PS-27.7:** the complete 20-minute phone session with ten source replacements and ten comparisons, including retained-memory measurement where supported. Bounded local layer checks do not measure the entire application's heap or GPU memory.
- **PS-25/26:** broader slow-network/source-replacement races, screen readers and real-device recovery. The browser unavailable-file/retry test and unit cancellation checks cover specific cases only.
- The broader live-image benchmark, independent restaurant-owner acceptance and release gates remain open in the [implementation status](PHOTO_STUDIO_IMPLEMENTATION_STATUS.md).

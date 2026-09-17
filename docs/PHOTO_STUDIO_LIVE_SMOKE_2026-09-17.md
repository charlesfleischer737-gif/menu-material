# Photo Studio — single live image test

Completed September 17, 2026, after explicit approval to send the bundled sample pasta photograph to OpenAI and incur one image-generation charge using the existing key.

**Result: the single-image service and export test passed.** This is one sample, with an assistant-only visual review. It does not accept the broader restaurant-quality benchmark or the complete release.

## Configuration and observed outcome

| Item | Recorded value |
| --- | --- |
| Source | Bundled `public/pasta.jpg`, 1400 × 931 pixels; already well-lit sample photography, not a representative ordinary-phone-photo cohort. |
| Look | Neighborhood table (`menu-wood`): warm wood and natural restaurant atmosphere. |
| Protected choices | Keep the original serving dish and camera angle; full dish composition. |
| Image model | `gpt-image-2.5-flare` |
| Orchestration model | `gpt-6-astra` |
| Pipeline | `studio-2026-09-17-studio-v6` |
| Requested rendering | 1536 × 1536, high quality, JPEG, compression 95. |
| Actual result | JPEG, 1536 × 1536 pixels, 325,170 bytes. |
| Submission count | Exactly one provider generation submission, one local output and one completed terminal event. |
| Elapsed time | 48 seconds from test start through locally retrievable output, including local setup/upload and polling. This is not a latency percentile. |
| Monetary cost | A live API charge was authorized. The application returned no monetary estimate; invoice cost was not verified. |

The test used the real application upload, job, provider polling, storage, approval and export paths with isolated local QA data. It did not run through a physical phone or modify the published site. The ordinary local browser preview remains provider-disabled.

## Preliminary visual assessment

The original and result were inspected at their available resolutions. The requested warm wood surface and softly blurred restaurant setting are evident. The pasta arrangement, sauce appearance, prominent basil garnish and white plate appear consistent with the source. The complete serving remains visible, with plausible lighting and shadows. No obvious prominent ingredient substitution, added side, invented text or watermark was observed in this sample.

This is a promising individual result. It is not an independent food-expert assessment, restaurant-owner approval, or proof of performance on difficult lighting, packaging, drinks, other styles or other cuisines. The already attractive source also limits conclusions about improvement of poor phone photos.

## Verified recovery and export behavior

- The result was initially unapproved and the download endpoint returned 403.
- A QA-only accuracy approval was saved to the isolated workspace; the same download then returned 200 with the correct JPEG content type.
- Full-quality export preserved the provider file byte for byte and returned the correct `.jpg` extension.
- Menu export produced a decodable 1536 × 1536 JPEG; its reported dimensions matched the decoded file.
- The menu export was visually inspected and retained the complete plate and dish.
- All post-generation checks disabled external network calls. No second generation was submitted.

QA approval here is an exercise of the product flow after assistant inspection, not an assertion that a restaurant owner accepted the photo. Browser download receipt and physical-device sharing remain unverified.

## Local evidence

The following files are in the ignored `outputs` directory and were not published:

- [Original sample](../outputs/photo-studio-live-test-2026-09-17/original.jpg)
- [Generated full-quality image](../outputs/photo-studio-live-test-2026-09-17/result.jpg)
- [Menu export](../outputs/photo-studio-live-test-2026-09-17/menu-export.jpg)
- [Machine-readable test record](../outputs/photo-studio-live-test-2026-09-17/report.json)

The broader release gaps remain in [the implementation status](PHOTO_STUDIO_IMPLEMENTATION_STATUS.md). No quality thresholds have been reduced because this one example succeeded.

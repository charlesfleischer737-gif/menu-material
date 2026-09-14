# Plateworthy positioning and design

The site focuses on improving restaurant food photos for menus, delivery listings, websites, and social posts. Captions and hosted menu tools remain available in the existing workspace.

## September 14 refinement

A restrained header, one direct headline (“Studio-quality food photos. From your phone.”), a single primary action, and an equal-width before/after comparison. Three short steps explain upload, style, and review/download. Repetitive slogans, the secondary pasta feature, oversized crop demonstration, and dark promotional section have been removed. Download/crop tools in the product remain intact. On phones, the example images stack at a consistent ratio to keep the complete burger visible.

A compact channel list, practical FAQs, and invitation-only signup explain the service without promising a measured sales increase. Buttons preserve existing login, invitation, and signed-in studio flows. Existing social-preview metadata and assets are unchanged.

## Comparison imagery

The old professional stock photograph was unsuitable as an everyday “before.” The new original is cyclonebill’s [Burger photograph on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Hamburger_(5).jpg), taken with a Sony Ericsson J20i phone according to its source metadata. It shows ordinary indoor light, a glass and utensils, and crumbs on the plate. The source is not artificially degraded.

- Original, unedited photo: `public/burger-phone-original.jpg`.
- Studio edit: `public/burger-studio-edit.png`.
- Source, license, full generation prompt, and fidelity assessment: `docs/burger-image-provenance.json`.

Both source and derivative are licensed under [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/); linked attribution and the AI edit disclosure appear on the page. One built-in imagegen edit was generated directly from the source photo. The same bun, single patty, cheese, tomato, lettuce, and mayonnaise remain recognizable, with regenerated fine textures and neater presentation. The page identifies it as an example AI edit and prompts owners to check accuracy. This is a demonstration asset, not a result from the currently disconnected production API.

Original reference sites reviewed in the previous iteration: [FoodShot](https://foodshot.ai/) and [Beautiful Food](https://www.trybeautifulfood.com/). No competitor photos, testimonials, statistics, or copy are reused.

## Validation for this refinement

TypeScript check passed. Local page returned HTTP 200 and the new source/edit pair was visually reviewed in the browser. The FAQ expanded and the signed-in primary action returned to the existing photo studio. This design pass does not claim live AI API quality validation; generation still needs its existing server credentials.

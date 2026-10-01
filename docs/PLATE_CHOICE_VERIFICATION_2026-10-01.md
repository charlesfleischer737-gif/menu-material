# Serving-dish choice verification — 2026-10-01

The explicit `plate: style` choice previously shared instructions that retained the original food vessel when the style did not name serving ware, and whenever a beverage/bar style was applied to food. Reference-image roles mentioned only setting, light and color, even though the main prompt allowed serving-ware aesthetics. Revision-image roles also said to change only the requested styling without naming the current plate choice.

The v9 prompt places the selected serving-dish edit before preservation instructions, requires replacement for `style` and `white`, and verifies that choice at the end. A style's food vessel is used first, then a supplied reference's food vessel, then new food serving ware suited to the style. Material, shape, rim and color matter. Food quantity and arrangement remain protected, as do drink vessels and their visible branding. The reference and previous-result roles now agree with the selected plate control. `keep` remains a separate preservation instruction. New requests cannot reuse results cached under v8; queued jobs keep their frozen prompts.

## Live check

Two jobs ran through the local application's authenticated API, upload storage, queue, prompt snapshot, direct OpenAI Images edit request and output storage. Both used the repository's `public/burger-phone-original.jpg`, which shows a cheeseburger on a white plate, and the **Dark degustation** preset. The dish details deliberately mentioned the original white plate.

- Model: `gpt-image-2.5-flare`; configured quality: `high`; size: 1536 × 1536; JPEG, compression 95.
- `plate: style`: the output visibly replaced the white plate with matte charcoal ceramic serving ware, including a different rim/profile. The burger remained recognizable with the same principal ingredients.
- `plate: keep`: the output retained white serving ware while applying the dark slate setting and directional lighting.
- The background drink's glass remained recognizable in both outputs.

The original and both outputs were visually inspected. Generated textures and fine food details differ, so this is a targeted plate-control check, not an exact food-fidelity benchmark or a guarantee for all styles. The generated images and request metadata remain in the checkout's ignored `work/plate-check/` directory, not in customer records or public assets. No customer image allowance was used.

## Automated regression coverage

`tests/plate-choice.mjs` uses isolated provider fixtures to verify preset and explicit override prompts, saved-recipe round trips, serving-ware reference roles, original/previous image roles, drink protection, description-only requests and cache separation between keep/style/white. It is included in `npm run test:studio` and therefore `npm test`.

The prompt follows the [official image prompting guidance](https://developers.openai.com/api/docs/guides/image-prompting) to distinguish requested edits from details to preserve and to assign explicit reference-image roles.

Full validation passed: `npm test`, `npm run typecheck`, and the production build. Automated provider responses are fixtures; only the two paired checks described above used the live image service.

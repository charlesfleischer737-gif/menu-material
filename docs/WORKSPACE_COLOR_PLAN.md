# Workspace color and contrast plan

Approved design for Photo Studio, My Dishes, and Menu. Prepared and implemented September 16, 2026. The source review and plan are retained below.

## Implementation record

- Added a shared white / pearl-gray / charcoal / evergreen palette and mapped the existing workspace and dialog theme roles to it. Replaced scattered colors in the workspace styles rather than adding another override stylesheet.
- Updated navigation, enabled/disabled actions, input boundaries, keyboard focus, Photo Studio selection, upload and generation surfaces, downloads, library drawers, and Menu controls and sharing panels.
- Added aligned, currency-formatted dish prices, selection outlines, and icon-backed Ready to use / Needs review / No photo states to library cards.
- Preserved selected Photo Studio outlines on hover and the transparent menu-item editing overlay. Mobile navigation wraps within available space; existing responsive layouts remain in use.
- Customer menu, restaurant design swatch, print/table-card, lighting-sample, and post-artwork CSS rules were compared with the previous source and preserved exactly.
- Validation passed: TypeScript checking, 42 existing workspace API checks, parsing of all eight affected stylesheets, eleven palette contrast pairs, whitespace checks, and the production build. The local page returned HTTP 200.
- No live AI requests or publishing of customer menus were performed during validation. Browser interaction and visual accessibility audits were not performed in this implementation pass.

## Recommended direction

Use clean white surfaces on a neutral pearl-gray canvas, charcoal typography, and a deep evergreen accent. Let the food photography carry most of the color. Replace the yellow-green and cream surface treatments throughout these workspaces. Keep the existing Menu Material identity and editorial headings, while making controls more precise and readable.

Evergreen is the recommended accent because it connects to the current identity without the weak light-green-on-cream combination. Use it sparingly for primary actions, active navigation, selection outlines, and links. It should not tint every heading, surface, or secondary label.

## What the current styles reveal

The workspace uses a cream canvas (`#F7F7F1`), lime (`#E7EFB7`), a pale-green active navigation fill (`#EDF2DF`), olive-gray labels, and many separate green border colors. The menu preview stage is also green-gray (`#E7EBE3`). Similar values flatten the distinction between navigation, work surfaces, selections, and supporting content.

Several specified foreground/background combinations have low contrast. Calculations use the CSS colors; final rendered states still need verification:

| Existing example | Foreground / background | Calculated contrast |
| --- | --- | --- |
| Sidebar section label | `#969D91` / white | 2.79:1 |
| Inactive sidebar navigation | `#727D71` / white | 4.30:1 |
| Selected-style supporting label | `#788575` / white | 3.88:1 |
| Shared focus outline against workspace canvas | `#99B87D` / `#F7F7F1` | 2.05:1 |

Normal text should meet at least 4.5:1. Essential control boundaries and visual state indicators should meet 3:1 against adjacent colors where those cues are required to identify the control or state. Decorative dividers need not meet that threshold. Sources: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Palette and rules

| Role | Color | Application |
| --- | --- | --- |
| Page canvas | `#F4F5F6` | Neutral background behind working surfaces |
| Surface | `#FFFFFF` | Sidebar, cards, controls, dialogs, and editing panels |
| Primary text | `#202624` | Titles, labels, dish names, values |
| Secondary text | `#59625F` | Descriptions and supporting information |
| Primary accent | `#174C3C` | Main action, active navigation, selected state, links |
| Accent hover | `#103C2E` | Enabled primary-button hover |
| Decorative divider | `#D6DCDA` | Card edges and grouping that do not identify controls |
| Control boundary | `#7C8681` | Inputs and secondary buttons when the boundary identifies them |
| Preview stage | `#E4E7E9` | Neutral surround behind customer menu preview |
| Review / warning | `#8A4B08` | Needs-review text with an icon; optional `#FFF4DF` background |

Calculated examples: charcoal on white 15.39:1; secondary text on the canvas 5.77:1; white text on evergreen 9.83:1; control boundary on white 3.76:1. These are individual color-pair checks, not a claim of whole-page compliance.

- Use a filled evergreen button for the primary completion action in each context. Secondary actions are white with a neutral border. Tertiary links use evergreen and a visible underline where needed.
- Selected navigation gets evergreen with white text. Selected photographic cards retain white captions and use an evergreen outline plus a visible check mark.
- Use neutral text for ordinary content. Reserve success, warning, and error colors for meaningful states, always paired with an icon or label.
- Replace global disabled opacity with explicit disabled foreground, background, and border values, so the entire control does not become indistinct.
- Use a dark focus ring separated from the control by a white gap. Verify it against both light surfaces and filled buttons.
- Main copy: 16px. Frequently used controls and labels: at least 14px. Secondary metadata: 12–13px only where appropriate. Remove the current forced 12px primary-button and link styles.
- Use consistent 8px control corners, 10–12px card corners, and an 8px spacing rhythm. Keep shadows restrained and neutral, with stronger hierarchy coming from spacing and typography.

## Page-by-page changes

### Photo Studio

1. Keep the gallery beside the creation panel on desktop, with the existing responsive flow on smaller screens.
2. Put the gallery on the neutral canvas; use white caption areas with charcoal style names and legible gray descriptions.
3. Make the selected style unmistakable with a 2px evergreen outline and a white check on a dark evergreen badge. Keep selection visibly different from hover and keyboard focus.
4. Make category chips neutral by default and dark when selected. Give “For you” the same visual rules instead of its own pale-green fill.
5. Keep the creation panel white with clearer section spacing. Replace green-tinted upload and empty states with neutral surfaces and legible boundaries.
6. Give Create photo the strongest action treatment. Upload, fine-tuning, saved work, quick edits, and download controls must keep clear relative priority.
7. Apply the same palette to generating, success, failed generation, recovery, comparison, and download states.

### My Dishes

1. Present photographs in consistent white cards, with dish names in charcoal, supporting information in gray, and prices aligned consistently.
2. Give search and filters visible neutral borders. Active filters use the shared selected treatment.
3. Use dark evergreen plus a check for Ready to use, dark amber plus an alert icon for Needs review, and neutral gray with a label for No photo.
4. Keep photo reuse actions distinct from status indicators. Use one primary Add dishes button at page level.
5. Carry the same white surfaces and contrast rules into detail drawers, photo versions, uploads, archive/undo, and bulk selection. Use an outlined or white bulk-action bar instead of a broad pale-green fill.

### Menu

1. Put editing controls on a white panel so they read as a separate tool area.
2. Replace the sage preview stage with a neutral gray surround, providing clear visual separation around the customer menu.
3. Keep the restaurant's chosen menu colors and typography inside its actual preview. Application colors should not replace customer branding or alter exported menus.
4. Use an evergreen border or side marker, plus explicit selection state, for the selected section and design. Avoid large tinted backgrounds.
5. Make Publish menu the dominant completion action; keep Print, preview choices, and other editing actions secondary.
6. Make saved, unpublished-changes, published, and validation-error states distinct and readable. Include import review, sharing, QR, and print-preview dialogs in the styling pass.

## Implementation sequence

1. Establish one workspace palette and semantic roles for surfaces, text, action, selection, status, focus, and disabled controls. Alias the existing `--cx-*` and `--mm-*` roles to that palette rather than introducing another competing layer.
2. Update the common shell and primitives in `app/creation.css`, then the Photo Studio rules in `app/studio-workbench.css` and relevant onboarding/download styles.
3. Update the library and menu rules in `app/creative-workspace.css`, plus relevant collection styles. Replace hard-coded colors in the affected selectors instead of appending a large override file.
4. Check selector scope for dialogs rendered outside the main page. Map shared popover, dropdown, sheet, and dialog colors to the workspace palette without changing the homepage or the restaurant's exported artwork.
5. Review all three pages together on desktop and mobile. Include the shared shell's appearance on adjacent tools, since they inherit common styles.

## Acceptance criteria

- No pale-green-on-cream styling remains in application controls or working surfaces on these three pages.
- Normal text meets 4.5:1 at minimum; the proposed secondary text aims above 5:1. Essential control and state indicators meet applicable 3:1 requirements.
- Selected, hover, focus, disabled, loading, success, and error states remain distinguishable without relying on hue alone.
- Inputs, labels, actions, and dish descriptions remain readable at 200% zoom and phone widths, without clipping.
- Validate empty and populated pages, long dish names, photo backgrounds of varying brightness, menus with and without photos, and relevant overlays.
- Verify upload/create/save, dish reuse, and menu preview/publish controls still behave correctly after implementation. Changes stay within presentation and preserve restaurant content.

The accompanying interactive concept uses existing sample imagery and illustrative dishes/prices to demonstrate the direction. It does not modify the application or connect its controls to real generation, data writes, or publishing.

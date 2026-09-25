# Site color: Stone & Evergreen

Approved and implemented September 24, 2026. It follows the [workspace color plan](WORKSPACE_COLOR_PLAN.md) and changes only surfaces and where color lands. Type, spacing, radii, pill buttons and the photo-first layout are unchanged.

## Why

The interface separated areas with three near-whites: white, `#fbfbfd` and `#f5f5f7`. They differ from each other by 1.03–1.09:1, so the sidebar, drop zones, bands and plan cards barely registered. Color came almost only from photography, and the logo's green appeared only as small link text.

## Rules

- **Two light tones.** White for cards, panels and dialogs; warm stone `#efede8` for the canvas and for any tinted area on white. No other near-white is used as a surface. White cards on stone carry a hairline and a soft warm shadow (`--shadow-card`).
- **One dark color.** Evergreen ink `#12211a`, a near-black with the logo's green in it, is used for the workspace sidebar, the phone tab bar, primary buttons, selected chips, the homepage closing band, the Explore closing card and the Pro plan card.
- **Bright green on dark only.** The logo's `#3fbf7f` marks the sidebar avatar, Pro checkmarks, focus rings on dark surfaces and a soft glow at the top of dark bands (`--green-glow`). On light surfaces, evergreen `#1a7045` stays the color for links, eyebrows and success.
- **No more than one light step.** A white surface on the stone canvas is the deepest light stack. Large areas inside a white panel stay white: drop targets are outlined, not filled. Only small controls (segmented tracks, search wells, chips, short notes) use a stone fill inside white. A feature panel on the canvas is either evergreen or its own full color, never a paler off-white.
- **Artwork on a dark stage.** Post and menu previews sit on `--artwork-stage` (`#1b2922`), a step lighter than the navigation, so light artwork stands out; `--artwork-edge` adds a hairline so dark artwork stays separate. Stage controls use the on-dark colors; white cards and the zoom pill keep ink text.
- **Restaurant artwork is untouched.** Menus, posts, table cards and exports keep their own colors. Published menu pages keep their previous neutral surround and chrome (`--menu-surround`, `--menu-chrome-line`).

## Tokens (`app/globals.css`)

| Token | Value | Notes |
| --- | --- | --- |
| `--gray-50` | `#f7f6f3` | Shimmer highlight only; no longer a surface |
| `--gray-100` / `--workspace-canvas` | `#efede8` | Stone canvas and tinted wells |
| `--gray-200` | `#e4e1da` | Selected, stage, disabled and loading fills |
| `--gray-300` / `--workspace-line` | `#d4d0c7` | Decorative lines |
| `--gray-600` / `--workspace-muted` | `#5f5f64` | Darkened from `#6e6e73` to hold 4.5:1 on stone |
| `--green` | `#1a7045` | Darkened from `#1e7a4c` to hold 4.5:1 on stone |
| `--green-ink` / `--workspace-action` | `#12211a` | Hover `#243a30`, pressed `#0a140f` |
| `--fill` | `rgb(120 110 90 / 12%)` | Warm translucent fill |
| `--canvas-glass` | `rgb(239 237 232 / 86%)` | Sticky bars over the canvas |
| `--nav-surface` | `rgb(18 33 26 / 96%)` | Phone tab bar |
| `--on-dark`, `--on-dark-muted`, `--on-dark-hover`, `--on-dark-selected`, `--on-dark-line` | white at 100%, 70%, 8%, 11%, 12% | Text, states and lines on evergreen |
| `--on-dark-warning` | `#f2c57c` | Warnings on the dark stage |
| `--artwork-stage` | `#1b2922` | Post and menu preview stage |
| `--artwork-edge` | hairline and drop shadow | Artwork on the dark stage |

The text grays from `--gray-400` to `--gray-900` are unchanged.

## Where it shows

- **Workspace shell:** evergreen sidebar with the reversed logo (`Brand reversedMedia`), white icons and a bright-green avatar; evergreen phone tab bar with the same white icons. The phone top bar stays on the canvas with the regular logo.
- **Photo Studio:** the empty drop zone is white inside the white card, outlined with a dashed line and centered on an evergreen icon tile; hover and drag tint it mint. The style library rail and dish placeholders are stone.
- **Explore:** stone page, white filter chips with a hairline, white search, stone frosted filter bar. "Made for the moment" is an evergreen band with white cards, a chosen collection introduces itself on its full color, and the closing card is evergreen.
- **Post Maker and Menus:** the preview stages are dark, with the Post/Story and Print/Phone switches, page controls, hints, design strip and review strip in on-dark colors. This includes the phone preview, Focus preview and phone layouts.
- **My Dishes:** white search beside the white Filters and Select buttons.
- **Post Maker:** the empty state's main action and Photo Studio link now sit in one spaced row (they previously touched).
- **Public site:** faint green glow behind the hero, stone use-case band with white cards, evergreen closing band, stone footer, stone Free card and evergreen Pro card. The visitor Photo Studio header is frosted stone.

## Contrast (calculated)

| Pair | Foreground | Background | Contrast |
| --- | --- | --- | ---: |
| Body text on stone | #1d1d1f | #efede8 | 14.38:1 |
| Muted text | #5f5f64 | #ffffff | 6.35:1 |
| Muted text on stone | #5f5f64 | #efede8 | 5.43:1 |
| Disabled label | #5f5f64 | #e4e1da | 4.86:1 |
| Link / eyebrow | #1a7045 | #ffffff | 6.09:1 |
| Link / eyebrow on stone | #1a7045 | #efede8 | 5.21:1 |
| Primary button | #ffffff | #12211a | 16.69:1 |
| Primary hover | #ffffff | #243a30 | 12.19:1 |
| Primary pressed | #ffffff | #0a140f | 18.75:1 |
| Sidebar item (white 70%) | #b8bcba | #12211a | 8.70:1 |
| Sidebar icon | #ffffff | #12211a | 16.69:1 |
| Sidebar active icon | #ffffff | #2c3933 | 12.07:1 |
| Bright green on evergreen | #3fbf7f | #12211a | 7.13:1 |
| Text on the artwork stage | #ffffff | #1b2922 | 15.14:1 |
| Muted text on the artwork stage (white 70%) | #bbbfbd | #1b2922 | 8.15:1 |
| Warning on the artwork stage | #f2c57c | #1b2922 | 9.41:1 |
| Cream artwork on the stage | #f5efe8 | #1b2922 | 13.26:1 |
| Collection panel text (ink 70%), weakest tint | #524e58 | #cdc0dc | 4.70:1 |
| Error text on stone | #b3261e | #efede8 | 5.59:1 |
| Control boundary | #86868b | #ffffff | 3.62:1 |

These are color-pair calculations, not a whole-page audit.

## Verification

- TypeScript, `npm test`, `npm run build`, Prettier and ESLint (warnings unchanged from before) passed.
- The homepage, pricing, privacy, guidelines and every workspace tab were reviewed at 1440×900 and 390×844, along with the plans, settings, style library and Explore detail dialogs, the account menu, the menu editor, More tools and the visitor Photo Studio.
- Held pressed states, 200% text enlargement and a published customer menu page were not rendered in this pass.
- September 25 layering pass: Photo Studio, Explore (with a collection chosen), My Dishes and a dish's details, Post Maker with a real post, and the menu editor in Print, Phone and Focus preview were reviewed at 1440×900 and 390×844 with photographed dishes.

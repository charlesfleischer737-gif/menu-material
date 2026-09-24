# Site color: Stone & Evergreen

Approved and implemented September 24, 2026. It follows the [workspace color plan](WORKSPACE_COLOR_PLAN.md) and changes only surfaces and where color lands. Type, spacing, radii, pill buttons and the photo-first layout are unchanged.

## Why

The interface separated areas with three near-whites: white, `#fbfbfd` and `#f5f5f7`. They differ from each other by 1.03–1.09:1, so the sidebar, drop zones, bands and plan cards barely registered. Color came almost only from photography, and the logo's green appeared only as small link text.

## Rules

- **Two light tones.** White for cards, panels and dialogs; warm stone `#efede8` for the canvas and for any tinted area on white. No other near-white is used as a surface. White cards on stone carry a hairline and a soft warm shadow (`--shadow-card`).
- **One dark color.** Evergreen ink `#12211a`, a near-black with the logo's green in it, is used for the workspace sidebar, the phone tab bar, primary buttons, selected chips, the homepage closing band, the Explore closing card and the Pro plan card.
- **Bright green on dark only.** The logo's `#3fbf7f` marks the sidebar avatar, Pro checkmarks, focus rings on dark surfaces and a soft glow at the top of dark bands (`--green-glow`). On light surfaces, evergreen `#1a7045` stays the color for links, eyebrows and success.
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
| `--on-dark`, `--on-dark-muted`, `--on-dark-hover`, `--on-dark-selected` | white at 100%, 70%, 8%, 11% | Text and states on evergreen |

The text grays from `--gray-400` to `--gray-900` are unchanged.

## Where it shows

- **Workspace shell:** evergreen sidebar with the reversed logo (`Brand reversedMedia`), white icons and a bright-green avatar; evergreen phone tab bar with the same white icons. The phone top bar stays on the canvas with the regular logo.
- **Photo Studio:** the drop zone, style library rail and dish placeholders are stone wells inside white panels.
- **Explore:** stone page, white filter chips with a hairline, white search, stone frosted filter bar, evergreen closing card.
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
| Error text on stone | #b3261e | #efede8 | 5.59:1 |
| Control boundary | #86868b | #ffffff | 3.62:1 |

These are color-pair calculations, not a whole-page audit.

## Verification

- TypeScript, `npm test`, `npm run build`, Prettier and ESLint (warnings unchanged from before) passed.
- The homepage, pricing, privacy, guidelines and every workspace tab were reviewed at 1440×900 and 390×844, along with the plans, settings, style library and Explore detail dialogs, the account menu, the menu editor, More tools and the visitor Photo Studio.
- Held pressed states, 200% text enlargement and a published customer menu page were not rendered in this pass.

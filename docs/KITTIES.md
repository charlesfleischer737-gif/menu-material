# Kitties

Added September 25, 2026. Small evergreen cats keep people company in the empty and waiting moments. They are decoration only: hidden from assistive technology, never focusable or clickable, and never part of restaurant artwork (menus, posts, table cards, exports, published menu pages).

## Where they are

| Place | Pose | Motion |
| --- | --- | --- |
| Public footer (home, pricing, privacy, guidelines, not-found, error) | Asleep beside the © sign-off | Breathes, "z"s drift up, an ear twitches |
| Not-found page, above the title | Peeking out of an open moving box | Blinks, glances around |
| Error page, above the title | Sitting | Blinks, glances around, tail swishes |
| Photo Studio while a photo is created | Sitting on the progress track | Eyes follow the moving bar on the bar's own 1.6 s timing; tail swishes |
| My Dishes before the first dish | Asleep, in place of the photos icon | As in the footer |
| Explore when a search finds nothing | Peeking over a ledge, in place of the search icon | Glances around |

My Dishes keeps the photos icon when filters or the archive are empty. When the kitty shows there, the heading and "Add your first dish" center with it.

On a device with a pointer, resting on an awake kitty closes its eyes contentedly and floats a small heart.

## Rules

- **Inside the palette.** Fur is the evergreen ink (`#12211a`). Eyes are the logo's bright green (`#3fbf7f`), which sits on the dark fur, as the [site color plan](SITE_COLOR_PLAN.md) keeps bright green for dark surfaces. The "z"s and the heart float on the light page, so they use evergreen `#1a7045`. Inner ears, toes and the curled tail's rim are `#34463c` and the nose is `#5b6e63`, subtle on the fur. The box and ledge use the stone grays.
- **White or stone only.** On an evergreen band or the artwork stage the fur would disappear.
- **Motion only when allowed.** Every animation sits under `prefers-reduced-motion: no-preference`. With reduced motion the kitties are still pictures.
- **Layout stays put.** The footer kitty's negative margins keep the sign-off line at its usual height and position. On the creating screen the kitty sits in front of the track and the bar slides under its paws.

## Files

- `app/components/kitty.tsx`: the SVG poses `sit`, `sleep`, `peek` and `box`, sharing one face. No state, so server and client components can both render it.
- `app/kitties.css`: colors, motion and each placement's size. The component takes only `pose` and `className`.

To remove the kitties, delete both files, the `kitties.css` import in `app/layout.tsx` and the `<Kitty>` uses. For the 404 page, that includes its `art` prop on `PublicInformation`.

## Verification

- Typecheck, `npm test` and the build pass, Prettier is clean on the changed files, and ESLint's warnings are unchanged from before.
- Reviewed at 1440×900 and 390×844: the homepage and pricing footers, the not-found page, the error page (forced with a malformed workspace state), My Dishes with no dishes and Explore with no search results. The Photo Studio creating panel was rendered on its own with the app's stylesheets, because a live creation needs the image API.
- The footer sign-off keeps its exact position, and the footer keeps its height on every page checked.
- With reduced motion, no kitty animations run. Without it, each pose runs only its own animations.

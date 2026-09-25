# Restaurant social design direction

September 15, 2026. The user asked to replace the generic, block-heavy Post Maker designs with work that restaurants would actually share.

## Observed references

- **Fonda London:** the restaurant's tuna post reproduced in [Toast's restaurant guide](https://pos.toasttab.com/uk/blog/on-the-line/how-to-drive-repeat-visits-to-your-restaurant). The browser showed the actual Instagram image: a generous overhead dish photograph with a fork, terracotta tile and wood. No headline or promotional block on the image; ingredients and provenance live in the caption. [Observed screenshot source](https://images.ctfassets.net/rric2f17v78a/4zGH0gU6Uc7VUMJdLhSyft/768393641e1f85f0ec1f0c6bb94607d5/fonda-london-instagram-dish.png).
- **Bang Bang Burgers:** the agency's [published social campaign](https://youmakeme.com/projects/bang-bang/), linked to the restaurant's Instagram. The actual Instagram screenshot uses a full-frame photograph and a short, large typographic announcement placed directly over it. The broader case study ties photography and type to the restaurant's personality. It is an older campaign, used for composition rather than a claim about current trends.
- **MISIPASTA:** [restaurant imagery credited to its Instagram](https://secretnyc.co/misipasta-nyc/) provides supporting context for food, craft and place as content. The design decisions above are based primarily on the two directly inspected examples.

No restaurant reference photos, marks, slogans or compositions were copied into the site. All shipped food examples remain Menu Material's existing original generated assets. Reference businesses' names are not used in templates. Gallery restaurant names, prices and dates are explicitly example-only and never copied into customer work.

## Result

- Food occupies almost the entire output, with no generic text panel underneath it.
- Ten compositions use distinctive typographic treatments: condensed announcement, fine serif, italic bar story, handwritten café note and clean photo-only.
- Barlow Condensed, Cormorant Garamond, Caveat and DM Sans are shipped locally under their included SIL Open Font Licenses from the official Google Fonts repository. The same fonts are used by live previews and exported files.
- Photo only, A few words and All details give the owner direct control over density. Restaurant name/logo are optional.
- Template switching preserves real photos, custom headlines, prices, dates and captions. It removes only known retired default slogans; it does not invent new customer claims.
- The picker uses larger images and minimal labels. Homepage sample promotions use the actual renderer with working price and palette controls.

## Verification

Type checking, the existing API/flow/catalog suites and 57 export checks pass. The actual ten gallery designs were rendered at both output sizes with the shipped fonts and images and reviewed as contact sheets. An additional default-offer assertion verifies a quantity greater than one even when the offer has only one dish type. Browser review caught an encoded-font-path issue, which was fixed by shipping filenames without brackets. All ten browser canvases subsequently rendered without alerts.

## September 25, 2026: Phase 1 art directions

Phase 1 of the [Post Maker review](POST_MAKER_REVIEW_2026-09-24.md#phase-1-status-september-25-2026) rebuilt the ten designs around the photo. Each design now has its own headline face and photo treatment. DM Sans stays the supporting face for labels, facts and descriptions.

| Design | Headline face | Photo and page |
|---|---|---|
| Just the dish | Instrument Serif | Full-bleed photo; words go in its quiet space |
| Daily special | Fraunces, soft semibold | Deep brand color, a shadowed photo card and a price seal |
| Menu drop | Anton, uppercase | Poster headline on the photo's own extended backdrop, or on a color block |
| Nightcap | Instrument Serif Italic, gold | Moody full-bleed photo with a vignette and warm glow |
| Slow mornings | Fraunces, soft italic, with a Caveat note | Paper texture and an arched photo with a keyline |
| Morning bake | Fraunces, soft semibold | Scalloped photo edge over warm paper |
| Supper club | Instrument Serif | Dark velvet, a date line between hairlines and an arched window with a gold keyline |
| In season | Bricolage Grotesque | Airy background tinted from the dish and a rounded photo card |
| Table for two | Bricolage Grotesque, with an Anton price | Brand color, a line listing the items and the price as the hero |
| From the pass | Cormorant Garamond | Stone paper, a framed photo, tracked facts and a hairline |

Rules every design follows:

- **Safe zones.** On Stories, text and logos stay between 270 px and 1540 px, clear of Instagram's profile row and reply bar, and 72 px from the sides in every format.
- **The whole dish.** A plain backdrop is extended from the photo's own edges, never filled with a design color. A busy photo that would lose too much is shown whole on a deep, blurred copy of itself.
- **Legible without covering the food.** Ink is chosen by measured contrast on the pixels behind each line. Any shade is only as dark as legibility needs. Long headlines move or shrink a dish on a plain backdrop rather than cover it.
- **Type.** Capitals are letter-spaced. Lines are balanced, so no line holds a single word when two balanced lines fit. Facts are joined with "·". The restaurant name is set at 36 px in tracked capitals.

The new faces are Instrument Serif (roman and italic), Anton, Fraunces and Bricolage Grotesque, from the official Google Fonts repository under the SIL Open Font License. Fraunces and Bricolage Grotesque are variable fonts, so `scripts/prepare-post-fonts.py` builds fixed instances of them. It also writes the WOFF2 files that browsers load, one font at a time. Node tests load the TTF files. Each face's license is in `public/fonts/social/`.

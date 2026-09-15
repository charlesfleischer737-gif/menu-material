# Restaurant social design direction

September 15, 2026. The user asked to replace the generic, block-heavy Post Maker designs with work that restaurants would actually share.

## Observed references

- **Fonda London:** the restaurant's tuna post reproduced in [Toast's restaurant guide](https://pos.toasttab.com/uk/blog/on-the-line/how-to-drive-repeat-visits-to-your-restaurant). The browser showed the actual Instagram image: a generous overhead dish photograph with a fork, terracotta tile and wood. No headline or promotional block on the image; ingredients and provenance live in the caption. [Observed screenshot source](https://images.ctfassets.net/rric2f17v78a/4zGH0gU6Uc7VUMJdLhSyft/768393641e1f85f0ec1f0c6bb94607d5/fonda-london-instagram-dish.png).
- **Bang Bang Burgers:** the agency's [published social campaign](https://youmakeme.com/projects/bang-bang/), linked to the restaurant's Instagram. The actual Instagram screenshot uses a full-frame photograph and a short, large typographic announcement placed directly over it. The broader case study ties photography and type to the restaurant's personality. It is an older campaign, used for composition rather than a claim about current trends.
- **MISIPASTA:** [restaurant imagery credited to its Instagram](https://secretnyc.co/misipasta-nyc/) provides supporting context for food, craft and place as content. The design decisions above are based primarily on the two directly inspected examples.

No restaurant reference photos, marks, slogans or compositions were copied into the site. All shipped food examples remain Plateworthy's existing original generated assets. Reference businesses' names are not used in templates. Gallery restaurant names, prices and dates are explicitly example-only and never copied into customer work.

## Result

- Food occupies almost the entire output, with no generic text panel underneath it.
- Ten compositions use distinctive typographic treatments: condensed announcement, fine serif, italic bar story, handwritten café note and clean photo-only.
- Barlow Condensed, Cormorant Garamond, Caveat and DM Sans are shipped locally under their included SIL Open Font Licenses from the official Google Fonts repository. The same fonts are used by live previews and exported files.
- Photo only, A few words and All details give the owner direct control over density. Restaurant name/logo are optional.
- Template switching preserves real photos, custom headlines, prices, dates and captions. It removes only known retired default slogans; it does not invent new customer claims.
- The picker uses larger images and minimal labels. Homepage sample promotions use the actual renderer with working price and palette controls.

## Verification

Type checking, the existing API/flow/catalog suites and 57 export checks pass. The actual ten gallery designs were rendered at both output sizes with the shipped fonts and images and reviewed as contact sheets. An additional default-offer assertion verifies a quantity greater than one even when the offer has only one dish type. Browser review caught an encoded-font-path issue, which was fixed by shipping filenames without brackets. All ten browser canvases subsequently rendered without alerts.

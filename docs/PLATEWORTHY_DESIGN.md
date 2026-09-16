# Plateworthy positioning and design

## Homepage audit follow-up — September 16, 2026

The use-case section now shows a generic delivery listing, a finished social post with its caption, and an illustrative dinner menu. Sample dishes and prices are labeled together beside the section heading; these layouts do not imply direct publishing to delivery platforms.

`public/homepage/social-post-example.webp` is a 640 × 800 capture of the actual Post Maker `special` template using `/homepage/social.webp`, a cobalt background (`#2346a3`), white accent, “Fish tacos” title, “TODAY’S SPECIAL” kicker, and “Your restaurant” sample name. It is served as a lazy-loaded static image with descriptive alternative text, avoiding the renderer and its fonts on the home page.

The hero keeps its headline and shorter benefit statement. At the user's request, the original six food bubbles and their desktop, tablet, and phone arrangements are restored. The free-offer note is now 15px. The style-gallery heading follows the main content alignment, while the interactive workbench remains at a maximum of 800px. Gallery supporting text is at least 14px. The before/after interaction and studio entry flow are unchanged.

The delivery example is now a polished item-detail screen: a prominent steak photograph, circular back and favorite icons, restaurant identity, dish title, price, description, quantity indicator, and an Add to order bar. It is a labeled, noninteractive illustration with a complete accessible description. No real ratings, endorsements, delivery estimates, or integration claims are presented. The compact purchase bar adapts to narrow phone layouts.

The expanded style gallery includes an Original photo option after the four styled images. Opening or reopening the gallery always shows the currently selected styled image; customers must select Original to view the source photograph. The original retains its full 4:3 framing and never replaces the main-page styled preview.

The homepage now presents the complete output: ordinary food photos become professionally styled imagery, shareable menu pages, and crops/captions for delivery and social posts. The headline is “From phone photos to menus, listings, and posts.” The product's existing menu, caption, image, and invitation flows remain intact. It does not claim to publish to DoorDash or Instagram automatically.

## Current page

- A restrained header, direct headline, primary action, and original/studio comparison.
- Three visual examples: a restaurant menu with rigatoni, a delivery listing with the burger, and an Instagram post with fish tacos. These are labeled illustrative layouts; prices and restaurant names are sample content, not customer data.
- Three steps: upload your dish, style the presentation, put the image into your menu or download the crop/caption.
- A compact final invitation to start with one dish.

The “Good to know” FAQ and the text-only channel list have been removed. Desktop examples align their visual frames and captions; tablet examples place copy beside images, and phone layouts stack. Existing social-preview imagery is preserved.

## Hero comparison

`public/burger-phone-original.jpg` is cyclonebill’s [original Burger photograph](https://commons.wikimedia.org/wiki/File:Hamburger_(5).jpg), with Sony Ericsson J20i phone metadata. It shows a casual indoor photo, ordinary lighting, utensils, a glass, and crumbs. The before image is unchanged.

`public/burger-studio-transformation.png` was made with one built-in imagegen edit directly from that original. It changes the large white plate to matte charcoal ceramic, replaces the table and clutter with a pale blue studio setting, lowers the camera angle, and reshapes lighting. The recognizable sesame bun, single thick patty, cheese, tomato, lettuce, and mayonnaise remain; fine textures and ingredient silhouettes are regenerated. It is labeled as an example AI edit, with owner accuracy review encouraged.

Source and derivative are [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/), with linked author/license attribution in the footer. Prior illustration assets are retained for existing metadata and version history.

## Additional examples

- `public/rigatoni-menu-example.png`: generated editorial tomato rigatoni in an ivory bowl on a wine-red table.
- `public/tacos-social-example.png`: generated fish tacos on a white plate against cobalt blue, in portrait composition.

One built-in imagegen request per asset; these are illustrative style examples, not customer or production API results. Full prompts, generation method, source paths, and current project paths are in `docs/styled-food-examples.json`. The original phone photo provenance remains in `docs/burger-image-provenance.json`.

The production AI connection still needs its existing server credentials; this design update does not claim live generation verification. The existing caption and menu features, download tools, usage controls, and data are preserved.

## Checks

TypeScript passed. The local page rendered successfully; the transformed burger and all three example layouts were inspected in the browser. Desktop and 390px mobile layouts were reviewed, and the temporary viewport override was reset. The FAQ content and imports are absent. This pass changes presentation only and does not alter data, authentication, generation jobs, usage enforcement, or publishing controls.

## Conversion copy refinement

The homepage now leads with “Make hungry customers choose your food.” Supporting copy emphasizes professional presentation, avoiding hours of editing, simple phone-based setup, and helping customers decide what to order. “Get started free” appears in the header, hero, and final call to action. The signup dialog carries the same benefits and uses “Sign up free” / “Create my free account.” The free pilot, invitation requirement, and no-card offer remain clear.

Copy avoids unmeasured revenue lifts, guaranteed results, or an unverified seconds-to-completion promise. The two homepage disclaimer paragraphs remain removed at the user's request. Image credits and existing product accuracy review remain. TypeScript passed, the local page rendered, and the header action opened the signup tab with its invitation fields. No account was created during this review.

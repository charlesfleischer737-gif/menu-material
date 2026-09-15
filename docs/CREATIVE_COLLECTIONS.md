# Photo collections and Instagram design system

September 15, 2026. The core tools retain their source-photo, approval, persistence and export boundaries.

## Photo Studio

Twenty-eight curated presets across seven collections. Each preset has a distinct photograph, lighting/surface/composition prompt, intended uses and visible traits. The four-image collection is the working surface. The selected reference updates immediately. Original food identity and serving size remain generation requirements; results still require review. Examples are never passed as food references to the provider.

### Delivery & Takeout

Clear, appetizing item photos that make the dish easy to recognize at a glance. Show the complete serving. Keep the background simple and avoid added text or props.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Clean & craveable | Even softbox light · White seamless · Full serving | Burgers, sandwiches and individual entrées |
| Takeout, elevated | Soft neutral light · Pale grey surface · Keep real packaging | Poke, grain bowls and boxed meals |
| Natural daylight | Diffused daylight · Light oak · Natural color | Tacos, wraps and comfort food |
| Top-down clarity | Overhead angle · Plain white surface · Complete edges | Pizza, flatbreads and shallow bowls |

### Fine Dining

Quiet luxury, considered light and an elegant setting for your signature dishes. Elevate the surroundings while keeping your real plating, ingredients and portion intact.

| Style | Treatment | Particularly useful for |
|---|---|---|
| White-linen service | Refined window light · White linen · Soft dining-room blur | Seafood, delicate starters and tasting plates |
| Dark degustation | Directional sidelight · Dark slate · Restrained contrast | Steak, duck and rich signature dishes |
| Chef’s counter | Clean sidelight · Pale travertine · Quiet negative space | Crudo, tartare and sculptural plating |
| Evening reservation | Warm low light · Deep burgundy tones · Distant candle bokeh | Dinner specials and reservation campaigns |

### Menu

Versatile restaurant photography with balanced colors and easy-to-read detail. Use one preset across a menu for a consistent visual treatment.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Fresh on stone | Bright diffused light · Pale limestone · Balanced natural color | Salads, seasonal plates and lighter dishes |
| Neighborhood table | Warm window light · Natural oak · Gentle background blur | Roasts, breakfast plates and comfort food |
| Menu flat lay | Overhead angle · Warm grey surface · Even soft light | Skillets, bowls and dishes with layered toppings |
| Modern bistro | Balanced daylight · Matte light grey · Soft contact shadows | Risotto, pasta and everyday entrées |

### Bar & Lounge

After-dark atmosphere, rich shadows and precise highlights that make glassware glow. Moody lighting should still leave the drink, garnish and serving clearly visible.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Amber hour | Amber rim light · Polished walnut · Charcoal shadows | Whiskey cocktails and dark spirits |
| Velvet lounge | Cool rim light · Dark stone · Emerald velvet blur | Martinis, coupes and signature cocktails |
| Blue-hour bar | Cool ambient light · Cobalt bar · Warm highlights | Colorful cocktails and evening announcements |
| Wine-bar warmth | Warm candlelike light · Rich earthy tones · Shallow background depth | Bar snacks, sharing plates and wine pairings |

### Beverage

Fresh, luminous drinks with beautiful color, texture and clarity. Keep the original glass, liquid level, ice and garnish true to what you serve.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Morning café | Morning window light · Warm café table · Clear glass detail | Iced coffee, lattes and café drinks |
| Sunshine sip | Clean sunshine · Pale terracotta · Fresh natural color | Fresh juice, smoothies and summer drinks |
| Modern matcha bar | Soft studio sidelight · Pale green matte · Delicate shadows | Matcha, milk teas and specialty drinks |
| Light through glass | Luminous backlight · Cool pale stone · Controlled highlights | Iced teas, spritzes and clear cold drinks |

### Studio

Controlled light and striking backgrounds for a polished commercial photograph. Choose a backdrop that complements the food. Color and light do the work.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Sculpted ivory | Large softbox · Ivory seamless · Sculptural soft shadow | Desserts, delicate plates and premium products |
| Color-pop campaign | Controlled softbox · Cobalt seamless · Crisp commercial finish | Bao, sandwiches and colorful hero dishes |
| Spotlight studio | Directional studio light · Charcoal seamless · Detailed highlights | Noodles, grilled dishes and glossy sauces |
| Soft-color studio | Gentle diffused light · Blush seamless · Soft short shadows | Gelato, sweets and playful seasonal items |

### Bakery

Golden crusts, delicate layers and handcrafted details, beautifully lit. Let real crumb, frosting and pastry texture stay visible, with no invented decoration.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Fresh from the oven | Warm morning light · Pale oak · Crisp pastry texture | Croissants, viennoiserie and breakfast pastries |
| Patisserie counter | Bright diffuse light · Pale marble · Natural highlights | Fruit tarts, entremets and refined cakes |
| Artisan bread | Warm directional daylight · Rustic wood · Oatmeal linen backdrop | Sourdough, rolls and rustic baking |
| Confectionery color | Luminous softbox · Lilac seamless · Soft confectionery color | Macarons, petit fours and colorful confections |

Overhead presets explicitly change the angle and show a review note. The owner can choose Keep my angle in fine-tuning; the resulting prompt respects that override. New choices reset old surface/lighting overrides so the selected preset has the advertised treatment. Restaurant looks and user-supplied references are preserved. Previous preset IDs still resolve for saved work. Menu batches can use the expanded catalog.

## Post Maker

Ten original photographic compositions adapt to 1080 × 1350 feed posts and 1080 × 1920 stories. The September 15 revision replaces the earlier blocks, arches, offer seals and generic slogans with full-frame food photography, restrained copy and properly licensed display fonts. See [the social art direction](SOCIAL_DESIGN_DIRECTION.md) for observed restaurant references and implementation choices.

| Design | Composition |
|---|---|
| Just the dish | An uninterrupted photo, with the wording in the caption. |
| The daily special | Large condensed type over a close food photograph, with supplied price and time. |
| Menu drop | Oversized announcement type directly over the photo. |
| The nightcap | A drink portrait with expressive italic typography and quiet branding. |
| Slow mornings | Sunlit photography and a casual handwritten line. |
| The morning bake | A close crop, fine border and handwritten headline on the photograph. |
| Supper club | A photographic invitation with elegant serif type and supplied date. |
| In season | Restrained corner typography over a generous ingredient photo. |
| A table for two | Full-frame food pairing with the actual quantities and price. |
| From the pass | A fine-dining photograph with delicate editorial type. |

Owners choose Photo only, A few words, or All details and can turn the restaurant signature on or off. Optional fields stay optional. Blank space is not filled with invented badges or slogans. Custom headlines and confirmed customer facts survive template changes. Photo-only posts retain the factual caption. The preview offers ten distinct food/drink examples or the customer's own approved photo; example photos, brands, dates and prices never enter the customer's draft.

Fill frame is the new default. Fit whole dish remains available with a blurred extension of the same image. Feed and story framing stay independent. Fonts load before canvas rendering and export, and ship with their licenses. Headlines support line breaks. All details exports preserve supplied dish names, quantities, prices and dates. Text is measured and fitted, and excessive copy produces an actionable error rather than clipping. Existing photo/price/story template IDs still resolve. Preview, PNG and ZIP exports use the same renderer, including the homepage promotion examples.

## Assets and validation

- 28 new images generated with the built-in image generator; optimized 1000 × 1000 WebP files in `public/studio/styles/`. Prompts and provenance: `STUDIO_V2_IMAGE_PROMPTS.json`. Each file and each preset prompt is unique.
- Existing API and persistence suites, 18 caption/flow assertions, and a catalog suite checking all preset prompts, images, category coverage, example isolation and old-draft mappings.
- 57 export checks: original PDF/delivery checks, all ten templates plus legacy mappings in feed/story, safe text bounds, combo quantities/prices and non-overlapping text, and campaign ZIP contents.
- Prior collection release: desktop/phone review of Photo Studio. Social redesign: actual feed/story export contact sheets and browser checks of font loading, example/customer switching, text controls and saving. The browser viewport override did not change its available 694px viewport in this run; no new 1440px/390px browser claim is made.

## Service boundary

Photo generation still requires the existing OpenAI service connection. This release changes preset instructions and the editor; it does not claim live generation fidelity, latency or billing verification. Instagram templates, local photo adjustments, manual captions and exports do not call an image model. No social accounts are auto-published.

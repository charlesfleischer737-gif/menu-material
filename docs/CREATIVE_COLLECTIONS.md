# Photo collections and Instagram design system

September 15, 2026. The core tools retain their source-photo, approval, persistence and export boundaries.

## Photo Studio

Sixty-three curated presets across nine collections. The seven original collections each have eight styles; Bold & Dramatic adds four and Pro Food Fantasy adds three. Each preset has a distinct example, lighting/surface/composition prompt, intended uses and visible traits, browsable in the single-page workbench. The selected reference updates immediately. Photography styles retain original food identity and serving size; Food Fantasy deliberately exaggerates scale and presentation while retaining ingredient identity. Examples are never passed as food references to the provider.

### Food Fantasy · Pro

Added September 28, 2026. Deliberately stylized campaign art with appetizing food textures and exaggerated geometry. Melt monument amplifies existing cheese and sauce into sculptural folds; Flavor in flight suspends existing ingredients in a controlled burst; Sugar skyscraper stretches existing frosting and dessert layers into a tower. Each style is labeled as creative food art in Explore, the library and the workbench, with a Pro badge and upgrade action.

The server resolves this treatment from a known catalog ID or exact saved prompt, enforces Pro before reserving a new image, and captures the creative direction for generation and corrections. It ignores arbitrary client treatment flags. Paid work already accepted and reusable completed results remain accessible after a downgrade. Normal photography prompts remain unchanged. This collection permits exaggerated proportions and arrangement, but not new ingredient types, toppings, servings or brands. Owner controls and source drink vessels remain authoritative.

Original examples and exact built-in image-generation prompts are recorded in `FOOD_FANTASY_IMAGE_PROMPTS.json`. These examples demonstrate the artistic direction, not a verified transformation of a customer photo. `tests/food-fantasy.mjs` covers the paid gate, saved-prompt resolution, credit preservation, downgrade replay and prompt separation.

### Bold & Dramatic

Added September 28, 2026. More extravagant settings for social launches, signature dishes and website photography. Color, light and framing provide the impact; food, portion, texture and serving ware stay faithful to the original. These styles do not add ingredients, enlarge servings, float food or invent sauce drips. The existing generation instructions still take priority for food identity, original drink vessels and owner controls.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Crimson close-up | Saturated red · Hard sidelight · Grounded shadow | Burgers, sandwiches and signature snacks |
| Electric blue | Electric cobalt · Diagonal yellow spotlight · Neutral food light | Tacos, bao and colorful lunch specials |
| The main event | Dark cherry velvet · Warm spotlight · Natural highlights | Pasta, steak and dinner specials |
| Golden hour, amplified | Saturated amber · Hard sun · Large architectural shadow | Cheesecake, pastries and desserts |

The collection is available in Photo Studio and Explore. The crimson and electric-blue looks also appear in the homepage showcase. Search recognizes “extravagant” and “wow.” All four remain available on the existing free photo plan. Examples are original built-in image-generator outputs; exact prompts and provenance are recorded in `BOLD_STYLES_IMAGE_PROMPTS.json`. They demonstrate the art direction, not a verified transformation of an uploaded customer dish.

### Delivery & Takeout

Clear, appetizing item photos that make the dish easy to recognize at a glance. Show the complete serving. Keep the background simple and avoid added text or props.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Clean & craveable | Even softbox light · White seamless · Full serving | Burgers, sandwiches and individual entrées |
| Takeout, elevated | Soft neutral light · Pale grey surface · Keep real packaging | Poke, grain bowls and boxed meals |
| Natural daylight | Diffused daylight · Light oak · Natural color | Tacos, wraps and comfort food |
| Top-down clarity | Overhead angle · Plain white surface · Complete edges | Pizza, flatbreads and shallow bowls |
| Paper & crunch | Bright diffuse light · Sand seamless · Real takeaway container | Fried chicken, tenders and takeaway snacks |
| Fresh on sage | Overhead angle · Muted sage surface · Even softbox light | Falafel bowls, salads and plant-based meals |
| Crisp on charcoal | Graphite backdrop · Bright even light · Simple white tray | Fish and chips, golden entrées and hearty meals |
| Peach-perfect | Pale peach surface · Soft daylight · Diagonal composition | Wraps, subs and colorful sandwiches |

### Fine Dining

Quiet luxury, considered light and an elegant setting for your signature dishes. Elevate the surroundings while keeping your real plating, ingredients and portion intact.

| Style | Treatment | Particularly useful for |
|---|---|---|
| White-linen service | Refined window light · White linen · Soft dining-room blur | Seafood, delicate starters and tasting plates |
| Dark degustation | Directional sidelight · Dark slate · Restrained contrast | Steak, duck and rich signature dishes |
| Chef’s counter | Clean sidelight · Pale travertine · Quiet negative space | Crudo, tartare and sculptural plating |
| Evening reservation | Warm low light · Deep burgundy tones · Distant candle bokeh | Dinner specials and reservation campaigns |
| Presented by the chef | Hand-presented plate · Luminous sidelight · Warm dining-room blur | Signature pasta, tasting plates and chef specials |
| Riviera terrace | Pale stone terrace · Olive garden blur · Late-afternoon light | Seafood, vegetable mains and seasonal plates |
| Obsidian tasting | Overhead spotlight · Glossy obsidian · Black porcelain | Carpaccio, colorful starters and tasting courses |
| The gallery plate | Warm plaster wall · Porcelain on a plinth · Architectural shadow | Delicate starters, seafood and sculptural plating |

### Menu

Versatile restaurant photography with balanced colors and easy-to-read detail. Use one preset across a menu for a consistent visual treatment.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Fresh on stone | Bright diffused light · Pale limestone · Balanced natural color | Salads, seasonal plates and lighter dishes |
| Neighborhood table | Warm window light · Natural oak · Gentle background blur | Roasts, breakfast plates and comfort food |
| Menu flat lay | Overhead angle · Warm grey surface · Even soft light | Skillets, bowls and dishes with layered toppings |
| Modern bistro | Balanced daylight · Matte light grey · Soft contact shadows | Risotto, pasta and everyday entrées |
| Terrazzo brunch | Overhead daylight · Peach terrazzo · Cream ceramic | Brunch plates, pancakes and breakfast specials |
| Courtyard table | Jade glazed tile · Courtyard blur · Soft front light | Grilled seafood, summer plates and vegetables |
| From our kitchen | Two supporting hands · Taupe linen apron · Airy window light | Pasta bowls, signature dishes and daily specials |
| Modern diner | Burgundy checks · White ceramic · Lateral daylight | Sandwiches, lunch favorites and comfort food |

### Bar & Lounge

After-dark atmosphere, rich shadows and precise highlights that make glassware glow. Moody lighting should still leave the drink, garnish and serving clearly visible.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Amber hour | Amber rim light · Polished walnut · Charcoal shadows | Whiskey cocktails and dark spirits |
| Velvet lounge | Cool rim light · Dark stone · Emerald velvet blur | Martinis, coupes and signature cocktails |
| Blue-hour bar | Cool ambient light · Cobalt bar · Warm highlights | Colorful cocktails and evening announcements |
| Wine-bar warmth | Warm candlelike light · Rich earthy tones · Shallow background depth | Bar snacks, sharing plates and wine pairings |
| The perfect pint | Brushed brass · Oxblood leather blur · Warm narrow sidelight | Stouts, ales and draft-beer features |
| Rooftop at dusk | Dusky rose stone · Mauve skyline blur · Sunset rim light | Palomas, spritzes and aperitif specials |
| Midnight reflection | Mirror surface · Copper glow · Sculptural sidelight | Espresso martinis, coupes and cocktail launches |
| Cellar reserve | Aged limestone · Burgundy plaster · Narrow warm light | Red wine, wine flights and cellar selections |

### Beverage

Fresh, luminous drinks with beautiful color, texture and clarity. Keep the original glass, liquid level, ice and garnish true to what you serve.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Morning café | Morning window light · Warm café table · Clear glass detail | Iced coffee, lattes and café drinks |
| Sunshine sip | Clean sunshine · Pale terracotta · Fresh natural color | Fresh juice, smoothies and summer drinks |
| Modern matcha bar | Soft studio sidelight · Pale green matte · Delicate shadows | Matcha, milk teas and specialty drinks |
| Light through glass | Luminous backlight · Cool pale stone · Controlled highlights | Iced teas, spritzes and clear cold drinks |
| Poolside refresh | Turquoise tile · Water-light reflections · Crisp summer sun | Lemonades, sparkling drinks and seasonal refreshers |
| The morning ritual | One supporting hand · Oatmeal linen · Gentle morning backlight | Flat whites, cappuccinos and warm café drinks |
| Orchid pop | Lilac seamless · Curved tonal plinth · Luminous softbox | Smoothies, fruit drinks and colorful shakes |
| Botanical light | Pale travertine · Greenhouse blur · Soft leaf shadows | Iced teas, herbal infusions and clear cold drinks |

### Studio

Controlled light and striking backgrounds for a polished commercial photograph. Choose a backdrop that complements the food. Color and light do the work.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Sculpted ivory | Large softbox · Ivory seamless · Sculptural soft shadow | Desserts, delicate plates and premium products |
| Color-pop campaign | Controlled softbox · Cobalt seamless · Crisp commercial finish | Bao, sandwiches and colorful hero dishes |
| Spotlight studio | Directional studio light · Charcoal seamless · Detailed highlights | Noodles, grilled dishes and glossy sauces |
| Soft-color studio | Gentle diffused light · Blush seamless · Soft short shadows | Gelato, sweets and playful seasonal items |
| Lifted in coral | One supporting hand · Coral seamless · Controlled studio shadow | Small plates, snacks and colorful hero dishes |
| Chrome editorial | Stainless steel tray · Cool silver sweep · Large softbox highlights | Sushi, refined small plates and modern campaigns |
| Butter-yellow sun | Butter-yellow backdrop · Architectural shadow · Warm directional light | Cheesecake, desserts and golden baked treats |
| Terracotta forms | Terracotta surface · Sculptural arch · Warm diffused light | Pastries, snacks and earthy-colored dishes |

### Bakery

Golden crusts, delicate layers and handcrafted details, beautifully lit. Let real crumb, frosting and pastry texture stay visible, with no invented decoration.

| Style | Treatment | Particularly useful for |
|---|---|---|
| Fresh from the oven | Warm morning light · Pale oak · Crisp pastry texture | Croissants, viennoiserie and breakfast pastries |
| Patisserie counter | Bright diffuse light · Pale marble · Natural highlights | Fruit tarts, entremets and refined cakes |
| Artisan bread | Warm directional daylight · Rustic wood · Oatmeal linen backdrop | Sourdough, rolls and rustic baking |
| Confectionery color | Luminous softbox · Lilac seamless · Soft confectionery color | Macarons, petit fours and colorful confections |
| Parisian pause | Marble checkerboard · Scalloped cream plate · Soft café daylight | Éclairs, choux pastry and elegant café sweets |
| Made by hand | Two supporting hands · Oatmeal linen apron · Soft window light | Galettes, pies and handcrafted bakes |
| Blueberry morning | Cornflower blue · Textured blue linen · Bright diffused daylight | Muffins, scones and berry-filled pastries |
| Golden on copper | Patinated copper · Cocoa plaster · Low warm sidelight | Cardamom knots, cinnamon rolls and laminated pastry |

Overhead and hand-presented food presets select an appropriate camera angle; fine-tuning shows a review note when the angle changes. The owner can choose Keep my angle in fine-tuning; the resulting prompt respects that override. New choices reset old surface/lighting overrides so the selected preset has the advertised treatment. Restaurant looks and user-supplied references are preserved. Previous preset IDs still resolve for saved work. Menu batches can use the expanded catalog.

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

- Expanded collection: 28 additional unique photographs, generated using the built-in subscription tool only (no API calls), bringing every category to eight styles. Native-resolution WebP files in `public/studio/styles/`; exact prompts, original output paths and subject identities in `STUDIO_EXPANSION_IMAGE_PROMPTS.json`.
- Preset art directions specify the depicted background, lighting, surface and presentation. Hands only appear in hand-presented styles. Drink styles preserve the uploaded vessel and visible branding. Beer, wine, coffee, tea and smoothie recommendations now include relevant new examples.

- Original collection: 28 images generated with the built-in image generator; optimized 1000 × 1000 WebP files in `public/studio/styles/`. Prompts and provenance: `STUDIO_V2_IMAGE_PROMPTS.json`. Each file and each preset prompt is unique.
- Existing API and persistence suites, 18 caption/flow assertions, and a catalog suite checking all preset prompts, images, category coverage, example isolation and old-draft mappings.
- 57 export checks: original PDF/delivery checks, all ten templates plus legacy mappings in feed/story, safe text bounds, combo quantities/prices and non-overlapping text, and campaign ZIP contents.
- Prior collection release: desktop/phone review of Photo Studio. Social redesign: actual feed/story export contact sheets and browser checks of font loading, example/customer switching, text controls and saving. The browser viewport override did not change its available 694px viewport in this run; no new 1440px/390px browser claim is made.

## Service boundary

Photo generation still requires the existing OpenAI service connection. This release changes preset instructions and the editor; it does not claim live generation fidelity, latency or billing verification. Instagram templates, local photo adjustments, manual captions and exports do not call an image model. No social accounts are auto-published.

# Homepage use cases and feature examples

The homepage now includes six food-led use cases and three interactive feature examples. Demo prices, colors, the original/result toggle, and menu availability are local illustrative state; they do not alter a restaurant record, generate a photo, publish a menu, or emit product-usage metrics. Start buttons use the existing invitation/studio flow.

## Final project assets

All paths below are relative to the project root. Images are optimized WebP files, lazy-loaded below the existing hero, at 960 pixels wide.

| Use                          | Saved image                            | Source                                                                             |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Delivery apps                | `public/homepage/restaurants.webp`     | Existing generated steak-frites photograph, reused at its original display quality |
| Social media                 | `public/homepage/social.webp`          | Existing `public/tacos-social-example.png`                                         |
| Menus and promotion examples | `public/homepage/menus.webp`           | Existing `public/rigatoni-menu-example.png`                                        |
| Bars & restaurants           | `public/homepage/restaurants.webp`     | New built-in imagegen photograph                                                   |
| Bakeries & cafés             | `public/homepage/cafes.webp`           | New built-in imagegen photograph                                                   |
| Food trucks                  | `public/homepage/food-trucks.webp`     | New built-in imagegen photograph                                                   |
| Original comparison          | `public/homepage/burger-original.webp` | Existing `public/burger-phone-original.jpg`                                        |
| Enhanced comparison          | `public/homepage/burger-enhanced.webp` | Existing `public/burger-studio-transformation.png`                                 |

The existing cyclonebill / CC BY-SA 2.0 burger attribution remains in the homepage footer and applies to its optimized derivatives. Newly generated images are illustrative category photography, not customer testimonials or documented results from a live restaurant account.

## Final generation prompts

Used built-in imagegen for exactly three original images in a parallel batch. No variants or retries. Each original is 1536 × 1024 pixels. Only size and file format changed during integration.

### Bars & restaurants

Use case: photorealistic-natural
Asset type: standalone food photography for a premium independent-restaurant marketing homepage.
Primary request: beautifully seared steak frites on a ceramic bistro plate, herb butter melting over the steak, thin crisp fries.
Scene/backdrop: rich dark walnut table and softly blurred amber restaurant atmosphere.
Style/medium: photoreal editorial food photography, premium independent-restaurant feel, extremely appetizing natural food texture.
Composition/framing: landscape 3:2 image, elegant close composition; food is the focal point; full plate and all food fully inside the crop with some breathing room, shallow depth of field.
Lighting/mood: natural soft window light, warm inviting atmosphere, realistic colors and surfaces.
Materials/textures: seared steak crust, melting herb butter, crisp golden fries, tactile ceramic glaze and walnut grain.
Constraints: original single photograph, no text, no logos, no watermarks, no UI, no collage.

### Bakeries & cafés

Use case: photorealistic-natural
Asset type: standalone food photography for a premium independent-restaurant marketing homepage.
Primary request: a golden flaky croissant with a cut strawberry pastry and a beautiful latte on a cafe table.
Scene/backdrop: softly blurred elegant independent cafe atmosphere.
Style/medium: photoreal editorial food photography, premium independent-restaurant feel, extremely appetizing natural food texture.
Composition/framing: landscape 3:2 image, elegant close composition; pastries and latte are the focal point; subjects fully inside the crop with some breathing room, shallow depth of field.
Lighting/mood: natural morning window light, warm inviting atmosphere, realistic colors and surfaces.
Materials/textures: tactile crumbs and croissant lamination, fresh strawberries, delicate pastry flakes, creamy latte foam in a ceramic cup.
Constraints: original single photograph, no text, no logos, no watermarks, no UI, no collage.

### Food trucks

Use case: photorealistic-natural
Asset type: standalone food photography for a premium independent-restaurant marketing homepage.
Primary request: three vibrant birria tacos in a compostable tray with a small consomme cup, chopped cilantro and onion, and lime.
Scene/backdrop: sunlit outdoor food-truck counter subtly hinted in the softly blurred backdrop.
Style/medium: photoreal editorial food photography, premium independent-restaurant feel, extremely appetizing natural food texture.
Composition/framing: landscape 3:2 image, elegant close composition; tacos are the focal point; tray, food and consomme cup fully inside the crop with some breathing room, shallow depth of field.
Lighting/mood: natural warm sunlight, inviting atmosphere, realistic colors and surfaces.
Materials/textures: rich seared tortilla texture, succulent birria, bright fresh cilantro and onion, lime, tactile compostable fiber tray.
Constraints: exactly three tacos; original single photograph, no text, no logos, no watermarks, no UI, no collage.

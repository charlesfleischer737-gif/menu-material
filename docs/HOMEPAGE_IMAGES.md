# Homepage use cases and feature examples

The homepage includes a before/after hero comparison, three food-led use cases and a style gallery. Demo prices, colors, the original/result toggle, and menu availability are local illustrative state; they do not alter a restaurant record, generate a photo, publish a menu, or emit product-usage metrics. Start buttons use the existing invitation/studio flow.

## Images on the current homepage

All paths are relative to the project root. Every served file is a lossy WebP copy made by `node scripts/prepare-web-images.mjs homepage` from an unchanged source, and every `<img>` has a `srcset` and a `sizes` that match its rendered width, so each device downloads one suitably sized copy.

| Section                      | Served files                                                                                               | Source (kept, not re-encoded)                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Hero comparison, before      | `public/homepage/optimized/burger-before-{640,960,1280,1536}.webp`                                         | `public/burger-phone-original.jpg` (2592 × 1944)                                 |
| Hero comparison, after       | `public/homepage/optimized/burger-after-{640,960,1280,1536}.webp`                                          | `public/burger-studio-transformation.png` (1536 × 1024)                          |
| Use case: Delivery apps      | `public/homepage/optimized/restaurants-{320,480,640,800}.webp`, `public/homepage/restaurants.webp`         | `public/homepage/restaurants.webp` (960 px generated steak-frites photograph)    |
| Use case: Social media       | `public/homepage/optimized/social-post-example-{320,480}.webp`, `public/homepage/social-post-example.webp` | `public/homepage/social-post-example.webp` (640 × 800 Post Maker capture)        |
| Use case: Your existing menu | `public/homepage/optimized/menus-{320,480,640,800}.webp`, `public/homepage/menus.webp`                     | `public/homepage/menus.webp` (960 px rigatoni photograph)                        |
| Style gallery                | `public/homepage/styles/cheesecake-<style>-{160,…,1254}.webp`, `cheesecake-original-{320,…,1280}.webp`     | Lossless masters and the original JPEG; see `HOMEPAGE_STYLE_GALLERY_IMAGES.json` |

The marketing page is rendered on the server for signed-out visitors, so the two hero photos are in the initial HTML (`fetchpriority="high"`). Use-case and gallery photos are `loading="lazy"`. The style gallery mounts only the photo on screen; another style's photo starts loading when its option is hovered, focused or chosen, and photos already shown stay mounted for the cross-fade.

### Encoding

`scripts/prepare-web-images.mjs` resizes each source with lanczos3 and encodes WebP at quality 82 with sharp YUV conversion (`smartSubsample`) and effort 6. Quality 78–85 was compared on crops of the burger bun, the cheesecake crumb and the cobalt backdrop at 2× zoom: there is no banding or blocking at 82, only a slight softening of the finest paper grain, and the files are about a tenth of the earlier lossless ones. The `drawing` and `photo` presets and `smartDeblock` looked no better. `npm run test:web-assets` checks every copy against its source (PSNR at least 34 dB at display sizes, 31 dB for thumbnails; measured 35–40 dB and 32–38 dB), its dimensions, and weight budgets (hero pair at 1536 px ≤ 300 KB, each 960 px gallery photo ≤ 150 KB).

### Weight

Measured September 24, 2026 with Playwright on a fresh cache, scrolling the whole page so every lazy image loads:

| Viewport               | Images before | Images after  | Hero pair before → after           |
| ---------------------- | ------------- | ------------- | ---------------------------------- |
| Desktop 1440 × 900 @1x | 7,208 KB      | 367 KB (−95%) | 2,436 KB → 210 KB (1280 px copies) |
| Phone 390 × 844 @3x    | 9,808 KB      | 595 KB (−94%) | 2,436 KB → 276 KB (1536 px copies) |

Before, the hero served lossless WebP (and, for the before photo, the 2592 px JPEG on any screen needing more than 640 px), the gallery downloaded all five 960 px (desktop) or 1254 px lossless masters (3× phone), and the use-case cards always loaded the 960 px files.

### Earlier assets

`public/homepage/cafes.webp`, `food-trucks.webp`, `delivery.webp`, `social.webp`, `burger-original.webp` and `burger-enhanced.webp` are not shown on the current homepage and are left unchanged. `social.webp` is the photo inside `social-post-example.webp`, and the prompts below produced `restaurants.webp`, `cafes.webp` and `food-trucks.webp` for an earlier six-use-case homepage.

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

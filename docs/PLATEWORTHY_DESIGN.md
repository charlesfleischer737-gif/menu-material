# Plateworthy positioning and design

The current focus is photo improvement for restaurants: regular phone photos become studio-style images for menus, delivery listings, websites, and social posts. The former restaurant-partner positioning has been removed from the landing page. Captions and hosted menu tools remain available in the existing workspace without leading the marketing.

## Message

Make your food look worth ordering. Upload your dish, choose the lighting/presentation, review two options, then crop and download. Sales language describes the purpose and potential benefit; it does not claim a measured conversion or revenue increase.

## Structure

- Original photograph next to a labeled illustrative studio edit.
- Three steps: upload, choose a look, review/download.
- Interactive square, portrait, and story crop examples.
- Food accuracy and owner review.
- Practical FAQs and invitation-only pilot signup.

References reviewed: [FoodShot](https://foodshot.ai/) and [Beautiful Food](https://www.trybeautifulfood.com/). No competitor imagery, testimonials, performance statistics, prices, or copy are reused.

## Imagery

Original: `public/burger.jpg`, [Valeria Boltneva, Pexels](https://www.pexels.com/photo/close-up-photo-of-burger-1639562/). Supporting pasta image: `public/pasta.jpg`, [Adrian Vieriu, Pexels](https://www.pexels.com/photo/pasta-on-a-plate-11654225/). Both under the Pexels license.

Edited illustration: `public/plateworthy-burger.png`, generated once with built-in image_gen, from the original licensed burger photograph. No retry or variant. The comparison is labeled on the page as an illustrative edit created for this demo; it is not represented as a live API or customer result. The bun, layers, skewer, and overall dish remain recognizable, while seed placement and fine textures change.

Final image prompt:

> Use case: precise-object-edit. Asset type: restaurant landing-page example, explicitly labeled externally as an AI-styled illustration. Input image is the edit target; preserve its exact burger. Edit the supplied photo into photorealistic high-end restaurant advertising food photography. Change lighting, surface, background, and framing only. Replace the blurred restaurant and wooden tabletop with a minimal warm light-gray seamless studio sweep and a brushed stainless-steel serving tray beneath the burger. Preserve the exact burger’s shape, proportions, sesame bun, wooden skewer, lettuce, tomato, beef patty, yellow cheese, sauce, bottom bun, and existing onion. Keep ingredient silhouettes, layer order, and handmade character recognizable; do not add or remove ingredients. Landscape 3:2, same three-quarter camera angle, full burger, skewer, and tray visible, ideally 20% breathing room. Controlled soft directional studio lighting, natural appetizing color and food texture, clean contact shadows. Restrained moisture, no excessive gloss, fries, invented sides, extra props, text, logos, or watermark.

## Review status

Source and generated asset inspected. Existing API integration checks, type checking, and production compilation are used to validate this iteration. Browser/device visual QA and live image quality benchmarking are still separate pilot checks.

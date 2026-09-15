export type PhotoStyle = {
  id: string;
  name: string;
  cue: string;
  group: string;
  image: string;
  prompt: string;
  category?: string;
  description?: string;
  bestFor?: string;
  traits?: string[];
  angle?: string;
  legacy?: boolean;
};
export const styleCategories = [
  {
    id: "delivery",
    name: "Delivery & Takeout",
    description:
      "Clear, appetizing item photos that make the dish easy to recognize at a glance.",
    use: "Delivery listings, takeout menus and ordering pages",
    tip: "Show the complete serving. Keep the background simple and avoid added text or props.",
    color: "#d9edbd",
  },
  {
    id: "fine",
    name: "Fine Dining",
    description:
      "Quiet luxury, considered light and an elegant setting for your signature dishes.",
    use: "Tasting menus, reservations and restaurant editorials",
    tip: "Elevate the surroundings while keeping your real plating, ingredients and portion intact.",
    color: "#d9c5b1",
  },
  {
    id: "menu",
    name: "Menu",
    description:
      "Versatile restaurant photography with balanced colors and easy-to-read detail.",
    use: "Digital menus, printed menus and restaurant websites",
    tip: "Use one preset across a menu for a consistent visual treatment.",
    color: "#e6dfbd",
  },
  {
    id: "bar",
    name: "Bar & Lounge",
    description:
      "After-dark atmosphere, rich shadows and precise highlights that make glassware glow.",
    use: "Cocktail lists, lounge promotions and evening specials",
    tip: "Moody lighting should still leave the drink, garnish and serving clearly visible.",
    color: "#cdc0dc",
  },
  {
    id: "beverage",
    name: "Beverage",
    description:
      "Fresh, luminous drinks with beautiful color, texture and clarity.",
    use: "Coffee menus, juice bars and seasonal drink launches",
    tip: "Keep the original glass, liquid level, ice and garnish true to what you serve.",
    color: "#cddfaa",
  },
  {
    id: "studio",
    name: "Studio",
    description:
      "Controlled light and striking backgrounds for a polished commercial photograph.",
    use: "Campaigns, websites and brand-led product stories",
    tip: "Choose a backdrop that complements the food. Color and light do the work.",
    color: "#b8d5ec",
  },
  {
    id: "bakery",
    name: "Bakery",
    description:
      "Golden crusts, delicate layers and handcrafted details, beautifully lit.",
    use: "Bakery counters, café menus and patisserie collections",
    tip: "Let real crumb, frosting and pastry texture stay visible, with no invented decoration.",
    color: "#edcdb7",
  },
] as const;
export const photoStyles: PhotoStyle[] = [
  {
    id: "delivery-white",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Clean & craveable",
    cue: "White backdrop · true-to-life color",
    description:
      "A bright, distraction-free product shot that keeps every ingredient readable.",
    bestFor: "Burgers, sandwiches and individual entrées",
    traits: ["Even softbox light", "White seamless", "Full serving"],
    prompt:
      "Clean white seamless tabletop. Bright even neutral softbox light, soft natural contact shadow, accurate appetizing color. Center the complete original serving with generous margins. No extra food, props, text or packaging.",
    image: "/studio/styles/delivery-white.webp",
    angle: "keep",
  },
  {
    id: "delivery-takeout",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Takeout, elevated",
    cue: "Neat packaging · fresh detail",
    description:
      "A tidy, polished view of your food in the packaging customers actually receive.",
    bestFor: "Poke, grain bowls and boxed meals",
    traits: ["Soft neutral light", "Pale grey surface", "Keep real packaging"],
    prompt:
      "Pale grey clean tabletop, balanced soft daylight, crisp food texture. Retain the original plate or takeout container and exact contents. Show the full serving. No added packaging, sides, logos or text.",
    image: "/studio/styles/delivery-takeout.webp",
    angle: "keep",
  },
  {
    id: "delivery-daylight",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Natural daylight",
    cue: "Light oak · honest & appetizing",
    description:
      "Warm natural light makes everyday favorites inviting without a busy scene.",
    bestFor: "Tacos, wraps and comfort food",
    traits: ["Diffused daylight", "Light oak", "Natural color"],
    prompt:
      "Light neutral oak tabletop, diffused window daylight and gentle short shadows. Simple delivery catalog composition with complete original serving visible. Keep accurate colors and portions. No extra dishes or props.",
    image: "/studio/styles/delivery-daylight.webp",
    angle: "keep",
  },
  {
    id: "delivery-overhead",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Top-down clarity",
    cue: "Overhead · clean catalog",
    description:
      "An organized overhead view for food whose shape and toppings deserve to be seen.",
    bestFor: "Pizza, flatbreads and shallow bowls",
    traits: ["Overhead angle", "Plain white surface", "Complete edges"],
    prompt:
      "Straight overhead catalog composition on a plain white tabletop. Even neutral light, complete serving and container edges visible with breathing room. Preserve toppings and portion exactly. No props, text or added food.",
    image: "/studio/styles/delivery-overhead.webp",
    angle: "overhead",
  },
  {
    id: "fine-linen",
    category: "fine",
    group: "Fine Dining",
    name: "White-linen service",
    cue: "Soft daylight · understated luxury",
    description:
      "Airy, refined light with the quiet elegance of a beautiful dining room.",
    bestFor: "Seafood, delicate starters and tasting plates",
    traits: ["Refined window light", "White linen", "Soft dining-room blur"],
    prompt:
      "Refined white-linen dining table, restrained soft window light, understated upscale restaurant background blur. Preserve original plate and exact food arrangement. No added garnish, cutlery or other servings.",
    image: "/studio/styles/fine-linen.webp",
    angle: "keep",
  },
  {
    id: "fine-slate",
    category: "fine",
    group: "Fine Dining",
    name: "Dark degustation",
    cue: "Charcoal · sculpted contrast",
    description:
      "A dramatic, focused setting for rich textures and careful plating.",
    bestFor: "Steak, duck and rich signature dishes",
    traits: ["Directional sidelight", "Dark slate", "Restrained contrast"],
    prompt:
      "Dark slate table with charcoal surroundings. Precise directional side light, gentle food highlights, deep clean shadows with visible detail. Fine-dining editorial mood. Preserve original plating, ingredients and portions.",
    image: "/studio/styles/fine-slate.webp",
    angle: "keep",
  },
  {
    id: "fine-counter",
    category: "fine",
    group: "Fine Dining",
    name: "Chef’s counter",
    cue: "Travertine · precise & modern",
    description:
      "Minimal stone and controlled light give a signature dish room to stand on its own.",
    bestFor: "Crudo, tartare and sculptural plating",
    traits: ["Clean sidelight", "Pale travertine", "Quiet negative space"],
    prompt:
      "Minimal pale travertine chef counter, clean precise soft sidelight, subtle warm-grey background, luxurious quiet negative space. Keep original dish and plate untouched in arrangement. No new garnish or serving ware.",
    image: "/studio/styles/fine-counter.webp",
    angle: "keep",
  },
  {
    id: "fine-candle",
    category: "fine",
    group: "Fine Dining",
    name: "Evening reservation",
    cue: "Warm glow · intimate dining",
    description:
      "An inviting evening mood, with warm highlights and a softly fading dining room.",
    bestFor: "Dinner specials and reservation campaigns",
    traits: ["Warm low light", "Deep burgundy tones", "Distant candle bokeh"],
    prompt:
      "Elegant evening restaurant in deep burgundy tones, warm low directional light with distant candle bokeh. Keep food well exposed and colors believable. Preserve original plate, ingredients and portion. No foreground props.",
    image: "/studio/styles/fine-candle.webp",
    angle: "keep",
  },
  {
    id: "menu-stone",
    category: "menu",
    group: "Menu",
    name: "Fresh on stone",
    cue: "Pale limestone · bright & balanced",
    description:
      "A clean, flexible menu look with soft light and crisp, natural ingredients.",
    bestFor: "Salads, seasonal plates and lighter dishes",
    traits: [
      "Bright diffused light",
      "Pale limestone",
      "Balanced natural color",
    ],
    prompt:
      "Pale limestone tabletop with bright diffused daylight. Soft clean shadows and balanced natural color. Uncluttered restaurant menu photography, full original plate and serving visible. No added food, garnish or text.",
    image: "/studio/styles/menu-stone.webp",
    angle: "keep",
  },
  {
    id: "menu-wood",
    category: "menu",
    group: "Menu",
    name: "Neighborhood table",
    cue: "Warm oak · familiar & welcoming",
    description:
      "A comfortable restaurant setting that gives hearty dishes a warm, inviting feel.",
    bestFor: "Roasts, breakfast plates and comfort food",
    traits: ["Warm window light", "Natural oak", "Gentle background blur"],
    prompt:
      "Warm natural oak restaurant tabletop with soft window light and gentle background blur. Inviting neighborhood dining mood, realistic food detail and full serving visible. Preserve food and plate exactly; no added sides.",
    image: "/studio/styles/menu-wood.webp",
    angle: "keep",
  },
  {
    id: "menu-overhead",
    category: "menu",
    group: "Menu",
    name: "Menu flat lay",
    cue: "Graphic overhead · clear detail",
    description:
      "A tidy overhead composition makes toppings, color and arrangement easy to scan.",
    bestFor: "Skillets, bowls and dishes with layered toppings",
    traits: ["Overhead angle", "Warm grey surface", "Even soft light"],
    prompt:
      "Straight overhead restaurant menu photograph on matte warm grey. Even soft light, clear food detail, complete dish and vessel centered with room around the edges. Preserve original ingredients and arrangement; no props.",
    image: "/studio/styles/menu-overhead.webp",
    angle: "overhead",
  },
  {
    id: "menu-neutral",
    category: "menu",
    group: "Menu",
    name: "Modern bistro",
    cue: "Soft grey · quietly polished",
    description:
      "A contemporary, restrained look that works across a wide range of menu items.",
    bestFor: "Risotto, pasta and everyday entrées",
    traits: ["Balanced daylight", "Matte light grey", "Soft contact shadows"],
    prompt:
      "Matte light-grey bistro tabletop, balanced neutral studio daylight, soft contact shadows and calm background. Modern uncluttered menu editorial. Preserve exact food and serving ware. No added ingredients, text or decoration.",
    image: "/studio/styles/menu-neutral.webp",
    angle: "keep",
  },
  {
    id: "bar-speakeasy",
    category: "bar",
    group: "Bar & Lounge",
    name: "Amber hour",
    cue: "Walnut · a golden glow",
    description:
      "Rich amber highlights and deep shadows for a classic, intimate bar photograph.",
    bestFor: "Whiskey cocktails and dark spirits",
    traits: ["Amber rim light", "Polished walnut", "Charcoal shadows"],
    prompt:
      "Polished dark walnut bar, amber side and rim light, smoky charcoal background. Luxurious intimate speakeasy mood. Keep original vessel, liquid level, ice, garnish or food exactly unchanged. No added drink or smoke.",
    image: "/studio/styles/bar-speakeasy.webp",
    angle: "keep",
  },
  {
    id: "bar-velvet",
    category: "bar",
    group: "Bar & Lounge",
    name: "Velvet lounge",
    cue: "Emerald · cool crystal highlights",
    description:
      "A lush, polished setting gives elegant glassware a striking silhouette.",
    bestFor: "Martinis, coupes and signature cocktails",
    traits: ["Cool rim light", "Dark stone", "Emerald velvet blur"],
    prompt:
      "Dark stone bar with softly blurred deep emerald velvet lounge. Cool precise rim light on glassware and restrained warm ambient glow. Preserve original contents, vessel, garnish and proportions. No extra glasses or props.",
    image: "/studio/styles/bar-velvet.webp",
    angle: "keep",
  },
  {
    id: "bar-bluehour",
    category: "bar",
    group: "Bar & Lounge",
    name: "Blue-hour bar",
    cue: "Midnight blue · vivid contrast",
    description:
      "Cool surroundings and warm highlights bring a contemporary nightlife feel.",
    bestFor: "Colorful cocktails and evening announcements",
    traits: ["Cool ambient light", "Cobalt bar", "Warm highlights"],
    prompt:
      "Midnight cobalt-blue bar setting, sophisticated cool ambient light and precise warm highlights, distant soft bokeh. Vivid realistic colors with visible drink detail. Keep original glass, contents and garnish. No neon text.",
    image: "/studio/styles/bar-bluehour.webp",
    angle: "keep",
  },
  {
    id: "bar-candle",
    category: "bar",
    group: "Bar & Lounge",
    name: "Wine-bar warmth",
    cue: "Burgundy · candlelit texture",
    description:
      "An intimate, textured setting for the small plates that go with a great night out.",
    bestFor: "Bar snacks, sharing plates and wine pairings",
    traits: [
      "Warm candlelike light",
      "Rich earthy tones",
      "Shallow background depth",
    ],
    prompt:
      "Intimate wine-bar setting in burgundy and chocolate tones, warm candlelike sidelight and shallow background depth. Preserve original serving, food arrangement and vessel. Keep textures visible. No added pairings or props.",
    image: "/studio/styles/bar-candle.webp",
    angle: "keep",
  },
  {
    id: "beverage-cafe",
    category: "beverage",
    group: "Beverage",
    name: "Morning café",
    cue: "Window light · beautiful layers",
    description:
      "Soft café light makes espresso, milk and ice feel fresh and inviting.",
    bestFor: "Iced coffee, lattes and café drinks",
    traits: ["Morning window light", "Warm café table", "Clear glass detail"],
    prompt:
      "Warm café tabletop, soft morning window light, restrained background blur. Show authentic liquid and glass texture, clear highlights without glare. Keep original drink, cup, layers, ice and garnish exactly unchanged.",
    image: "/studio/styles/beverage-cafe.webp",
    angle: "keep",
  },
  {
    id: "beverage-citrus",
    category: "beverage",
    group: "Beverage",
    name: "Sunshine sip",
    cue: "Terracotta · sunny & fresh",
    description:
      "Lively sunlight and a warm surface give colorful drinks a bright seasonal mood.",
    bestFor: "Fresh juice, smoothies and summer drinks",
    traits: ["Clean sunshine", "Pale terracotta", "Fresh natural color"],
    prompt:
      "Sunny pale terracotta tabletop, clean directional daylight and fresh natural color. Luminous beverage photography without artificial saturation. Preserve original glass, drink amount and garnish. Do not add fruit or ingredients.",
    image: "/studio/styles/beverage-citrus.webp",
    angle: "keep",
  },
  {
    id: "beverage-matcha",
    category: "beverage",
    group: "Beverage",
    name: "Modern matcha bar",
    cue: "Pale green · soft & contemporary",
    description:
      "A gentle green studio setting for drinks with beautiful color and texture.",
    bestFor: "Matcha, milk teas and specialty drinks",
    traits: ["Soft studio sidelight", "Pale green matte", "Delicate shadows"],
    prompt:
      "Contemporary pale-green matte studio backdrop, soft clean sidelight, delicate grounded shadow and rich true drink color. Preserve original vessel, liquid layers, ice and garnish. No additional ingredients or lettering.",
    image: "/studio/styles/beverage-matcha.webp",
    angle: "keep",
  },
  {
    id: "beverage-backlit",
    category: "beverage",
    group: "Beverage",
    name: "Light through glass",
    cue: "Luminous · crisp & refreshing",
    description:
      "Subtle backlighting brings out translucent color, ice and glass texture.",
    bestFor: "Iced teas, spritzes and clear cold drinks",
    traits: ["Luminous backlight", "Cool pale stone", "Controlled highlights"],
    prompt:
      "Cool pale stone with luminous controlled backlighting through the drink. Show authentic translucency and ice with crisp glass edges, avoiding blown highlights. Preserve original liquid, vessel, ice and garnish. No new ingredients.",
    image: "/studio/styles/beverage-backlit.webp",
    angle: "keep",
  },
  {
    id: "studio-ivory",
    category: "studio",
    group: "Studio",
    name: "Sculpted ivory",
    cue: "Warm white · quiet dimension",
    description:
      "A refined commercial look with gentle shape and a clean, seamless setting.",
    bestFor: "Desserts, delicate plates and premium products",
    traits: ["Large softbox", "Ivory seamless", "Sculptural soft shadow"],
    prompt:
      "Warm ivory seamless studio sweep, large diffused softbox, sculptural soft grounded shadows. Luxurious minimal commercial food photograph. Preserve original plate, food texture and arrangement. No new serving ware or garnish.",
    image: "/studio/styles/studio-ivory.webp",
    angle: "keep",
  },
  {
    id: "studio-color",
    category: "studio",
    group: "Studio",
    name: "Color-pop campaign",
    cue: "Cobalt · bold & graphic",
    description:
      "A saturated, clean backdrop makes the dish the focal point of a confident campaign.",
    bestFor: "Bao, sandwiches and colorful hero dishes",
    traits: [
      "Controlled softbox",
      "Cobalt seamless",
      "Crisp commercial finish",
    ],
    prompt:
      "Vibrant saturated cobalt-blue seamless studio backdrop, controlled commercial softbox lighting, crisp soft shadow. Bold graphic background with accurate natural food color. Keep original serving and plate unchanged.",
    image: "/studio/styles/studio-color.webp",
    angle: "keep",
  },
  {
    id: "studio-dark",
    category: "studio",
    group: "Studio",
    name: "Spotlight studio",
    cue: "Deep charcoal · focused drama",
    description:
      "A dark, controlled setting with precise highlights that reveal rich texture.",
    bestFor: "Noodles, grilled dishes and glossy sauces",
    traits: [
      "Directional studio light",
      "Charcoal seamless",
      "Detailed highlights",
    ],
    prompt:
      "Deep charcoal-black studio sweep, precise directional side light, rich contrast and controlled highlights on actual food texture. Full original serving visible. No invented steam, ingredients, extra bowls or decoration.",
    image: "/studio/styles/studio-dark.webp",
    angle: "keep",
  },
  {
    id: "studio-pastel",
    category: "studio",
    group: "Studio",
    name: "Soft-color studio",
    cue: "Blush · light & playful",
    description:
      "A soft pastel setting for sweet treats and gently colored food campaigns.",
    bestFor: "Gelato, sweets and playful seasonal items",
    traits: ["Gentle diffused light", "Blush seamless", "Soft short shadows"],
    prompt:
      "Soft blush-pink seamless studio background with gentle diffused light and delicate short shadows. Playful refined commercial photograph, accurate food color. Keep original food, container, portion and garnish unchanged.",
    image: "/studio/styles/studio-pastel.webp",
    angle: "keep",
  },
  {
    id: "bakery-morning",
    category: "bakery",
    group: "Bakery",
    name: "Fresh from the oven",
    cue: "Morning light · golden layers",
    description:
      "Warm, soft light brings out flaky pastry and the comfort of a neighborhood bakery.",
    bestFor: "Croissants, viennoiserie and breakfast pastries",
    traits: ["Warm morning light", "Pale oak", "Crisp pastry texture"],
    prompt:
      "Pale oak bakery table in soft warm early-morning window light, inviting artisanal editorial. Reveal actual golden crust and flaky layers without adding shine. Preserve pastry shape, serving and toppings. No invented crumbs.",
    image: "/studio/styles/bakery-morning.webp",
    angle: "keep",
  },
  {
    id: "bakery-patisserie",
    category: "bakery",
    group: "Bakery",
    name: "Patisserie counter",
    cue: "Pale marble · delicate detail",
    description:
      "Bright, refined light gives glossy fruit, cream and delicate pastry a clean finish.",
    bestFor: "Fruit tarts, entremets and refined cakes",
    traits: ["Bright diffuse light", "Pale marble", "Natural highlights"],
    prompt:
      "Elegant pale marble patisserie setting with cool bright diffused light and delicate natural highlights. Preserve exact fruit, cream, icing and pastry arrangement, original plate and portion. No additional decoration or toppings.",
    image: "/studio/styles/bakery-patisserie.webp",
    angle: "keep",
  },
  {
    id: "bakery-rustic",
    category: "bakery",
    group: "Bakery",
    name: "Artisan bread",
    cue: "Warm wood · honest texture",
    description:
      "Earthy tones and directional light celebrate crust, crumb and handcrafted detail.",
    bestFor: "Sourdough, rolls and rustic baking",
    traits: [
      "Warm directional daylight",
      "Rustic wood",
      "Oatmeal linen backdrop",
    ],
    prompt:
      "Rustic warm wood with restrained oatmeal linen in distant background. Directional window light reveals authentic bread crust and crumb. Keep original shape, slices, quantity and serving ware. No invented flour or crumbs.",
    image: "/studio/styles/bakery-rustic.webp",
    angle: "keep",
  },
  {
    id: "bakery-jewel",
    category: "bakery",
    group: "Bakery",
    name: "Confectionery color",
    cue: "Lilac · delicate & luminous",
    description:
      "A softly colored patisserie look with clean highlights and a refined sense of play.",
    bestFor: "Macarons, petit fours and colorful confections",
    traits: ["Luminous softbox", "Lilac seamless", "Soft confectionery color"],
    prompt:
      "Soft lilac seamless patisserie studio, luminous diffused softbox light and delicate shadows. Preserve exact number, colors and arrangement of confections and original plate. No added sweets, toppings or text.",
    image: "/studio/styles/bakery-jewel.webp",
    angle: "keep",
  },
];

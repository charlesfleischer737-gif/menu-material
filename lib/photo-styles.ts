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
  // Optional subject families (see foodFamilies) this look is made for.
  // When omitted, relevance is inferred from bestFor, traits and category.
  subjects?: string[];
  angle?: string;
  // Only presets with explicit food serving ware opt into replacing it.
  plate?: "style";
  legacy?: boolean;
};
/** A small preview of a catalog example for tiles; other images pass through. */
export function styleThumbnail(image: string) {
  return /^\/studio\/styles\/[^/]+\.webp$/.test(image)
    ? image.replace("/studio/styles/", "/studio/styles/thumbs/")
    : image;
}
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
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Clean & craveable",
    cue: "White backdrop · true-to-life color",
    description:
      "A bright, distraction-free product shot that keeps every ingredient readable.",
    bestFor: "Burgers, sandwiches and individual entrées",
    traits: ["Even softbox light", "White seamless", "Full serving"],
    prompt:
      "Clean white seamless tabletop and simple white serving ware suited to the dish. Bright even neutral softbox light, soft contact shadow and accurate appetizing color. Center the complete serving with generous margins. No extra food, props, text or packaging.",
    image: "/studio/styles/delivery-white.webp",
    angle: "keep",
  },
  {
    id: "delivery-takeout",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Takeout, elevated",
    cue: "Neat packaging · fresh detail",
    description: "A tidy, polished view of your food in an open takeout box.",
    bestFor: "Poke, grain bowls and boxed meals",
    traits: ["Soft neutral light", "Pale grey surface", "Open takeout box"],
    prompt:
      "Pale grey tabletop, soft daylight, crisp food texture. Serve the unchanged food directly in an open unbranded kraft takeout box sized for the full portion. Retain suitable existing takeout packaging; otherwise replace the original plate. No plate inside or under the box, added sides, logos or text.",
    image: "/studio/styles/delivery-takeout.webp",
    angle: "keep",
  },
  {
    id: "delivery-daylight",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Natural daylight",
    cue: "Light oak · honest & appetizing",
    description:
      "Warm natural light makes everyday favorites inviting without a busy scene.",
    bestFor: "Tacos, wraps and comfort food",
    traits: ["Diffused daylight", "Light oak", "Natural color"],
    prompt:
      "Light neutral oak tabletop, simple neutral ceramic serving ware, diffused window daylight and gentle short shadows. Clear delivery catalog composition with the complete serving visible. Keep accurate colors and portions. No extra dishes or props.",
    image: "/studio/styles/delivery-daylight.webp",
    angle: "keep",
  },
  {
    id: "delivery-overhead",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Top-down clarity",
    cue: "Overhead · clean catalog",
    description:
      "An organized overhead view for food whose shape and toppings deserve to be seen.",
    bestFor: "Pizza, flatbreads and shallow bowls",
    traits: ["Overhead angle", "Plain white surface", "Complete edges"],
    prompt:
      "Straight overhead catalog composition on a plain white tabletop with clean white serving ware. Even neutral light, complete serving and vessel edges visible with breathing room. Preserve toppings and portion exactly. No props, text or added food.",
    image: "/studio/styles/delivery-overhead.webp",
    angle: "overhead",
  },
  {
    id: "delivery-paper",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Paper & crunch",
    cue: "Warm sand · crisp texture",
    description:
      "A clean, softly lit setting that makes golden, crispy food look freshly prepared.",
    bestFor: "Fried chicken, tenders and takeaway snacks",
    traits: [
      "Bright diffuse light",
      "Sand seamless",
      "Paper-lined takeaway tray",
    ],
    prompt:
      "Warm sand tabletop, bright diffuse light, soft shadows and crisp food texture. Serve unchanged food directly in an unbranded paper-lined takeaway tray sized for the full portion. Retain suitable existing packaging; otherwise replace the plate. No plate under the tray, added sides, props or text.",
    image: "/studio/styles/delivery-paper.webp",
    angle: "keep",
  },
  {
    id: "delivery-sage",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Fresh on sage",
    cue: "Sage green · an overhead view",
    description:
      "A calm green backdrop gives fresh bowls and colorful ingredients clear definition.",
    bestFor: "Falafel bowls, salads and plant-based meals",
    traits: ["Overhead angle", "Muted sage surface", "Even softbox light"],
    prompt:
      "Straight overhead on a matte muted sage-green seamless tabletop with an off-white bowl or plate suited to the dish. Broad diffused softbox, clear true food color and soft shadow. Full serving and vessel edges visible. No extra food, props or text.",
    image: "/studio/styles/delivery-sage.webp",
    angle: "overhead",
  },
  {
    id: "delivery-graphite",
    plate: "style",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Crisp on charcoal",
    cue: "Graphite · bright food detail",
    description:
      "A dark, uncluttered background makes golden food stand out at thumbnail size.",
    bestFor: "Fish and chips, golden entrées and hearty meals",
    traits: ["Graphite backdrop", "Bright even light", "Simple white tray"],
    prompt:
      "Clean graphite seamless background, simple shallow white serving tray appropriate to the dish, bright even light on food and a subtle grounded shadow. Clear complete serving with generous margins and true colors. No added food, props or text.",
    image: "/studio/styles/delivery-graphite.webp",
    angle: "keep",
  },
  {
    id: "delivery-peach",
    category: "delivery",
    group: "Delivery & Takeout",
    name: "Peach-perfect",
    cue: "Soft peach · fresh contrast",
    description:
      "Soft warmth and a diagonal composition give handheld favorites an inviting finish.",
    bestFor: "Wraps, subs and colorful sandwiches",
    traits: ["Pale peach surface", "Soft daylight", "Diagonal composition"],
    prompt:
      "Pale peach seamless tabletop, soft daylight and a tidy diagonal composition. Keep the original serving vessel or paper sleeve and all food intact. Reveal actual cut filling without cutting or changing the serving. No extra food, props or text.",
    image: "/studio/styles/delivery-peach.webp",
    angle: "keep",
  },
  {
    id: "fine-linen",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "White-linen service",
    cue: "Soft daylight · understated luxury",
    description:
      "Airy, refined light with the quiet elegance of a beautiful dining room.",
    bestFor: "Seafood, delicate starters and tasting plates",
    traits: ["Refined window light", "White linen", "Soft dining-room blur"],
    prompt:
      "Refined white-linen dining table, elegant white porcelain serving ware, soft window light and understated upscale dining-room blur. Preserve the exact food arrangement and portion. No added garnish, cutlery or other servings.",
    image: "/studio/styles/fine-linen.webp",
    angle: "keep",
  },
  {
    id: "fine-slate",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Dark degustation",
    cue: "Charcoal · sculpted contrast",
    description:
      "A dramatic, focused setting for rich textures and careful plating.",
    bestFor: "Steak, duck and rich signature dishes",
    traits: ["Directional sidelight", "Dark slate", "Restrained contrast"],
    prompt:
      "Dark slate table, matte charcoal ceramic serving ware and charcoal surroundings. Precise directional sidelight, gentle food highlights and deep shadows with visible detail. Fine-dining editorial mood. Preserve the food arrangement, ingredients and portion.",
    image: "/studio/styles/fine-slate.webp",
    angle: "keep",
  },
  {
    id: "fine-counter",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Chef’s counter",
    cue: "Travertine · precise & modern",
    description:
      "Minimal stone and controlled light give a signature dish room to stand on its own.",
    bestFor: "Crudo, tartare and sculptural plating",
    traits: ["Clean sidelight", "Pale travertine", "Quiet negative space"],
    prompt:
      "Minimal pale travertine chef counter, refined ivory ceramic serving ware, precise soft sidelight and subtle warm-grey background with luxurious quiet negative space. Preserve the food arrangement and portion. No new garnish or extra dishes.",
    image: "/studio/styles/fine-counter.webp",
    angle: "keep",
  },
  {
    id: "fine-candle",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Evening reservation",
    cue: "Warm glow · intimate dining",
    description:
      "An inviting evening mood, with warm highlights and a softly fading dining room.",
    bestFor: "Dinner specials and reservation campaigns",
    traits: ["Warm low light", "Deep burgundy tones", "Distant candle bokeh"],
    prompt:
      "Elegant evening restaurant in deep burgundy tones, fine ivory porcelain serving ware, warm directional light and distant candle bokeh. Keep food well exposed and colors believable. Preserve ingredients, arrangement and portion. No foreground props.",
    image: "/studio/styles/fine-candle.webp",
    angle: "keep",
  },
  {
    id: "fine-presented",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Presented by the chef",
    cue: "A graceful hand · dining-room glow",
    description:
      "An intimate moment of service, with your dish presented against a softly glowing room.",
    bestFor: "Signature pasta, tasting plates and chef specials",
    traits: [
      "Hand-presented plate",
      "Luminous sidelight",
      "Warm dining-room blur",
    ],
    prompt:
      "Broad ivory porcelain plate supported underneath by one anatomically natural hand, cropped charcoal sleeve and blurred warm fine-dining room. Luminous soft sidelight. Keep the complete food arrangement visible, untouched and unchanged; no face or added food.",
    image: "/studio/styles/fine-presented.webp",
    angle: "three-quarter",
  },
  {
    id: "fine-terrace",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Riviera terrace",
    cue: "Pale stone · garden light",
    description:
      "A sunlit terrace and soft olive-green background bring fresh, relaxed luxury.",
    bestFor: "Seafood, vegetable mains and seasonal plates",
    traits: ["Pale stone terrace", "Olive garden blur", "Late-afternoon light"],
    prompt:
      "Cream porcelain on a pale stone terrace, softly blurred olive-green garden and late-afternoon daylight. Restrained dappled shadows only in the background; food remains evenly lit and fully visible. Preserve exact food and arrangement. No added ingredients or props.",
    image: "/studio/styles/fine-terrace.webp",
    angle: "keep",
  },
  {
    id: "fine-obsidian",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "Obsidian tasting",
    cue: "Glossy black · precise spotlight",
    description:
      "A dramatic pool of light draws attention to the color and detail of your plating.",
    bestFor: "Carpaccio, colorful starters and tasting courses",
    traits: ["Overhead spotlight", "Glossy obsidian", "Black porcelain"],
    prompt:
      "Straight overhead photograph, black porcelain on subtly reflective glossy obsidian, precise spotlight and deep black backdrop. Retain realistic soft reflections and readable food color. Complete plate visible; preserve food arrangement and portion. No additions.",
    image: "/studio/styles/fine-obsidian.webp",
    angle: "overhead",
  },
  {
    id: "fine-gallery",
    plate: "style",
    category: "fine",
    group: "Fine Dining",
    name: "The gallery plate",
    cue: "Sculptural porcelain · arch shadows",
    description:
      "A quiet, architectural setting gives a beautifully plated dish room to shine.",
    bestFor: "Delicate starters, seafood and sculptural plating",
    traits: [
      "Warm plaster wall",
      "Porcelain on a plinth",
      "Architectural shadow",
    ],
    prompt:
      "Sculptural white plate on a low off-white plinth against warm plaster with a soft architectural arch shadow. Gallery-like fine dining, diffused front light and quiet negative space. Preserve food arrangement, ingredients and portion. Entire serving visible; no added food.",
    image: "/studio/styles/fine-gallery.webp",
    angle: "keep",
  },
  {
    id: "menu-stone",
    plate: "style",
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
      "Pale limestone tabletop, simple off-white ceramic serving ware and bright diffused daylight. Soft clean shadows and balanced natural color. Uncluttered restaurant menu photography, full plate and serving visible. No added food, garnish or text.",
    image: "/studio/styles/menu-stone.webp",
    angle: "keep",
  },
  {
    id: "menu-wood",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Neighborhood table",
    cue: "Warm oak · familiar & welcoming",
    description:
      "A comfortable restaurant setting that gives hearty dishes a warm, inviting feel.",
    bestFor: "Roasts, breakfast plates and comfort food",
    traits: ["Warm window light", "Natural oak", "Gentle background blur"],
    prompt:
      "Warm natural oak restaurant tabletop, warm cream stoneware, soft window light and gentle dining-room blur. Inviting neighborhood mood, realistic food detail and full serving visible. Preserve the food arrangement and portion; no added sides.",
    image: "/studio/styles/menu-wood.webp",
    angle: "keep",
  },
  {
    id: "menu-overhead",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Menu flat lay",
    cue: "Graphic overhead · clear detail",
    description:
      "A tidy overhead composition makes toppings, color and arrangement easy to scan.",
    bestFor: "Skillets, bowls and dishes with layered toppings",
    traits: ["Overhead angle", "Warm grey surface", "Even soft light"],
    prompt:
      "Straight overhead restaurant menu photograph on matte warm grey with simple ivory serving ware. Even soft light, clear food detail, complete dish and vessel centered with room around the edges. Preserve ingredients and arrangement; no props.",
    image: "/studio/styles/menu-overhead.webp",
    angle: "overhead",
  },
  {
    id: "menu-neutral",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Modern bistro",
    cue: "Soft grey · quietly polished",
    description:
      "A contemporary, restrained look that works across a wide range of menu items.",
    bestFor: "Risotto, pasta and everyday entrées",
    traits: ["Balanced daylight", "Matte light grey", "Soft contact shadows"],
    prompt:
      "Matte light-grey bistro tabletop, modern white ceramic serving ware, balanced neutral studio daylight, soft contact shadows and calm background. Uncluttered menu editorial. Preserve exact food and portion. No added ingredients, text or decoration.",
    image: "/studio/styles/menu-neutral.webp",
    angle: "keep",
  },
  {
    id: "menu-terrazzo",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Terrazzo brunch",
    cue: "Peach stone · an airy flat lay",
    description:
      "Subtle stone flecks and soft light create a bright, welcoming menu photograph.",
    bestFor: "Brunch plates, pancakes and breakfast specials",
    traits: ["Overhead daylight", "Peach terrazzo", "Cream ceramic"],
    prompt:
      "Straight overhead menu photograph, simple cream plate on warm peach terrazzo. Soft even daylight, restrained stone pattern and natural appetizing colors. Keep all food and vessel edges visible with generous margins. Preserve the original serving; no extra props or food.",
    image: "/studio/styles/menu-terrazzo.webp",
    angle: "overhead",
  },
  {
    id: "menu-courtyard",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Courtyard table",
    cue: "Jade tile · sunlit greenery",
    description:
      "Glazed green tile and gentle garden light add character without distracting from the dish.",
    bestFor: "Grilled seafood, summer plates and vegetables",
    traits: ["Jade glazed tile", "Courtyard blur", "Soft front light"],
    prompt:
      "White ceramic on jade-green glazed tile, softly blurred sunlit courtyard. Gentle leaf shadows on the background only, soft front light keeps food clear. Refined restaurant-menu composition, complete serving visible. No added ingredients, cutlery or other dishes.",
    image: "/studio/styles/menu-courtyard.webp",
    angle: "keep",
  },
  {
    id: "menu-handheld",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "From our kitchen",
    cue: "Two hands · warm linen",
    description:
      "A personal, welcoming presentation that puts the people behind the food in the picture.",
    bestFor: "Pasta bowls, signature dishes and daily specials",
    traits: ["Two supporting hands", "Taupe linen apron", "Airy window light"],
    prompt:
      "Cream serving bowl or plate held at waist height by two anatomically natural hands at its outer rim, cropped taupe linen apron behind. Airy window light. Hands must not cover or touch food. Entire vessel and unchanged serving visible. No face or extra food.",
    image: "/studio/styles/menu-handheld.webp",
    angle: "three-quarter",
  },
  {
    id: "menu-diner",
    plate: "style",
    category: "menu",
    group: "Menu",
    name: "Modern diner",
    cue: "Burgundy checks · soft window light",
    description:
      "A familiar checkered table, photographed with a clean contemporary touch.",
    bestFor: "Sandwiches, lunch favorites and comfort food",
    traits: ["Burgundy checks", "White ceramic", "Lateral daylight"],
    prompt:
      "Simple white plate on a restrained burgundy-and-cream checkered tabletop. Soft lateral window light, modern diner editorial with balanced color and crisp food detail. Keep the whole serving visible and original arrangement intact. No added sides, props or food.",
    image: "/studio/styles/menu-diner.webp",
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
      "Polished dark walnut bar, amber side and rim light, charcoal background. Luxurious intimate speakeasy mood. Keep the original glass and visible branding, drink volume, foam, ice and garnish. Relight the same drink in this new setting. No added drink or smoke.",
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
      "Dark stone bar with softly blurred deep emerald velvet lounge, cool precise rim light and restrained warm ambient glow. Keep the original glass and visible branding, contents, drink volume, foam, ice and garnish. No extra glasses or props.",
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
      "Midnight cobalt-blue bar, cool ambient light, precise warm highlights and distant soft bokeh. Vivid realistic color and visible drink detail. Keep the original glass and visible branding, contents, drink volume, foam, ice and garnish. No added neon text.",
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
      "Intimate wine bar in burgundy and chocolate tones, candlelike sidelight and shallow background depth. Warm neutral stoneware for food; keep the original glass and visible branding for drinks. Preserve the serving, foam, garnish and food arrangement. No added pairings or props.",
    image: "/studio/styles/bar-candle.webp",
    angle: "keep",
  },
  {
    id: "bar-brass",
    category: "bar",
    group: "Bar & Lounge",
    name: "The perfect pint",
    cue: "Antique brass · oxblood leather",
    description:
      "Warm light and rich materials give beer the same attention as a signature cocktail.",
    bestFor: "Stouts, ales and draft-beer features",
    traits: ["Brushed brass", "Oxblood leather blur", "Warm narrow sidelight"],
    prompt:
      "Brushed antique brass tabletop, dark oxblood leather banquette blur, warm narrow sidelight and amber reflections. Keep the original glass and visible branding, liquid level, color, foam, ice and garnish. Relight without obscuring the logo. No added drinks or props.",
    image: "/studio/styles/bar-brass.webp",
    angle: "keep",
  },
  {
    id: "bar-rooftop",
    category: "bar",
    group: "Bar & Lounge",
    name: "Rooftop at dusk",
    cue: "Rose stone · sunset skyline",
    description:
      "A glowing horizon and soft city lights set the scene for an evening drink.",
    bestFor: "Palomas, spritzes and aperitif specials",
    traits: ["Dusky rose stone", "Mauve skyline blur", "Sunset rim light"],
    prompt:
      "Dusky rose stone rooftop bar, mauve-blue skyline blur and glowing sunset rim light. Chic evening editorial with legible drink detail. Keep the original glass and visible branding, liquid, fill, foam, ice and garnish. No new ingredients, glasses or text.",
    image: "/studio/styles/bar-rooftop.webp",
    angle: "keep",
  },
  {
    id: "bar-mirror",
    category: "bar",
    group: "Bar & Lounge",
    name: "Midnight reflection",
    cue: "Polished mirror · copper highlights",
    description:
      "A crisp reflection and sculptural highlights create a striking cocktail portrait.",
    bestFor: "Espresso martinis, coupes and cocktail launches",
    traits: ["Mirror surface", "Copper glow", "Sculptural sidelight"],
    prompt:
      "Polished mirror tabletop, deep black background with a restrained copper gradient and crisp sculptural sidelight. Physically accurate vessel reflection. Keep the original glass and visible branding, liquid, fill, foam, ice and garnish. No extra drinks or decoration.",
    image: "/studio/styles/bar-mirror.webp",
    angle: "keep",
  },
  {
    id: "bar-cellar",
    category: "bar",
    group: "Bar & Lounge",
    name: "Cellar reserve",
    cue: "Burgundy plaster · light through wine",
    description:
      "A warm beam of light reveals rich color against the texture of an intimate wine cellar.",
    bestFor: "Red wine, wine flights and cellar selections",
    traits: ["Aged limestone", "Burgundy plaster", "Narrow warm light"],
    prompt:
      "Dark aged limestone ledge, textured burgundy plaster and a narrow warm beam through the drink. Quiet wine-cellar luxury, readable glass edges. Keep the original glass and visible branding, liquid color, fill level, foam, ice and garnish. No added bottle or props.",
    image: "/studio/styles/bar-cellar.webp",
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
      "Warm café tabletop, soft morning window light and restrained background blur. Authentic liquid texture and clear highlights without glare. Keep the original cup or glass and visible branding, drink volume, layers, foam, ice and garnish.",
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
      "Sunny pale terracotta tabletop, clean directional daylight and fresh natural color. Luminous beverage photography without artificial saturation. Keep the original glass and visible branding, drink amount, foam, ice and garnish. Do not add fruit or ingredients.",
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
      "Contemporary pale-green matte studio backdrop, soft clean sidelight, delicate grounded shadow and rich true drink color. Keep the original vessel and visible branding, drink volume, layers, foam, ice and garnish. No additional ingredients or lettering.",
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
      "Cool pale stone and luminous controlled backlighting. Authentic translucency and ice with crisp glass edges; avoid blown highlights over branding. Keep the original vessel and visible branding, liquid amount, layers, foam, ice and garnish. No new ingredients.",
    image: "/studio/styles/beverage-backlit.webp",
    angle: "keep",
  },
  {
    id: "beverage-poolside",
    category: "beverage",
    group: "Beverage",
    name: "Poolside refresh",
    cue: "Turquoise tile · dancing sunlight",
    description:
      "Ripples of reflected light give cold drinks an unmistakable summer feel.",
    bestFor: "Lemonades, sparkling drinks and seasonal refreshers",
    traits: ["Turquoise tile", "Water-light reflections", "Crisp summer sun"],
    prompt:
      "Turquoise glazed tile with subtle rippled water-light reflections across the background, crisp summer sunlight and clear drink detail. Keep the original glass and visible branding, liquid color, fill, foam, ice and garnish. No added fruit, water splashes or ingredients.",
    image: "/studio/styles/beverage-poolside.webp",
    angle: "keep",
  },
  {
    id: "beverage-ritual",
    category: "beverage",
    group: "Beverage",
    name: "The morning ritual",
    cue: "A gentle hand · oatmeal linen",
    description:
      "An inviting café moment with beautiful light and the personal touch of a hand in frame.",
    bestFor: "Flat whites, cappuccinos and warm café drinks",
    traits: [
      "One supporting hand",
      "Oatmeal linen",
      "Gentle morning backlight",
    ],
    prompt:
      "Oatmeal linen tabletop, gentle morning backlight, one natural hand holding the existing handle or supporting the base without hiding branding. Keep the original cup or glass and visible branding, contents, fill, foam art, ice and garnish. No invented handle or ingredients.",
    image: "/studio/styles/beverage-ritual.webp",
    angle: "keep",
  },
  {
    id: "beverage-orchid",
    category: "beverage",
    group: "Beverage",
    name: "Orchid pop",
    cue: "Tonal lilac · vivid drink color",
    description:
      "Soft purple shapes make naturally colorful drinks feel like a polished product campaign.",
    bestFor: "Smoothies, fruit drinks and colorful shakes",
    traits: ["Lilac seamless", "Curved tonal plinth", "Luminous softbox"],
    prompt:
      "Lilac seamless studio sweep and a soft curved lavender plinth, luminous softbox and delicate grounded shadows. Preserve natural beverage color. Keep the original vessel and visible branding, contents, fill, layers, foam, ice and garnish. No extra fruit or props.",
    image: "/studio/styles/beverage-orchid.webp",
    angle: "keep",
  },
  {
    id: "beverage-botanical",
    category: "beverage",
    group: "Beverage",
    name: "Botanical light",
    cue: "Travertine · a greenhouse glow",
    description:
      "Fresh green surroundings and delicate shadows frame a bright, refreshing drink.",
    bestFor: "Iced teas, herbal infusions and clear cold drinks",
    traits: ["Pale travertine", "Greenhouse blur", "Soft leaf shadows"],
    prompt:
      "Pale travertine, softly blurred greenhouse foliage and clean daylight; delicate leaf shadows only on the background. Keep the original glass and visible branding, liquid color, fill, layers, foam, ice and garnish. No added botanicals, ingredients or glasses.",
    image: "/studio/styles/beverage-botanical.webp",
    angle: "keep",
  },
  {
    id: "studio-ivory",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Sculpted ivory",
    cue: "Warm white · quiet dimension",
    description:
      "A refined commercial look with gentle shape and a clean, seamless setting.",
    bestFor: "Desserts, delicate plates and premium products",
    traits: ["Large softbox", "Ivory seamless", "Sculptural soft shadow"],
    prompt:
      "Warm ivory seamless studio sweep, refined ivory ceramic serving ware, large diffused softbox and sculptural grounded shadows. Luxurious minimal commercial food photograph. Preserve food texture, arrangement and portion. No extra serving ware or garnish.",
    image: "/studio/styles/studio-ivory.webp",
    angle: "keep",
  },
  {
    id: "studio-color",
    plate: "style",
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
      "Vibrant cobalt-blue seamless studio backdrop, clean white serving ware, controlled commercial softbox lighting and crisp soft shadow. Bold graphic background with accurate natural food color. Preserve the original food arrangement and serving size.",
    image: "/studio/styles/studio-color.webp",
    angle: "keep",
  },
  {
    id: "studio-dark",
    plate: "style",
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
      "Deep charcoal-black studio sweep, matte dark ceramic serving ware, precise directional sidelight, rich contrast and controlled highlights on actual food texture. Full original serving visible. No invented steam, ingredients, extra bowls or decoration.",
    image: "/studio/styles/studio-dark.webp",
    angle: "keep",
  },
  {
    id: "studio-pastel",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Soft-color studio",
    cue: "Blush · light & playful",
    description:
      "A soft pastel setting for sweet treats and gently colored food campaigns.",
    bestFor: "Gelato, sweets and playful seasonal items",
    traits: ["Gentle diffused light", "Blush seamless", "Soft short shadows"],
    prompt:
      "Soft blush-pink seamless studio background, simple pale ceramic serving ware, gentle diffused light and delicate short shadows. Playful refined commercial photograph with accurate food color. Preserve food, portion and garnish.",
    image: "/studio/styles/studio-pastel.webp",
    angle: "keep",
  },
  {
    id: "studio-levitate",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Lifted in coral",
    cue: "Hand-held · bold coral",
    description:
      "A sculptural hand-held composition gives your dish a confident campaign moment.",
    bestFor: "Small plates, snacks and colorful hero dishes",
    traits: [
      "One supporting hand",
      "Coral seamless",
      "Controlled studio shadow",
    ],
    prompt:
      "Sculptural ivory plate supported from below by one anatomically natural hand entering the lower frame, warm coral seamless backdrop and crisp soft-edged studio shadow. Show all original food unchanged with complete plate edges. No floating food, face or extra ingredients.",
    image: "/studio/styles/studio-levitate.webp",
    angle: "three-quarter",
  },
  {
    id: "studio-chrome",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Chrome editorial",
    cue: "Cool silver · liquid reflections",
    description:
      "Polished metal and clean highlights bring a sharp, contemporary edge to the food.",
    bestFor: "Sushi, refined small plates and modern campaigns",
    traits: [
      "Stainless steel tray",
      "Cool silver sweep",
      "Large softbox highlights",
    ],
    prompt:
      "Small polished stainless serving tray appropriate to the dish, cool silver seamless studio and restrained abstract chrome reflections. Crisp large-softbox highlights; food stays naturally colored. Keep original food, arrangement and portion. No extra objects or ingredients.",
    image: "/studio/styles/studio-chrome.webp",
    angle: "keep",
  },
  {
    id: "studio-sunbeam",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Butter-yellow sun",
    cue: "A bold sunbeam · graphic shadows",
    description:
      "Warm yellow and a diagonal beam of light turn simple food into a beautiful still life.",
    bestFor: "Cheesecake, desserts and golden baked treats",
    traits: [
      "Butter-yellow backdrop",
      "Architectural shadow",
      "Warm directional light",
    ],
    prompt:
      "Warm-white serving plate on a buttery yellow backdrop and low plinth. Bold diagonal sunbeam and architectural shadow across the background, food luminous with natural texture. Preserve original food, portion and arrangement; no invented glaze or additions.",
    image: "/studio/styles/studio-sunbeam.webp",
    angle: "keep",
  },
  {
    id: "studio-arch",
    plate: "style",
    category: "studio",
    group: "Studio",
    name: "Terracotta forms",
    cue: "Sculptural arch · earthy warmth",
    description:
      "A warm architectural backdrop adds depth and shape to a minimal studio photograph.",
    bestFor: "Pastries, snacks and earthy-colored dishes",
    traits: ["Terracotta surface", "Sculptural arch", "Warm diffused light"],
    prompt:
      "Soft white serving plate on earthy terracotta with one sculptural terracotta arch in the rear. Warm diffused studio light and gentle contact shadows, sophisticated minimal composition. Preserve food shape, amount and arrangement. No extra ingredients or props.",
    image: "/studio/styles/studio-arch.webp",
    angle: "keep",
  },
  {
    id: "bakery-morning",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Fresh from the oven",
    cue: "Morning light · golden layers",
    description:
      "Warm, soft light brings out flaky pastry and the comfort of a neighborhood bakery.",
    bestFor: "Croissants, viennoiserie and breakfast pastries",
    traits: ["Warm morning light", "Pale oak", "Crisp pastry texture"],
    prompt:
      "Pale oak bakery table, simple cream ceramic serving ware and soft warm early-morning window light. Inviting artisanal editorial. Reveal actual golden crust and flaky layers without adding shine. Preserve pastry shape, serving and toppings. No invented crumbs.",
    image: "/studio/styles/bakery-morning.webp",
    angle: "keep",
  },
  {
    id: "bakery-patisserie",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Patisserie counter",
    cue: "Pale marble · delicate detail",
    description:
      "Bright, refined light gives glossy fruit, cream and delicate pastry a clean finish.",
    bestFor: "Fruit tarts, entremets and refined cakes",
    traits: ["Bright diffuse light", "Pale marble", "Natural highlights"],
    prompt:
      "Elegant pale marble patisserie setting, delicate white porcelain serving ware, cool bright diffused light and natural highlights. Preserve exact fruit, cream, icing, pastry arrangement and portion. No additional decoration or toppings.",
    image: "/studio/styles/bakery-patisserie.webp",
    angle: "keep",
  },
  {
    id: "bakery-rustic",
    plate: "style",
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
      "Rustic warm wood, a simple natural wood bread board and restrained oatmeal linen in the distant background. Directional window light reveals authentic crust and crumb. Preserve bread shape, slices and quantity. No invented flour or crumbs.",
    image: "/studio/styles/bakery-rustic.webp",
    angle: "keep",
  },
  {
    id: "bakery-jewel",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Confectionery color",
    cue: "Lilac · delicate & luminous",
    description:
      "A softly colored patisserie look with clean highlights and a refined sense of play.",
    bestFor: "Macarons, petit fours and colorful confections",
    traits: ["Luminous softbox", "Lilac seamless", "Soft confectionery color"],
    prompt:
      "Soft lilac seamless patisserie studio, refined white porcelain serving ware, luminous diffused softbox light and delicate shadows. Preserve the exact number, colors and arrangement of confections. No added sweets, toppings or text.",
    image: "/studio/styles/bakery-jewel.webp",
    angle: "keep",
  },
  {
    id: "bakery-paris",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Parisian pause",
    cue: "Marble checks · café glow",
    description:
      "Soft daylight, delicate porcelain and a glimpse of the café make pastry feel like an occasion.",
    bestFor: "Éclairs, choux pastry and elegant café sweets",
    traits: [
      "Marble checkerboard",
      "Scalloped cream plate",
      "Soft café daylight",
    ],
    prompt:
      "Scalloped cream plate on restrained black-and-white marble checkerboard, blurred warm café lights and soft daylight. Exquisite natural pastry detail, full serving visible. Preserve pastry shape, filling, icing and quantity. No additional decorations or dishes.",
    image: "/studio/styles/bakery-paris.webp",
    angle: "keep",
  },
  {
    id: "bakery-hands",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Made by hand",
    cue: "Flour-dusted hands · artisan warmth",
    description:
      "A generous, hands-on presentation celebrates the craft behind every bake.",
    bestFor: "Galettes, pies and handcrafted bakes",
    traits: [
      "Two supporting hands",
      "Oatmeal linen apron",
      "Soft window light",
    ],
    prompt:
      "Wide cream plate supported by two natural hands with lightly flour-dusted fingertips, cropped oatmeal linen apron behind and gentle window light. Hands stay below the plate, never touch food. Keep pastry and toppings unchanged. No added flour on food, crumbs or extra servings.",
    image: "/studio/styles/bakery-hands.webp",
    angle: "three-quarter",
  },
  {
    id: "bakery-blue",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Blueberry morning",
    cue: "Cornflower blue · bright detail",
    description:
      "Rich blue fabric and an airy backdrop give everyday baking a fresh campaign look.",
    bestFor: "Muffins, scones and berry-filled pastries",
    traits: [
      "Cornflower blue",
      "Textured blue linen",
      "Bright diffused daylight",
    ],
    prompt:
      "Small cream plate on blue linen with a cornflower-blue backdrop, bright diffused daylight and soft grounded shadows. Authentic crumb and natural color. Preserve pastry, liner, toppings and portion exactly. No invented berries, crumbs or decoration.",
    image: "/studio/styles/bakery-blue.webp",
    angle: "keep",
  },
  {
    id: "bakery-copper",
    plate: "style",
    category: "bakery",
    group: "Bakery",
    name: "Golden on copper",
    cue: "Patinated metal · warm sidelight",
    description:
      "Rich copper and low warm light reveal the folds, crust and glaze of a beautiful bake.",
    bestFor: "Cardamom knots, cinnamon rolls and laminated pastry",
    traits: ["Patinated copper counter", "Cocoa plaster", "Low warm sidelight"],
    prompt:
      "Off-white ceramic on subtly patinated copper counter, cocoa-toned plaster background and low warm sidelight revealing real pastry texture. Refined indulgent editorial. Preserve shape, layers, glaze, toppings and portion. No added shine, crumbs or ingredients.",
    image: "/studio/styles/bakery-copper.webp",
    angle: "keep",
  },
];

// The homepage showcase: style-library examples chosen for range, from
// breakfast to cocktails, white seamless to candlelight, across every
// collection. Names match lib/photo-styles.ts and tests/web-assets.mjs keeps
// them in step. The catalog is not imported here so its prompts stay out of
// the homepage bundle.

// Every style in the library (lib/photo-styles.ts), for the section's copy.
export const libraryStyleCount = 56;

export type ShowcaseStyle = { id: string; name: string; alt: string };

// Two rows that drift in opposite directions. Neighbors alternate light and
// dark, warm and cool, so the wall reads as a range rather than a theme.
export const showcaseRows: ShowcaseStyle[][] = [
  [
    {
      id: "studio-color",
      name: "Color-pop campaign",
      alt: "Two bao buns with crispy mushroom filling against a cobalt-blue backdrop",
    },
    {
      id: "bakery-paris",
      name: "Parisian pause",
      alt: "A glossy chocolate éclair on a black-and-white marble café table",
    },
    {
      id: "beverage-poolside",
      name: "Poolside refresh",
      alt: "Sparkling yuzu lemonade on turquoise poolside tile in bright sun",
    },
    {
      id: "fine-terrace",
      name: "Riviera terrace",
      alt: "Sea bass on fennel on a stone terrace above an olive garden",
    },
    {
      id: "bar-rooftop",
      name: "Rooftop at dusk",
      alt: "A salt-rimmed paloma on a rooftop bar with the city skyline at sunset",
    },
    {
      id: "delivery-white",
      name: "Clean & craveable",
      alt: "A double cheeseburger on a white plate against a white backdrop",
    },
    {
      id: "menu-courtyard",
      name: "Courtyard table",
      alt: "Grilled octopus and potatoes on a jade-tile table in a sunlit courtyard",
    },
    {
      id: "studio-sunbeam",
      name: "Butter-yellow sun",
      alt: "A slice of Basque cheesecake in a bold sunbeam on butter yellow",
    },
    {
      id: "bar-speakeasy",
      name: "Amber hour",
      alt: "An Old Fashioned with an orange twist on a glowing walnut bar",
    },
    {
      id: "menu-stone",
      name: "Fresh on stone",
      alt: "Burrata with heirloom tomatoes and basil on pale limestone",
    },
    {
      id: "beverage-orchid",
      name: "Orchid pop",
      alt: "A magenta dragon-fruit smoothie on a lilac plinth",
    },
  ],
  [
    {
      id: "fine-presented",
      name: "Presented by the chef",
      alt: "Lobster ravioli presented on a wide ivory plate in a candlelit dining room",
    },
    {
      id: "delivery-takeout",
      name: "Takeout, elevated",
      alt: "A salmon poke bowl with avocado and edamame in an open kraft takeout bowl",
    },
    {
      id: "bar-bluehour",
      name: "Blue-hour bar",
      alt: "A ruby negroni with an orange peel on a midnight-blue marble bar",
    },
    {
      id: "bakery-patisserie",
      name: "Patisserie counter",
      alt: "A strawberry and raspberry tart on a white cake stand on pale marble",
    },
    {
      id: "studio-levitate",
      name: "Lifted in coral",
      alt: "A hand holding up three golden arancini against a coral backdrop",
    },
    {
      id: "beverage-ritual",
      name: "The morning ritual",
      alt: "A hand lifting a flat white with rosetta latte art on oatmeal linen",
    },
    {
      id: "studio-dark",
      name: "Spotlight studio",
      alt: "Steaming miso ramen with soft eggs and mushrooms against charcoal",
    },
    {
      id: "menu-terrazzo",
      name: "Terrazzo brunch",
      alt: "Ricotta pancakes with figs, seen from above on peach terrazzo",
    },
    {
      id: "delivery-overhead",
      name: "Top-down clarity",
      alt: "A whole margherita pizza seen from above on white",
    },
    {
      id: "fine-obsidian",
      name: "Obsidian tasting",
      alt: "Beetroot carpaccio with goat cheese on a black plate under a spotlight",
    },
    {
      id: "bakery-blue",
      name: "Blueberry morning",
      alt: "A blueberry muffin on a cream plate against cornflower-blue linen",
    },
  ],
];

export const showcaseStyles = showcaseRows.flat();

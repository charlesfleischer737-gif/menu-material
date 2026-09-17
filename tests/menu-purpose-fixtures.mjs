import { newMenuDocument, newMenuEntry } from "../lib/menu-document.ts";

// Fictional, reviewed sample content for layout validation, not customer menus.
const section = (name, items, description = "") => ({
  id: crypto.randomUUID(),
  name,
  description,
  pageBreakBefore: false,
  items,
});
const priced = (name, description, price) =>
  newMenuEntry({ name, description, price });
const variants = (name, description, labels, prices) =>
  newMenuEntry({
    name,
    description,
    priceMode: "variants",
    variants: labels.map((label, n) => ({
      id: `size-${n}`,
      label,
      price: prices[n],
    })),
  });
const document = (name, draft) => ({
  ...newMenuDocument({
    colorMode: "signature",
    priceFormat: "numbers",
    ...draft,
  }),
  restaurant: { name, currency: "USD" },
});

export function purposeFixtures() {
  return [
    {
      key: "dive-bar",
      menu: document("The Lucky Penny", {
        name: "Drinks at the Penny",
        title: "Cold drinks. Good company.",
        purpose: "bar",
        design: "bar",
        pageTarget: 1,
        priceFormat: "whole",
        subtitle: "Your neighborhood corner bar",
        sections: [
          section("On tap", [
            variants(
              "House lager",
              "Crisp, clean, easy drinking",
              ["Half pint", "Pint"],
              [350, 600],
            ),
            variants(
              "West Coast IPA",
              "Pine, citrus, a firm bitter finish",
              ["Half pint", "Pint"],
              [450, 800],
            ),
            variants(
              "Dry cider",
              "Bright apple, dry finish",
              ["Half pint", "Pint"],
              [400, 700],
            ),
          ]),
          section("Cans & bottles", [
            priced("Lager tallboy", "16 oz can", 500),
            priced("Amber ale", "12 oz bottle", 600),
            priced("Alcohol-free lager", "12 oz can", 500),
          ]),
          section("The usuals", [
            priced("Whiskey & ginger", "Whiskey, ginger ale, lime", 900),
            priced("Gin & tonic", "London dry gin, tonic, lime", 900),
            priced("Paloma", "Tequila, grapefruit soda, lime", 1000),
          ]),
          section("Something to snack on", [
            priced("Warm pretzel", "Beer mustard", 700),
            priced("Chips & onion dip", "A bowl for the table", 500),
          ]),
        ],
        footer:
          "Ask about today's rotating tap. Please tell the bartender about any allergies.",
      }),
    },
    {
      key: "cocktail-bar",
      menu: document("The Violet Room", {
        name: "Evening cocktails",
        title: "Cocktails",
        purpose: "cocktails",
        design: "cocktail",
        appearance: "dark",
        pageTarget: 1,
        priceFormat: "whole",
        subtitle: "Familiar spirits. A different point of view.",
        sections: [
          section("House signatures", [
            priced(
              "Velvet Afterglow",
              "Bourbon, oloroso sherry, maple, aromatic bitters",
              1700,
            ),
            priced(
              "The Green Hour",
              "Gin, cucumber, dry vermouth, lime, celery bitters",
              1600,
            ),
            priced(
              "Paper Lantern",
              "White rum, pineapple, jasmine tea, fresh lime",
              1600,
            ),
            priced(
              "Midnight Orchard",
              "Calvados, rye whiskey, pear, walnut bitters",
              1800,
            ),
            priced(
              "Pink Correspondence",
              "Tequila blanco, grapefruit, hibiscus, sea salt",
              1600,
            ),
          ]),
          section("Without the spirit", [
            priced("Garden Party", "Cucumber, basil, lime, soda", 1000),
            priced(
              "The Long Way Home",
              "Black tea, cherry, lemon, ginger",
              1100,
            ),
            priced(
              "Golden Afternoon",
              "Pineapple, turmeric, lime, sparkling water",
              1000,
            ),
          ]),
        ],
        footer:
          "Classics available on request. Please tell your bartender about allergies before ordering.",
      }),
    },
    {
      key: "smoothie-truck",
      menu: document("Sunbeam Smoothies", {
        name: "Smoothies & fresh juice",
        title: "Blended to order",
        purpose: "smoothies",
        design: "smoothie",
        pageTarget: 1,
        subtitle: "Find us at the yellow truck.",
        sections: [
          section("Fruit favorites", [
            variants(
              "Mango Sunrise",
              "Mango, pineapple, banana, orange juice",
              ["12 oz", "20 oz"],
              [700, 950],
            ),
            variants(
              "Berry Happy",
              "Strawberry, blueberry, banana, oat milk",
              ["12 oz", "20 oz"],
              [750, 1000],
            ),
            variants(
              "Peach Please",
              "Peach, mango, vanilla yogurt, oat milk",
              ["12 oz", "20 oz"],
              [750, 1000],
            ),
          ]),
          section("Green blends", [
            variants(
              "Green Light",
              "Spinach, pineapple, green apple, coconut water",
              ["12 oz", "20 oz"],
              [800, 1050],
            ),
            variants(
              "Avocado Glow",
              "Avocado, banana, spinach, lime, oat milk",
              ["12 oz", "20 oz"],
              [850, 1100],
            ),
          ]),
          section("Fresh juice", [
            variants(
              "Orange squeeze",
              "Freshly squeezed orange juice",
              ["12 oz", "20 oz"],
              [600, 800],
            ),
            variants(
              "Carrot kick",
              "Carrot, apple, ginger, lemon",
              ["12 oz", "20 oz"],
              [700, 950],
            ),
          ]),
          section("Make it yours", [
            newMenuEntry({
              name: "Boost your blend",
              description: "Choose additions for any smoothie",
              priceMode: "included",
              additions: [
                { id: "chia", label: "Chia seeds", price: 100 },
                { id: "protein", label: "Plant protein", price: 200 },
                { id: "almond", label: "Almond butter", price: 150 },
              ],
            }),
          ]),
        ],
        footer:
          "Tell us about allergies before ordering. Our equipment is shared with milk, nuts, and other ingredients.",
      }),
    },
    {
      key: "cafe",
      menu: document("Juniper Coffee", {
        name: "Coffee & all-day kitchen",
        title: "Coffee & all-day kitchen",
        purpose: "cafe",
        design: "cafe",
        pageTarget: 1,
        subtitle: "Good mornings. Long lunches.",
        sections: [
          section(
            "Coffee",
            [
              variants(
                "Americano",
                "",
                ["8 oz", "12 oz", "16 oz"],
                [325, 375, 425],
              ),
              variants(
                "Latte",
                "",
                ["8 oz", "12 oz", "16 oz"],
                [425, 475, 525],
              ),
              variants(
                "Cappuccino",
                "",
                ["8 oz", "12 oz", "16 oz"],
                [425, 475, 525],
              ),
              variants(
                "Mocha",
                "Chocolate, espresso",
                ["8 oz", "12 oz", "16 oz"],
                [475, 525, 575],
              ),
              variants(
                "Chai latte",
                "Black tea, warming spices",
                ["8 oz", "12 oz", "16 oz"],
                [450, 500, 550],
              ),
            ],
            "Whole or oat milk. Extra espresso shot +1.00.",
          ),
          section("Cold drinks", [
            variants(
              "Cold brew",
              "Slow steeped, served over ice",
              ["12 oz", "16 oz"],
              [425, 475],
            ),
            variants(
              "Iced matcha",
              "Matcha, your choice of milk",
              ["12 oz", "16 oz"],
              [525, 575],
            ),
          ]),
          section("All-day kitchen", [
            priced(
              "Egg & cheddar roll",
              "Soft scrambled eggs, aged cheddar, brioche",
              850,
            ),
            {
              ...priced(
                "Avocado toast",
                "Sourdough, lemon, radish, toasted seeds",
                1050,
              ),
              additions: [{ id: "egg", label: "Poached egg", price: 250 }],
            },
            priced(
              "Roast tomato toastie",
              "Tomato, mozzarella, basil pesto",
              1100,
            ),
          ]),
          section("From the bakery", [
            priced("Butter croissant", "Baked every morning", 425),
            priced("Blueberry & lemon cake", "A thick slice, lemon glaze", 500),
          ]),
        ],
        footer:
          "Order at the counter. Please tell us about any allergies before ordering.",
      }),
    },
    {
      key: "wine",
      menu: document("No. 12 Wine Bar", {
        name: "The wine list",
        title: "The wine list",
        purpose: "drinks",
        design: "wine",
        pageTarget: 1,
        subtitle: "A glass for the moment. A bottle for the table.",
        sections: [
          section("Sparkling", [
            variants(
              "Casa del Colle · Brut",
              "Veneto, Italy · Glera · NV",
              ["150 ml", "Bottle"],
              [1200, 4800],
            ),
            variants(
              "Maison Bellune · Rosé",
              "Loire, France · Cabernet Franc · NV",
              ["150 ml", "Bottle"],
              [1400, 5600],
            ),
          ]),
          section("White & rosé", [
            variants(
              "Domaine des Aulnes · Sauvignon Blanc",
              "Loire, France · 2024 · Citrus, cut grass, mineral finish",
              ["150 ml", "Bottle"],
              [1300, 5200],
            ),
            variants(
              "Stone Orchard · Chardonnay",
              "Sonoma Coast, California · 2023 · Pear, almond, gentle oak",
              ["150 ml", "Bottle"],
              [1600, 6400],
            ),
            variants(
              "Les Jardins Clairs · Rosé",
              "Provence, France · 2024 · Strawberry, white peach",
              ["150 ml", "Bottle"],
              [1300, 5200],
            ),
          ]),
          section("Red", [
            variants(
              "Hill & Hollow · Pinot Noir",
              "Willamette Valley, Oregon · 2023 · Cherry, forest floor",
              ["150 ml", "Bottle"],
              [1700, 6800],
            ),
            variants(
              "Finca del Arroyo · Garnacha",
              "Aragón, Spain · 2022 · Red berries, savory spice",
              ["150 ml", "Bottle"],
              [1400, 5600],
            ),
            variants(
              "Tenuta della Sera · Chianti",
              "Tuscany, Italy · Sangiovese · 2022 · Cherry, dried herbs",
              ["150 ml", "Bottle"],
              [1500, 6000],
            ),
          ]),
        ],
        footer:
          "Wines and vintages are subject to availability. Ask us about the bottle-only cellar selection.",
      }),
    },
    {
      key: "tasting",
      menu: document("Linden", {
        name: "September tasting",
        title: "September",
        subtitle: "Five courses from the garden and coast",
        purpose: "tasting",
        design: "fine",
        pageTarget: 1,
        fixedPrice: 9500,
        fixedPriceLabel: "per guest · five courses",
        sections: [
          section("To begin", [
            newMenuEntry({
              name: "Tomato",
              description: "Heirloom tomato, chilled consommé, basil oil",
              priceMode: "included",
            }),
          ]),
          section("From the coast", [
            newMenuEntry({
              name: "Scallop",
              description: "Sweetcorn, brown butter, lemon thyme",
              priceMode: "included",
            }),
          ]),
          section("From the garden", [
            newMenuEntry({
              name: "Hen-of-the-woods",
              description: "Barley, black garlic, mushroom broth",
              priceMode: "included",
            }),
          ]),
          section("From the farm", [
            newMenuEntry({
              name: "Duck",
              description: "Roasted breast, beetroot, plum, juniper jus",
              priceMode: "included",
            }),
          ]),
          section("To finish", [
            newMenuEntry({
              name: "Pear",
              description: "Poached pear, oat crumble, vanilla cream",
              priceMode: "included",
              additions: [
                { id: "cheese", label: "Add a cheese course", price: 1400 },
              ],
            }),
          ]),
        ],
        footer:
          "Wine pairing 55.00 per guest. Please discuss allergies and dietary requirements with your server.",
      }),
    },
  ];
}

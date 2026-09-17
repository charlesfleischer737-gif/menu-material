// Collections organize existing photographic treatments. They never add food,
// team marks, promotional claims, or change an everyday restaurant default.
export const studioOccasions = [
  {
    id: "christmas",
    name: "Christmas",
    description: "Candlelight, white linen and warm copper for holiday menus.",
    keywords: "christmas holiday festive winter",
    looks: ["fine-candle", "fine-linen", "bakery-copper"],
    window: [11, 12],
  },
  {
    id: "game-day",
    name: "Game day",
    description:
      "Welcoming tables, crisp charcoal and the glow of a neighborhood bar.",
    keywords: "game day football foodball sunday sports",
    looks: ["menu-wood", "delivery-graphite", "bar-brass"],
    window: [],
  },
  {
    id: "valentines",
    name: "Valentine’s dinner",
    description: "Velvet, rich color and an understated restaurant setting.",
    keywords: "valentine valentines romantic romance date night dinner",
    looks: ["bar-velvet", "bakery-jewel", "fine-gallery"],
    window: [2],
  },
  {
    id: "summer-drinks",
    name: "Summer drinks",
    description: "Clear backlight, citrus color and cool poolside reflections.",
    keywords: "summer drinks beach sunshine poolside",
    looks: ["beverage-backlit", "beverage-citrus", "beverage-poolside"],
    window: [],
  },
] as const;
export function occasionName(id?: string) {
  return studioOccasions.find((occasion) => occasion.id === id)?.name || "";
}
export function orderedOccasions(timezone?: string, date = new Date()) {
  let month = 0;
  // No seasonal hemisphere guess. Summer remains explicit inspiration only.
  if (timezone)
    try {
      month = Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          month: "numeric",
        }).format(date),
      );
    } catch {}
  return [...studioOccasions].sort(
    (a, b) =>
      Number((b.window as readonly number[]).includes(month)) -
      Number((a.window as readonly number[]).includes(month)),
  );
}

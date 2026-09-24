import type { Row } from "./client";
import { normalizeDietary } from "./dietary";
import type { MenuContact } from "./restaurant-contact";

const schemaDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const schemaDiets: Record<string, string> = {
  vegetarian: "https://schema.org/VegetarianDiet",
  vegan: "https://schema.org/VeganDiet",
  "gluten-free": "https://schema.org/GlutenFreeDiet",
};
const items = (menu: Row): Row[] =>
  (menu.sections || []).flatMap((s: Row) => s.items || []);
/** What guests see: sold-out dishes only when the menu shows them. */
const guestSections = (menu: Row) =>
  (menu.sections || [])
    .map((s: Row) => ({
      ...s,
      items: (s.items || []).filter(
        (i: Row) =>
          i.visible !== false &&
          (menu.showUnavailable !== false || i.available !== false),
      ),
    }))
    .filter((s: Row) => s.items.length);

/** A dish photo (or the logo) for link previews of a published menu. */
export function menuPreviewImage(menu: Row, slug: string, origin: string) {
  const all = items(menu);
  const dish =
    all.find((i) => i.featured && i.photoId && i.available !== false) ||
    all.find((i) => i.photoId && i.available !== false);
  const asset = (id: string) =>
    new URL(`/api/public/${encodeURIComponent(slug)}/assets/${id}`, origin)
      .href;
  if (dish) return { url: asset(dish.photoId), alt: dish.name, large: true };
  if (menu.restaurant?.logoId)
    return {
      url: asset(menu.restaurant.logoId),
      alt: `${menu.restaurant.name} logo`,
      large: false,
    };
  return null;
}

function offers(item: Row, currency: string) {
  const offer = (price: number, name?: string) => ({
    "@type": "Offer",
    ...(name ? { name } : {}),
    price: (price / 100).toFixed(2),
    priceCurrency: currency,
    ...(item.available === false
      ? { availability: "https://schema.org/OutOfStock" }
      : {}),
  });
  if (item.priceMode === "variants" && item.variants?.length)
    return { offers: item.variants.map((v: Row) => offer(v.price, v.label)) };
  if ((item.priceMode ?? "single") === "single" && Number.isFinite(item.price))
    return { offers: offer(item.price) };
  return {};
}

/** schema.org data so search engines can read the restaurant and its menu. */
export function menuStructuredData(
  menu: Row & { contact?: MenuContact },
  url?: string,
  image?: string,
) {
  const contact = menu.contact,
    currency = menu.restaurant?.currency || "USD";
  const hours =
    contact?.hours?.length === 7 ? contact.hours.filter((h) => !h.closed) : [];
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: menu.restaurant?.name,
    ...(url ? { url } : {}),
    ...(image ? { image } : {}),
    ...(menu.restaurant?.cuisine
      ? { servesCuisine: menu.restaurant.cuisine }
      : {}),
    ...(contact?.phone ? { telephone: contact.phone } : {}),
    ...(contact?.address ? { address: contact.address } : {}),
    ...(contact?.reservationUrl
      ? { acceptsReservations: contact.reservationUrl }
      : {}),
    ...(hours.length
      ? {
          openingHoursSpecification: hours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${schemaDays[h.day]}`,
            opens: h.open,
            closes: h.close,
          })),
        }
      : {}),
    hasMenu: {
      "@type": "Menu",
      name: menu.title || "Menu",
      ...(url ? { url } : {}),
      hasMenuSection: guestSections(menu).map((section: Row) => ({
        "@type": "MenuSection",
        name: section.name,
        ...(section.description ? { description: section.description } : {}),
        hasMenuItem: section.items.map((item: Row) => {
          const diets = normalizeDietary(item.dietary)
            .map((tag) => schemaDiets[tag])
            .filter(Boolean);
          return {
            "@type": "MenuItem",
            name: item.name,
            ...(item.description ? { description: item.description } : {}),
            ...offers(item, currency),
            ...(diets.length ? { suitableForDiet: diets } : {}),
          };
        }),
      })),
    },
  };
}
/** JSON for a script tag: "<" is escaped so menu text can't close it. */
export const jsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");

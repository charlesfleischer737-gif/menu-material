// Names a signup form or local workspace fills in before an owner names the
// restaurant. Guests should never see them on a menu, post, or menu address.
const placeholderNames = new Set([
  "my restaurant",
  "your restaurant",
  "restaurant",
  "new restaurant",
  "untitled restaurant",
  "local pilot",
]);

export function isPlaceholderRestaurantName(name?: string | null) {
  const normalized = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
  return normalized.length < 2 || placeholderNames.has(normalized);
}

export const restaurantNameMessage =
  "Add your restaurant’s name. Guests see it on your menu and posts.";

// Names a dish has before the owner names it, such as a photo added without
// one. Guests should never see them on a menu or post.
const placeholderDishNames = new Set(["untitled dish", "untitled", "new dish"]);
export function isPlaceholderDishName(name?: string | null) {
  return placeholderDishNames.has(
    (name || "").trim().toLowerCase().replace(/\s+/g, " "),
  );
}
export const dishNameMessage =
  "Name this dish. Guests would see “Untitled dish”.";

export function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      // "Joe's Pizza" reads as joes-pizza, not joe-s-pizza.
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
      .replace(/-$/g, "") || "restaurant"
  );
}

export const menuAddressPattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

// Addresses guests could mistake for Menu Material's own pages or staff.
const reservedAddresses = new Set([
  "about",
  "abuse",
  "account",
  "admin",
  "administrator",
  "api",
  "app",
  "billing",
  "blog",
  "contact",
  "help",
  "legal",
  "login",
  "menu",
  "menus",
  "official",
  "press",
  "pricing",
  "privacy",
  "report",
  "security",
  "sign-in",
  "sign-up",
  "signin",
  "signup",
  "staff",
  "status",
  "support",
  "team",
  "terms",
  "guidelines",
  "www",
]);

export function menuAddressProblem(address: string) {
  if (address.length < 3) return "Use at least 3 characters.";
  if (address.length > 60) return "Use 60 characters or fewer.";
  if (!menuAddressPattern.test(address) || address.includes("--"))
    return "Use lowercase letters, numbers, and single hyphens.";
  if (reservedAddresses.has(address) || /menu-?material/.test(address))
    return "That address is reserved. Try one with your restaurant’s name.";
  return "";
}

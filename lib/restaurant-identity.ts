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

export function slugify(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
      .replace(/-$/g, "") || "restaurant"
  );
}

export const menuAddressPattern = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export function menuAddressProblem(address: string) {
  if (address.length < 3) return "Use at least 3 characters.";
  if (address.length > 60) return "Use 60 characters or fewer.";
  if (!menuAddressPattern.test(address) || address.includes("--"))
    return "Use lowercase letters, numbers, and single hyphens.";
  return "";
}

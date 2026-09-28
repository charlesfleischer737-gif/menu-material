/** A deliberate choice of an exact photo version, not an accuracy certification. */
export const photoUseActions = [
  "download",
  "share",
  "post",
  "menu",
  "pack",
  "main",
] as const;
export type PhotoUseAction = (typeof photoUseActions)[number];
export const photoReviewReminder =
  "Check that the food and portions match what you serve.";

/** Names for a sentence: “A”, “A and B”, “A, B and C”. */
function listed(names: string[]) {
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
/**
 * What reporting a photo as inaccurate changed for guests: the live menus it
 * came off (a menu without an id is one from before Menus) and the specials
 * now hidden. Empty when guests weren't shown it.
 */
export function reportedPhotoNotice(
  withdrawn?: {
    menus?: { id: string | null; name: string }[];
    specials?: { title: string }[];
  } | null,
) {
  const menus = withdrawn?.menus || [],
    named = menus.filter((m) => m.id).map((m) => `“${m.name}”`),
    specials = (withdrawn?.specials || []).map(
      (s) => `“${s.title.trim() || "Special"}”`,
    );
  const notes: string[] = [];
  if (menus.length)
    notes.push(
      `Guests no longer see this photo on your ${
        named.length
          ? `live ${named.length === 1 ? "menu" : "menus"} ${listed(named)}`
          : "live menu"
      }. Choose another photo in Menus and publish again.`,
    );
  if (specials.length)
    notes.push(
      specials.length === 1
        ? `Your special ${specials[0]} is hidden from guests until it has another photo.`
        : `Your specials ${listed(specials)} are hidden from guests until they have another photo.`,
    );
  return notes.join(" ");
}

// Free signup images an owner doesn't have (yet), for the note shown wherever
// their image balance is: held while a day's grants for new accounts are used
// up, or already had by this email's deleted account (lib/server/free-grants.ts).
export type FreeImages =
  | { status: "verification"; images: number }
  | { status: "held"; images: number; days: number | null }
  | { status: "used"; images: number };

/** A plain sentence about them, or "" when there is nothing to say. */
export function freeImagesNote(free?: FreeImages | null) {
  if (!free) return "";
  if (free.status === "verification")
    return `Verify your email to unlock your ${free.images} free images.`;
  if (free.status === "used")
    return `This email already had its ${free.images} free images.`;
  return free.days === null
    ? `Your ${free.images} free images are on their way.`
    : `Your ${free.images} free images arrive within ${free.days <= 1 ? "a day" : `${free.days} days`}.`;
}

/** The balance as a short label: images on their way rather than "0 left". */
export function imagesLeft(remaining: number, free?: FreeImages | null) {
  if (free?.status === "verification") return "Verify email to unlock images";
  return remaining <= 0 && free?.status === "held"
    ? `${free.images} images on the way`
    : `${remaining} ${remaining === 1 ? "image" : "images"} left`;
}

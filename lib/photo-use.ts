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

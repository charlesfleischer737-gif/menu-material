/**
 * Where a menu link or QR code is put out. Each placement gets its own link
 * (`?src=`), so owners can see which one brings guests in. Earlier QR codes
 * without a placement keep working and count as "Other links".
 */
export const menuPlacementIds = [
  "table",
  "counter",
  "window",
  "takeout",
  "flyer",
  "instagram",
  "website",
  "google",
] as const;
export type MenuPlacement = (typeof menuPlacementIds)[number];
export const menuPlacementLabels: Record<MenuPlacement, string> = {
  table: "Tables",
  counter: "Counter",
  window: "Window",
  takeout: "Takeout bags",
  flyer: "Flyers",
  instagram: "Instagram bio",
  website: "Website",
  google: "Google profile",
};
/** Reads naturally mid-sentence: "Link for your Instagram bio". */
export const menuPlacementPhrases: Record<MenuPlacement, string> = {
  table: "your tables",
  counter: "your counter",
  window: "your window",
  takeout: "takeout bags",
  flyer: "flyers",
  instagram: "your Instagram bio",
  website: "your website",
  google: "your Google profile",
};
/** Printed placements get a QR code; the others are links to paste. */
export const printedPlacements: MenuPlacement[] = [
  "table",
  "counter",
  "window",
  "takeout",
  "flyer",
];
export const isMenuPlacement = (value: unknown): value is MenuPlacement =>
  menuPlacementIds.includes(value as MenuPlacement);

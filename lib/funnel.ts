// The launch funnel's shared names, for the pages that record its steps and
// the server that counts them (lib/server/funnel.ts).

/**
 * Steps counted once per browser, before or after signup: opening the
 * homepage signed out, adding a photo in Photo Studio and pressing Create.
 */
export const visitorSteps = ["home", "photo", "create"] as const;
export type VisitorStep = (typeof visitorSteps)[number];

/** What a menu can be exported as: its PDF, a table card or its QR image. */
export const menuExportFormats = ["pdf", "table_card", "qr_image"] as const;
export type MenuExportFormat = (typeof menuExportFormats)[number];

/** The exports that put a menu's QR code on a table. */
export const tableCardFormats: readonly MenuExportFormat[] = [
  "table_card",
  "qr_image",
];
export const isTableCard = (format: unknown) =>
  tableCardFormats.includes(format as MenuExportFormat);

/** Sent on the window when a menu export starts, so open screens can follow. */
export const MENU_EXPORTED = "menu-material:menu-exported";

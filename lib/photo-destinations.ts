import {
  catalogProfiles,
  formats,
  photoStyles,
  type PhotoFormat,
} from "./studio";
import type { Row } from "./client";

export const photoDestinations = [
  {
    id: "toast",
    label: "Toast",
    hint: "Your existing menu",
    instructions:
      "In Toast Web, open your item in Menu Manager, add or replace its image, then save and publish. Center the dish: Toast may crop it differently across displays.",
  },
  {
    id: "doordash",
    label: "DoorDash",
    hint: "Item photo",
    instructions:
      "Open the item in DoorDash Merchant Portal’s Menu Manager and upload this photo for review. If your menu is managed through a POS provider, update it there.",
  },
  {
    id: "uber",
    label: "Uber Eats",
    hint: "Item photo",
    instructions:
      "Open the item in Uber Eats Manager’s menu editor and upload this photo for review. If your menu is managed through a POS provider, update it there.",
  },
  {
    id: "menu",
    label: "Website or menu",
    hint: "Square photo",
    instructions:
      "Upload this photo in your website or menu editor. Choose Full-quality image if your platform needs a different shape.",
  },
  {
    id: "feed",
    label: "Instagram",
    hint: "Post or Story",
    instructions:
      "Open Instagram and choose this photo from your downloads or photo library. Add your caption and review before posting.",
  },
  {
    id: "master",
    label: "Full-quality image",
    hint: "Original size, no crop",
    instructions:
      "Your saved photo at its original resolution, with no resizing or recompression. Keep it for future edits, print, or other platforms.",
  },
] as const;
export type PhotoDestination =
  (typeof photoDestinations)[number]["id"] | "story";
export type DownloadPhoto = {
  assetId: string;
  dishId: string;
  name: string;
  fromPhoto: boolean;
};
export function photoDestination(value: string): PhotoDestination {
  return value === "story" || photoDestinations.some((d) => d.id === value)
    ? (value as PhotoDestination)
    : "menu";
}
export function isCatalogDestination(value: string) {
  return Object.prototype.hasOwnProperty.call(catalogProfiles, value);
}
export function downloadPhotoItem(
  state: Row,
  asset: Row,
  name: string,
): DownloadPhoto {
  const seen = new Set<string>();
  function fromRealPhoto(current: Row | undefined): boolean {
    if (!current || seen.has(current.id)) return false;
    seen.add(current.id);
    if (current.kind === "source" || current.kind === "staff") return true;
    const output = state.outputs?.find((o: Row) => o.asset_id === current.id);
    const job = state.jobs?.find((j: Row) => j.id === output?.job_id);
    const edit = state.assetEdits?.find((e: Row) => e.asset_id === current.id);
    const sourceId = edit?.source_id || edit?.parent_id || job?.source_id;
    return fromRealPhoto(state.assets?.find((a: Row) => a.id === sourceId));
  }
  return {
    assetId: asset.id,
    dishId: asset.dish_id,
    name,
    fromPhoto: fromRealPhoto(asset),
  };
}
/** A file-safe version of a dish name: letters and numbers joined by hyphens. */
export function photoFileStem(name: string) {
  return (
    name
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "dish"
  );
}
export function photoFilename(
  item: DownloadPhoto,
  destination: string,
  extension = "jpg",
) {
  return `${photoFileStem(item.name)}-${item.assetId.slice(0, 8)}-${destination}.${extension}`;
}
function parsed(value: unknown): Row {
  if (value && typeof value === "object") return value as Row;
  try {
    return JSON.parse(String(value || "{}")) || {};
  } catch {
    return {};
  }
}
/**
 * The format and look a saved photo was made with, read from its job or
 * adjustment history: a photo opens its download at the size it was made for.
 * Originals are "Polish my original"-like: their own real setting.
 */
export function photoLineage(
  state: Row,
  asset: Row | undefined,
): { format: PhotoFormat; lookId: string } {
  const seen = new Set<string>();
  let format = "",
    lookId = "";
  let current = asset;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.kind === "source" || current.kind === "staff") {
      lookId ||= "keep";
      break;
    }
    const id = current.id;
    const edit = state.assetEdits?.find((e: Row) => e.asset_id === id);
    if (edit) {
      format ||= parsed(edit.edits).format || "";
      current = state.assets?.find((a: Row) => a.id === edit.parent_id);
      continue;
    }
    const output = state.outputs?.find((o: Row) => o.asset_id === id);
    const job = state.jobs?.find((j: Row) => j.id === output?.job_id);
    if (job) {
      const details = parsed(job.details);
      format ||= details.controls?.format || "";
      lookId ||=
        details.lookContext?.presetId ||
        photoStyles.find((style) => style.prompt === details.style?.photoStyle)
          ?.id ||
        "";
    }
    break;
  }
  return {
    format: (format === "door"
      ? "doordash"
      : format in formats
        ? format
        : "menu") as PhotoFormat,
    lookId,
  };
}
export function exportFormat(
  destination: Exclude<PhotoDestination, "master">,
): PhotoFormat {
  return destination;
}

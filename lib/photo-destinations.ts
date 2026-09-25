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
  return {
    assetId: asset.id,
    dishId: asset.dish_id,
    name,
    fromPhoto: statePhotoHistory(state, asset).fromPhoto,
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
 * A saved photo's history: whether a real photo (an upload or staff photo) is
 * behind it, and the format and look it was made with. Descriptions make
 * illustrations, which stay out of delivery apps and Google; a photo opens
 * its download at the size it was made for. Originals are "Polish my
 * original"-like: their own real setting.
 */
export type PhotoHistory = {
  fromPhoto: boolean;
  format: PhotoFormat;
  lookId: string;
};
/** How a generated photo was requested. */
type PhotoCreation = {
  sourceId?: string | null;
  format?: string | null;
  presetId?: string | null;
  photoStyle?: string | null;
};
type PhotoAncestry = {
  asset: (id: string) => Row | undefined;
  edit: (assetId: string) => Row | undefined;
  creation: (assetId: string) => PhotoCreation | undefined;
};
const savedFormat = (format: string) =>
  (format === "door"
    ? "doordash"
    : format in formats
      ? format
      : "menu") as PhotoFormat;
const realPhoto = (asset: Row) =>
  asset.kind === "source" || asset.kind === "staff";
export function photoHistory(
  asset: Row | undefined,
  ancestry: PhotoAncestry,
): PhotoHistory {
  // Adjustments keep their original; requests keep the photo they started from.
  let fromPhoto = false;
  const seen = new Set<string>();
  for (let current = asset; current && !seen.has(current.id);) {
    seen.add(current.id);
    if (realPhoto(current)) {
      fromPhoto = true;
      break;
    }
    const edit = ancestry.edit(current.id);
    const next = edit
      ? edit.source_id || edit.parent_id
      : ancestry.creation(current.id)?.sourceId;
    current = next ? ancestry.asset(next) : undefined;
  }
  // The nearest adjustment sets the format; the request behind it the look.
  let format = "",
    lookId = "";
  seen.clear();
  for (let current = asset; current && !seen.has(current.id);) {
    seen.add(current.id);
    if (realPhoto(current)) {
      lookId ||= "keep";
      break;
    }
    const edit = ancestry.edit(current.id);
    if (edit) {
      format ||= parsed(edit.edits).format || "";
      current = ancestry.asset(edit.parent_id);
      continue;
    }
    const creation = ancestry.creation(current.id);
    if (creation) {
      format ||= creation.format || "";
      lookId ||=
        creation.presetId ||
        photoStyles.find((style) => style.prompt === creation.photoStyle)?.id ||
        "";
    }
    break;
  }
  return { fromPhoto, format: savedFormat(format), lookId };
}
/**
 * Every photo's history, for the server: from all of a restaurant's photos
 * (removed ones included, as ancestors), adjustments and image requests.
 */
export function photoHistories(
  assets: Row[],
  edits: Row[],
  creations: Row[],
): Map<string, PhotoHistory> {
  const assetById = new Map(assets.map((asset) => [asset.id, asset])),
    editOf = new Map(edits.map((edit) => [edit.asset_id, edit])),
    creationOf = new Map(
      creations.map((row) => [
        row.asset_id,
        {
          sourceId: row.source_id,
          format: row.format,
          presetId: row.preset_id,
          photoStyle: row.photo_style,
        },
      ]),
    );
  const ancestry: PhotoAncestry = {
    asset: (id) => assetById.get(id),
    edit: (id) => editOf.get(id),
    creation: (id) => creationOf.get(id),
  };
  return new Map(
    assets.map((asset) => [asset.id, photoHistory(asset, ancestry)]),
  );
}
/**
 * A workspace photo's history. `/api/state` sends it with each photo; older
 * states fall back to the recent requests and adjustments they include.
 */
export function statePhotoHistory(
  state: Row,
  asset: Row | undefined,
): PhotoHistory {
  if (asset && typeof asset.from_photo === "boolean")
    return {
      fromPhoto: asset.from_photo,
      format: savedFormat(asset.photo_format || ""),
      lookId: asset.look_id || "",
    };
  return photoHistory(asset, {
    asset: (id) => state.assets?.find((a: Row) => a.id === id),
    edit: (id) => state.assetEdits?.find((e: Row) => e.asset_id === id),
    creation: (id) => {
      const output = state.outputs?.find((o: Row) => o.asset_id === id);
      const job = state.jobs?.find((j: Row) => j.id === output?.job_id);
      if (!job) return undefined;
      const details = parsed(job.details);
      return {
        sourceId: job.source_id,
        format: details.controls?.format,
        presetId: details.lookContext?.presetId,
        photoStyle: details.style?.photoStyle,
      };
    },
  });
}
/** The format and look a saved photo was made with. */
export function photoLineage(
  state: Row,
  asset: Row | undefined,
): { format: PhotoFormat; lookId: string } {
  const { format, lookId } = statePhotoHistory(state, asset);
  return { format, lookId };
}
export function exportFormat(
  destination: Exclude<PhotoDestination, "master">,
): PhotoFormat {
  return destination;
}

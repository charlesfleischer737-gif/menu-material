import {
  aspectCheck,
  backdropCheck,
  channelRules,
  destinationChannel,
  fileCheck,
  photoCheck,
  sizeCheck,
  styleProfile,
  styleWarning,
  type ChannelCheck,
  type ChannelRule,
  type StyleProfile,
} from "./channel-rules";
import { exportDimensions } from "./photo-export";
import { photoFileStem } from "./photo-destinations";
import { formats, looks, type PhotoFormat } from "./studio";

/**
 * One tap, every channel: a ZIP of photos sized and checked for where they go.
 * This module is pure (sizes, checks, names, README) so it runs in Node tests;
 * the dialog in app/components/photo-pack-sheet.tsx draws and zips the files.
 */
export type PackEntryId =
  | "doordash"
  | "uber"
  | "google"
  | "instagram-post"
  | "instagram-story"
  | "website";
export type PackEntry = {
  id: PackEntryId;
  channel: ChannelRule | null;
  label: string;
  use: string;
  slug: string;
  width: number;
  height: number;
  /** Delivery apps and Google must be filled edge to edge (no letterboxing). */
  fill: "cover" | "auto";
};
export const packEntries: PackEntry[] = [
  {
    id: "doordash",
    channel: channelRules.doordash,
    label: "DoorDash",
    use: "Item photo · 16:9",
    slug: "doordash",
    width: formats.doordash.width,
    height: formats.doordash.height,
    fill: "cover",
  },
  {
    id: "uber",
    channel: channelRules.uber,
    label: "Uber Eats",
    use: "Item photo · 5:4",
    slug: "uber-eats",
    width: formats.uber.width,
    height: formats.uber.height,
    fill: "cover",
  },
  {
    id: "google",
    channel: channelRules.google,
    label: "Google Business Profile",
    use: "Dish photo · square",
    slug: "google",
    width: 1200,
    height: 1200,
    fill: "cover",
  },
  {
    id: "instagram-post",
    channel: channelRules.instagram,
    label: "Instagram post",
    use: "Portrait · 4:5",
    slug: "instagram-post",
    width: formats.feed.width,
    height: formats.feed.height,
    fill: "auto",
  },
  {
    id: "instagram-story",
    channel: channelRules.instagram,
    label: "Instagram Story",
    use: "Full screen · 9:16",
    slug: "instagram-story",
    width: formats.story.width,
    height: formats.story.height,
    fill: "auto",
  },
  {
    id: "website",
    channel: null,
    label: "Website & menu",
    use: "Square · 1:1",
    slug: "website",
    width: formats.menu.width,
    height: formats.menu.height,
    fill: "auto",
  },
];
/**
 * Social and website sizes fill the frame when that trims at most a fifth of
 * the photo; otherwise the whole dish is kept and the frame padded.
 */
export const MAX_FILL_TRIM = 0.2;
export function packFit(
  entry: Pick<PackEntry, "width" | "height" | "fill">,
  source: { width: number; height: number },
) {
  if (entry.fill === "cover") return false;
  const sourceRatio = source.width / source.height,
    targetRatio = entry.width / entry.height;
  const trim =
    1 - Math.min(sourceRatio / targetRatio, targetRatio / sourceRatio);
  return trim > MAX_FILL_TRIM + 1e-9;
}
export type PackSource = {
  name: string;
  width: number;
  height: number;
  fromPhoto: boolean;
  style: StyleProfile;
};
export type PackItem = {
  entry: PackEntry;
  included: boolean;
  /** Why a channel is left out of the pack. */
  skipped?: string;
  width: number;
  height: number;
  fit: boolean;
  filename: string;
  checks: ChannelCheck[];
};
export function packFileName(name: string, slug: string, w: number, h: number) {
  return `${photoFileStem(name).toLowerCase()}-${slug}-${w}x${h}.jpg`;
}
export function packZipName(name: string) {
  return `${photoFileStem(name).toLowerCase()}-photo-pack.zip`;
}
/** Sizes and checks every pack file before anything is drawn. */
export function planPhotoPack(source: PackSource): PackItem[] {
  return packEntries.map((entry) => {
    const fit = packFit(entry, source);
    const { width, height } = exportDimensions(entry, source, { fit });
    const rule = entry.channel;
    const checks: ChannelCheck[] = [];
    if (rule) {
      const photo = photoCheck(rule, source.fromPhoto);
      if (photo) checks.push(photo);
      checks.push(sizeCheck(rule, width, height));
      const aspect = aspectCheck(rule, width, height);
      if (aspect) checks.push(aspect);
      if (rule.maxBytes || rule.minBytes) checks.push(fileCheck(rule));
      const backdrop = backdropCheck(rule, source.style);
      if (backdrop) checks.push(backdrop);
    }
    const failed = checks.find((check) => check.status === "fail");
    return {
      entry,
      included: !failed,
      ...(failed
        ? {
            skipped:
              failed.id === "photo"
                ? `Left out: ${entry.label} needs a photo of your actual dish, and this image was created from a description.`
                : `Left out: ${failed.detail}`,
          }
        : {}),
      width,
      height,
      fit,
      filename: packFileName(source.name, entry.slug, width, height),
      checks,
    };
  });
}
/** A pack is worth downloading when at least one channel can be included. */
export function packReady(plan: PackItem[]) {
  return plan.some((item) => item.included);
}
/**
 * Advisory warnings for a single download: a backdrop the channel often
 * rejects, or a crop smaller than the channel's minimum.
 */
export function downloadWarnings(
  destination: string,
  {
    style,
    source,
    edits = {},
  }: {
    style: StyleProfile;
    source?: { width: number; height: number } | null;
    edits?: { zoom?: number; rotate?: number };
  },
): string[] {
  const rule = destinationChannel(destination);
  if (!rule) return [];
  const warnings: string[] = [];
  const backdrop = styleWarning(rule, style);
  if (backdrop) warnings.push(backdrop);
  const format = formats[destination as PhotoFormat];
  if (source && format && (rule.minWidth || rule.minHeight)) {
    const turned = edits.rotate && edits.rotate % 180 !== 0;
    const { width, height } = exportDimensions(
      format,
      turned ? { width: source.height, height: source.width } : source,
      { fit: false, zoom: edits.zoom },
    );
    if (width < rule.minWidth || height < rule.minHeight)
      warnings.push(
        `This crop is ${width} × ${height} pixels, smaller than ${rule.label}’s minimum of ${rule.minWidth} × ${rule.minHeight}. Use a larger photo or zoom out; enlarging it won’t add detail.`,
      );
  }
  return warnings;
}
/** Replaces the planned file check with the encoded file's real size. */
export function verifyPackFile(item: PackItem, bytes: number): PackItem {
  const rule = item.entry.channel;
  if (!rule || !(rule.maxBytes || rule.minBytes)) return item;
  const check = fileCheck(rule, bytes);
  return {
    ...item,
    included: item.included && check.status !== "fail",
    ...(check.status === "fail"
      ? { skipped: `Left out: ${check.detail}` }
      : {}),
    checks: item.checks.map((c) => (c.id === "file" ? check : c)),
  };
}
/** Encoding steps: start at export quality and ease off only to fit a limit. */
export const packQualities = [0.94, 0.9, 0.86, 0.82];

export function lookProfile(
  lookId: string,
  restaurantStyle?: { photoPreset?: string } | null,
) {
  return styleProfile(
    looks.find((look) => look.id === lookId),
    restaurantStyle,
  );
}
export function packReadme(
  name: string,
  plan: PackItem[],
  date = new Date(),
): string {
  const lines = [
    `Menu Material photo pack · ${name.trim() || "Dish photo"}`,
    `Made ${date.toISOString().slice(0, 10)}. Each photo is cropped and sized for where it goes.`,
    "",
    "WHAT'S INSIDE",
  ];
  for (const item of plan.filter((i) => i.included)) {
    const rule = item.entry.channel;
    lines.push(
      "",
      item.filename,
      `  ${item.entry.label} · ${item.entry.use} · ${item.width} × ${item.height} pixels`,
      `  Upload: ${rule ? rule.upload : "Use it on your website, online menu or printed menu."}`,
    );
    for (const check of item.checks.filter((c) => c.status === "warn"))
      lines.push(`  Check first: ${check.detail}`);
    if (rule)
      lines.push(
        `  Rules checked ${rule.verified}: ${rule.sources.join(" · ")}`,
      );
  }
  const skipped = plan.filter((i) => !i.included);
  if (skipped.length) {
    lines.push("", "NOT INCLUDED");
    for (const item of skipped)
      lines.push(
        `  ${item.entry.label}: ${(item.skipped || "").replace(/^Left out: /, "")}`,
      );
  }
  lines.push(
    "",
    "BEFORE YOU UPLOAD",
    "  Delivery apps and Google reject photos with added text, logos, borders or watermarks.",
    "  Each platform reviews photos itself and may change its rules; the links above have the latest.",
    "",
  );
  return lines.join("\n");
}

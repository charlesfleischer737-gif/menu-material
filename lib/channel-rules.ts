import {
  photoStyles,
  type PhotoBackdrop,
  type PhotoStyle,
} from "./photo-styles";

/**
 * The single source for each channel's photo rules. Downloads, photo packs
 * and catalog export limits (catalogProfiles in lib/studio.ts) all read from
 * here. Platforms change these pages often: re-check the sources and update
 * `verified` when you do.
 */
export type ChannelId = "doordash" | "uber" | "google" | "instagram" | "toast";
export type ChannelRisk = PhotoBackdrop | "staged";
export type ChannelRule = {
  id: ChannelId;
  label: string;
  kind: "delivery" | "listing" | "social" | "pos";
  /** The date these rules were last checked against the sources. */
  verified: string;
  sources: string[];
  fileTypes?: string[];
  minWidth: number;
  minHeight: number;
  maxHeight?: number;
  minBytes?: number;
  maxBytes?: number;
  orientation?: "landscape";
  /** Allowed width ÷ height, inclusive. */
  aspect?: { min: number; max: number; label: string };
  recommended?: { width: number; height: number; note: string };
  /** Sizes the platform displays, for reference (e.g. Instagram). */
  sizes?: { label: string; width: number; height: number }[];
  /** Images created only from a description are not photos of the dish. */
  realPhotoOnly: boolean;
  /** Why a backdrop or staging is likely to be rejected on this channel. */
  risky: Partial<Record<ChannelRisk, string>>;
  /** Owner-facing summary, used in upload guidance and the pack README. */
  rules: string[];
  upload: string;
};

const MB = 1024 * 1024;
const deliveryBackdrop =
  "DoorDash often rejects colorful or plain white studio backdrops.";
const googleReality =
  "Google asks for photos that represent reality, without significant alterations or excessive filters, so a studio backdrop may not be accepted.";

export const channelRules: Record<ChannelId, ChannelRule> = {
  doordash: {
    id: "doordash",
    label: "DoorDash",
    kind: "delivery",
    verified: "2026-09-24",
    sources: [
      "https://merchants.doordash.com/en-us/learning-center/photo-rejection",
      "https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained",
    ],
    minWidth: 1400,
    minHeight: 800,
    // Upload limit carried over from the 2026-09-16 catalog profile.
    maxBytes: 16 * MB,
    orientation: "landscape",
    recommended: {
      width: 1920,
      height: 1080,
      note: "Shown as a square thumbnail and a 16:9 header, so keep the dish centered.",
    },
    realPhotoOnly: true,
    risky: {
      colorful: deliveryBackdrop,
      white: deliveryBackdrop,
      dark: "DoorDash often rejects creative or heavily edited backgrounds, and a dark studio backdrop can read that way.",
      staged:
        "DoorDash wants the actual dish on its own; hands, plinths or other staging can read as a creative shot.",
    },
    rules: [
      "Landscape, at least 1400 × 800 pixels.",
      "Shown as a square thumbnail and a 16:9 header, so keep the dish centered.",
      "No text, borders, overlays or watermarks.",
      "Creative, overly colorful, transparent or white, and heavily edited backgrounds get rejected.",
      "Must show the actual dish.",
    ],
    upload:
      "In DoorDash Merchant Portal, open Menu, choose the item and add or replace its photo. If your menu comes from a POS, update it there.",
  },
  uber: {
    id: "uber",
    label: "Uber Eats",
    kind: "delivery",
    verified: "2026-09-24",
    sources: [
      "https://help.uber.com/en/merchants-and-restaurants/article/merchant-submitted-menu-catalog-photo-guidelines?nodeId=6985355b-0426-4523-94f2-89bb9b0566e9",
    ],
    fileTypes: ["JPG", "PNG"],
    // 440 px tall at the narrowest allowed shape (5:4) is 550 px wide.
    minWidth: 550,
    minHeight: 440,
    maxHeight: 10000,
    maxBytes: 10 * MB,
    aspect: { min: 5 / 4, max: 6 / 4, label: "5:4 to 6:4" },
    recommended: {
      width: 2880,
      height: 2304,
      note: "Uber Eats shows photos best at 2880 × 2304 or larger.",
    },
    realPhotoOnly: true,
    risky: {
      staged:
        "Uber Eats asks for one centered item that accurately represents the dish; hands or props can get it rejected.",
    },
    rules: [
      "JPG or PNG, up to 10 MB.",
      "440 to 10,000 pixels tall.",
      "Shape between 5:4 and 6:4 (1.25 to 1.5 wide for every 1 tall).",
      "One centered item that accurately represents the dish.",
      "No text, logos or watermarks.",
      "Best quality at 2880 × 2304 or larger.",
    ],
    upload:
      "In Uber Eats Manager, open Menu, choose the item and upload this photo for review. If your menu comes from a POS, update it there.",
  },
  google: {
    id: "google",
    label: "Google Business Profile",
    kind: "listing",
    verified: "2026-09-24",
    sources: ["https://support.google.com/business/answer/6103862"],
    fileTypes: ["JPG", "PNG"],
    minWidth: 250,
    minHeight: 250,
    minBytes: 10 * 1024,
    maxBytes: 5 * MB,
    recommended: {
      width: 720,
      height: 720,
      note: "Google recommends at least 720 × 720 pixels.",
    },
    realPhotoOnly: true,
    risky: {
      colorful: googleReality,
      white: googleReality,
      dark: googleReality,
      staged: googleReality,
    },
    rules: [
      "JPG or PNG, 10 KB to 5 MB.",
      "At least 250 × 250 pixels; 720 × 720 recommended.",
      "Photos should represent reality: no significant alterations or excessive filters.",
    ],
    upload:
      "In your Google Business Profile, choose Add photo (or Edit menu to add it to a dish), then upload this photo.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    kind: "social",
    verified: "2026-09-24",
    sources: [
      "https://9to5mac.com/2025/05/29/instagram-changes-standard-photo-aspect-ratio/",
    ],
    minWidth: 0,
    minHeight: 0,
    recommended: {
      width: 1080,
      height: 1350,
      note: "Instagram shows photos 1080 pixels wide.",
    },
    sizes: [
      { label: "Post · 4:5", width: 1080, height: 1350 },
      { label: "Post · 3:4", width: 1080, height: 1440 },
      { label: "Story · 9:16", width: 1080, height: 1920 },
    ],
    realPhotoOnly: false,
    risky: {},
    rules: [
      "Posts: 1080 × 1350 (4:5) or 1080 × 1440 (3:4).",
      "Stories: 1080 × 1920 (9:16).",
    ],
    upload:
      "Open Instagram, tap +, and choose this photo from your downloads or photo library. Add your caption and review before posting.",
  },
  toast: {
    id: "toast",
    label: "Toast",
    kind: "pos",
    verified: "2026-09-16",
    sources: [
      "https://support.toasttab.com/en/article/Adding-Images-to-Menu-Items-in-the-Menu?lang=en_US",
    ],
    minWidth: 750,
    minHeight: 450,
    maxBytes: 5 * MB,
    realPhotoOnly: true,
    risky: {},
    rules: [
      "At least 750 × 450 pixels, up to 5 MB.",
      "Toast may crop it differently across displays, so center the dish.",
    ],
    upload:
      "In Toast Web, open your item in Menu Manager, add or replace its image, then save and publish.",
  },
};

/** Which rules apply to each single-download destination. */
export function destinationChannel(destination: string): ChannelRule | null {
  if (["feed", "feed-3x4", "story"].includes(destination))
    return channelRules.instagram;
  return destination === "doordash" ||
    destination === "uber" ||
    destination === "toast" ||
    destination === "google"
    ? channelRules[destination]
    : null;
}

export type StyleProfile = {
  id: string;
  name: string;
  backdrop: PhotoBackdrop;
  staged: boolean;
  /** False when the backdrop was assumed (saved or unknown looks). */
  known: boolean;
};
type LookLike = Pick<PhotoStyle, "id" | "name"> &
  Partial<Pick<PhotoStyle, "backdrop" | "staged">>;
/**
 * The backdrop of the look behind a photo. "My restaurant look" follows the
 * restaurant's chosen preset; saved looks and unknown looks count as natural.
 */
export function styleProfile(
  look: LookLike | null | undefined,
  restaurantStyle?: { photoPreset?: string } | null,
): StyleProfile {
  if (!look)
    return {
      id: "",
      name: "Your saved look",
      backdrop: "natural",
      staged: false,
      known: false,
    };
  const preset =
    look.id === "restaurant"
      ? photoStyles.find((s) => s.id === restaurantStyle?.photoPreset)
      : null;
  const source = preset || look;
  return {
    id: look.id,
    name: look.name,
    backdrop: source.backdrop || "natural",
    staged: !!source.staged,
    known: !!source.backdrop,
  };
}

export const backdropLabels: Record<PhotoBackdrop, string> = {
  natural: "a natural setting",
  white: "a plain white or pale studio backdrop",
  colorful: "a bold colored backdrop",
  dark: "a dark, dramatic backdrop",
};
const naturalAdvice: Partial<Record<ChannelRule["kind"], string>> = {
  delivery:
    "For delivery apps, a natural setting like Neighborhood table or Polish my original works best.",
  listing:
    "For Google, Polish my original or a natural setting like Neighborhood table is the safest choice.",
  pos: "For ordering menus, a natural setting like Neighborhood table or Polish my original works best.",
};
/** A plain-language warning when a style is likely to be rejected, or null. */
export function styleWarning(
  rule: ChannelRule,
  style: StyleProfile,
): string | null {
  const backdrop = style.backdrop !== "natural" && rule.risky[style.backdrop];
  const staged = style.staged && rule.risky.staged;
  if (!backdrop && !staged) return null;
  const what = backdrop
    ? `${style.name} uses ${backdropLabels[style.backdrop]}.`
    : `${style.name} is a staged shot.`;
  return [what, backdrop || staged, naturalAdvice[rule.kind]]
    .filter(Boolean)
    .join(" ");
}

export type CheckStatus = "pass" | "warn" | "fail";
export type ChannelCheck = {
  id: "photo" | "size" | "aspect" | "file" | "backdrop";
  status: CheckStatus;
  label: string;
  detail: string;
};
const px = (width: number, height: number) =>
  `${Math.round(width).toLocaleString("en-US")} × ${Math.round(height).toLocaleString("en-US")}`;
const megabytes = (bytes: number) =>
  bytes >= MB
    ? `${Number((bytes / MB).toFixed(1))} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Does an image of this size meet the channel's minimum and recommendations? */
export function sizeCheck(
  rule: ChannelRule,
  width: number,
  height: number,
): ChannelCheck {
  if (width < rule.minWidth || height < rule.minHeight)
    return {
      id: "size",
      status: "fail",
      label: "Too small",
      detail: `${px(width, height)} pixels. ${rule.label} needs at least ${px(rule.minWidth, rule.minHeight)}; enlarging a photo doesn’t add detail.`,
    };
  if (rule.maxHeight && height > rule.maxHeight)
    return {
      id: "size",
      status: "fail",
      label: "Too tall",
      detail: `${rule.label} accepts photos up to ${rule.maxHeight.toLocaleString("en-US")} pixels tall.`,
    };
  const recommended = rule.recommended;
  const belowRecommended =
    !!recommended && (width < recommended.width || height < recommended.height);
  // Only Google's recommendation is a review concern; elsewhere it's a note.
  if (belowRecommended && rule.kind === "listing")
    return {
      id: "size",
      status: "warn",
      label: "Below recommended size",
      detail: `${px(width, height)} pixels. ${recommended.note}`,
    };
  return {
    id: "size",
    status: "pass",
    label: "Minimum size met",
    detail: `${px(width, height)} pixels.${belowRecommended ? ` ${recommended.note}` : ""}`,
  };
}
/** Is this shape accepted? Exports crop to an exact ratio, so this confirms it. */
export function aspectCheck(
  rule: ChannelRule,
  width: number,
  height: number,
): ChannelCheck | null {
  const ratio = width / height;
  if (rule.aspect) {
    const ok =
      ratio >= rule.aspect.min - 1e-9 && ratio <= rule.aspect.max + 1e-9;
    return {
      id: "aspect",
      status: ok ? "pass" : "fail",
      label: ok ? "Aspect ratio in range" : "Aspect ratio out of range",
      detail: `${ratio.toFixed(2)} wide for every 1 tall; ${rule.label} accepts ${rule.aspect.label}.`,
    };
  }
  if (rule.orientation === "landscape")
    return {
      id: "aspect",
      status: ratio > 1 ? "pass" : "fail",
      label: ratio > 1 ? "Landscape" : "Needs landscape",
      detail: `${rule.label} needs a landscape photo.`,
    };
  return null;
}
/** The encoded file's size against the channel's limits. */
export function fileCheck(rule: ChannelRule, bytes?: number): ChannelCheck {
  const limits = [
    rule.minBytes ? `at least ${megabytes(rule.minBytes)}` : "",
    rule.maxBytes ? `up to ${megabytes(rule.maxBytes)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  if (bytes === undefined)
    return {
      id: "file",
      status: "pass",
      label: "File size within limit",
      detail: limits ? `JPG, ${limits}.` : "JPG at high quality.",
    };
  const ok =
    (!rule.minBytes || bytes >= rule.minBytes) &&
    (!rule.maxBytes || bytes <= rule.maxBytes);
  return {
    id: "file",
    status: ok ? "pass" : "fail",
    label: ok ? "File size within limit" : "File size outside limit",
    detail: `${megabytes(bytes)} JPG${limits ? `; ${rule.label} accepts ${limits}` : ""}.`,
  };
}
export function backdropCheck(
  rule: ChannelRule,
  style: StyleProfile,
): ChannelCheck | null {
  if (!Object.keys(rule.risky).length) return null;
  const warning = styleWarning(rule, style);
  return warning
    ? {
        id: "backdrop",
        status: "warn",
        label: "Backdrop may be rejected",
        detail: warning,
      }
    : {
        id: "backdrop",
        status: "pass",
        label: "Natural backdrop",
        detail: style.known
          ? `${style.name} uses ${backdropLabels[style.backdrop]}.`
          : "Treated as a natural setting.",
      };
}
export function photoCheck(
  rule: ChannelRule,
  fromPhoto: boolean,
): ChannelCheck | null {
  if (!rule.realPhotoOnly) return null;
  return fromPhoto
    ? {
        id: "photo",
        status: "pass",
        label: "Real photo",
        detail: "Made from your photo of the dish.",
      }
    : {
        id: "photo",
        status: "fail",
        label: "Illustration",
        detail: `This image is an illustration created from a description. ${rule.label} needs a photo of the actual dish.`,
      };
}

/**
 * The ten Post Maker art directions. Each one owns its layout, type pairing and
 * photo treatment; the kit keeps text inside safe zones, readable on its actual
 * background, and the photo composed for the frame.
 */
import type { Row } from "./client";
import { paintMaterial } from "./template-materials";
import {
  type Box,
  type Framing,
  type PhotoAnalysis,
  type PostKit,
  type Safe,
  type TextLayout,
  type TextStyle,
  contrast,
  ensureContrast,
  hexToRgb,
  isManual,
  luminance,
  makeCanvas,
  mix,
  placePhoto,
  rgba,
  rgbToHex,
  tone,
} from "./post-kit";

export type Logo = {
  im: CanvasImageSource & { width: number; height: number };
  transparent: boolean;
  lum: number;
};
export type Design = {
  k: PostKit;
  W: number;
  H: number;
  safe: Safe;
  format: "feed" | "tall" | "story";
  slide: "single" | "cover" | "dish" | "closing";
  images: (CanvasImageSource & { width: number; height: number })[];
  analyses: PhotoAnalysis[];
  framings: Framing[];
  names: string[];
  headline: string;
  kicker: string;
  price: string;
  validity: string;
  cta: string;
  detail: string;
  itemsLine: string;
  photoOnly: boolean;
  showBrand: boolean;
  brandName: string;
  logo: Logo | null;
  primary: string;
  accent: string;
  family: (fallback: string) => string;
  placement: "auto" | "top" | "bottom";
};

/** Fonts each design draws with, so only those files load. */
export const designFonts: Record<string, string[]> = {
  editorial: ["Post Display"],
  special: ["Post Soft"],
  launch: ["Post Poster"],
  afterdark: ["Post Display Italic"],
  brunch: ["Post Soft Italic", "Post Hand"],
  bakery: ["Post Soft"],
  event: ["Post Display"],
  fresh: ["Post Grotesk"],
  combo: ["Post Poster", "Post Grotesk"],
  chef: ["Post Serif"],
};

const LABEL: TextStyle = {
  family: "Post Sans",
  weight: 600,
  size: 36,
  min: 36,
  tracking: 0.16,
  upper: true,
  maxLines: 2,
  lineHeight: 1.3,
};
const FACT: TextStyle = {
  family: "Post Sans",
  weight: 500,
  size: 40,
  min: 36,
  tracking: 0.01,
  maxLines: 3,
  lineHeight: 1.3,
};
const BODY: TextStyle = {
  family: "Post Sans",
  weight: 400,
  size: 40,
  min: 36,
  maxLines: 3,
  lineHeight: 1.32,
};
const CREAM = "#fbf6ec",
  INK = "#17140f";

function facts(d: Design, withPrice = true) {
  return [withPrice ? d.price : "", d.validity, d.cta]
    .filter(Boolean)
    .join("  ·  ");
}
function tooMuch() {
  return Error(
    "There is too much text for this design. Move the description to your caption.",
  );
}
function opt(d: Design, value: string, column: number, style: TextStyle) {
  return value ? d.k.layout(value, column, style) : null;
}
/** A layout, or null when the value doesn't fit there at a readable size. */
function fitted(d: Design, value: string, column: number, style: TextStyle) {
  try {
    return d.k.layout(value, column, style);
  } catch {
    return null;
  }
}
type Piece = {
  t: TextLayout | null;
  gap?: number;
  /** A fixed fill, for colors already checked against a flat background. */
  ink?: string | CanvasGradient;
  /** This piece's own ink choices, when it differs from the rest of the stack. */
  inks?: string[];
  /** Room kept for the piece even when it is shorter, so carousel slides line up. */
  reserve?: number;
};
/** Carousel dish slides use one headline size, so a series reads as a set. */
const brandWeight: Record<string, number> = {
  "Post Sans": 600,
  "Post Serif": 500,
  "Post Condensed": 700,
};
function titled(d: Design, style: TextStyle): TextStyle {
  const s = brandWeight[style.family]
    ? { ...style, weight: brandWeight[style.family] }
    : style;
  return d.slide === "dish"
    ? { ...s, size: Math.round(s.size * 0.8), maxLines: 2 }
    : s;
}
/** Carousel dish slides keep two lines of headline room, so every slide's photo lines up. */
function slot(d: Design, t: TextLayout | null) {
  return d.slide === "dish" && t ? t.ascent + t.advance + t.size * 0.25 : 0;
}
const size = (p: Piece) => Math.max(p.t?.height || 0, p.reserve || 0);
function stackHeight(pieces: Piece[]) {
  let h = 0,
    first = true;
  for (const p of pieces) {
    if (!p.t) continue;
    h += (first ? 0 : (p.gap ?? 24)) + size(p);
    first = false;
  }
  return h;
}
function stackBoxes(
  k: PostKit,
  pieces: Piece[],
  x: number,
  y: number,
  align: CanvasTextAlign,
) {
  const out: { box: Box; size: number; piece: Piece; y: number }[] = [];
  let first = true;
  for (const p of pieces) {
    if (!p.t) continue;
    y += first ? 0 : (p.gap ?? 24);
    out.push({ box: k.bounds(p.t, x, y, align), size: p.t.size, piece: p, y });
    y += size(p);
    first = false;
  }
  return out;
}
/** Draws a stack with one readable ink (and only as much shade as it needs). */
function drawStack(
  d: Design,
  pieces: Piece[],
  x: number,
  y: number,
  align: CanvasTextAlign,
  candidates: string[],
  scrim: "top" | "bottom" | "soft" | "band" = "soft",
  extra: { box: Box; size: number }[] = [],
) {
  const placed = stackBoxes(d.k, pieces, x, y, align);
  if (!placed.length && !extra.length) return { ink: candidates[0], placed };
  // Every ink (and any shade it needs) is settled before any text is drawn,
  // so shade added for one line can never dim another.
  const shared = placed.filter((p) => !p.piece.ink && !p.piece.inks);
  const ink =
    shared.length || extra.length
      ? d.k.ink([...shared, ...extra], candidates, scrim)
      : candidates[0];
  const own = new Map(
    placed
      .filter((p) => p.piece.inks)
      .map((p) => [p, d.k.ink([p], p.piece.inks!, scrim)] as const),
  );
  for (const p of placed)
    d.k.text(p.piece.t!, x, p.y, p.piece.ink ?? own.get(p) ?? ink, align);
  return { ink, placed };
}

/* ---------- brand lockup ---------- */
type BrandLayout = {
  t: TextLayout | null;
  logoW: number;
  logoH: number;
  h: number;
  w: number;
};
function brandLayout(
  d: Design,
  column: number,
  style: TextStyle = LABEL,
): BrandLayout | null {
  if (!d.showBrand || (!d.brandName && !d.logo)) return null;
  // A wide wordmark keeps its shape: capping its width lowers its height too.
  const ratio = d.logo ? d.logo.im.width / d.logo.im.height : 0,
    logoW = d.logo ? Math.min(220, ratio * 64) : 0,
    logoH = d.logo ? logoW / ratio : 0;
  const t = d.brandName
    ? d.k.layout(d.brandName, column - (logoW ? logoW + 22 : 0), style)
    : null;
  return {
    t,
    logoW,
    logoH,
    h: Math.max(logoH, t?.height || 0),
    w: logoW + (logoW && t ? 22 : 0) + (t?.width || 0),
  };
}
function brandBoxes(
  d: Design,
  b: BrandLayout,
  x: number,
  y: number,
  column: number,
  align: CanvasTextAlign,
) {
  const left =
    align === "center"
      ? x + (column - b.w) / 2
      : align === "right"
        ? x + column - b.w
        : x;
  const nameX = left + (b.logoW ? b.logoW + 22 : 0);
  const nameY = y + (b.h - (b.t?.height || 0)) / 2;
  return {
    left,
    nameX,
    nameY,
    logo: b.logoW
      ? { x: left, y: y + (b.h - b.logoH) / 2, w: b.logoW, h: b.logoH }
      : null,
    text: b.t
      ? { box: d.k.bounds(b.t, nameX, nameY, "left"), size: b.t.size }
      : null,
  };
}
function drawLogo(d: Design, box: Box, ink: string) {
  d.k.overlay(() => paintLogo(d, box, ink));
}
function paintLogo(d: Design, box: Box, ink: string) {
  const logo = d.logo!,
    ctx = d.k.ctx;
  const inkLum = luminance(hexToRgb(ink));
  if (logo.transparent) {
    const clash = inkLum > 0.4 ? logo.lum < 0.3 : logo.lum > 0.55;
    if (clash) {
      // A one-color logo in the text ink, so it reads on this background.
      const s = d.k.scale,
        c = makeCanvas(box.w * s, box.h * s),
        cc = c.getContext("2d")!;
      cc.drawImage(logo.im, 0, 0, c.width, c.height);
      cc.globalCompositeOperation = "source-in";
      cc.fillStyle = ink;
      cc.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(c, box.x, box.y, box.w, box.h);
    } else ctx.drawImage(logo.im, box.x, box.y, box.w, box.h);
    return;
  }
  // Opaque logos keep their own background, shaped like a small printed card.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = d.k.px(18);
  ctx.shadowOffsetY = d.k.px(4);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 12);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 12);
  ctx.clip();
  ctx.drawImage(logo.im, box.x, box.y, box.w, box.h);
  ctx.restore();
}
function drawBrand(
  d: Design,
  b: BrandLayout | null,
  x: number,
  y: number,
  column: number,
  align: CanvasTextAlign,
  candidates: string[],
  scrim: "top" | "bottom" | "soft" | "band" = "soft",
) {
  if (!b) return candidates[0];
  const at = brandBoxes(d, b, x, y, column, align);
  const ink = at.text ? d.k.ink([at.text], candidates, scrim) : candidates[0];
  if (at.logo) drawLogo(d, at.logo, ink);
  if (b.t) d.k.text(b.t, at.nameX, at.nameY, ink, "left");
  return ink;
}

/* ---------- photographs ---------- */
function groupBoxes(b: Box, n: number, gap = 14): Box[] {
  const rows = (r: Box, count: number): Box[] =>
    Array.from({ length: count }, (_, i) => ({
      x: r.x,
      y: r.y + i * ((r.h - gap * (count - 1)) / count + gap),
      w: r.w,
      h: (r.h - gap * (count - 1)) / count,
    }));
  const cols = (r: Box, count: number): Box[] =>
    Array.from({ length: count }, (_, i) => ({
      x: r.x + i * ((r.w - gap * (count - 1)) / count + gap),
      y: r.y,
      w: (r.w - gap * (count - 1)) / count,
      h: r.h,
    }));
  const portrait = b.h >= b.w * 0.8;
  if (n <= 1) return [b];
  if (n === 2) return portrait ? rows(b, 2) : cols(b, 2);
  const split = (r: Box, share: number, vertical: boolean): [Box, Box] =>
    vertical
      ? [
          { ...r, h: (r.h - gap) * share },
          {
            ...r,
            y: r.y + (r.h - gap) * share + gap,
            h: (r.h - gap) * (1 - share),
          },
        ]
      : [
          { ...r, w: (r.w - gap) * share },
          {
            ...r,
            x: r.x + (r.w - gap) * share + gap,
            w: (r.w - gap) * (1 - share),
          },
        ];
  if (n === 3) {
    const [hero, rest] = split(b, 0.58, portrait);
    return [hero, ...(portrait ? cols(rest, 2) : rows(rest, 2))];
  }
  if (n === 4) return rows(b, 2).flatMap((r) => cols(r, 2));
  if (n === 5) {
    const [a, c] = split(b, 0.5, true);
    return [...cols(a, 2), ...cols(c, 3)];
  }
  return portrait
    ? rows(b, 3).flatMap((r) => cols(r, 2))
    : rows(b, 2).flatMap((r) => cols(r, 3));
}
type PhotoOptions = Parameters<PostKit["photo"]>[4];
function photos(d: Design, box: Box, o: PhotoOptions = {}) {
  const n = d.images.length;
  if (n === 1)
    return d.k.photo(d.images[0], d.analyses[0], box, d.framings[0], {
      name: d.names[0],
      ...o,
    });
  const cells = groupBoxes(box, n);
  const radius = typeof o.radius === "number" ? Math.min(o.radius, 24) : 18;
  let first = null;
  for (const [i, cell] of cells.entries()) {
    const p = d.k.photo(d.images[i], d.analyses[i], cell, d.framings[i], {
      ...o,
      name: d.names[i],
      shape: "round",
      radius,
      keyline: undefined,
      maxCrop: 0.3,
    });
    first ||= p;
  }
  return first!;
}
function minPhoto(d: Design) {
  return d.images.length > 1 ? 380 : 420;
}
function photoBackdrop(d: Design) {
  return rgbToHex(d.analyses[0].backdrop);
}
/** A light paper that belongs with the photo: its own backdrop when that is light. */
function paperFor(d: Design, fallback: string) {
  const back = photoBackdrop(d),
    l = luminance(hexToRgb(back));
  return l > 0.55 ? mix(back, fallback, 0.45) : fallback;
}
function deepFrom(color: string, lightness = 0.14) {
  return tone(color, lightness, 0.55);
}

/* ---------- closing slide ---------- */
async function closing(
  d: Design,
  paint: () => Promise<void> | void,
  inks: string[],
  headlineFamily: string,
  headlineWeight?: number,
) {
  const { k, W, safe } = d;
  await paint();
  k.grain(0.035);
  const col = safe.right - safe.left;
  const line = k.layout(
    d.headline,
    col,
    {
      family: d.family(headlineFamily),
      weight: headlineWeight,
      size: 140,
      min: 66,
      lineHeight: 1.02,
      maxLines: 4,
    },
    (safe.bottom - safe.top) * 0.5,
  );
  const brand = brandLayout(d, col);
  const info = opt(
    d,
    [d.validity, d.cta].filter(Boolean).join("  ·  "),
    col,
    FACT,
  );
  const pieces: Piece[] = [{ t: line }, { t: info, gap: 44 }];
  const h = stackHeight(pieces) + (brand ? brand.h + 56 : 0);
  let y = safe.top + (safe.bottom - safe.top - h) / 2;
  if (brand) {
    drawBrand(d, brand, safe.left, y, col, "center", inks);
    y += brand.h + 56;
  }
  drawStack(d, pieces, safe.left, y, "center", inks);
  void W;
}

/* ---------- full-bleed photographs with words on them ---------- */
type Overlay = {
  edge: "top" | "bottom";
  kicker: TextLayout | null;
  title: TextLayout | null;
  info: TextLayout | null;
  detail: TextLayout | null;
  brand: BrandLayout | null;
  options: PhotoOptions;
  /** The photo's frame; taller than the post when the photo slides away from long words. */
  box: Box;
};
/** Plans words over a full-bleed photo: on its plain backdrop, clear of the food when possible. */
function overlayPlan(
  d: Design,
  style: TextStyle,
  prefer: "top" | "bottom",
  gaps: { title: number; after: number },
  brandInBlock: boolean,
): Overlay {
  const { k, safe } = d;
  const col = safe.right - safe.left,
    a = d.analyses[0],
    text = !d.photoOnly;
  const kicker = text ? opt(d, d.kicker, col, LABEL) : null;
  const info = text ? opt(d, facts(d), col, FACT) : null;
  const detail = text ? opt(d, d.detail, col, BODY) : null;
  const brand = brandLayout(d, col);
  const other = (flag: boolean) =>
    (kicker ? kicker.height + gaps.title : 0) +
    (detail ? detail.height + gaps.after : 0) +
    (info ? info.height + gaps.after : 0) +
    (brand && flag ? brand.h + 36 : 0);
  const plainTop = a.edges.top.plain,
    plainBottom = a.edges.bottom.plain;
  const edge: "top" | "bottom" =
    d.placement !== "auto"
      ? d.placement
      : prefer === "top"
        ? plainBottom && !plainTop
          ? "bottom"
          : "top"
        : plainTop && !plainBottom
          ? "top"
          : "bottom";
  const words = text && !!(d.headline || kicker || info || detail);
  const options: PhotoOptions = {
    anchor: { y: words ? (edge === "top" ? 1 : 0) : 0.55 },
    maxCrop: 0.25,
    minKept: words ? 0.92 : 0.8,
    minCover: 0.6,
  };
  const full = (safe.bottom - safe.top) * 0.34;
  const fit = (height: number) =>
    k.layout(d.headline, col, titled(d, style), height);
  const top = edge === "top";
  const food = a.core || a.subject;
  let box: Box = k.full;
  let title: TextLayout | null = null;
  if (text && d.headline && food && d.images.length === 1) {
    // Keep the headline off the food when the photo leaves room for it.
    const p = placePhoto(a, k.full, d.framings[0], options);
    const room = top
      ? p.y + food.y0 * p.h - 56 - safe.top - other(brandInBlock || top)
      : safe.bottom - (p.y + food.y1 * p.h + 56) - other(brandInBlock);
    // On a plain backdrop the photo may slide away from long words, trimming table, never food.
    const slide =
      p.mode === "extend" && !isManual(d.framings[0])
        ? Math.max(
            0,
            Math.min(
              p.h * 0.25,
              top ? d.H - 24 - (p.y + food.y1 * p.h) : p.y + food.y0 * p.h - 24,
            ),
          )
        : 0;
    const attempt = (height: number) => {
      try {
        return height >= 150 ? fit(Math.min(full, height)) : null;
      } catch {
        return null;
      }
    };
    title = attempt(room);
    if (!title && slide) {
      title = attempt(room + slide);
      const move = title ? Math.ceil(title.height - room) : 0;
      if (move > 0)
        box = top
          ? { x: 0, y: 0, w: d.W, h: d.H + move }
          : { x: 0, y: -move, w: d.W, h: d.H + move };
    }
    // Still crowded: show the dish a little smaller, its plain backdrop extended all round.
    const sides = a.edges.left.plain && a.edges.right.plain;
    for (
      let f = 0.92;
      !title &&
      sides &&
      p.mode === "extend" &&
      !isManual(d.framings[0]) &&
      f > 0.62;
      f -= 0.04
    ) {
      const q = placePhoto(a, k.full, d.framings[0], { ...options, shrink: f });
      title = attempt(
        top
          ? q.y + food.y0 * q.h - 56 - safe.top - other(brandInBlock || top)
          : safe.bottom - (q.y + food.y1 * q.h + 56) - other(brandInBlock),
      );
      if (title) options.shrink = f;
    }
  }
  // Clearing the food is a preference: a headline that needs more room may overlap it.
  if (text && d.headline && !title) title = fit(full);
  return { edge, kicker, title, info, detail, brand, options, box };
}

/* ---------- 1. Just the dish: an uninterrupted photograph ---------- */
async function editorial(d: Design) {
  const { k, safe } = d;
  const col = safe.right - safe.left;
  if (d.slide === "closing")
    return closing(
      d,
      () => k.fill(deepFrom(d.primary, 0.12)),
      [CREAM, INK],
      "Post Display",
    );
  const plan = overlayPlan(
    d,
    {
      family: d.family("Post Display"),
      size: 150,
      min: 66,
      lineHeight: 0.98,
      maxLines: 4,
    },
    "bottom",
    { title: 20, after: 24 },
    false,
  );
  const { kicker, title, info, detail, brand } = plan;
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 20, reserve: slot(d, title) },
    { t: detail, gap: 26 },
    { t: info, gap: 22 },
  ];
  const blockH = stackHeight(pieces);
  let edge = plan.edge;
  const photo = photos(d, plan.box, plan.options);
  if (
    blockH &&
    d.placement === "auto" &&
    photo.mode === "cover" &&
    !photo.subject &&
    d.images.length === 1
  ) {
    // On a busy photo, the words go where it is quietest.
    const top = k.busyness({ x: safe.left, y: safe.top, w: col, h: blockH });
    const bottom = k.busyness({
      x: safe.left,
      y: safe.bottom - blockH,
      w: col,
      h: blockH,
    });
    edge = top < bottom * 0.8 ? "top" : "bottom";
  }
  k.grain(0.03);
  const inks = [CREAM, INK];
  if (brand) drawBrand(d, brand, safe.left, safe.top, col, "left", inks, "top");
  if (!blockH) return;
  const y =
    edge === "top"
      ? safe.top + (brand ? brand.h + 40 : 0)
      : safe.bottom - blockH;
  drawStack(d, pieces, safe.left, y, "left", inks, edge);
}

/* ---------- 2. The daily special: a bistro poster with a price seal ---------- */
async function special(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const deep = deepFrom(d.primary, 0.15);
  const paint = () => {
    k.fill(deep);
    k.glow(W * 0.85, H * 0.08, W * 0.9, mix(d.primary, d.accent, 0.35), 0.28);
    k.glow(W * 0.05, H * 0.95, W * 0.8, "#000000", 0.35);
  };
  const cream = ensureContrast(mix(d.accent, CREAM, 0.6), deep, 7);
  const gold = ensureContrast(mix(d.accent, "#e2c48d", 0.5), deep, 5);
  if (d.slide === "closing") return closing(d, paint, [cream], "Post Soft");
  paint();
  const brand = brandLayout(d, col);
  const kicker = opt(d, d.kicker, col, LABEL);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Soft"),
          size: 132,
          min: 66,
          lineHeight: 1.02,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * (d.format === "story" ? 0.26 : 0.3),
      );
  // The price sits in a seal; one too long for it joins the other facts.
  const sealR = d.format === "story" ? 124 : 112;
  const sealPrice =
    d.price && !d.photoOnly
      ? fitted(d, d.price, sealR * 1.5, {
          family: d.family("Post Soft"),
          size: 88,
          min: 44,
          maxLines: 1,
        })
      : null;
  const info = d.photoOnly ? null : opt(d, facts(d, !sealPrice), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const pieces: Piece[] = [
    { t: kicker, ink: gold },
    { t: title, gap: 20, reserve: slot(d, title) },
    { t: detail, gap: 24 },
    { t: info, gap: 22, ink: gold },
  ];
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 36;
  const textY = y;
  y += stackHeight(pieces) + (stackHeight(pieces) ? 48 : 0);
  const bottom = d.format === "story" ? H - 150 : safe.bottom;
  const card = { x: safe.left, y, w: col, h: bottom - y };
  if (card.h < minPhoto(d)) throw tooMuch();
  photos(d, card, {
    shape: "round",
    radius: 34,
    shadow: { blur: 60, y: 26, color: "rgba(0,0,0,0.45)" },
    anchor: { y: 0.5 },
  });
  let seal: { x: number; y: number; r: number } | null = null;
  if (sealPrice) {
    const r = sealR;
    // The seal may overhang the card; its price stays inside the safe margins.
    seal = {
      x: Math.min(
        card.x + card.w - r * 0.45,
        W - 26 - r,
        safe.right - r * 0.75,
      ),
      y: card.y + r + 26,
      r,
    };
    const ctx = k.ctx;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = k.px(30);
    ctx.shadowOffsetY = k.px(12);
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(seal.x, seal.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(deep, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(seal.x, seal.y, r - 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  k.grain(0.04);
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "left", [gold, cream]);
  drawStack(d, pieces, safe.left, textY, "left", [cream]);
  if (seal && sealPrice) {
    const t = sealPrice;
    const ty = seal.y - t.height / 2;
    const ink = k.ink(
      [
        {
          box: k.bounds(t, seal.x - seal.r * 0.75, ty, "center"),
          size: t.size,
        },
      ],
      [deep, INK],
    );
    k.text(t, seal.x - seal.r * 0.75, ty, ink, "center");
  }
}

/* ---------- 3. Menu drop: an oversized poster headline ---------- */
async function launch(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const a = d.analyses[0];
  const back = photoBackdrop(d);
  if (d.slide === "closing")
    return closing(
      d,
      () => k.fill(deepFrom(d.primary, 0.2)),
      [CREAM, INK],
      "Post Poster",
    );
  const poster = (budget: number) =>
    d.photoOnly || !d.headline
      ? null
      : k.layout(
          d.headline,
          col,
          titled(d, {
            family: d.family("Post Poster"),
            size: 250,
            min: 66,
            lineHeight: 0.92,
            maxLines: 4,
            upper: true,
          }),
          budget,
        );
  const kicker = opt(d, d.kicker, col, LABEL);
  const info = d.photoOnly ? null : opt(d, facts(d), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const brand = brandLayout(d, col);
  const usable = safe.bottom - safe.top;
  const lead = (brand ? brand.h + 30 : 0) + (kicker ? kicker.height + 22 : 0);
  // With a plain backdrop the photo's own world carries the type; otherwise a color block does.
  // Carousels keep the color block on every slide, so the series reads as one.
  const single = d.images.length === 1 && d.slide === "single";
  const trial = single
    ? placePhoto(a, k.full, d.framings[0], {
        anchor: { y: 1 },
        maxCrop: 0.22,
        minKept: 0.92,
      })
    : null;
  const food = a.core || a.subject;
  const room =
    trial && trial.mode === "extend"
      ? (food ? trial.y + food.y0 * trial.h : trial.y + trial.h * 0.2) - 56
      : 0;
  const tail =
    (info ? info.height + 22 : 0) + (detail ? detail.height + 22 : 0);
  const want = usable * (d.format === "story" ? 0.3 : 0.36);
  // A poster headline needs room: lower the photo, trimming table and plate, never the food.
  const drop =
    trial && trial.mode === "extend" && food
      ? Math.max(
          0,
          Math.min(
            want - (room - safe.top - lead - tail),
            trial.h * 0.25,
            H - 24 - (trial.y + food.y1 * trial.h),
          ),
        )
      : 0;
  const open = room + drop - safe.top - lead - tail;
  if (trial && trial.mode === "extend" && open >= 200) {
    const title = poster(Math.min(open, usable * 0.42));
    photos(
      d,
      { x: 0, y: 0, w: W, h: H + drop },
      { anchor: { y: 1 }, maxCrop: 0.22, minKept: 0.92 },
    );
    k.grain(0.035);
    const inks = [INK, CREAM];
    const headInks = [
      ensureContrast(deepFrom(d.primary, 0.22), back, 3.2),
      INK,
      CREAM,
    ];
    let y = safe.top;
    if (brand) {
      drawBrand(d, brand, safe.left, y, col, "left", inks, "top");
      y += brand.h + 30;
    }
    drawStack(
      d,
      [
        { t: kicker },
        { t: title, gap: 22, inks: headInks, reserve: slot(d, title) },
        { t: detail, gap: 22 },
        { t: info, gap: 22 },
      ],
      safe.left,
      y,
      "left",
      inks,
      "top",
    );
    return;
  }
  const block =
    contrast(d.primary, CREAM) >= 3 ? d.primary : deepFrom(d.primary, 0.3);
  const title = poster(usable * (d.format === "story" ? 0.3 : 0.36));
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 22, reserve: slot(d, title) },
    { t: detail, gap: 22 },
    { t: info, gap: 22 },
  ];
  const textH = (brand ? brand.h + 30 : 0) + stackHeight(pieces);
  const split = textH ? safe.top + textH + 56 : 0;
  if (H - split < minPhoto(d)) throw tooMuch();
  k.fill(block, { x: 0, y: 0, w: W, h: split + 2 });
  k.glow(W * 0.9, split * 0.2, W * 0.7, mix(block, "#ffffff", 0.3), 0.22);
  photos(
    d,
    { x: 0, y: split, w: W, h: H - split },
    { anchor: { y: 0 }, minCover: 0.55 },
  );
  k.grain(0.035);
  const inks = [
    ensureContrast(mix(d.accent, CREAM, 0.5), block, 4.8),
    CREAM,
    INK,
  ];
  let y = safe.top;
  if (brand) {
    drawBrand(d, brand, safe.left, y, col, "left", inks);
    y += brand.h + 30;
  }
  drawStack(d, pieces, safe.left, y, "left", inks);
}

/* ---------- 4. The nightcap: a moody full-bleed photo, gold italic ---------- */
async function afterdark(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  if (d.slide === "closing")
    return closing(
      d,
      () => {
        k.fill("#120e0c");
        k.glow(W * 0.8, H * 0.2, W * 0.9, mix(d.primary, "#c4884a", 0.6), 0.35);
      },
      ["#e9cf98", CREAM],
      "Post Display Italic",
    );
  const plan = overlayPlan(
    d,
    {
      family: d.family("Post Display Italic"),
      size: 156,
      min: 66,
      lineHeight: 0.98,
      maxLines: 4,
    },
    "top",
    { title: 18, after: 30 },
    true,
  );
  const { kicker, title, info, detail, brand } = plan;
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 18, reserve: slot(d, title) },
    { t: detail, gap: 30 },
    { t: info, gap: 30 },
  ];
  const blockH = stackHeight(pieces) + (brand ? brand.h + 34 : 0);
  let edge = plan.edge;
  const photo = photos(d, plan.box, plan.options);
  if (
    blockH &&
    d.placement === "auto" &&
    photo.mode === "cover" &&
    !photo.subject &&
    d.images.length === 1
  ) {
    const top = k.darkness({ x: safe.left, y: safe.top, w: col, h: blockH });
    const bottom = k.darkness({
      x: safe.left,
      y: safe.bottom - blockH,
      w: col,
      h: blockH,
    });
    edge = bottom > top * 1.15 ? "bottom" : "top";
  }
  k.vignette(0.42, "#080605");
  k.glow(
    W * (edge === "top" ? 0.85 : 0.15),
    edge === "top" ? H * 0.06 : H * 0.94,
    W * 0.7,
    mix(d.primary, "#d59651", 0.6),
    0.2,
  );
  k.grain(0.04);
  if (!blockH) return;
  let y = edge === "top" ? safe.top : safe.bottom - blockH;
  const brandY = y;
  if (brand) y += brand.h + 34;
  const placed = stackBoxes(k, pieces, safe.left, y, "center");
  const at = brand
    ? brandBoxes(d, brand, safe.left, brandY, col, "center")
    : null;
  // One gold for the whole block, with any shade it needs laid down before the words.
  const gold = k.ink(
    [...placed, ...(at?.text ? [at.text] : [])],
    ["#d8b878"],
    edge,
  );
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "center", [gold]);
  for (const p of placed) {
    const t = p.piece.t!;
    const isTitle = t === title;
    const fill = isTitle
      ? k.linear(safe.left, p.y, safe.right, p.y + t.height, [
          [0, "#d8b878"],
          [0.35, "#f1d9a6"],
          [0.55, "#fff1cf"],
          [0.8, "#e4c68e"],
          [1, "#d8b878"],
        ])
      : t === kicker
        ? gold
        : "#f6ecdc";
    k.text(t, safe.left, p.y, fill, "center");
    if (isTitle && (info || detail))
      k.overlay(() =>
        k.rule(W / 2 - 32, p.y + t.height + 16, 64, rgba("#d8b878", 0.9), 2),
      );
  }
}

/* ---------- 5. Slow mornings: paper, an arched photo and a handwritten note ---------- */
async function brunch(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const paper = paperFor(d, mix(d.accent, "#f7f0e4", 0.7));
  const ink = ensureContrast(deepFrom(d.primary, 0.2), paper, 7.5);
  const paint = async () => {
    k.fill(paper);
    await paintMaterial(k.ctx, W, H, "paper", paper, 0.55);
    k.fill(rgba(paper, 0.42));
  };
  if (d.slide === "closing")
    return closing(d, paint, [ink, INK], "Post Soft Italic");
  await paint();
  const brand = brandLayout(d, col);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Soft Italic"),
          size: 136,
          min: 66,
          lineHeight: 1.0,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.3,
      );
  const kicker = opt(d, d.kicker, col, LABEL);
  const note = d.photoOnly
    ? null
    : opt(d, d.validity, col, {
        family: "Post Hand",
        weight: 600,
        size: 64,
        min: 48,
        maxLines: 2,
        lineHeight: 1.05,
      });
  const info = d.photoOnly
    ? null
    : opt(d, [d.price, d.cta].filter(Boolean).join("  ·  "), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 34;
  const head: Piece[] = [
    { t: kicker },
    { t: title, gap: 18, reserve: slot(d, title) },
  ];
  const headY = y;
  y += stackHeight(head) + (stackHeight(head) ? 44 : 0);
  const foot: Piece[] = [
    { t: note },
    { t: detail, gap: 14 },
    { t: info, gap: 16 },
  ];
  const footH = stackHeight(foot);
  const archW = d.format === "story" ? 820 : d.images.length > 1 ? col : 740;
  const box = {
    x: (W - archW) / 2,
    y: y + 16,
    w: archW,
    h: safe.bottom - y - 16 - (footH ? footH + 40 : 0),
  };
  if (box.h < minPhoto(d)) throw tooMuch();
  photos(d, box, {
    shape: d.images.length > 1 ? "round" : "arch",
    radius: 16,
    keyline: { color: rgba(ink, 0.5), gap: 16, width: 2 },
    shadow: { blur: 44, y: 18, color: "rgba(60,40,20,0.22)" },
    backdrop: paper,
  });
  k.grain(0.035);
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "center", [ink, INK]);
  drawStack(d, head, safe.left, headY, "center", [ink, INK]);
  if (footH)
    drawStack(d, foot, safe.left, safe.bottom - footH, "center", [ink, INK]);
}

/* ---------- 6. The morning bake: a scalloped photo over warm paper ---------- */
async function bakery(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const paper = paperFor(d, mix(d.accent, "#f8efdf", 0.72));
  const ink = ensureContrast(deepFrom(d.primary, 0.2), paper, 7.5);
  const paint = async () => {
    k.fill(paper);
    await paintMaterial(k.ctx, W, H, "paper", paper, 0.45);
    k.fill(rgba(paper, 0.5));
  };
  if (d.slide === "closing") return closing(d, paint, [ink, INK], "Post Soft");
  await paint();
  const brand = brandLayout(d, col);
  const kicker = opt(d, d.kicker, col, LABEL);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Soft"),
          size: 124,
          min: 66,
          lineHeight: 1.02,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.28,
      );
  const info = d.photoOnly ? null : opt(d, facts(d), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 18, reserve: slot(d, title) },
    { t: detail, gap: 22 },
    { t: info, gap: 22 },
  ];
  const textH =
    stackHeight(pieces) +
    (brand ? brand.h + (stackHeight(pieces) ? 30 : 0) : 0);
  const single = d.images.length === 1;
  if (d.format === "story") {
    // Words first, in the safe zone; the scalloped photo runs to the bottom edge.
    const top = safe.top + textH + (textH ? 70 : 0);
    if (H - top < minPhoto(d) + 200) throw tooMuch();
    photos(
      d,
      { x: 0, y: top, w: W, h: H - top },
      {
        shape: single ? "scallop-top" : "rect",
        anchor: { y: 0 },
        maxCrop: 0.2,
        backdrop: paper,
      },
    );
    k.grain(0.035);
    let y = safe.top;
    if (brand) {
      drawBrand(d, brand, safe.left, y, col, "center", [ink, INK]);
      y += brand.h + 30;
    }
    drawStack(d, pieces, safe.left, y, "center", [ink, INK]);
    return;
  }
  const photoH = safe.bottom - textH - (textH ? 52 : 0);
  if (photoH < minPhoto(d) + 60) throw tooMuch();
  photos(
    d,
    { x: 0, y: 0, w: W, h: photoH },
    {
      shape: single ? "scallop" : "rect",
      anchor: { y: 1 },
      maxCrop: 0.2,
      backdrop: paper,
    },
  );
  k.grain(0.035);
  let y = photoH + (textH ? 52 : 0);
  if (brand) {
    drawBrand(d, brand, safe.left, y, col, "center", [ink, INK]);
    y += brand.h + 30;
  }
  drawStack(d, pieces, safe.left, y, "center", [ink, INK]);
}

/* ---------- 7. Supper club: a dark invitation with an arched window ---------- */
async function event(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const deep = deepFrom(d.primary, 0.1);
  const gold = ensureContrast(mix(d.accent, "#d9b77a", 0.55), deep, 5);
  const cream = ensureContrast(mix(d.accent, CREAM, 0.7), deep, 8);
  const paint = async () => {
    k.fill(deep);
    await paintMaterial(k.ctx, W, H, "dark", deep, 0.5);
    k.fill(rgba(deep, 0.35));
    k.glow(W / 2, H * 0.08, W * 0.8, "#c98d52", 0.2);
  };
  if (d.slide === "closing") return closing(d, paint, [cream], "Post Display");
  await paint();
  const brand = brandLayout(d, col);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Display"),
          size: 136,
          min: 66,
          lineHeight: 1.0,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.27,
      );
  const kicker = opt(d, d.kicker, col, LABEL);
  const date = d.photoOnly
    ? null
    : opt(d, d.validity, col - 200, { ...LABEL, tracking: 0.2 });
  const info = d.photoOnly
    ? null
    : opt(d, [d.price, d.cta].filter(Boolean).join("  ·  "), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const head: Piece[] = [
    { t: kicker, ink: gold },
    { t: title, gap: 20, reserve: slot(d, title) },
  ];
  const foot: Piece[] = [{ t: detail }, { t: info, gap: 16 }];
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 36;
  const headY = y;
  y += stackHeight(head) + (stackHeight(head) ? 36 : 0);
  const dateY = y;
  if (date) y += date.height + 44;
  const footH = stackHeight(foot);
  const archW = d.format === "story" ? 780 : d.images.length > 1 ? col : 660;
  const box = {
    x: (W - archW) / 2,
    y: y + 16,
    w: archW,
    h: safe.bottom - y - 16 - (footH ? footH + 44 : 0),
  };
  if (box.h < minPhoto(d)) throw tooMuch();
  photos(d, box, {
    shape: d.images.length > 1 ? "round" : "arch",
    radius: 14,
    keyline: { color: rgba(gold, 0.85), gap: 15, width: 2 },
    shadow: { blur: 60, y: 24, color: "rgba(0,0,0,0.5)" },
    backdrop: deep,
  });
  if (date) {
    const w = date.width;
    k.overlay(() => {
      k.rule(
        safe.left + (col - w) / 2 - 90,
        dateY + date.height / 2,
        64,
        rgba(gold, 0.85),
        2,
      );
      k.rule(
        safe.left + (col + w) / 2 + 26,
        dateY + date.height / 2,
        64,
        rgba(gold, 0.85),
        2,
      );
    });
  }
  k.grain(0.04);
  if (brand)
    drawBrand(d, brand, safe.left, brandY, col, "center", [gold, cream]);
  drawStack(d, head, safe.left, headY, "center", [cream]);
  if (date)
    drawStack(d, [{ t: date }], safe.left + 100, dateY, "center", [
      gold,
      cream,
    ]);
  if (footH)
    drawStack(d, foot, safe.left, safe.bottom - footH, "center", [cream]);
}

/* ---------- 8. In season: airy color taken from the dish ---------- */
async function fresh(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const dom = rgbToHex(d.analyses[0].dominant);
  const tint = tone(mix(dom, d.accent, 0.25), 0.93, 0.45);
  const ink = ensureContrast(tone(dom, 0.2, 0.5), tint, 7.5);
  const paint = () => {
    k.fill(tint);
    k.glow(W * 0.95, H * 0.1, W * 0.9, mix(dom, "#ffffff", 0.5), 0.35);
  };
  if (d.slide === "closing")
    return closing(d, paint, [ink, INK], "Post Grotesk");
  paint();
  const brand = brandLayout(d, col);
  const kicker = opt(d, d.kicker, col, { ...LABEL });
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Grotesk"),
          size: 116,
          min: 66,
          lineHeight: 0.98,
          tracking: -0.015,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.28,
      );
  const info = d.photoOnly ? null : opt(d, facts(d), col, FACT);
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 16, reserve: slot(d, title) },
    { t: detail, gap: 22 },
    { t: info, gap: 22 },
  ];
  const textH = stackHeight(pieces);
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 30;
  const inset = 56;
  const story = d.format === "story";
  const textY = story ? y : safe.bottom - textH;
  const box = story
    ? { x: inset, y: y + textH + (textH ? 56 : 0), w: W - inset * 2, h: 0 }
    : {
        x: inset,
        y,
        w: W - inset * 2,
        h: safe.bottom - y - (textH ? textH + 48 : 0),
      };
  if (story) box.h = H - 150 - box.y;
  if (box.h < minPhoto(d)) throw tooMuch();
  photos(d, box, {
    shape: "round",
    radius: 44,
    anchor: { y: 0.5 },
    backdrop: tint,
  });
  k.grain(0.03);
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "left", [ink, INK]);
  drawStack(d, pieces, safe.left, textY, "left", [ink, INK]);
}

/* ---------- 9. A table for two: a bold offer, the price as the hero ---------- */
async function combo(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const base =
    luminance(hexToRgb(d.primary)) < 0.3 ? d.primary : deepFrom(d.primary, 0.3);
  const cream = ensureContrast(mix(d.accent, CREAM, 0.6), base, 7);
  const pop = ensureContrast(mix(d.accent, "#ffd88a", 0.4), base, 4);
  const paint = () => {
    k.fill(base);
    k.fill(
      k.linear(0, 0, W, H, [
        [0, rgba("#ffffff", 0.08)],
        [0.6, rgba("#ffffff", 0)],
        [1, rgba("#000000", 0.28)],
      ]),
    );
  };
  if (d.slide === "closing") return closing(d, paint, [cream], "Post Grotesk");
  paint();
  const brand = brandLayout(d, col);
  const kicker = opt(d, d.kicker, col, LABEL);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Grotesk"),
          size: 104,
          min: 66,
          lineHeight: 0.98,
          tracking: -0.01,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.24,
      );
  const items = d.photoOnly ? null : opt(d, d.itemsLine, col, FACT);
  // The price is the hero; one too long for that joins the other facts.
  const price =
    d.photoOnly || !d.price
      ? null
      : fitted(d, d.price, col * 0.55, {
          family: "Post Poster",
          size: 150,
          min: 66,
          maxLines: 1,
        });
  const side = d.photoOnly
    ? null
    : opt(
        d,
        [price ? "" : d.price, d.validity, d.cta].filter(Boolean).join("\n"),
        price ? col - price.width - 40 : col,
        { ...FACT, maxLines: 4 },
      );
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const head: Piece[] = [
    { t: kicker, ink: pop },
    { t: title, gap: 16, reserve: slot(d, title) },
    { t: items, gap: 18 },
    { t: detail, gap: 18 },
  ];
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 30;
  const headY = y;
  y += stackHeight(head) + (stackHeight(head) ? 40 : 0);
  const rowH = Math.max(price?.height || 0, side?.height || 0);
  const box = {
    x: safe.left,
    y,
    w: col,
    h: safe.bottom - y - (rowH ? rowH + 40 : 0),
  };
  if (box.h < minPhoto(d)) throw tooMuch();
  photos(d, box, {
    shape: "round",
    radius: 30,
    shadow: { blur: 50, y: 20, color: "rgba(0,0,0,0.35)" },
    backdrop: base,
  });
  k.grain(0.035);
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "left", [cream]);
  drawStack(d, head, safe.left, headY, "left", [cream]);
  const rowY = safe.bottom - rowH;
  if (price)
    drawStack(
      d,
      [{ t: price }],
      safe.left,
      rowY + (rowH - price.height),
      "left",
      [pop, cream],
    );
  if (side)
    drawStack(
      d,
      [{ t: side }],
      price ? safe.right - side.column : safe.left,
      rowY + (rowH - side.height),
      price ? "right" : "left",
      [cream],
    );
}

/* ---------- 10. From the pass: a quiet fine-dining editorial ---------- */
async function chef(d: Design) {
  const { k, W, H, safe } = d;
  const col = safe.right - safe.left;
  const stone = paperFor(d, "#f3efe7");
  const ink = ensureContrast(
    mix(deepFrom(d.primary, 0.12), INK, 0.6),
    stone,
    9,
  );
  if (d.slide === "closing")
    return closing(d, () => k.fill(stone), [ink, INK], "Post Serif", 500);
  k.fill(stone);
  const brand = brandLayout(d, col);
  const kicker = opt(d, d.kicker, col, LABEL);
  const title = d.photoOnly
    ? null
    : k.layout(
        d.headline,
        col,
        titled(d, {
          family: d.family("Post Serif"),
          weight: 500,
          size: 108,
          min: 66,
          lineHeight: 1.02,
          maxLines: 3,
        }),
        (safe.bottom - safe.top) * 0.25,
      );
  const info = d.photoOnly
    ? null
    : opt(d, facts(d), col, { ...LABEL, tracking: 0.12, maxLines: 3 });
  const detail = d.photoOnly ? null : opt(d, d.detail, col, BODY);
  const pieces: Piece[] = [
    { t: kicker },
    { t: title, gap: 16, reserve: slot(d, title) },
    { t: detail, gap: 24 },
    { t: info, gap: 46 },
  ];
  const textH = stackHeight(pieces);
  let y = safe.top;
  const brandY = y;
  if (brand) y += brand.h + 40;
  const story = d.format === "story";
  const frameW = d.images.length > 1 ? col : story ? 900 : 848;
  const textY = story ? y : safe.bottom - textH;
  const box = story
    ? { x: (W - frameW) / 2, y: y + textH + (textH ? 64 : 0), w: frameW, h: 0 }
    : {
        x: (W - frameW) / 2,
        y,
        w: frameW,
        h: safe.bottom - y - (textH ? textH + 54 : 0),
      };
  if (story) box.h = H - 150 - box.y;
  if (box.h < minPhoto(d)) throw tooMuch();
  photos(d, box, {
    shape: "round",
    radius: 6,
    shadow: { blur: 36, y: 16, color: "rgba(40,30,20,0.16)" },
    backdrop: stone,
  });
  k.grain(0.025);
  if (brand) drawBrand(d, brand, safe.left, brandY, col, "center", [ink, INK]);
  const out = drawStack(d, pieces, safe.left, textY, "center", [ink, INK]);
  const t = out.placed.find((p) => p.piece.t === title);
  if (t && info)
    k.overlay(() =>
      k.rule(
        W / 2 - 22,
        t.y + t.piece.t!.height + 23,
        44,
        rgba(out.ink, 0.55),
        2,
      ),
    );
}

export const designs: Record<string, (d: Design) => Promise<void>> = {
  editorial,
  special,
  launch,
  afterdark,
  brunch,
  bakery,
  event,
  fresh,
  combo,
  chef,
};
export type { Row };

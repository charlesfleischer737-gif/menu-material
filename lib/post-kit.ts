/**
 * Drawing primitives for Post Maker designs. Designs work in logical pixels
 * (1080 wide); `scale` renders the same layout smaller for thumbnails, so a
 * preview and its export always match.
 */
import type { Row } from "./client";
import { emptyAdjustments } from "./studio";

export type Box = { x: number; y: number; w: number; h: number };
export type RGB = [number, number, number];
export type Safe = { top: number; bottom: number; left: number; right: number };

/* ---------- colour ---------- */
export function hexToRgb(hex: string): RGB {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n)
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [0, 0, 0];
}
export const rgbToHex = (c: RGB) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const linear = Array.from({ length: 256 }, (_, v) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const lum3 = (r: number, g: number, b: number) =>
  0.2126 * linear[Math.round(r)] +
  0.7152 * linear[Math.round(g)] +
  0.0722 * linear[Math.round(b)];
export const luminance = (c: RGB) => lum3(c[0], c[1], c[2]);
export const ratio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const contrast = (a: string, b: string) =>
  ratio(luminance(hexToRgb(a)), luminance(hexToRgb(b)));
export function mix(a: string, b: string, t: number) {
  const x = hexToRgb(a),
    y = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => x[i] * (1 - t) + y[i] * t) as RGB);
}
export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
export function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function fromHsl(h: number, s: number, l: number): RGB {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
/** The same hue at another lightness, with saturation optionally capped. */
export function tone(hex: string, lightness: number, maxSaturation = 1) {
  const [h, s] = toHsl(hexToRgb(hex));
  return rgbToHex(fromHsl(h, Math.min(s, maxSaturation), lightness));
}
/** Moves ink away from the background until it reaches the contrast ratio. */
export function ensureContrast(ink: string, background: string, target = 4.5) {
  if (contrast(ink, background) >= target) return ink;
  const [h, s, l] = toHsl(hexToRgb(ink));
  const lighter = luminance(hexToRgb(background)) < 0.2;
  for (let step = 1; step <= 24; step++) {
    const next = rgbToHex(
      fromHsl(h, s, lighter ? l + ((1 - l) * step) / 24 : l * (1 - step / 24)),
    );
    if (contrast(next, background) >= target) return next;
  }
  return lighter ? "#ffffff" : "#000000";
}

/* ---------- canvases ---------- */
export function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
/** A canvas's 2D context; a phone out of canvas memory returns none. */
export function context2d(
  c: HTMLCanvasElement,
  settings?: CanvasRenderingContext2DSettings,
) {
  const ctx = c.getContext("2d", settings);
  if (!ctx)
    throw Error(
      "This device ran out of memory for the image. Close other tabs or apps and try again.",
    );
  return ctx;
}
/** Frees scratch canvases' pixels now; phones otherwise hold them until collected. */
export function release(...canvases: HTMLCanvasElement[]) {
  for (const c of canvases) c.width = c.height = 0;
}
type Paintable = CanvasImageSource & { width: number; height: number };

/* ---------- photo analysis ---------- */
export type Edge = "top" | "bottom" | "left" | "right";
export type EdgeStat = { color: RGB; plain: boolean };
export type PhotoAnalysis = {
  width: number;
  height: number;
  edges: Record<Edge, EdgeStat>;
  backdrop: RGB;
  /** Normalized bounds of whatever differs from a plain backdrop. */
  subject: { x0: number; y0: number; x1: number; y1: number } | null;
  /** The food itself: the subject without pale, neutral plates and cloths. */
  core: { x0: number; y0: number; x1: number; y1: number } | null;
  centroid: { x: number; y: number };
  luminance: number;
  dominant: RGB;
};
const analyses = new WeakMap<object, PhotoAnalysis>();
export function analyzePhoto(im: Paintable): PhotoAnalysis {
  const hit = analyses.get(im);
  if (hit) return hit;
  const long = 72,
    sw =
      im.width >= im.height
        ? long
        : Math.max(8, Math.round((long * im.width) / im.height)),
    sh =
      im.height > im.width
        ? long
        : Math.max(8, Math.round((long * im.height) / im.width));
  const c = makeCanvas(sw, sh),
    ctx = context2d(c, { willReadFrequently: true });
  // Averaged, not sampled: a noisy thumbnail would read smooth light falloff as detail.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(im, 0, 0, sw, sh);
  const d = ctx.getImageData(0, 0, sw, sh).data;
  release(c);
  const px = (x: number, y: number): RGB => {
    const i = (y * sw + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const dist = (a: RGB, b: RGB) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441.7;
  const depth = 3;
  function band(edge: Edge): EdgeStat & { line: RGB[] } {
    const along = edge === "top" || edge === "bottom" ? sw : sh;
    const line: RGB[] = [];
    for (let i = 0; i < along; i++) {
      const sum = [0, 0, 0];
      for (let k = 0; k < depth; k++) {
        const p =
          edge === "top"
            ? px(i, k)
            : edge === "bottom"
              ? px(i, sh - 1 - k)
              : edge === "left"
                ? px(k, i)
                : px(sw - 1 - k, i);
        sum[0] += p[0];
        sum[1] += p[1];
        sum[2] += p[2];
      }
      line.push(sum.map((v) => v / depth) as RGB);
    }
    const mean = [0, 1, 2].map(
      (k) => line.reduce((a, p) => a + p[k], 0) / line.length,
    ) as RGB;
    const spread = line.reduce((a, p) => a + dist(p, mean), 0) / line.length;
    let step = 0;
    for (let i = 1; i < line.length; i++) step += dist(line[i], line[i - 1]);
    step /= Math.max(1, line.length - 1);
    // Smooth light falloff extends cleanly; texture, props and plate rims do not.
    return { color: mean, plain: spread < 0.12 && step < 0.03, line };
  }
  const bands = {
    top: band("top"),
    bottom: band("bottom"),
    left: band("left"),
    right: band("right"),
  };
  const plainEdges = (Object.keys(bands) as Edge[]).filter(
    (e) => bands[e].plain,
  );
  const backdrop = (
    plainEdges.length ? plainEdges : (Object.keys(bands) as Edge[])
  )
    .map((e) => bands[e].color)
    .reduce(
      (a, c, _, all) => [0, 1, 2].map((k) => a[k] + c[k] / all.length) as RGB,
      [0, 0, 0] as RGB,
    );
  let subject: PhotoAnalysis["subject"] = null,
    core: PhotoAnalysis["core"] = null;
  if (plainEdges.length) {
    // The backdrop is whatever the plain edges reach through gentle steps, so a
    // table's light falloff or a soft shadow never counts as food.
    const reached = new Uint8Array(sw * sh),
      queue: number[] = [];
    const reach = (x: number, y: number) => {
      const i = y * sw + x;
      if (!reached[i]) {
        reached[i] = 1;
        queue.push(i);
      }
    };
    for (const e of plainEdges)
      for (let i = 0; i < (e === "top" || e === "bottom" ? sw : sh); i++)
        if (e === "top") reach(i, 0);
        else if (e === "bottom") reach(i, sh - 1);
        else if (e === "left") reach(0, i);
        else reach(sw - 1, i);
    while (queue.length) {
      const i = queue.pop()!,
        x = i % sw,
        y = (i - x) / sw,
        p = px(x, y);
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= sw || ny >= sh || reached[ny * sw + nx])
          continue;
        const q = px(nx, ny);
        // Shadows are grey; food is rarely both grey and a gentle step from the table.
        if (
          dist(q, p) < 0.03 &&
          (dist(q, backdrop) < 0.35 || toHsl(q)[1] < 0.2)
        )
          reach(nx, ny);
      }
    }
    const xs: number[] = [],
      ys: number[] = [],
      cxs: number[] = [],
      cys: number[] = [];
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        if (reached[y * sw + x]) continue;
        const p = px(x, y);
        let nearest = 1;
        for (const e of plainEdges) {
          const ref =
            e === "top" || e === "bottom" ? bands[e].line[x] : bands[e].line[y];
          nearest = Math.min(nearest, dist(p, ref));
        }
        if (nearest > 0.13) {
          xs.push(x);
          ys.push(y);
          // Plates and cloths are pale and neutral; the food is what must stay whole.
          const [, s, l] = toHsl(p);
          if (!(s < 0.16 && l > 0.72)) {
            cxs.push(x);
            cys.push(y);
          }
        }
      }
    const bounds = (bx: number[], by: number[]) => {
      if (bx.length < sw * sh * 0.015 || bx.length > sw * sh * 0.88)
        return null;
      const pct = (v: number[], q: number) =>
        v.sort((a, b) => a - b)[Math.floor((v.length - 1) * q)];
      // Thin garnish tips count: a headline should clear the basil leaf too.
      return {
        x0: pct(bx, 0.003) / sw,
        x1: (pct(bx, 0.997) + 1) / sw,
        y0: pct(by, 0.003) / sh,
        y1: (pct(by, 0.997) + 1) / sh,
      };
    };
    subject = bounds(xs, ys);
    core = bounds(cxs, cys) || subject;
  }
  let weight = 0,
    cx = 0,
    cy = 0,
    lumSum = 0;
  const bins = new Map<number, { n: number; c: number[] }>();
  for (let y = 1; y < sh - 1; y++)
    for (let x = 1; x < sw - 1; x++) {
      const p = px(x, y),
        q = px(x - 1, y),
        w =
          Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
      weight += w;
      cx += x * w;
      cy += y * w;
      lumSum += luminance(p);
      const [, s, l] = toHsl(p);
      if (s > 0.25 && l > 0.2 && l < 0.8) {
        const key = (p[0] >> 5) * 64 + (p[1] >> 5) * 8 + (p[2] >> 5);
        const bin = bins.get(key) || { n: 0, c: [0, 0, 0] };
        bin.n++;
        bin.c[0] += p[0];
        bin.c[1] += p[1];
        bin.c[2] += p[2];
        bins.set(key, bin);
      }
    }
  const top = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  const result: PhotoAnalysis = {
    width: im.width,
    height: im.height,
    edges: {
      top: { color: bands.top.color, plain: bands.top.plain },
      bottom: { color: bands.bottom.color, plain: bands.bottom.plain },
      left: { color: bands.left.color, plain: bands.left.plain },
      right: { color: bands.right.color, plain: bands.right.plain },
    },
    backdrop,
    subject,
    core,
    centroid: {
      x: weight ? cx / weight / (sw - 1) : 0.5,
      y: weight ? cy / weight / (sh - 1) : 0.5,
    },
    luminance: lumSum / Math.max(1, (sw - 2) * (sh - 2)),
    dominant: top
      ? (top.c.map((v) => v / top.n) as RGB)
      : ([0, 1, 2].map((k) => backdrop[k]) as RGB),
  };
  analyses.set(im, result);
  return result;
}

/* ---------- photo placement ---------- */
export type Framing = typeof emptyAdjustments & { autoFrame?: boolean };
export type Placement = {
  mode: "cover" | "extend" | "contain";
  manual: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Source pixels per output pixel at full size; above 1 the photo is enlarged. */
  enlargement: number;
  extend: Record<Edge, boolean>;
  /** Share of the dish's bounds that stays inside the frame. */
  subjectVisible: number;
  subject: Box | null;
  /** The food itself, without pale plates and cloths, when the backdrop shows it. */
  core: Box | null;
};
export function isManual(e: Framing) {
  if (e.autoFrame === false) return true;
  if (e.autoFrame === true) return false;
  return !!(
    e.fit ||
    e.x !== 50 ||
    e.y !== 50 ||
    e.zoom !== 1 ||
    (e.rotate || 0) % 360
  );
}
export function placePhoto(
  a: PhotoAnalysis,
  box: Box,
  e: Framing,
  options: {
    anchor?: { x?: number; y?: number };
    maxCrop?: number;
    extend?: boolean;
    minKept?: number;
    /** Below this share kept, a busy photo is shown whole over a soft copy of itself. */
    minCover?: number;
    /** Shows a dish on a plain backdrop smaller, the backdrop extended all round. */
    shrink?: number;
    /** Where a photo shown whole goes, such as a Story's band clear of the bars and words. */
    band?: { top: number; bottom: number };
  } = {},
): Placement {
  const iw = a.width,
    ih = a.height;
  const none = { top: false, bottom: false, left: false, right: false };
  const finish = (
    mode: Placement["mode"],
    s: number,
    x: number,
    y: number,
    manual: boolean,
    extend = none,
  ): Placement => {
    const toBox = (r: PhotoAnalysis["subject"]) =>
      r
        ? {
            x: x + r.x0 * iw * s,
            y: y + r.y0 * ih * s,
            w: (r.x1 - r.x0) * iw * s,
            h: (r.y1 - r.y0) * ih * s,
          }
        : null;
    const subject = toBox(a.subject),
      core = toBox(a.core);
    let visible = 1;
    if (core) {
      const ox = Math.max(
          0,
          Math.min(core.x + core.w, box.x + box.w) - Math.max(core.x, box.x),
        ),
        oy = Math.max(
          0,
          Math.min(core.y + core.h, box.y + box.h) - Math.max(core.y, box.y),
        );
      visible = (ox * oy) / Math.max(1, core.w * core.h);
    }
    return {
      mode,
      manual,
      x,
      y,
      w: iw * s,
      h: ih * s,
      enlargement: s,
      extend,
      subjectVisible: visible,
      subject,
      core,
    };
  };
  if (isManual(e)) {
    const s =
      (e.fit
        ? Math.min(box.w / iw, box.h / ih)
        : Math.max(box.w / iw, box.h / ih)) * (e.zoom || 1);
    return finish(
      e.fit ? "contain" : "cover",
      s,
      box.x + ((box.w - iw * s) * e.x) / 100,
      box.y + ((box.h - ih * s) * e.y) / 100,
      true,
    );
  }
  // Focus on the dish: its bounds when the backdrop is plain, otherwise where the detail is.
  const f = a.core || a.subject;
  const focus = f ? { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2 } : a.centroid;
  const cover = Math.max(box.w / iw, box.h / ih);
  const position = (s: number, axis: "x" | "y") => {
    const size = axis === "x" ? iw * s : ih * s,
      room = axis === "x" ? box.w : box.h,
      start = axis === "x" ? box.x : box.y;
    if (size <= room) return start + (room - size) / 2;
    const want = start + room / 2 - (axis === "x" ? focus.x : focus.y) * size;
    return Math.min(start, Math.max(start + room - size, want));
  };
  const kept = Math.min(box.w / (iw * cover), box.h / (ih * cover));
  if (kept >= (options.minKept ?? 0.8) || options.extend === false)
    return finish(
      "cover",
      cover,
      position(cover, "x"),
      position(cover, "y"),
      false,
    );
  const tall = box.w / iw < box.h / ih;
  const maxCrop = options.maxCrop ?? 0.2;
  if (tall) {
    const sides =
      (options.shrink ?? 1) < 1 && a.edges.left.plain && a.edges.right.plain;
    const s =
      Math.min(cover, box.w / (iw * (1 - maxCrop))) *
      (sides ? options.shrink! : 1);
    const ph = ih * s,
      free = box.h - ph;
    if (free < box.h * 0.05 && !sides)
      return finish(
        "cover",
        cover,
        position(cover, "x"),
        position(cover, "y"),
        false,
      );
    const tryAnchor = (anchor: number) => {
      const y = box.y + free * anchor;
      const top = y > box.y + 0.5,
        bottom = y + ph < box.y + box.h - 0.5;
      return (!top || a.edges.top.plain) && (!bottom || a.edges.bottom.plain)
        ? { y, top, bottom }
        : null;
    };
    const preferred = options.anchor?.y ?? 0.5;
    const fit =
      tryAnchor(preferred) ||
      (a.edges.top.plain ? tryAnchor(1) : null) ||
      (a.edges.bottom.plain ? tryAnchor(0) : null);
    if (fit) {
      const x = position(s, "x");
      return finish("extend", s, x, fit.y, false, {
        ...none,
        top: fit.top,
        bottom: fit.bottom,
        left: sides && x > box.x + 0.5,
        right: sides && x + iw * s < box.x + box.w - 0.5,
      });
    }
  } else {
    const s = Math.min(cover, box.h / (ih * (1 - maxCrop)));
    const pw = iw * s,
      free = box.w - pw;
    if (free < box.w * 0.05)
      return finish(
        "cover",
        cover,
        position(cover, "x"),
        position(cover, "y"),
        false,
      );
    const tryAnchor = (anchor: number) => {
      const x = box.x + free * anchor;
      const left = x > box.x + 0.5,
        right = x + pw < box.x + box.w - 0.5;
      return (!left || a.edges.left.plain) && (!right || a.edges.right.plain)
        ? { x, left, right }
        : null;
    };
    const fit =
      tryAnchor(options.anchor?.x ?? 0.5) ||
      (a.edges.left.plain ? tryAnchor(1) : null) ||
      (a.edges.right.plain ? tryAnchor(0) : null);
    if (fit)
      return finish("extend", s, fit.x, position(s, "y"), false, {
        ...none,
        left: fit.left,
        right: fit.right,
      });
  }
  if (kept < (options.minCover ?? 0)) {
    const top = Math.max(box.y, options.band?.top ?? box.y),
      room =
        Math.min(box.y + box.h, options.band?.bottom ?? box.y + box.h) - top;
    const s = Math.min(box.w / iw, room / ih);
    return finish(
      "contain",
      s,
      box.x + (box.w - iw * s) * (options.anchor?.x ?? 0.5),
      top + (room - ih * s) * (options.anchor?.y ?? 0.5),
      false,
    );
  }
  return finish(
    "cover",
    cover,
    position(cover, "x"),
    position(cover, "y"),
    false,
  );
}

/* ---------- shapes ---------- */
export type Shape =
  "rect" | "round" | "arch" | "circle" | "scallop" | "scallop-top";
export function shapePath(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  b: Box,
  radius: number | number[] = 0,
) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.ellipse(
      b.x + b.w / 2,
      b.y + b.h / 2,
      b.w / 2,
      b.h / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else if (shape === "arch") {
    const r = Math.min(b.w / 2, b.h);
    ctx.roundRect(b.x, b.y, b.w, b.h, [
      r,
      r,
      Number(radius) || 0,
      Number(radius) || 0,
    ]);
  } else if (shape === "scallop" || shape === "scallop-top") {
    // A baker's-box edge of half circles, along the bottom or the top.
    const count = Math.max(6, Math.round(b.w / 96)),
      step = b.w / count,
      r = step / 2;
    if (shape === "scallop") {
      const base = b.y + b.h - r;
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, base);
      for (let i = count - 1; i >= 0; i--)
        ctx.arc(b.x + i * step + r, base, r, 0, Math.PI, false);
    } else {
      const base = b.y + r;
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x, base);
      for (let i = 0; i < count; i++)
        ctx.arc(b.x + i * step + r, base, r, Math.PI, Math.PI * 2, false);
      ctx.lineTo(b.x + b.w, b.y + b.h);
    }
    ctx.closePath();
  } else if (shape === "round") {
    ctx.roundRect(b.x, b.y, b.w, b.h, radius);
  } else ctx.rect(b.x, b.y, b.w, b.h);
}

/* ---------- text ---------- */
export type TextStyle = {
  family: string;
  weight?: number;
  size: number;
  min?: number;
  lineHeight?: number;
  /** Letter spacing in ems. */
  tracking?: number;
  upper?: boolean;
  maxLines?: number;
  balance?: boolean;
};
export type TextLayout = {
  value: string;
  lines: string[];
  widths: number[];
  size: number;
  font: string;
  spacing: number;
  width: number;
  column: number;
  height: number;
  ascent: number;
  descent: number;
  advance: number;
};
const shippedWeight: Record<string, number> = {
  "Post Sans": 500,
  "Post Condensed": 700,
  "Post Serif": 500,
  "Post Italic": 500,
  "Post Hand": 600,
  "Post Display": 400,
  "Post Display Italic": 400,
  "Post Poster": 400,
  "Post Soft": 600,
  "Post Soft Italic": 500,
  "Post Grotesk": 700,
};
const fallbackFor: Record<string, string> = {
  "Post Display": '"Post Serif", serif',
  "Post Display Italic": '"Post Italic", serif',
  "Post Serif": "serif",
  "Post Italic": "serif",
  "Post Soft": '"Post Serif", serif',
  "Post Soft Italic": '"Post Italic", serif',
};
export function fontString(family: string, size: number, weight?: number) {
  const w = weight ?? shippedWeight[family] ?? 400;
  return `${w} ${Math.round(size * 100) / 100}px "${family}", ${fallbackFor[family] || '"Post Sans", sans-serif'}`;
}
export function tooLong(value: string) {
  const quote =
    value.length > 48
      ? `${value.slice(0, 48).replace(/[\s,.;:–—-]+\S*$/, "")}…`
      : value;
  return Error(
    `“${quote}” is too long to read comfortably. Shorten it or move details to the caption.`,
  );
}
// Chinese, Japanese, Thai and their neighbours don't space their words, so a
// run of them breaks between the words the platform's segmenter finds.
const spaceless =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "word" })
    : null;
function parts(word: string) {
  if (!segmenter || !spaceless.test(word)) return [word];
  const out: string[] = [];
  // Punctuation stays with the word before it.
  for (const { segment, isWordLike } of segmenter.segment(word))
    if (out.length && !isWordLike) out[out.length - 1] += segment;
    else out.push(segment);
  return out;
}
function wrap(
  text: string,
  width: number,
  measure: (s: string) => number,
  breakWords: boolean,
): string[] | null {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean))
      for (const [n, part] of parts(word).entries()) {
        const candidate = line ? line + (n ? "" : " ") + part : part;
        if (measure(candidate) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
        if (measure(part) <= width) {
          line = part;
          continue;
        }
        if (!breakWords) return null;
        for (const char of part) {
          if (line && measure(line + char) > width) {
            lines.push(line);
            line = "";
          }
          line += char;
        }
      }
    if (line) lines.push(line);
  }
  return lines;
}

/* ---------- the kit ---------- */
export type Scrim = "top" | "bottom" | "soft" | "band";
/** A scrim is solid this far past the words, then fades out over `scrimFade`. */
const scrimPad = 40,
  scrimFade = 220,
  scrimBlur = 26;
export class PostKit {
  readonly ctx: CanvasRenderingContext2D;
  readonly textBoxes: Row[] = [];
  readonly photoBoxes: Row[] = [];
  /** Where the food sits in each photo drawn, so words can keep their shade off it. */
  readonly dishBoxes: Box[] = [];
  readonly renderedText: string[] = [];
  readonly warnings: string[] = [];
  private tracking: boolean;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly W: number,
    readonly H: number,
    readonly scale: number,
    readonly safe: Safe,
  ) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    this.ctx = context2d(canvas);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.tracking = "letterSpacing" in this.ctx;
  }
  /** Converts logical lengths for filters and shadows, which ignore transforms. */
  px(n: number) {
    return n * this.scale;
  }
  fill(color: string | CanvasGradient | CanvasPattern, b: Box = this.full) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  get full(): Box {
    return { x: 0, y: 0, w: this.W, h: this.H };
  }
  linear(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: [number, string][],
  ) {
    const g = this.ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [at, c] of stops)
      g.addColorStop(Math.max(0, Math.min(1, at)), c);
    return g;
  }
  glow(x: number, y: number, radius: number, color: string, alpha = 0.5) {
    const g = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(1, rgba(color, 0));
    this.fill(g, {
      x: x - radius,
      y: y - radius,
      w: radius * 2,
      h: radius * 2,
    });
  }
  rule(x: number, y: number, w: number, color: string, thickness = 2) {
    this.fill(color, { x, y, w, h: thickness });
  }

  /* text */
  private setSpacing(px: number) {
    if (this.tracking)
      (
        this.ctx as CanvasRenderingContext2D & { letterSpacing: string }
      ).letterSpacing = `${Math.round(px * 100) / 100}px`;
  }
  private width(s: string, spacing: number) {
    const w = this.ctx.measureText(s).width;
    if (!spacing) return w;
    // Trailing spacing after the last letter is not part of the visible line.
    return this.tracking
      ? w - spacing
      : w + spacing * (Array.from(s).length - 1);
  }
  layout(
    value: string,
    column: number,
    style: TextStyle,
    maxHeight = Infinity,
  ): TextLayout {
    const text = (style.upper ? value.toLocaleUpperCase() : value).trim();
    const min = Math.min(style.min ?? 36, style.size),
      maxLines = style.maxLines ?? 5,
      lh = style.lineHeight ?? 1.08;
    const attempt = (size: number, breakWords: boolean): TextLayout | null => {
      const font = fontString(style.family, size, style.weight);
      const spacing = (style.tracking || 0) * size;
      this.ctx.font = font;
      this.setSpacing(spacing);
      const measure = (s: string) => this.width(s, spacing);
      const lines = wrap(text, column, measure, breakWords);
      if (!lines?.length || lines.length > maxLines) return null;
      const first = this.ctx.measureText(lines[0]),
        last = this.ctx.measureText(lines[lines.length - 1]);
      const ascent = first.actualBoundingBoxAscent ?? size * 0.72,
        descent = last.actualBoundingBoxDescent ?? size * 0.2,
        advance = size * lh;
      const height = ascent + (lines.length - 1) * advance + descent;
      if (height > maxHeight + 0.5) return null;
      const widths = lines.map(measure);
      return {
        value,
        lines,
        widths,
        size,
        font,
        spacing,
        width: Math.max(...widths),
        column,
        height,
        ascent,
        descent,
        advance,
      };
    };
    let best = attempt(min, false);
    if (!best) {
      best = attempt(min, true);
      if (!best) throw tooLong(value);
      this.setSpacing(0);
      return best;
    }
    let lo = min,
      hi = Math.max(min, Math.floor(style.size));
    const top = attempt(hi, false);
    if (top) best = top;
    else {
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const at = attempt(mid, false);
        if (at) {
          lo = mid;
          best = at;
        } else hi = mid;
      }
    }
    if (style.balance !== false && best.lines.length > 1) {
      // Keep the line count, but even out the lengths.
      const measure = (s: string) => this.width(s, best!.spacing);
      this.ctx.font = best.font;
      this.setSpacing(best.spacing);
      const count = best.lines.length;
      let lo2 = column * 0.4,
        hi2 = column;
      for (let i = 0; i < 14; i++) {
        const mid = (lo2 + hi2) / 2,
          lines = wrap(text, mid, measure, false);
        if (lines && lines.length <= count) hi2 = mid;
        else lo2 = mid;
      }
      const balanced = wrap(text, hi2, measure, false);
      if (balanced && balanced.length === count) {
        best = {
          ...best,
          lines: balanced,
          widths: balanced.map(measure),
          ascent:
            this.ctx.measureText(balanced[0]).actualBoundingBoxAscent ??
            best.ascent,
          descent:
            this.ctx.measureText(balanced[count - 1])
              .actualBoundingBoxDescent ?? best.descent,
        };
        best.width = Math.max(...best.widths);
        best.height = best.ascent + (count - 1) * best.advance + best.descent;
      }
    }
    this.setSpacing(0);
    return best;
  }
  /** The ink bounds a layout would occupy, without drawing it. */
  bounds(
    t: TextLayout,
    x: number,
    y: number,
    align: CanvasTextAlign = "left",
  ): Box {
    const left =
      align === "center"
        ? x + (t.column - t.width) / 2
        : align === "right"
          ? x + t.column - t.width
          : x;
    return { x: left, y, w: t.width, h: t.height };
  }
  /**
   * Places text. Drawing waits for flush(), so every shade and scrim is laid
   * down first and text is always the top layer.
   */
  text(
    t: TextLayout,
    x: number,
    y: number,
    color: string | CanvasGradient,
    align: CanvasTextAlign = "left",
  ): Box {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = t.font;
    this.setSpacing(t.spacing);
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    const lines = t.lines.map((line, i) => {
      const w = t.widths[i],
        lx =
          align === "center"
            ? x + (t.column - w) / 2
            : align === "right"
              ? x + t.column - w
              : x,
        base = y + t.ascent + i * t.advance;
      const m = ctx.measureText(line);
      x0 = Math.min(x0, lx - Math.max(0, m.actualBoundingBoxLeft ?? 0));
      x1 = Math.max(x1, lx + Math.max(w, m.actualBoundingBoxRight ?? w));
      y0 = Math.min(y0, base - (m.actualBoundingBoxAscent ?? t.size * 0.72));
      y1 = Math.max(y1, base + (m.actualBoundingBoxDescent ?? t.size * 0.2));
      return { line, lx, base };
    });
    this.setSpacing(0);
    ctx.restore();
    this.overlay(() => {
      ctx.save();
      ctx.font = t.font;
      this.setSpacing(t.spacing);
      ctx.fillStyle = color;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      for (const { line, lx, base } of lines)
        if (this.tracking || !t.spacing) ctx.fillText(line, lx, base);
        else {
          let cx = lx;
          for (const char of Array.from(line)) {
            ctx.fillText(char, cx, base);
            cx += ctx.measureText(char).width + t.spacing;
          }
        }
      this.setSpacing(0);
      ctx.restore();
    });
    const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    this.textBoxes.push({
      value: t.value,
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      fontSize: t.size,
    });
    this.renderedText.push(t.value);
    return box;
  }
  private queue: (() => void)[] = [];
  /** Draws something above every shade: text, logos and the rules beside them. */
  overlay(draw: () => void) {
    this.queue.push(draw);
  }
  flush() {
    for (const draw of this.queue.splice(0)) draw();
  }

  /* pixels and legibility */
  private sample(b: Box) {
    const s = this.scale;
    const x = Math.max(0, Math.floor(b.x * s)),
      y = Math.max(0, Math.floor(b.y * s)),
      w = Math.min(this.canvas.width - x, Math.ceil(b.w * s)),
      h = Math.min(this.canvas.height - y, Math.ceil(b.h * s));
    if (w <= 0 || h <= 0) return { mean: 0, spread: 0 };
    const d = this.ctx.getImageData(x, y, w, h).data;
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000))) * 4;
    let n = 0,
      sum = 0,
      sq = 0;
    for (let i = 0; i < d.length; i += step) {
      const l = lum3(d[i], d[i + 1], d[i + 2]);
      sum += l;
      sq += l * l;
      n++;
    }
    const mean = sum / n;
    return { mean, spread: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
  }
  /** How much a region varies: text reads best where this is low. */
  busyness(b: Box) {
    return this.sample(b).spread;
  }
  /** How dark a region is, from 0 (white) to 1 (black). */
  darkness(b: Box) {
    return 1 - this.sample(b).mean;
  }
  private extremes(b: Box) {
    const s = this.scale;
    const x = Math.max(0, Math.floor((b.x - 3) * s)),
      y = Math.max(0, Math.floor((b.y - 3) * s)),
      w = Math.min(this.canvas.width - x, Math.ceil((b.w + 6) * s)),
      h = Math.min(this.canvas.height - y, Math.ceil((b.h + 6) * s));
    if (w <= 0 || h <= 0) return null;
    const d = this.ctx.getImageData(x, y, w, h).data;
    let hi = -1,
      lo = 2,
      bright: RGB = [0, 0, 0],
      dark: RGB = [255, 255, 255];
    for (let i = 0; i < d.length; i += 4) {
      const l = lum3(d[i], d[i + 1], d[i + 2]);
      if (l > hi) {
        hi = l;
        bright = [d[i], d[i + 1], d[i + 2]];
      }
      if (l < lo) {
        lo = l;
        dark = [d[i], d[i + 1], d[i + 2]];
      }
    }
    return { bright, dark, hi, lo };
  }
  /** Chooses the most readable ink and adds only as much local shade as it needs. */
  ink(
    blocks: { box: Box; size: number }[],
    candidates: string[],
    scrim: Scrim = "soft",
    shade = { dark: "#0d0b09", light: "#fbf8f1" },
  ) {
    return this.settle(blocks, candidates, scrim, shade)!;
  }
  /**
   * Like ink(), but the shade laid over the food (dishBoxes) stays at or under
   * `limit`. Returns null, drawing nothing, when no ink reads within it;
   * `draw: false` only asks.
   */
  inkOffFood(
    blocks: { box: Box; size: number }[],
    candidates: string[],
    scrim: Scrim,
    limit = 0.6,
    draw = true,
  ) {
    return this.settle(blocks, candidates, scrim, undefined, { limit, draw });
  }
  private settle(
    blocks: { box: Box; size: number }[],
    candidates: string[],
    scrim: Scrim,
    shade = { dark: "#0d0b09", light: "#fbf8f1" },
    food?: { limit: number; draw: boolean },
  ): string | null {
    const need = (size: number) => ((size * 320) / 1080 >= 24 ? 3 : 4.5) * 1.1;
    const check = () =>
      blocks.map((b) => ({ need: need(b.size), e: this.extremes(b.box) }));
    const worst = (ink: string, list: ReturnType<typeof check>) => {
      const li = luminance(hexToRgb(ink));
      return Math.min(
        ...list.map((b) =>
          b.e ? Math.min(ratio(li, b.e.hi), ratio(li, b.e.lo)) / b.need : 9,
        ),
      );
    };
    let state = check();
    for (const ink of candidates) if (worst(ink, state) >= 1) return ink;
    // The ink needing the least shade wins; shade is computed on the actual pixels.
    const alphaFor = (ink: string, list: ReturnType<typeof check>) => {
      const li = luminance(hexToRgb(ink)),
        light = li > 0.3,
        sc = hexToRgb(light ? shade.dark : shade.light);
      let alpha = 0;
      for (const b of list) {
        if (!b.e) continue;
        const p = light ? b.e.bright : b.e.dark;
        let lo = 0,
          hi = 1;
        const ok = (a: number) =>
          ratio(
            li,
            lum3(
              p[0] * (1 - a) + sc[0] * a,
              p[1] * (1 - a) + sc[1] * a,
              p[2] * (1 - a) + sc[2] * a,
            ),
          ) >= b.need;
        if (ok(0)) continue;
        for (let i = 0; i < 16; i++) {
          const mid = (lo + hi) / 2;
          if (ok(mid)) hi = mid;
          else lo = mid;
        }
        alpha = Math.max(alpha, hi);
      }
      return { alpha, color: light ? shade.dark : shade.light };
    };
    // A pale haze over food looks cheap: light shading has to earn its place.
    const cost = (a: { alpha: number; color: string }) =>
      a.color === shade.light ? a.alpha * 1.6 + 0.08 : a.alpha;
    const boxes = blocks.map((b) => b.box);
    // The share of the scrim that would fall on the food, where that is limited.
    const reach = food
      ? Math.max(0, ...this.dishBoxes.map((d) => this.reach(boxes, scrim, d)))
      : 0;
    let choice: { ink: string; alpha: number; color: string } | null = null;
    for (const ink of candidates) {
      const a = alphaFor(ink, state);
      if (food && Math.min(1, a.alpha + 0.02) * reach > food.limit) continue;
      if (!choice || cost(a) < cost(choice)) choice = { ink, ...a };
    }
    if (!choice || (food && !food.draw)) return choice?.ink ?? null;
    let laid = 0;
    for (let round = 0; round < 4 && choice.alpha > 0; round++) {
      let alpha = Math.min(1, choice.alpha + 0.02);
      if (food && reach)
        alpha = Math.min(alpha, (1 - (1 - food.limit) / (1 - laid)) / reach);
      if (alpha <= 0) break;
      this.scrim(boxes, choice.color, alpha, scrim);
      laid = 1 - (1 - laid) * (1 - alpha * reach);
      state = check();
      if (worst(choice.ink, state) >= 1) break;
      choice = { ...choice, ...alphaFor(choice.ink, state) };
    }
    return choice.ink;
  }
  /** The share of a scrim's alpha that reaches the most shaded point of `target`. */
  private reach(boxes: Box[], mode: Scrim, target: Box) {
    const y0 = Math.min(...boxes.map((b) => b.y)),
      y1 = Math.max(...boxes.map((b) => b.y + b.h));
    const past = (d: number) => Math.min(1, Math.max(0, 1 - d / scrimFade)),
      above = y0 - scrimPad - (target.y + target.h),
      below = target.y - (y1 + scrimPad);
    if (mode === "top") return past(below);
    if (mode === "bottom") return past(above);
    if (mode === "band") return past(Math.max(above, below));
    // A soft scrim is a blurred card around the words.
    const x0 = Math.min(...boxes.map((b) => b.x)),
      x1 = Math.max(...boxes.map((b) => b.x + b.w)),
      p = scrimBlur * 3;
    return target.x < x1 + p &&
      target.x + target.w > x0 - p &&
      target.y < y1 + p &&
      target.y + target.h > y0 - p
      ? 1
      : 0;
  }
  scrim(boxes: Box[], color: string, alpha: number, mode: Scrim) {
    const x0 = Math.min(...boxes.map((b) => b.x)),
      y0 = Math.min(...boxes.map((b) => b.y)),
      x1 = Math.max(...boxes.map((b) => b.x + b.w)),
      y1 = Math.max(...boxes.map((b) => b.y + b.h));
    const ctx = this.ctx,
      pad = scrimPad,
      fade = scrimFade;
    ctx.save();
    if (mode === "top") {
      const end = y1 + pad;
      this.fill(
        this.linear(0, 0, 0, end + fade, [
          [0, rgba(color, alpha)],
          [end / (end + fade), rgba(color, alpha)],
          [1, rgba(color, 0)],
        ]),
        { x: 0, y: 0, w: this.W, h: end + fade },
      );
    } else if (mode === "bottom") {
      const start = y0 - pad;
      this.fill(
        this.linear(0, start - fade, 0, this.H, [
          [0, rgba(color, 0)],
          [fade / (this.H - start + fade), rgba(color, alpha)],
          [1, rgba(color, alpha)],
        ]),
        { x: 0, y: start - fade, w: this.W, h: this.H - start + fade },
      );
    } else if (mode === "band") {
      const a = y0 - pad,
        b = y1 + pad,
        total = b - a + fade * 2;
      this.fill(
        this.linear(0, a - fade, 0, b + fade, [
          [0, rgba(color, 0)],
          [fade / total, rgba(color, alpha)],
          [1 - fade / total, rgba(color, alpha)],
          [1, rgba(color, 0)],
        ]),
        { x: 0, y: a - fade, w: this.W, h: total },
      );
    } else {
      const sigma = scrimBlur,
        p = sigma * 3;
      ctx.filter = `blur(${this.px(sigma)}px)`;
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.roundRect(x0 - p, y0 - p, x1 - x0 + p * 2, y1 - y0 + p * 2, p);
      ctx.fill();
    }
    ctx.restore();
  }

  /* finish */
  grain(amount = 0.05, seed = 7) {
    const size = 256,
      tile = makeCanvas(size, size),
      tc = context2d(tile);
    const data = tc.createImageData(size, size);
    let s = seed >>> 0;
    const random = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < data.data.length; i += 4) {
      const v = 128 + (random() - 0.5) * 255;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    tc.putImageData(data, 0, 0);
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    release(tile);
  }
  vignette(strength = 0.25, color = "#000000") {
    const g = this.ctx.createRadialGradient(
      this.W / 2,
      this.H * 0.48,
      Math.min(this.W, this.H) * 0.42,
      this.W / 2,
      this.H * 0.48,
      Math.hypot(this.W, this.H) * 0.62,
    );
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, strength));
    this.fill(g);
  }

  /* photos */
  photo(
    im: Paintable,
    a: PhotoAnalysis,
    box: Box,
    framing: Framing,
    o: {
      name?: string;
      shape?: Shape;
      radius?: number | number[];
      shadow?: { blur: number; y: number; color: string };
      keyline?: { color: string; gap: number; width?: number };
      anchor?: { x?: number; y?: number };
      maxCrop?: number;
      extend?: boolean;
      minKept?: number;
      minCover?: number;
      shrink?: number;
      band?: { top: number; bottom: number };
      fade?: { top?: number; bottom?: number };
      backdrop?: string;
      quiet?: boolean;
    } = {},
  ): Placement {
    const p = placePhoto(a, box, framing, o);
    // The food's visible bounds; a busy photo, which can't show them, by its detail.
    const food = p.core || {
      x: p.x + (a.centroid.x - 0.25) * p.w,
      y: p.y + (a.centroid.y - 0.25) * p.h,
      w: p.w / 2,
      h: p.h / 2,
    };
    const fx = Math.max(food.x, box.x),
      fy = Math.max(food.y, box.y),
      fw = Math.min(food.x + food.w, box.x + box.w) - fx,
      fh = Math.min(food.y + food.h, box.y + box.h) - fy;
    if (fw > 0 && fh > 0) this.dishBoxes.push({ x: fx, y: fy, w: fw, h: fh });
    const s = this.scale,
      ctx = this.ctx;
    const layer = makeCanvas(box.w * s, box.h * s),
      lc = context2d(layer);
    // Scratch canvases are freed when the photo is placed.
    const scratch = [layer];
    lc.imageSmoothingEnabled = true;
    lc.imageSmoothingQuality = "high";
    lc.setTransform(s, 0, 0, s, -box.x * s, -box.y * s);
    const filter =
      framing.brightness !== 100 || framing.contrast !== 100
        ? `brightness(${framing.brightness}%) contrast(${framing.contrast}%)`
        : "none";
    if (p.mode === "extend" || p.mode === "contain") {
      const plainAll = (["top", "bottom", "left", "right"] as Edge[]).every(
        (e) => a.edges[e].plain,
      );
      // The photo's own backdrop underlies any extension; the design's color never shows through.
      lc.fillStyle = rgbToHex(a.backdrop);
      lc.fillRect(box.x, box.y, box.w, box.h);
      if (p.mode === "extend" || plainAll) {
        // Smear the photo's own edge rows outward, then soften them into a backdrop.
        const smear = makeCanvas(box.w * s, box.h * s),
          sc = context2d(smear);
        scratch.push(smear);
        sc.setTransform(s, 0, 0, s, -box.x * s, -box.y * s);
        sc.fillStyle = rgbToHex(a.backdrop);
        sc.fillRect(box.x, box.y, box.w, box.h);
        const band = 4 / p.enlargement;
        const sy = (sy0: number, dy: number, dh: number) =>
          sc.drawImage(im, 0, sy0, a.width, band, p.x, dy, p.w, dh);
        const sx = (sx0: number, dx: number, dw: number) =>
          sc.drawImage(im, sx0, 0, band, a.height, dx, p.y, dw, p.h);
        if (p.y > box.y) sy(0, box.y - 60, p.y - box.y + 64);
        if (p.y + p.h < box.y + box.h)
          sy(a.height - band, p.y + p.h - 4, box.y + box.h - p.y - p.h + 64);
        if (p.x > box.x) sx(0, box.x - 60, p.x - box.x + 64);
        if (p.x + p.w < box.x + box.w)
          sx(a.width - band, p.x + p.w - 4, box.x + box.w - p.x - p.w + 64);
        lc.save();
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.filter = `blur(${this.px(34)}px)`;
        lc.drawImage(smear, 0, 0);
        lc.drawImage(smear, 0, 0);
        lc.restore();
      } else {
        lc.save();
        // A deep mat in the dish's own color under a blurred copy of the photo, so the whole
        // photo sits on it like a print and pale plates never turn the surround grey.
        lc.fillStyle = tone(rgbToHex(a.dominant), 0.13, 0.55);
        lc.fillRect(box.x, box.y, box.w, box.h);
        lc.globalAlpha = 0.55;
        lc.filter = `blur(${this.px(60)}px) brightness(0.5) saturate(1.2)`;
        const cover = Math.max(box.w / a.width, box.h / a.height);
        lc.drawImage(
          im,
          box.x + (box.w - a.width * cover) / 2 - 40,
          box.y + (box.h - a.height * cover) / 2 - 40,
          a.width * cover + 80,
          a.height * cover + 80,
        );
        lc.filter = "none";
        lc.globalAlpha = 1;
        const cx = box.x + box.w / 2,
          cy = box.y + box.h / 2;
        const v = lc.createRadialGradient(
          cx,
          cy,
          Math.min(box.w, box.h) * 0.3,
          cx,
          cy,
          Math.hypot(box.w, box.h) * 0.6,
        );
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, "rgba(0,0,0,0.45)");
        lc.fillStyle = v;
        lc.fillRect(box.x, box.y, box.w, box.h);
        lc.restore();
      }
      // The photo itself, feathered only where it meets the extension.
      const ph = makeCanvas(p.w * s, p.h * s),
        pc = context2d(ph);
      scratch.push(ph);
      pc.imageSmoothingEnabled = true;
      pc.imageSmoothingQuality = "high";
      pc.filter = filter;
      pc.drawImage(im, 0, 0, ph.width, ph.height);
      pc.filter = "none";
      const room = {
        top: p.y - box.y,
        bottom: box.y + box.h - p.y - p.h,
        left: p.x - box.x,
        right: box.x + box.w - p.x - p.w,
      };
      const feather = (edge: Edge, most = 150) => {
        const f =
          Math.min(
            most,
            (edge === "top" || edge === "bottom" ? p.h : p.w) * 0.22,
            Math.max(28, room[edge] * 1.2),
          ) * s;
        const g =
          edge === "top"
            ? pc.createLinearGradient(0, 0, 0, f)
            : edge === "bottom"
              ? pc.createLinearGradient(0, ph.height, 0, ph.height - f)
              : edge === "left"
                ? pc.createLinearGradient(0, 0, f, 0)
                : pc.createLinearGradient(ph.width, 0, ph.width - f, 0);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,1)");
        pc.globalCompositeOperation = "destination-in";
        pc.fillStyle = g;
        pc.fillRect(0, 0, ph.width, ph.height);
      };
      if (p.mode === "extend")
        (["top", "bottom", "left", "right"] as Edge[]).forEach((e) => {
          if (p.extend[e]) feather(e);
        });
      else if (plainAll)
        (["top", "bottom", "left", "right"] as Edge[]).forEach((e) =>
          feather(e),
        );
      // A whole photo set in a band softens into its own copy where they meet.
      else if (o.band)
        (["top", "bottom", "left", "right"] as Edge[]).forEach((e) => {
          if (room[e] > 0.5) feather(e, 56);
        });
      if (p.mode === "contain" && !plainAll && !o.band) {
        lc.save();
        lc.shadowColor = "rgba(0,0,0,0.5)";
        lc.shadowBlur = this.px(56);
        lc.shadowOffsetY = this.px(20);
        lc.drawImage(ph, p.x, p.y, p.w, p.h);
        lc.restore();
      } else lc.drawImage(ph, p.x, p.y, p.w, p.h);
    } else {
      lc.filter = filter;
      lc.drawImage(im, p.x, p.y, p.w, p.h);
      lc.filter = "none";
    }
    if (o.fade?.top || o.fade?.bottom) {
      lc.save();
      lc.globalCompositeOperation = "destination-in";
      const t = o.fade.top || 0,
        b = o.fade.bottom || 0;
      lc.fillStyle = this.linearOn(lc, box.x, box.y, box.x, box.y + box.h, [
        [0, t ? "rgba(0,0,0,0)" : "#000"],
        [t / box.h, "#000"],
        [1 - b / box.h, "#000"],
        [1, b ? "rgba(0,0,0,0)" : "#000"],
      ]);
      lc.fillRect(box.x, box.y, box.w, box.h);
      lc.restore();
    }
    ctx.save();
    if (o.shadow) {
      ctx.save();
      ctx.shadowColor = o.shadow.color;
      ctx.shadowBlur = this.px(o.shadow.blur);
      ctx.shadowOffsetY = this.px(o.shadow.y);
      ctx.fillStyle = o.backdrop || rgbToHex(a.backdrop);
      shapePath(ctx, o.shape || "rect", box, o.radius);
      ctx.fill();
      ctx.restore();
    }
    shapePath(ctx, o.shape || "rect", box, o.radius);
    ctx.clip();
    ctx.drawImage(layer, box.x, box.y, box.w, box.h);
    ctx.restore();
    release(...scratch);
    if (o.keyline) {
      const g = o.keyline.gap;
      ctx.save();
      ctx.strokeStyle = o.keyline.color;
      ctx.lineWidth = o.keyline.width || 2;
      const kb = {
        x: box.x - g,
        y: box.y - g,
        w: box.w + g * 2,
        h: box.h + g * 2,
      };
      const r = Array.isArray(o.radius)
        ? o.radius.map((v) => (v ? v + g : 0))
        : o.radius
          ? o.radius + g
          : 0;
      shapePath(ctx, o.shape || "rect", kb, r);
      ctx.stroke();
      ctx.restore();
    }
    this.photoBoxes.push({ x: box.x, y: box.y, width: box.w, height: box.h });
    if (!o.quiet) {
      const name = o.name || "This photo";
      if (
        p.manual &&
        p.mode === "cover" &&
        Math.min(box.w / p.w, box.h / p.h) < 0.82
      )
        this.warnings.push(
          `${name}: the fill crop trims the photo. Check the whole dish or choose Fit whole dish.`,
        );
      else if (!p.manual && p.subject && p.subjectVisible < 0.85)
        this.warnings.push(
          `${name}: this design crops into the dish. Choose Fit whole dish in Photo, or try another design.`,
        );
      if (p.enlargement > 1.45 && box.w * box.h > this.W * this.H * 0.2)
        this.warnings.push(
          `${name}: the photo is small for this size and may look soft. Use a larger original if you have one.`,
        );
    }
    return p;
  }
  private linearOn(
    c: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    stops: [number, string][],
  ) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (const [at, col] of stops)
      g.addColorStop(Math.max(0, Math.min(1, at)), col);
    return g;
  }
}

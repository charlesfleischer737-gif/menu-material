import { renderComposedPost } from "./post-composition";
import { drawPhoto, imageBitmap } from "./photo-export";
import { money, type Row } from "./client";
import { getPostTemplate } from "./post-templates";
import { emptyAdjustments } from "./studio";
import { loadPostFonts } from "./post-fonts";
import { brandTypeface } from "./restaurant-look";

export async function renderPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
  if (draft.compositionVersion === 2)
    return renderComposedPost(canvas, draft, restaurant, channel, slide);
  await loadPostFonts();
  const W = 1080,
    H = channel === "story" ? 1920 : 1350,
    story = channel === "story";
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const template = getPostTemplate(draft.template);
  const color = draft.color || template.color,
    accent = draft.accent || template.accent;
  const layout = template.layout,
    top = story ? 185 : 72,
    bottom = H - (story ? 180 : 66);
  const items: Row[] =
    channel === "carousel" ? draft.items.slice(slide, slide + 1) : draft.items;
  if (!items.length)
    throw Error("Choose a dish photo before creating this design.");
  const images: ImageBitmap[] = [];
  const renderedText: string[] = [];
  const textBoxes: {
    value: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];
  const title = draft.title ?? items[0].name ?? "";
  const textMode = draft.textMode || template.textMode;
  const showBrand = draft.showBrand ?? template.showBrand;
  const kicker = draft.kicker ?? template.kicker,
    cta = draft.cta ?? template.cta;
  const price =
    draft.showPrice && draft.price !== "" && draft.price != null
      ? money(Math.round(Number(draft.price) * 100), restaurant.currency)
      : "";
  const offset = Math.max(-10, Math.min(10, Number(draft.textY || 0))) * 3;
  const itemNames = items
    .map(
      (i) =>
        (items.length > 1 || (i.quantity || 1) > 1 || channel === "carousel"
          ? (i.quantity || 1) + " × "
          : "") + i.name,
    )
    .join(" · ");
  const detailCopy = [title !== itemNames ? itemNames : "", draft.description]
    .filter(Boolean)
    .join("\n");
  function fill(c: string, x = 0, y = 0, w = W, h = H) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
  function round(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    c: string,
  ) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = c;
    ctx.fill();
  }
  function text(
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    c: string,
    options: {
      serif?: boolean;
      family?: "sans" | "serif" | "italic" | "condensed" | "hand";
      italic?: boolean;
      align?: "left" | "center" | "right";
      weight?: number;
    } = {},
  ) {
    if (!value?.trim()) return;
    const family =
      options.family ||
      (options.italic ? "italic" : options.serif ? "serif" : "sans");
    const font =
      draft.typography && draft.typography !== "template" && size >= 45
        ? `"${brandTypeface({ typography: draft.typography }).family}"`
        : '"' +
          {
            sans: "Post Sans",
            serif: "Post Serif",
            italic: "Post Italic",
            condensed: "Post Condensed",
            hand: "Post Hand",
          }[family] +
          '"';
    let lines: string[] = [],
      fs = size;
    const wrap = () => {
      lines = [];
      for (const paragraph of String(value).split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          if (!word) continue;
          if (ctx.measureText(line ? line + " " + word : word).width <= w)
            line = line ? line + " " + word : word;
          else {
            if (line) lines.push(line);
            line = "";
            for (const char of word) {
              if (ctx.measureText(line + char).width > w) {
                lines.push(line);
                line = "";
              }
              line += char;
            }
          }
        }
        if (line) lines.push(line);
      }
    };
    for (; fs >= 18; fs--) {
      ctx.font =
        "" +
        (options.weight || (options.serif ? 400 : 700)) +
        " " +
        fs +
        "px " +
        font;
      wrap();
      if (lines.length * fs * 1.1 <= h) break;
    }
    if (fs < 18 || lines.length * fs * 1.1 > h + 2)
      throw Error(
        "Some text is too long for this design. Shorten the headline or details.",
      );
    ctx.fillStyle = c;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = "top";
    const tx =
      options.align === "center"
        ? x + w / 2
        : options.align === "right"
          ? x + w
          : x;
    lines.forEach((line, i) => ctx.fillText(line, tx, y + i * fs * 1.1));
    renderedText.push(value);
    const matrix = ctx.getTransform(),
      width = Math.max(...lines.map((line) => ctx.measureText(line).width));
    const left =
      options.align === "center"
        ? x + (w - width) / 2
        : options.align === "right"
          ? x + w - width
          : x;
    const points = [
      [left, y],
      [left + width, y],
      [left, y + lines.length * fs * 1.1],
      [left + width, y + lines.length * fs * 1.1],
    ].map(([px, py]) => ({
      x: matrix.a * px + matrix.c * py + matrix.e,
      y: matrix.b * px + matrix.d * py + matrix.f,
    }));
    textBoxes.push({
      value,
      x: Math.min(...points.map((p) => p.x)),
      y: Math.min(...points.map((p) => p.y)),
      width:
        Math.max(...points.map((p) => p.x)) -
        Math.min(...points.map((p) => p.x)),
      height:
        Math.max(...points.map((p) => p.y)) -
        Math.min(...points.map((p) => p.y)),
    });
    ctx.textAlign = "left";
  }
  function photo(
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | number[] = 0,
  ) {
    const temp = document.createElement("canvas"),
      edits = { ...emptyAdjustments, fit: false, ...draft.layouts?.[channel] };
    drawPhoto(temp, images[index], Math.round(w), Math.round(h), edits, color);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.clip();
    if (edits.fit) {
      const backdrop = document.createElement("canvas");
      drawPhoto(
        backdrop,
        images[index],
        Math.round(w),
        Math.round(h),
        { ...edits, fit: false },
        color,
      );
      ctx.save();
      ctx.filter = "blur(28px) brightness(0.8)";
      ctx.drawImage(backdrop, x - 35, y - 35, w + 70, h + 70);
      ctx.restore();
      const rw =
          edits.rotate % 180 ? images[index].height : images[index].width,
        rh = edits.rotate % 180 ? images[index].width : images[index].height;
      const scale = Math.min(w / rw, h / rh) * edits.zoom,
        iw = rw * scale,
        ih = rh * scale;
      const px = ((w - iw) * edits.x) / 100,
        py = ((h - ih) * edits.y) / 100;
      const sx = Math.max(0, px),
        sy = Math.max(0, py),
        sw = Math.min(w, px + iw) - sx,
        sh = Math.min(h, py + ih) - sy;
      if (sw > 0 && sh > 0) {
        const foreground = document.createElement("canvas");
        foreground.width = Math.round(sw);
        foreground.height = Math.round(sh);
        const fc = foreground.getContext("2d")!;
        fc.drawImage(temp, sx, sy, sw, sh, 0, 0, sw, sh);
        if (iw < w - 2 || ih < h - 2) {
          const fade =
            ih < h - 2
              ? fc.createLinearGradient(0, 0, 0, sh)
              : fc.createLinearGradient(0, 0, sw, 0);
          fade.addColorStop(0, "#ffffff00");
          fade.addColorStop(0.035, "#ffffff");
          fade.addColorStop(0.965, "#ffffff");
          fade.addColorStop(1, "#ffffff00");
          fc.globalCompositeOperation = "destination-in";
          fc.fillStyle = fade;
          fc.fillRect(0, 0, sw, sh);
        }
        ctx.drawImage(foreground, x + sx, y + sy, sw, sh);
      }
    } else ctx.drawImage(temp, x, y, w, h);
    ctx.restore();
  }
  function photoGroup(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | number[] = 0,
  ) {
    if (images.length === 1) {
      photo(0, x, y, w, h, r);
      return;
    }
    const cols = 2,
      rows = Math.ceil(images.length / 2),
      gap = 18,
      cw = (w - gap) / 2,
      ch = (h - gap * (rows - 1)) / rows;
    images.forEach((_, i) => {
      const px = x + (i % cols) * (cw + gap),
        py = y + Math.floor(i / cols) * (ch + gap);
      photo(i, px, py, cw, ch, r);
    });
  }
  // Overlays are local to the text; food stays bright through the middle of the frame.
  function shade(edge: "top" | "bottom", depth: number, opacity = 0.72) {
    const y = edge === "top" ? 0 : H - depth;
    const g = ctx.createLinearGradient(0, y, 0, y + depth);
    const strength =
      textMode === "photo" ? Math.max(opacity, 0.86) : opacity * 0.35;
    const shade = `rgba(0,0,0,${strength})`;
    g.addColorStop(0, edge === "top" ? shade : "rgba(0,0,0,0)");
    g.addColorStop(1, edge === "top" ? "rgba(0,0,0,0)" : shade);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, depth);
  }
  function signature(
    c: string,
    y = top,
    align: "left" | "center" | "right" = "left",
  ) {
    if (!showBrand) return;
    text(
      restaurant.name || "",
      76,
      y,
      restaurant.logo_id ? 800 : 928,
      48,
      26,
      c,
      { align, weight: 500 },
    );
  }
  function information(
    y: number,
    c: string,
    align: "left" | "center" | "right" = "left",
  ) {
    // Supporting facts appear only when supplied; no invented slogans, badges or filler.
    const facts = [price, draft.validity, cta].filter(Boolean).join("  ·  ");
    const detail = textMode === "full" || items.length > 1 ? detailCopy : "";
    if (detail) text(detail, 76, y, 928, 106, 34, c, { align, weight: 400 });
    text(facts, 76, detail ? y + 120 : y, 928, 85, 30, c, {
      align,
      weight: 500,
    });
  }
  try {
    for (const item of items)
      images.push(
        await imageBitmap(item.photoUrl || "/api/assets/" + item.photoId),
      );
    fill(color);
    // Full-frame photography is the starting point for every composition.
    // Fit whole dish remains available as an explicit framing choice.
    if (layout === "bakery") {
      fill(accent);
      photoGroup(24, 24, W - 48, H - 48);
    } else if (layout === "combo" && images.length > 1) {
      photoGroup(0, 0, W, H);
    } else photoGroup(0, 0, W, H);

    if (textMode !== "photo") {
      // A continuous scrim keeps older saved overlays legible without separate
      // dark bands cutting across the food. Edge shading remains gradual.
      fill("rgba(0,0,0,0.58)");
      const white = "#fffdf7";
      const hasInfo = !!(
        price ||
        draft.validity ||
        cta ||
        (textMode === "full" && detailCopy) ||
        items.length > 1
      );
      const infoY =
        bottom - (textMode === "full" || items.length > 1 ? 198 : 80);
      if (layout === "special") {
        shade("top", H * 0.47, 0.5);
        shade("bottom", H * 0.37, 0.88);
        signature(white);
        text(kicker, 76, top + 62, 928, 45, 27, accent);
        text(
          title.toUpperCase(),
          70,
          top + 126 + offset,
          880,
          370,
          190,
          accent,
          { family: "condensed", weight: 700 },
        );
        if (hasInfo) information(infoY, white);
      } else if (layout === "launch") {
        // A bold typographic launch, with the photo visible behind the type.
        shade("top", H * 0.44, 0.58);
        shade("bottom", H * 0.25, 0.56);
        text(kicker, 76, top, 928, 48, 29, accent, { weight: 500 });
        text(
          title.toUpperCase(),
          70,
          top + 82 + offset,
          936,
          370,
          208,
          accent,
          { family: "condensed", weight: 700 },
        );
        if (hasInfo) information(infoY, white);
        else signature(white, bottom - 42);
      } else if (layout === "afterdark") {
        shade("top", H * 0.48, 0.66);
        shade("bottom", H * 0.34, 0.72);
        signature(accent, top, "center");
        text(kicker, 76, top + 67, 928, 45, 26, accent, {
          align: "center",
          weight: 400,
        });
        text(
          title,
          76,
          top + (kicker ? 155 : 86) + offset,
          928,
          245,
          142,
          accent,
          { family: "italic", align: "center", weight: 500 },
        );
        if (hasInfo) information(infoY, white, "center");
      } else if (layout === "brunch") {
        shade("top", H * 0.34, 0.35);
        shade("bottom", H * 0.4, 0.78);
        signature(white);
        text(kicker, 76, top + 64, 928, 42, 25, white);
        const ty = hasInfo ? infoY - 225 : bottom - 250;
        text(title, 76, ty + offset, 928, 200, 155, accent, {
          family: "hand",
          weight: 500,
        });
        if (hasInfo) information(infoY, white);
      } else if (layout === "bakery") {
        shade("top", H * 0.3, 0.42);
        shade("bottom", H * 0.45, 0.78);
        signature(white, top, "center");
        const ty = hasInfo ? infoY - 258 : bottom - 300;
        text(kicker, 76, ty - 60, 928, 44, 27, accent, { align: "center" });
        text(title, 76, ty + offset, 928, 240, 155, accent, {
          family: "hand",
          align: "center",
          weight: 500,
        });
        if (hasInfo) information(infoY, white, "center");
      } else if (layout === "event") {
        shade("top", H * 0.69, 0.88);
        shade("bottom", H * 0.39, 0.88);
        signature(accent, top, "center");
        text(kicker, 76, top + 76, 928, 45, 27, accent, {
          align: "center",
          weight: 400,
        });
        text(title, 76, top + 164 + offset, 928, 345, 142, accent, {
          family: "serif",
          align: "center",
          weight: 400,
        });
        if (hasInfo) information(infoY, white, "center");
      } else if (layout === "fresh") {
        shade("bottom", H * 0.37, 0.74);
        const ty = hasInfo ? infoY - 198 : bottom - 215;
        text(kicker, 76, ty - 58, 928, 44, 26, white);
        text(title, 76, ty + offset, 780, 170, 101, accent, {
          family: "sans",
          weight: 500,
        });
        if (hasInfo) information(infoY, white);
        if (showBrand) {
          shade("top", H * 0.2, 0.4);
          signature(white);
        }
      } else if (layout === "combo") {
        shade("top", H * 0.45, 0.7);
        shade("bottom", H * 0.38, 0.88);
        signature(white);
        text(kicker, 76, top + 65, 928, 45, 26, accent);
        text(
          title.toUpperCase(),
          70,
          top + 140 + offset,
          936,
          355,
          165,
          accent,
          { family: "condensed", weight: 700 },
        );
        if (hasInfo) information(infoY, white);
      } else {
        // A restrained editorial signature, also used if text is added to Just the dish.
        shade("bottom", H * 0.39, 0.78);
        const ty = hasInfo ? infoY - 210 : bottom - 230;
        text(kicker, 76, ty - 60, 928, 45, 26, accent);
        text(title, 76, ty + offset, 928, 190, 112, accent, {
          family: "serif",
          weight: 500,
        });
        if (hasInfo) information(infoY, white);
        if (showBrand) {
          shade("top", H * 0.2, 0.4);
          signature(white);
        }
      }
    } else if (showBrand) {
      shade("bottom", H * 0.17, 0.45);
      signature("#ffffff", bottom - 40);
    }
    if (restaurant.logo_id && showBrand) {
      const logo = await imageBitmap("/api/assets/" + restaurant.logo_id);
      try {
        const s = Math.min(56 / logo.width, 56 / logo.height);
        round(934, top - 6, 74, 74, 10, "#ffffff");
        ctx.drawImage(
          logo,
          971 - (logo.width * s) / 2,
          top + 31 - (logo.height * s) / 2,
          logo.width * s,
          logo.height * s,
        );
      } finally {
        logo.close();
      }
    }
    return {
      renderedText,
      textBoxes,
      warnings: [] as string[],
      template: template.id,
      width: W,
      height: H,
    };
  } finally {
    images.forEach((i) => i.close());
  }
}

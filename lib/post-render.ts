import { drawPhoto, imageBitmap } from "./creation-export";
import { money, type Row } from "./client";
import { getPostTemplate } from "./post-templates";
import { emptyAdjustments } from "./studio";

export async function renderPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
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
    bottom = H - (story ? 180 : 66),
    usable = bottom - top;
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
  const title = draft.title || items[0].name || "";
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
        (items.length > 1 || channel === "carousel"
          ? (i.quantity || 1) + " × "
          : "") + i.name,
    )
    .join(" · ");
  const detailCopy = [title !== itemNames ? itemNames : "", draft.description]
    .filter(Boolean)
    .join("\n");
  const contrast = (hex: string) => {
    const c = hex.replace("#", "");
    const n = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
    return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2] > 150
      ? "#182b23"
      : "#ffffff";
  };
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
      italic?: boolean;
      align?: "left" | "center" | "right";
      weight?: number;
    } = {},
  ) {
    if (!value?.trim()) return;
    const font = options.serif ? "Georgia" : "Arial";
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
        (options.italic ? "italic " : "") +
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
  function rule(x: number, y: number, w: number, c: string) {
    fill(c, x, y, w, 2);
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
      edits = { ...emptyAdjustments, ...draft.layouts?.[channel] };
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
  function gradient() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,.62)");
    g.addColorStop(0.38, "rgba(0,0,0,.05)");
    g.addColorStop(0.66, "rgba(0,0,0,.24)");
    g.addColorStop(1, "rgba(0,0,0,.90)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  function brand(c: string, y = top) {
    text(restaurant.name || "", 72, y, 820, 55, 29, c, { weight: 600 });
  }
  function details(c: string, y: number, h: number, w = 936, x = 72) {
    text(detailCopy, x, y, w, h, 38, c, { weight: 400 });
  }
  function footer(c: string, y = bottom - 48) {
    text(
      [draft.validity, cta].filter(Boolean).join("  /  "),
      72,
      y,
      936,
      64,
      33,
      c,
      { weight: 500 },
    );
  }
  try {
    for (const item of items)
      images.push(
        await imageBitmap(item.photoUrl || "/api/assets/" + item.photoId),
      );
    const ink = contrast(accent),
      onColor = contrast(color);
    if (layout === "afterdark") {
      fill(color);
      photoGroup(0, 0, W, H);
      gradient();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(48, top - 30, 984, usable + 70);
      text(restaurant.name || "", 100, top + 10, 880, 60, 30, "#ffffff", {
        align: "center",
      });
      text(kicker, 100, top + 112, 880, 60, 40, accent, { align: "center" });
      rule(440, top + 207, 200, accent);
      const y = top + usable * 0.52 + offset;
      text(title, 100, y, 880, 206, 112, "#ffffff", {
        serif: true,
        italic: true,
        align: "center",
      });
      text(price, 100, y + 220, 880, 90, 70, accent, { align: "center" });
      details("#ffffff", y + (price ? 330 : 230), 95);
      footer("#ffffff");
    } else if (layout === "editorial") {
      fill(color);
      photoGroup(0, 0, W, H);
      gradient();
      brand("#ffffff");
      rule(72, top + 74, 936, "#ffffff80");
      text(kicker, 72, top + 102, 936, 46, 28, accent);
      const titleY = top + usable * 0.53 + offset;
      text(title, 72, titleY, 900, 190, 104, "#ffffff", { serif: true });
      if (price) text(price, 72, titleY + 196, 320, 78, 64, accent);
      details("#ffffff", titleY + (price ? 278 : 206), 112);
      footer("#ffffff");
    } else if (layout === "special") {
      fill(accent);
      fill(color, 0, 0, 30, H);
      brand(color);
      text(kicker, 72, top + 74, 690, 45, 29, color);
      photoGroup(440, top + 150, 568, usable * 0.53, 44);
      text(title, 72, top + 175 + offset, 540, 340, 114, color);
      const py = top + usable * 0.58;
      if (price) {
        ctx.save();
        ctx.translate(836, py);
        ctx.rotate(0.1);
        round(-160, -80, 320, 160, 80, color);
        text(price, -140, -43, 280, 96, 67, onColor, { align: "center" });
        ctx.restore();
      }
      rule(72, top + usable * 0.76, 936, color);
      details(color, top + usable * 0.8, 120);
      footer(color);
    } else if (layout === "launch") {
      fill(color);
      brand(onColor);
      text(kicker, 72, top + 78, 936, 90, 50, accent);
      photoGroup(210, top + 185, 660, usable * 0.49, [330, 330, 30, 30]);
      round(46, top + usable * 0.62 + offset, 988, 250, 20, accent);
      text(title, 82, top + usable * 0.62 + 34 + offset, 916, 176, 94, ink, {
        align: "center",
      });
      const dy = top + usable * 0.62 + 280;
      text(
        [price, detailCopy].filter(Boolean).join(" · "),
        72,
        dy,
        936,
        95,
        33,
        onColor,
        { weight: 400, align: "center" },
      );
      footer(onColor);
    } else if (layout === "brunch") {
      fill(accent);
      brand(color);
      text(kicker, 72, top + 90, 936, 78, 49, color, { align: "center" });
      photoGroup(225, top + 205, 630, usable * 0.48, [315, 315, 18, 18]);
      text(title, 72, top + usable * 0.61 + offset, 936, 220, 108, color, {
        serif: true,
        italic: true,
        align: "center",
      });
      text(price, 72, top + usable * 0.81, 936, 74, 58, color, {
        align: "center",
      });
      details(color, top + usable * 0.88, 65);
      footer(color);
    } else if (layout === "bakery") {
      fill(accent);
      brand(color);
      text(kicker, 72, top + 85, 936, 80, 39, color, { align: "center" });
      const center = top + usable * 0.4;
      ctx.save();
      ctx.translate(W / 2, center);
      ctx.rotate(-0.045);
      fill("#fffaf0", -390, -usable * 0.24, 780, usable * 0.52);
      photoGroup(-360, -usable * 0.24 + 30, 720, usable * 0.43);
      ctx.restore();
      round(742, top + usable * 0.57, 262, 110, 55, color);
      text(
        price || "Made with care",
        755,
        top + usable * 0.57 + 26,
        236,
        66,
        price ? 43 : 26,
        onColor,
        { align: "center" },
      );
      text(title, 72, top + usable * 0.65 + offset, 936, 165, 87, color, {
        serif: true,
        italic: true,
      });
      details(color, top + usable * 0.83, 95);
      footer(color);
    } else if (layout === "event") {
      fill(color);
      round(48, top - 30, 984, usable + 78, 20, accent);
      brand(color, top + 20);
      text(kicker, 88, top + 98, 904, 60, 34, color);
      rule(88, top + 178, 904, color);
      text(title, 88, top + 210 + offset, 460, 340, 88, color, { serif: true });
      photoGroup(580, top + 215, 390, usable * 0.44, [195, 195, 12, 12]);
      rule(88, top + usable * 0.68, 904, color);
      text(draft.validity || "", 88, top + usable * 0.72, 904, 100, 48, color);
      text(
        [price, detailCopy].filter(Boolean).join(" · "),
        88,
        top + usable * 0.84,
        904,
        90,
        29,
        color,
        { weight: 400 },
      );
      text(cta, 88, bottom - 35, 904, 50, 29, color);
    } else if (layout === "fresh") {
      fill(accent);
      photoGroup(390, 0, 690, H);
      fill(color, 0, 0, 430, H);
      brand(onColor);
      text(kicker, 65, top + 110, 320, 80, 31, accent);
      text(
        title,
        65,
        top + usable * 0.26 + offset,
        460,
        usable * 0.28,
        99,
        onColor,
        {
          serif: true,
        },
      );
      text(price, 65, top + usable * 0.61, 335, 90, 64, accent);
      text(detailCopy, 65, top + usable * 0.79, 310, 105, 28, onColor, {
        weight: 400,
      });
      round(45, bottom - 64, 980, 90, 18, accent);
      footer(ink, bottom - 43);
    } else if (layout === "combo") {
      fill(accent);
      brand(color);
      text(kicker, 72, top + 76, 936, 60, 39, color);
      text(title, 72, top + 155 + offset, price ? 595 : 936, 170, 94, color);
      const photoY = top + usable * 0.34,
        photoH = usable * 0.37;
      photoGroup(72, photoY, 936, photoH, 22);
      const names = items
        .map((i) => (i.quantity || 1) + " × " + i.name)
        .join("  +  ");
      text(names, 72, photoY + photoH + 24, 936, 95, 34, color);
      if (price) {
        round(715, top + usable * 0.16, 290, 124, 62, color);
        text(price, 735, top + usable * 0.16 + 26, 250, 80, 58, onColor, {
          align: "center",
        });
      }
      text(
        draft.description || "",
        72,
        top + usable * 0.84,
        936,
        82,
        30,
        color,
        { weight: 400 },
      );
      footer(color);
    } else {
      fill(accent);
      brand(color);
      rule(72, top + 78, 936, color);
      text(kicker, 72, top + 105, 800, 50, 28, color);
      photoGroup(72, top + 196, 570, usable * 0.54, 4);
      text("01", 715, top + 195, 293, 185, 150, color, {
        serif: true,
        italic: true,
      });
      text(price, 696, top + usable * 0.46, 312, 80, 54, color);
      text(title, 72, top + usable * 0.74 + offset, 936, 154, 88, color, {
        serif: true,
      });
      details(color, top + usable * 0.89, 55);
      footer(color);
    }
    if (restaurant.logo_id) {
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
      template: template.id,
      width: W,
      height: H,
    };
  } finally {
    images.forEach((i) => i.close());
  }
}

import type { Row } from "./client";
import { money } from "./client";
import { drawPhoto, imageBitmap } from "./photo-export";
import { emptyAdjustments } from "./studio";
import { brandTypeface, readableBrandInk } from "./restaurant-look";
import { getPostTemplate } from "./post-templates";
import { loadPostFonts } from "./post-fonts";
import {
  paintMaterial,
  mixColor,
  gradient,
  glow,
  foil,
} from "./template-materials";

export function carouselSlides(draft: Row): Row[] {
  const items: Row[] = draft.items || [];
  return [
    ...(draft.carouselCover
      ? [{ kind: "cover", items, title: draft.title, key: "cover" }]
      : []),
    ...items.map((item, index) => ({
      kind: "dish",
      items: [item],
      title: item.headline || item.name,
      key: item.dishId || String(index),
      itemIndex: index,
    })),
    ...(draft.carouselClosing
      ? [
          {
            kind: "closing",
            items: items.slice(0, 1),
            title: draft.carouselClosing,
            key: "closing",
          },
        ]
      : []),
  ];
}
export function postSlideCount(draft: Row, channel: string) {
  return channel === "carousel"
    ? draft.compositionVersion === 2
      ? carouselSlides(draft).length
      : draft.items.length
    : 1;
}
export function recommendedDesigns(draft: Row, restaurant: Row) {
  const words =
    `${draft.items?.[0]?.name || ""} ${draft.items?.[0]?.category || ""} ${restaurant.cuisine || ""}`.toLowerCase();
  const lead =
    draft.occasion === "event"
      ? "event"
      : draft.occasion === "combo"
        ? "combo"
        : draft.occasion === "special"
          ? "special"
          : /cocktail|wine|beer|bar|drink/.test(words)
            ? "afterdark"
            : /bakery|croissant|cake|pastry/.test(words)
              ? "bakery"
              : restaurant.style?.typography === "editorial"
                ? "chef"
                : "fresh";
  return [
    ...new Set([lead, "editorial", lead === "special" ? "chef" : "special"]),
  ];
}
function photoCharacter(image: ImageBitmap) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(image, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  let top = 0,
    bottom = 0,
    weight = 0,
    cx = 0,
    cy = 0;
  const edges = [0, 0, 0];
  let n = 0;
  for (let y = 1; y < 31; y++)
    for (let x = 1; x < 31; x++) {
      const i = (y * 32 + x) * 4;
      const contrast =
        Math.abs(data[i] - data[i - 4]) +
        Math.abs(data[i + 1] - data[i - 3]) +
        Math.abs(data[i + 2] - data[i - 2]);
      if (y < 12) top += contrast;
      if (y > 20) bottom += contrast;
      weight += contrast;
      cx += x * contrast;
      cy += y * contrast;
      if (x < 3 || x > 28 || y < 3 || y > 28) {
        for (let k = 0; k < 3; k++) edges[k] += data[i + k];
        n++;
      }
    }
  return {
    quietEdge: top < bottom ? "top" : "bottom",
    topLight:
      Array.from(
        { length: 32 * 6 },
        (_, i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3,
      ).reduce((a, b) => a + b, 0) /
      (32 * 6),
    x: weight ? (cx / weight / 31) * 100 : 50,
    y: weight ? (cy / weight / 31) * 100 : 50,
    background: `rgb(${edges.map((v) => Math.round(v / n)).join(",")})`,
  };
}

/** Each art direction owns its geometry. Shared primitives keep proofs and exports identical. */
export async function renderComposedPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
  await loadPostFonts();
  const W = 1080,
    H = channel === "story" ? 1920 : 1350;
  const top = channel === "story" ? 184 : 64,
    bottom = H - (channel === "story" ? 184 : 64),
    usable = bottom - top;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const t = getPostTemplate(draft.template),
    card = channel === "carousel" ? carouselSlides(draft)[slide] : null;
  const items: Row[] = card?.items || draft.items || [];
  if (!items.length) throw Error("Choose an approved dish photo first.");
  const images: ImageBitmap[] = [],
    warnings: string[] = [],
    textBoxes: Row[] = [],
    photoBoxes: Row[] = [],
    renderedText: string[] = [];
  const primary = draft.color || restaurant.style?.primary || t.color,
    accent = draft.accent || restaurant.style?.accent || t.accent;
  const tint = (hex: string) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.15 + 255 * 0.85)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const paper = ["brunch", "bakery", "chef", "special"].includes(t.id)
    ? tint(accent)
    : accent;
  // A pale brand primary cannot serve as legible type on paper.
  const ink =
    readableBrandInk(primary) === "#ffffff" &&
    readableBrandInk(paper) === "#000000"
      ? primary
      : readableBrandInk(paper);
  const headline = String(card?.title ?? draft.title ?? items[0].name);
  const mode = draft.textMode || t.textMode,
    photoOnly = mode === "photo" && card?.kind !== "closing",
    showBrand = draft.showBrand ?? t.showBrand;
  const kicker =
    photoOnly || card?.kind === "dish" ? "" : String(draft.kicker || "");
  const price =
    draft.showPrice &&
    draft.price !== "" &&
    draft.price != null &&
    (channel !== "carousel" || card?.kind === "cover")
      ? money(Math.round(Number(draft.price) * 100), restaurant.currency)
      : "";
  const facts = photoOnly
    ? ""
    : [t.id === "special" ? "" : price, draft.validity, draft.cta]
        .filter(Boolean)
        .join("  /  ");
  let detail =
    mode === "full" && channel !== "carousel"
      ? String(draft.description || "")
      : "";
  if (detail.length > 100) {
    warnings.push(
      "The description is too long for the image. Check that your caption includes the details you want to share.",
    );
    detail = "";
  }
  const family = (fallback: string) =>
    draft.typography && draft.typography !== "template"
      ? brandTypeface({ typography: draft.typography }).family
      : fallback;
  function fill(c: string, x = 0, y = 0, w = W, h = H) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }
  function rule(x: number, y: number, w: number, c: string, thickness = 2) {
    fill(c, x, y, w, thickness);
  }
  function measure(
    value: string,
    w: number,
    max: number,
    min = 42,
    font = "Post Sans",
    maxH = 1000,
  ) {
    let lines: string[] = [],
      fs = max;
    for (; fs >= min; fs--) {
      ctx.font = `${font === "Post Serif" || font === "Post Italic" ? 500 : font === "Post Condensed" ? 700 : 500} ${fs}px "${font}"`;
      lines = [];
      for (const paragraph of value.split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
          const candidate = line ? line + " " + word : word;
          if (ctx.measureText(candidate).width <= w) line = candidate;
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
      if (lines.length * fs * 1.08 <= maxH) break;
    }
    if (fs < min)
      throw Error(
        `“${value.slice(0, 48)}” is too long to read comfortably. Shorten it or move details to the caption.`,
      );
    return { lines, fs, height: lines.length * fs * 1.08, font };
  }
  function text(
    value: string,
    x: number,
    y: number,
    w: number,
    maxH: number,
    size: number,
    c: string | CanvasGradient,
    font = "Post Sans",
    align: CanvasTextAlign = "left",
    min = 42,
  ) {
    if (!value.trim()) return 0;
    const m = measure(value, w, size, min, font, maxH);
    ctx.fillStyle = c;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    const tx = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
    m.lines.forEach((line, i) => ctx.fillText(line, tx, y + i * m.fs * 1.08));
    const width = Math.max(...m.lines.map((l) => ctx.measureText(l).width));
    textBoxes.push({
      value,
      x:
        align === "center"
          ? x + (w - width) / 2
          : align === "right"
            ? x + w - width
            : x,
      y,
      width,
      height: m.height,
      fontSize: m.fs,
    });
    renderedText.push(value);
    ctx.textAlign = "left";
    return m.height;
  }
  function title(
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    c: string | CanvasGradient,
    font = "Post Serif",
    align: CanvasTextAlign = "left",
  ) {
    return photoOnly
      ? 0
      : text(headline, x, y, w, h, size, c, family(font), align, 66);
  }
  function smallCopy(
    x: number,
    y: number,
    w: number,
    c: string,
    align: CanvasTextAlign = "left",
    withDetail = true,
  ) {
    let used = 0;
    if (detail && withDetail)
      used += text(detail, x, y, w, 105, 42, c, "Post Sans", align) + 22;
    if (facts)
      used += text(facts, x, y + used, w, 145, 42, c, "Post Sans", align);
    return used;
  }
  function copyHeight(w: number, withDetail = true) {
    return (
      (detail && withDetail ? measure(detail, w, 42).height + 22 : 0) +
      (facts ? measure(facts, w, 42).height : 0)
    );
  }
  async function brand(
    x: number,
    y: number,
    w: number,
    c: string,
    align: CanvasTextAlign = "left",
  ) {
    if (!showBrand) return 0;
    const logoId = restaurant.logo_id || restaurant.logoId;
    let inset = 0;
    if (logoId) {
      const logo = await imageBitmap(`/api/assets/${logoId}`);
      try {
        const s = Math.min(58 / logo.width, 58 / logo.height);
        fill("#ffffff", x, y - 3, 64, 64);
        ctx.drawImage(
          logo,
          x + 32 - (logo.width * s) / 2,
          y + 29 - (logo.height * s) / 2,
          logo.width * s,
          logo.height * s,
        );
        inset = 84;
      } finally {
        logo.close();
      }
    }
    return Math.max(
      inset ? 64 : 0,
      text(
        restaurant.name,
        x + inset,
        y,
        w - inset,
        150,
        36,
        c,
        "Post Sans",
        align,
        36,
      ),
    );
  }
  function photo(
    x: number,
    y: number,
    w: number,
    h: number,
    indices = images.map((_, i) => i),
    radius: number | number[] = 0,
    effect: "clean" | "float" | "blend" = "clean",
  ) {
    const cols = indices.length > 1 ? 2 : 1,
      rows = Math.ceil(indices.length / cols),
      gap = indices.length > 1 ? 12 : 0,
      cw = (w - gap * (cols - 1)) / cols,
      ch = (h - gap * (rows - 1)) / rows;
    indices.forEach((index, n) => {
      const im = images[index],
        item = items[index],
        props = photoCharacter(im);
      const edits = {
        ...emptyAdjustments,
        fit: false,
        ...draft.layouts?.[channel],
        ...item.layouts?.[channel],
      };
      if (edits.autoFrame && !edits.fit) {
        edits.x = props.x;
        edits.y = props.y;
      }
      const iw = edits.rotate % 180 ? im.height : im.width,
        ih = edits.rotate % 180 ? im.width : im.height;
      const scale =
        (edits.fit ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih)) *
        edits.zoom;
      if (scale > 1.1)
        warnings.push(
          `${item.name}: use a larger original for a sharper export.`,
        );
      if (!edits.fit && Math.min(cw / (iw * scale), ch / (ih * scale)) < 0.82)
        warnings.push(
          `${item.name}: the fill crop trims the photo. Check the whole dish or choose Fit whole dish.`,
        );
      const pc = document.createElement("canvas");
      drawPhoto(pc, im, Math.round(cw), Math.round(ch), edits, paper);
      if (effect === "blend") {
        const pcx = pc.getContext("2d")!;
        pcx.globalCompositeOperation = "destination-in";
        pcx.fillStyle = gradient(pcx, 0, 0, 0, ch, [
          [0, "#ffffff00"],
          [0.14, "#ffffff"],
          [0.83, "#ffffff"],
          [1, "#ffffff00"],
        ]);
        pcx.fillRect(0, 0, cw, ch);
        pcx.globalCompositeOperation = "source-over";
      }
      const px = x + (n % cols) * (cw + gap),
        py = y + Math.floor(n / cols) * (ch + gap);
      ctx.save();
      if (effect === "float") {
        ctx.shadowColor = "#1c120c50";
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 22;
        ctx.fillStyle = paper;
        ctx.beginPath();
        ctx.roundRect(px, py, cw, ch, radius);
        ctx.fill();
        ctx.shadowColor = "transparent";
      }
      ctx.beginPath();
      ctx.roundRect(px, py, cw, ch, radius);
      ctx.clip();
      ctx.drawImage(pc, px, py, cw, ch);
      ctx.restore();
      photoBoxes.push({ x: px, y: py, width: cw, height: ch });
    });
  }
  try {
    for (const item of items)
      images.push(
        await imageBitmap(item.photoUrl || `/api/assets/${item.photoId}`),
      );
    const light = "#fff7e8",
      mutedGold = "#ddc79e";
    const footerH = copyHeight(936),
      kickerH = kicker ? 64 : 0;
    const gold = (y: number, h = 150) => foil(ctx, 80, y, 920, h);
    const rim = (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | number[] = 0,
    ) => {
      ctx.save();
      ctx.strokeStyle = foil(ctx, x, y, w, h);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    };
    if (t.id === "editorial" || t.id === "afterdark") {
      photo(0, 0, W, H);
      const night = t.id === "afterdark",
        atTop = draft.textPlacement === "top";
      const th = photoOnly
        ? 0
        : measure(
            headline,
            920,
            night ? 154 : 140,
            66,
            family(night ? "Post Italic" : "Post Serif"),
            360,
          ).height;
      const stack = th + footerH + kickerH + (footerH ? 30 : 0);
      const start = atTop ? top + 115 : bottom - stack;
      if (!photoOnly || showBrand) {
        const shade = gradient(
          ctx,
          0,
          atTop ? 0 : H,
          0,
          atTop ? start + stack + 160 : -(H - start + 160),
          [
            [0, night ? "#100e18fa" : "#0c1712ef"],
            [0.62, night ? "#201523ac" : "#172c2590"],
            [1, "#10221a00"],
          ],
        );
        ctx.fillStyle = shade;
        ctx.fillRect(0, 0, W, H);
        if (night) {
          glow(
            ctx,
            W + 100,
            H * 0.82,
            650,
            mixColor(primary, "#d59651", 0.55),
            0.18,
          );
          glow(ctx, -200, H * 0.3, 550, "#9f6453", 0.16);
        }
        if (showBrand) {
          const isLight = photoCharacter(images[0]).topLight > 175;
          await brand(72, top, 936, isLight ? "#18241c" : light);
        }
        let y = start;
        if (kicker)
          y += text(kicker.toUpperCase(), 72, y, 936, 64, 42, mutedGold) + 20;
        y += title(
          68,
          y,
          920,
          th + 2,
          night ? 154 : 140,
          night ? gold(y, th) : light,
          night ? "Post Italic" : "Post Serif",
        );
        if (footerH) {
          rule(72, y + 15, 80, mutedGold, 2);
          smallCopy(72, y + 30, 936, light);
        }
      }
    } else if (t.id === "special") {
      await paintMaterial(ctx, W, H, "dark", primary);
      glow(
        ctx,
        W * 0.6,
        H * 0.46,
        700,
        mixColor(primary, "#d98245", 0.45),
        0.24,
      );
      let y = top;
      if (showBrand) y += (await brand(72, y, 936, mutedGold)) + 30;
      if (kicker)
        y += text(kicker.toUpperCase(), 72, y, 936, 64, 42, mutedGold) + 20;
      y +=
        title(
          68,
          y,
          944,
          Math.min(355, usable * 0.3),
          156,
          light,
          "Post Serif",
        ) + 12;
      const ph = bottom - y - footerH - (footerH ? 20 : 0);
      photo(0, y, W, ph, undefined, 0, "blend");
      if (price && !photoOnly) {
        measure(price, 380, 86, 48, "Post Serif", 120);
        const pw = Math.max(184, ctx.measureText(price).width + 48),
          py = y + ph - 125;
        ctx.fillStyle = gradient(ctx, 0, py, pw, 118, [
          [0, "#352218"],
          [1, "#090e0cf5"],
        ]);
        ctx.fillRect(W - 72 - pw, py, pw, 118);
        rim(W - 72 - pw, py, pw, 118, 8);
        text(
          price,
          W - 48 - pw,
          py + 18,
          pw - 48,
          90,
          86,
          gold(py),
          "Post Serif",
          "center",
          48,
        );
      }
      if (footerH) smallCopy(72, bottom - footerH, 936, light);
    } else if (t.id === "launch") {
      await paintMaterial(ctx, W, H, "dark", primary);
      ctx.fillStyle = gradient(ctx, 0, 0, W, H, [
        [0, mixColor(primary, "#211a24", 0.4)],
        [0.55, primary + "bd"],
        [1, "#151b20ef"],
      ]);
      ctx.fillRect(0, 0, W, H);
      glow(
        ctx,
        W * 0.85,
        H * 0.52,
        W * 0.82,
        mixColor(primary, "#ffbd8c", 0.62),
        0.9,
      );
      let y = top;
      if (showBrand) y += (await brand(72, y, 936, light)) + 25;
      if (kicker)
        y += text(kicker.toUpperCase(), 72, y, 936, 64, 42, light) + 24;
      y +=
        title(
          65,
          y,
          950,
          Math.min(380, usable * 0.31),
          184,
          light,
          "Post Condensed",
        ) + 24;
      const ph = bottom - y - footerH - (footerH ? 28 : 0);
      photo(88, y, 992, ph, undefined, [140, 0, 0, 0], "float");
      if (footerH) smallCopy(72, bottom - footerH, 936, light);
    } else if (t.id === "brunch") {
      await paintMaterial(ctx, W, H, "paper", primary);
      let y = top;
      if (showBrand) y += (await brand(72, y, 936, ink)) + 25;
      if (kicker) y += text(kicker.toUpperCase(), 72, y, 936, 64, 42, ink) + 18;
      y += title(68, y, 930, 340, 154, ink, "Post Italic") + 28;
      const ph = bottom - y - footerH - (footerH ? 32 : 0);
      photo(170, y, 838, ph, undefined, [180, 180, 12, 12], "float");
      rim(151, y - 16, 838, ph, [180, 180, 12, 12]);
      if (footerH) smallCopy(72, bottom - footerH, 936, ink);
    } else if (t.id === "bakery") {
      await paintMaterial(ctx, W, H, "paper", primary);
      const th = photoOnly
        ? 0
        : measure(headline, 920, 150, 66, family("Post Italic"), 330).height;
      let y = top;
      if (showBrand) y += (await brand(80, y, 920, ink)) + 14;
      if (kicker) y += text(kicker.toUpperCase(), 80, y, 920, 64, 42, ink) + 18;
      const ph = bottom - y - th - footerH - 22 - (footerH ? 20 : 0);
      photo(0, y, W, ph, undefined, 0, "blend");
      y += ph + 22;
      y += title(72, y, 936, th + 2, 150, ink, "Post Italic");
      if (footerH) smallCopy(72, bottom - footerH, 936, ink);
    } else if (t.id === "event") {
      await paintMaterial(ctx, W, H, "dark", primary);
      let y = top;
      if (showBrand) y += (await brand(90, y, 900, mutedGold, "center")) + 28;
      if (kicker)
        y +=
          text(
            kicker.toUpperCase(),
            90,
            y,
            900,
            64,
            42,
            mutedGold,
            "Post Sans",
            "center",
          ) + 20;
      y += title(80, y, 920, 310, 148, light, "Post Serif", "center") + 34;
      const ph = bottom - y - footerH - (footerH ? 32 : 0);
      photo(154, y, 772, ph, [0], [386, 386, 16, 16], "float");
      rim(138, y - 14, 804, ph + 28, [402, 402, 20, 20]);
      if (footerH) smallCopy(72, bottom - footerH, 936, light, "center");
    } else if (t.id === "fresh") {
      await paintMaterial(ctx, W, H, "silk", primary);
      glow(
        ctx,
        W * 0.93,
        H * 0.43,
        W * 0.9,
        mixColor(primary, "#b5c995", 0.8),
        0.7,
      );
      const th = photoOnly
        ? 0
        : measure(headline, 920, 128, 66, family("Post Serif"), 310).height;
      const bh = showBrand ? 70 : 0,
        fh = copyHeight(936),
        stack = th + fh + kickerH + (th && fh ? 24 : 0);
      const py = top + bh,
        ph = bottom - py - stack + 135;
      photo(78, py, 1002, ph, undefined, [400, 0, 0, 0], "blend");
      if (showBrand) await brand(72, top, 936, ink);
      let y = bottom - stack;
      if (kicker) y += text(kicker.toUpperCase(), 72, y, 936, 64, 42, ink) + 20;
      y += title(68, y, 936, th + 2, 128, ink, "Post Serif");
      if (fh) smallCopy(72, y + 24, 936, ink);
    } else if (t.id === "combo") {
      await paintMaterial(ctx, W, H, "dark", primary);
      glow(ctx, W * 0.8, H * 0.3, 800, mixColor(primary, "#ba602e", 0.5), 0.45);
      let y = top;
      if (showBrand) y += (await brand(64, y, 952, mutedGold)) + 24;
      if (kicker)
        y += text(kicker.toUpperCase(), 64, y, 952, 64, 42, mutedGold) + 18;
      const th = photoOnly
        ? 0
        : measure(headline, 936, 142, 66, family("Post Italic"), 310).height;
      const ph = bottom - y - th - footerH - 36 - (footerH ? 22 : 0);
      photo(54, y, 972, ph, undefined, [18, 120, 18, 18], "float");
      y += ph + 36;
      y += title(64, y, 952, th + 2, 142, light, "Post Italic");
      if (footerH) smallCopy(72, bottom - footerH, 936, light);
    } else {
      await paintMaterial(ctx, W, H, "silk", primary);
      let y = top;
      if (showBrand) y += (await brand(80, y, 920, ink, "center")) + 26;
      const th = photoOnly
        ? 0
        : measure(headline, 920, 135, 66, family("Post Serif"), 310).height;
      const ph = bottom - y - th - footerH - kickerH - 34 - (footerH ? 22 : 0);
      photo(72, y, 936, ph, undefined, [280, 280, 16, 16], "float");
      y += ph + 34;
      if (kicker)
        y +=
          text(
            kicker.toUpperCase(),
            80,
            y,
            920,
            64,
            42,
            ink,
            "Post Sans",
            "center",
          ) + 20;
      y += title(80, y, 920, th + 2, 135, ink, "Post Serif", "center");
      if (footerH) smallCopy(72, bottom - footerH, 936, ink, "center");
    }
    if (photoBoxes.some((b) => b.height < (items.length > 1 ? 120 : 220)))
      throw Error(
        "There is too much text for this design. Move the description to your caption.",
      );
    if (
      textBoxes.some(
        (b) =>
          b.x < 0 ||
          b.x + b.width > W + 1 ||
          b.y < top ||
          b.y + b.height > bottom + 1,
      )
    )
      throw Error(
        "Some text is too long to read comfortably in this design. Shorten it or move details to the caption.",
      );
    return {
      renderedText,
      textBoxes,
      photoBoxes,
      warnings: [...new Set(warnings)],
      template: t.id,
      width: W,
      height: H,
    };
  } finally {
    images.forEach((im) => im.close());
  }
}

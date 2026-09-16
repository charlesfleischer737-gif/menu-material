import type { Row } from "./client";
import { money } from "./client";
import { drawPhoto, imageBitmap } from "./creation-export";
import { emptyAdjustments } from "./studio";
import { brandTypeface, readableBrandInk } from "./restaurant-look";
import { getPostTemplate } from "./post-templates";
import { loadPostFonts } from "./post-fonts";

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
  const reverse = readableBrandInk(primary),
    headline = String(card?.title ?? draft.title ?? items[0].name);
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
    c: string,
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
    c: string,
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
      const px = x + (n % cols) * (cw + gap),
        py = y + Math.floor(n / cols) * (ch + gap);
      ctx.save();
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
    fill(paper);
    const footerH = copyHeight(936),
      kickerH = kicker ? 64 : 0;
    if (t.id === "editorial" || t.id === "afterdark") {
      // Cinematic, full-frame photography; type floats on a controlled, quiet gradient.
      photo(0, 0, W, H);
      const dark = t.id === "afterdark",
        c = "#fffaf0";
      if (!photoOnly || showBrand) {
        const titleH = photoOnly
          ? 0
          : measure(
              headline,
              900,
              dark ? 146 : 120,
              66,
              family(dark ? "Post Italic" : "Post Sans"),
              350,
            ).height;
        const stack = titleH + footerH + kickerH + (footerH ? 28 : 0),
          atTop = draft.textPlacement === "top";
        const start = atTop ? top + 100 : bottom - stack;
        const g = ctx.createLinearGradient(
          0,
          atTop ? 0 : H,
          0,
          atTop ? Math.min(H, stack + top + 420) : Math.max(0, start - 120),
        );
        g.addColorStop(0, "#080b09ee");
        g.addColorStop(0.55, "#080b09bd");
        g.addColorStop(1, "#080b0900");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (showBrand) {
          const light = photoCharacter(images[0]).topLight > 175;
          if (!light) {
            const bg = ctx.createLinearGradient(0, 0, 0, top + 160);
            bg.addColorStop(0, "#080b0966");
            bg.addColorStop(1, "#080b0900");
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, top + 160);
          }
          await brand(72, top, 936, light ? "#18241c" : c);
        }
        let y = start;
        if (kicker) {
          text(kicker.toUpperCase(), 72, y, 936, 65, 42, c);
          y += 64;
        }
        y += title(
          72,
          y,
          900,
          titleH + 2,
          dark ? 146 : 120,
          c,
          dark ? "Post Italic" : "Post Sans",
        );
        if (footerH) smallCopy(72, y + 28, 936, c);
      }
    } else if (t.id === "special") {
      // An editorial offer poster: paper masthead, ruled signature, inset photo, and price tab.
      let y = top;
      y += await brand(72, y, 936, ink);
      if (showBrand) y += 20;
      rule(72, y, 936, ink, 2);
      y += 26;
      if (kicker) {
        y += text(kicker.toUpperCase(), 72, y, 936, 65, 42, ink) + 18;
      }
      const th = title(
        68,
        y,
        944,
        Math.min(365, usable * 0.28),
        166,
        ink,
        "Post Condensed",
      );
      y += th + 28;
      const ph = bottom - y - footerH - (footerH ? 28 : 0);
      photo(72, y, 936, ph);
      if (price && !photoOnly) {
        measure(price, 420, 80, 48, "Post Condensed", 120);
        const pw = Math.max(170, ctx.measureText(price).width + 48);
        fill(primary, 1008 - pw, y + ph - 116, pw, 116);
        text(
          price,
          1008 - pw + 24,
          y + ph - 100,
          pw - 48,
          95,
          80,
          reverse,
          "Post Condensed",
          "center",
          48,
        );
      }
      if (footerH) smallCopy(72, bottom - footerH, 936, ink);
    } else if (t.id === "launch") {
      // An edge-to-edge horizontal split: oversized display type above a full-width crop.
      fill(primary);
      let y = top;
      if (showBrand) y += (await brand(64, y, 952, reverse)) + 24;
      if (kicker)
        y += text(kicker.toUpperCase(), 64, y, 952, 65, 42, reverse) + 22;
      y +=
        title(
          59,
          y,
          962,
          Math.min(370, usable * 0.28),
          182,
          reverse,
          "Post Condensed",
        ) + 34;
      const photoBottom = footerH ? bottom - footerH - 32 : H;
      photo(0, y, W, photoBottom - y);
      if (footerH) {
        fill(paper, 0, photoBottom, W, H - photoBottom);
        smallCopy(64, bottom - footerH, 952, ink);
      }
    } else if (t.id === "brunch") {
      // Offset magazine composition with an oversized italic headline and a contrasting side rail.
      fill(paper);
      fill(primary, 0, 0, 26, H);
      let y = top;
      if (showBrand) y += (await brand(72, y, 936, ink)) + 28;
      if (kicker) y += text(kicker.toUpperCase(), 72, y, 936, 65, 42, ink) + 18;
      y += title(68, y, 930, 350, 155, ink, "Post Italic") + 32;
      const ph = bottom - y - footerH - (footerH ? 28 : 0);
      photo(164, y, 852, ph);
      rule(72, y, 44, ink, 3);
      rule(72, y + ph - 3, 44, ink, 3);
      if (footerH) smallCopy(164, bottom - footerH, 852, ink);
    } else if (t.id === "bakery") {
      // A bakery paper sleeve: double keyline, portrait photograph, handwritten signature beneath.
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 30, W - 60, H - 60);
      let y = top;
      if (showBrand) y += (await brand(80, y, 920, ink, "center")) + 28;
      if (kicker)
        y +=
          text(
            kicker.toUpperCase(),
            80,
            y,
            920,
            65,
            42,
            ink,
            "Post Sans",
            "center",
          ) + 18;
      const th = photoOnly
        ? 0
        : measure(headline, 920, 120, 66, family("Post Italic"), 310).height;
      const ph = bottom - y - th - footerH - (th ? 30 : 0) - (footerH ? 20 : 0);
      photo(80, y, 920, ph);
      y += ph + 30;
      y += title(80, y, 920, th + 2, 120, ink, "Post Italic", "left");
      if (footerH) smallCopy(80, bottom - footerH, 920, ink);
    } else if (t.id === "event") {
      // A formal invitation with a photographic arch and centered, expressive serif typography.
      fill(primary);
      let y = top;
      if (showBrand) y += (await brand(90, y, 900, reverse, "center")) + 28;
      if (kicker)
        y +=
          text(
            kicker.toUpperCase(),
            90,
            y,
            900,
            65,
            42,
            reverse,
            "Post Sans",
            "center",
          ) + 18;
      y += title(86, y, 908, 310, 140, reverse, "Post Serif", "center") + 32;
      const ph = bottom - y - footerH - (footerH ? 30 : 0);
      photo(170, y, 740, ph, [0], [370, 370, 0, 0]);
      if (footerH) smallCopy(90, bottom - footerH, 900, reverse, "center");
    } else if (t.id === "fresh") {
      // A broad photographic field intersected by a paper label, aligned to a single vertical axis.
      photo(0, 0, W, H);
      const th = photoOnly
        ? 0
        : measure(headline, 810, 120, 66, family("Post Sans"), 325).height;
      const bh = showBrand ? measure(restaurant.name, 810, 42).height + 26 : 0;
      const fh = copyHeight(810),
        stack = th + fh + bh + kickerH + (th && fh ? 24 : 0),
        y = draft.textPlacement === "top" ? top : bottom - stack;
      if (stack) {
        fill(paper, 0, y - 34, 972, stack + 68);
        fill(primary, 0, y - 34, 14, stack + 68);
        let ty = y;
        if (showBrand) ty += (await brand(64, ty, 810, ink)) + 26;
        if (kicker)
          ty += text(kicker.toUpperCase(), 64, ty, 810, 64, 42, ink) + 18;
        ty += title(62, ty, 810, th + 2, 120, ink, "Post Sans");
        if (fh) smallCopy(64, ty + (th ? 24 : 0), 810, ink);
      }
    } else if (t.id === "combo") {
      // A real diptych/mosaic over a compact offer band, never a repeated photo masquerading as two dishes.
      fill(primary);
      let y = top;
      if (showBrand) y += (await brand(64, y, 952, reverse)) + 28;
      if (kicker)
        y += text(kicker.toUpperCase(), 64, y, 952, 65, 42, reverse) + 18;
      const th = photoOnly
        ? 0
        : measure(headline, 952, 150, 66, family("Post Condensed"), 300).height;
      const ph = bottom - y - th - footerH - 36 - (footerH ? 22 : 0);
      photo(0, y, W, ph);
      y += ph + 36;
      y += title(64, y, 952, th + 2, 150, reverse, "Post Condensed");
      if (footerH) smallCopy(64, bottom - footerH, 952, reverse);
    } else {
      // Fine-dining editorial: restrained masthead, large inset image, serif caption and a hairline.
      let y = top;
      if (showBrand) y += (await brand(86, y, 908, ink, "center")) + 28;
      rule(86, y, 908, ink, 1);
      y += 30;
      const th = photoOnly
        ? 0
        : measure(headline, 908, 118, 66, family("Post Serif"), 310).height;
      const ph = bottom - y - th - footerH - kickerH - 32 - (footerH ? 22 : 0);
      photo(86, y, 908, ph);
      y += ph + 32;
      if (kicker)
        y +=
          text(
            kicker.toUpperCase(),
            86,
            y,
            908,
            65,
            42,
            ink,
            "Post Sans",
            "center",
          ) + 18;
      y += title(86, y, 908, th + 2, 118, ink, "Post Serif", "center");
      if (footerH) smallCopy(86, bottom - footerH, 908, ink, "center");
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

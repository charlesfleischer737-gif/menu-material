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
    x: weight ? (cx / weight / 31) * 100 : 50,
    y: weight ? (cy / weight / 31) * 100 : 50,
    background: `rgb(${edges.map((v) => Math.round(v / n)).join(",")})`,
  };
}

/** Composed layouts reserve real space for type; a full-dish fit is the default. */
export async function renderComposedPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
  await loadPostFonts();
  const W = 1080,
    H = channel === "story" ? 1920 : 1350,
    pad = 72,
    top = channel === "story" ? 174 : 64,
    bottom = H - (channel === "story" ? 174 : 64);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const t = getPostTemplate(draft.template),
    card = channel === "carousel" ? carouselSlides(draft)[slide] : null;
  const items: Row[] = card?.items || draft.items || [];
  if (!items.length) throw Error("Choose an approved dish photo first.");
  const bitmaps: ImageBitmap[] = [];
  const warnings: string[] = [];
  const textBoxes: Row[] = [];
  const renderedText: string[] = [];
  const primary = draft.color || restaurant.style?.primary || t.color,
    accent = draft.accent || restaurant.style?.accent || t.accent;
  const bold = ["special", "launch", "combo", "afterdark"].includes(t.id),
    background = bold ? primary : accent,
    ink = readableBrandInk(background);
  const headline = card?.title ?? draft.title ?? items[0].name;
  const mode = draft.textMode || t.textMode,
    showBrand = draft.showBrand ?? t.showBrand;
  const panelPrice =
    draft.showPrice &&
    draft.price !== "" &&
    draft.price != null &&
    (channel !== "carousel" || card?.kind === "cover")
      ? money(Math.round(Number(draft.price) * 100), restaurant.currency)
      : "";
  const facts = [panelPrice, draft.validity, draft.cta]
    .filter(Boolean)
    .join(" · ");
  const headingFamily =
    draft.typography && draft.typography !== "template"
      ? brandTypeface({ typography: draft.typography }).family
      : ["special", "launch", "combo"].includes(t.id)
        ? "Post Condensed"
        : ["brunch", "bakery"].includes(t.id)
          ? "Post Hand"
          : "Post Serif";
  function fill(color: string, x: number, y: number, w: number, h: number) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function text(
    value: string,
    x: number,
    y: number,
    w: number,
    h: number,
    size: number,
    min: number,
    family = "Post Sans",
    align: CanvasTextAlign = "left",
  ) {
    if (!value?.trim()) return;
    let fs = size,
      lines: string[] = [];
    for (; fs >= min; fs--) {
      ctx.font = `${family === "Post Serif" ? 500 : 600} ${fs}px "${family}"`;
      lines = [];
      for (const paragraph of String(value).split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const candidate = line ? line + " " + word : word;
          if (ctx.measureText(candidate).width <= w) line = candidate;
          else {
            if (line) lines.push(line);
            line = "";
            for (const ch of word) {
              if (ctx.measureText(line + ch).width > w) {
                lines.push(line);
                line = "";
              }
              line += ch;
            }
          }
        }
        if (line) lines.push(line);
      }
      if (lines.length * fs * 1.12 <= h) break;
    }
    if (fs < min)
      throw Error(
        `“${String(value).slice(0, 48)}” is too long to read comfortably. Shorten it or move details to the caption.`,
      );
    ctx.fillStyle = ink;
    ctx.textBaseline = "top";
    ctx.textAlign = align;
    const tx = align === "center" ? x + w / 2 : x;
    lines.forEach((line, i) => ctx.fillText(line, tx, y + i * fs * 1.12));
    ctx.textAlign = "left";
    renderedText.push(value);
    const measured = Math.max(
      ...lines.map((line) => ctx.measureText(line).width),
    );
    textBoxes.push({
      value,
      x: align === "center" ? x + (w - measured) / 2 : x,
      y,
      width: measured,
      height: lines.length * fs * 1.12,
      fontSize: fs,
    });
  }
  try {
    for (const item of items)
      bitmaps.push(
        await imageBitmap(item.photoUrl || `/api/assets/${item.photoId}`),
      );
    const character = photoCharacter(bitmaps[0]);
    fill(background, 0, 0, W, H);
    const photoOnly = mode === "photo" && !card?.kind?.includes("closing");
    const centered = ["chef", "afterdark", "event", "bakery"].includes(t.id);
    const placement =
      draft.textPlacement === "top" || draft.textPlacement === "bottom"
        ? draft.textPlacement
        : ["launch", "event", "special"].includes(t.id)
          ? "top"
          : character.quietEdge;
    const lineCount = (value: string, width: number, fs = 42) => {
      ctx.font = `600 ${fs}px "Post Sans"`;
      let count = 0;
      for (const paragraph of String(value || "").split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const next = line ? line + " " + word : word;
          if (ctx.measureText(next).width > width && line) {
            count++;
            line = word;
          } else line = next;
        }
        if (line) count++;
      }
      return count;
    };
    const brandLines = showBrand
      ? lineCount(restaurant.name, W - pad * 2 - (restaurant.logo_id ? 90 : 0))
      : 0;
    const brandH = showBrand ? Math.max(64, brandLines * 48 + 16) : 0;
    const titleH = photoOnly ? 0 : headline.length > 45 ? 244 : 180;
    const detail =
      mode === "full" && draft.description && channel !== "carousel"
        ? draft.description
        : "";
    const detailFits =
      detail.length <= 100 && lineCount(detail, W - pad * 2) <= 2;
    if (detail && !detailFits)
      warnings.push(
        "The description is too long for the image. Check that your caption includes the details you want to share.",
      );
    const detailH = detail && detailFits ? 102 : 0;
    const factsH = facts
      ? Math.min(194, Math.max(100, lineCount(facts, W - pad * 2) * 48 + 8))
      : 0;
    const kicker = photoOnly
      ? ""
      : card?.kind === "dish"
        ? ""
        : draft.kicker || "";
    const kickerH = kicker
      ? Math.max(60, lineCount(kicker.toUpperCase(), W - pad * 2) * 48 + 12)
      : 0;
    const panelH = photoOnly
      ? brandH
      : titleH + brandH + kickerH + detailH + factsH + 32;
    const gap = photoOnly ? 0 : 28,
      usable = bottom - top;
    const maxPhotoH = usable - panelH - gap;
    const outerPad = t.id === "launch" ? 0 : pad,
      photoW = W - outerPad * 2;
    const firstFrame = {
      fit: true,
      ...draft.layouts?.[channel],
      ...items[0].layouts?.[channel],
    };
    const photoH =
      bitmaps.length === 1 && firstFrame.fit
        ? Math.min(maxPhotoH, (photoW * bitmaps[0].height) / bitmaps[0].width)
        : maxPhotoH;
    const contentTop = top + Math.max(0, (usable - photoH - panelH - gap) / 2);
    if (photoH < 300)
      throw Error(
        "There is too much text for this design. Move the description to your caption.",
      );
    const panelY = placement === "top" ? contentTop : contentTop + photoH + gap;
    const photoY = placement === "top" ? contentTop + panelH + gap : contentTop;
    const cols = bitmaps.length > 1 ? 2 : 1,
      rows = Math.ceil(bitmaps.length / cols),
      gutter = 18,
      cw = (photoW - gutter * (cols - 1)) / cols,
      ch = (photoH - gutter * (rows - 1)) / rows;
    bitmaps.forEach((image, index) => {
      const item = items[index],
        edits = {
          ...emptyAdjustments,
          fit: true,
          ...draft.layouts?.[channel],
          ...item.layouts?.[channel],
        };
      const props = photoCharacter(image);
      if (edits.autoFrame && !edits.fit) {
        edits.x = props.x;
        edits.y = props.y;
      }
      const rotatedW = edits.rotate % 180 ? image.height : image.width,
        rotatedH = edits.rotate % 180 ? image.width : image.height;
      const scale =
        (edits.fit
          ? Math.min(cw / rotatedW, ch / rotatedH)
          : Math.max(cw / rotatedW, ch / rotatedH)) * edits.zoom;
      if (scale > 1.1)
        warnings.push(
          `${item.name}: use a larger original for a sharper export.`,
        );
      if (
        !edits.fit &&
        Math.min(cw / (rotatedW * scale), ch / (rotatedH * scale)) < 0.82
      )
        warnings.push(
          `${item.name}: the fill crop trims the photo. Check the whole dish or choose Fit whole dish.`,
        );
      const photo = document.createElement("canvas");
      drawPhoto(
        photo,
        image,
        Math.round(cw),
        Math.round(ch),
        edits,
        background,
      );
      ctx.drawImage(
        photo,
        outerPad + (index % cols) * (cw + gutter),
        photoY + Math.floor(index / cols) * (ch + gutter),
      );
    });
    let ty = panelY;
    if (showBrand) {
      text(
        restaurant.name,
        pad,
        ty,
        W - pad * 2 - (restaurant.logo_id ? 90 : 0),
        brandH - 10,
        42,
        42,
        "Post Sans",
      );
      ty += brandH;
    }
    if (!photoOnly) {
      if (kicker) {
        text(
          kicker.toUpperCase(),
          pad,
          ty,
          W - pad * 2,
          kickerH - 10,
          42,
          42,
          "Post Sans",
          centered ? "center" : "left",
        );
        ty += kickerH;
      }
      text(
        headline,
        pad,
        ty,
        W - pad * 2,
        titleH,
        t.id === "launch" ? 134 : 110,
        66,
        headingFamily,
        centered ? "center" : "left",
      );
      ty += titleH + 20;
      if (detail && detailFits) {
        text(
          detail,
          pad,
          ty,
          W - pad * 2,
          detailH,
          42,
          42,
          "Post Sans",
          centered ? "center" : "left",
        );
        ty += detailH;
      }
      if (facts)
        text(
          facts,
          pad,
          ty,
          W - pad * 2,
          factsH,
          44,
          42,
          "Post Sans",
          centered ? "center" : "left",
        );
    }
    if (showBrand && restaurant.logo_id) {
      const logo = await imageBitmap(`/api/assets/${restaurant.logo_id}`);
      try {
        const size = Math.min(54 / logo.width, 54 / logo.height);
        fill("#ffffff", W - pad - 72, panelY - 4, 72, 62);
        ctx.drawImage(
          logo,
          W - pad - 36 - (logo.width * size) / 2,
          panelY + 27 - (logo.height * size) / 2,
          logo.width * size,
          logo.height * size,
        );
      } finally {
        logo.close();
      }
    }
    return {
      renderedText,
      textBoxes,
      warnings: [...new Set(warnings)],
      template: t.id,
      width: W,
      height: H,
    };
  } finally {
    bitmaps.forEach((image) => image.close());
  }
}

import {
  formats,
  deliveryProfiles,
  emptyAdjustments,
  type Adjustments,
  type PhotoFormat,
} from "./studio";
import { money, type Row } from "./client";
export async function imageBitmap(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw Error("This photo could not be opened. Please try again.");
  return createImageBitmap(await res.blob());
}
export function drawPhoto(
  canvas: HTMLCanvasElement,
  im: ImageBitmap,
  width: number,
  height: number,
  edits: Partial<Adjustments> = {},
  background = "#f4f1ea",
) {
  const e = { ...emptyAdjustments, ...edits };
  const rotated = document.createElement("canvas");
  const turn = ((e.rotate % 360) + 360) % 360;
  rotated.width = turn % 180 ? im.height : im.width;
  rotated.height = turn % 180 ? im.width : im.height;
  const rc = rotated.getContext("2d")!;
  rc.translate(rotated.width / 2, rotated.height / 2);
  rc.rotate((turn * Math.PI) / 180);
  rc.drawImage(im, -im.width / 2, -im.height / 2);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  const scale =
    (e.fit
      ? Math.min(width / rotated.width, height / rotated.height)
      : Math.max(width / rotated.width, height / rotated.height)) * e.zoom;
  const w = rotated.width * scale,
    h = rotated.height * scale;
  const x = ((width - w) * e.x) / 100,
    y = ((height - h) * e.y) / 100;
  ctx.save();
  ctx.filter = `brightness(${e.brightness}%) contrast(${e.contrast}%)`;
  ctx.drawImage(rotated, x, y, w, h);
  ctx.restore();
  if (e.warmth) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle =
      e.warmth > 0
        ? `rgba(255,145,30,${e.warmth / 300})`
        : `rgba(50,135,255,${-e.warmth / 300})`;
    ctx.fillRect(
      Math.max(0, x),
      Math.max(0, y),
      Math.min(width, w),
      Math.min(height, h),
    );
    ctx.restore();
  }
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  mime = "image/jpeg",
  quality = 0.94,
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(Error("The image could not be saved. Please try again.")),
      mime,
      quality,
    ),
  );
}
export async function photoExport(
  aid: string,
  format: PhotoFormat,
  edits: Partial<Adjustments> = {},
) {
  const im = await imageBitmap(`/api/assets/${aid}?download=1`);
  try {
    const profile = formats[format];
    const delivery = format === "doordash" || format === "uber";
    const e = {
      ...emptyAdjustments,
      ...edits,
      ...(delivery ? { fit: false } : {}),
    };
    const rw = e.rotate % 180 ? im.height : im.width,
      rh = e.rotate % 180 ? im.width : im.height;
    const cropW = Math.min(rw, rh * profile.ratio) / e.zoom,
      cropH = cropW / profile.ratio;
    let width: number = profile.width,
      height: number = profile.height;
    if (delivery) {
      const spec = deliveryProfiles[format];
      if (cropW < spec.minWidth || cropH < spec.minHeight)
        throw Error(
          `This crop is too small for ${format === "uber" ? "Uber Eats" : "DoorDash"}. Use a wider, higher-resolution photo; enlarging it will not add detail.`,
        );
      const scale = Math.min(1, cropW / width, cropH / height);
      width = Math.floor(width * scale);
      height = Math.round(width / profile.ratio);
    } else {
      const scale = Math.min(
        1,
        (e.fit ? rw : cropW) / width,
        (e.fit ? rh : cropH) / height,
      );
      if (!e.fit) {
        width = Math.floor(width * scale);
        height = Math.round(width / profile.ratio);
      }
    }
    const canvas = document.createElement("canvas");
    drawPhoto(canvas, im, width, height, e);
    let blob = await canvasBlob(canvas);
    const max = delivery ? deliveryProfiles[format].maxBytes : Infinity;
    for (const quality of [0.86, 0.78, 0.68]) {
      if (blob.size <= max) break;
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (blob.size > max)
      throw Error(
        "This file is too large for this destination. Try a simpler crop.",
      );
    return { blob, width, height };
  } finally {
    im.close();
  }
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const char of text) {
    if (char === "\n" || ctx.measureText(line + char).width > width) {
      lines.push(line);
      line = char === "\n" ? "" : char;
    } else line += char;
  }
  if (line) lines.push(line);
  return lines;
}
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  bold = false,
  family = "Arial",
) {
  let lines: string[] = [];
  for (; size >= 12; size -= 1) {
    ctx.font = `${bold ? "700" : "400"} ${size}px ${family}`;
    lines = wrap(ctx, text, w);
    if (lines.length * size * 1.18 <= h) break;
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.18));
}
function colorInk(color: string) {
  const c = color.replace("#", "");
  const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] > 155
    ? "#183e31"
    : "#ffffff";
}
function bPrice(draft: Row) {
  return draft.showPrice && draft.price !== null && draft.price !== "";
}
export async function renderPost(
  canvas: HTMLCanvasElement,
  draft: Row,
  restaurant: Row,
  channel = "feed",
  slide = 0,
) {
  const width = 1080,
    height = channel === "story" ? 1920 : 1350;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const brand = draft.color || restaurant.style?.primary || "#235b48",
    accent = restaurant.style?.accent || "#e6ef8b";
  const items =
    channel === "carousel" ? draft.items.slice(slide, slide + 1) : draft.items;
  const ims: ImageBitmap[] = [];
  try {
    for (const i of items)
      ims.push(await imageBitmap(`/api/assets/${i.photoId}`));
    const story = channel === "story",
      photoFirst = draft.template === "photo",
      price = draft.template === "price";
    const ink = colorInk(brand);
    ctx.fillStyle = brand;
    ctx.fillRect(0, 0, width, height);
    const top = story ? 170 : 80,
      bottom = photoFirst ? (bPrice(draft) ? 360 : 260) : story ? 560 : 460;
    const photoY = top,
      photoH = height - top - bottom,
      gap = 16,
      cols = ims.length > 1 ? 2 : 1,
      rows = Math.ceil(ims.length / cols) || 1;
    const layout = draft.layouts?.[channel] || emptyAdjustments;
    ims.forEach((im, i) => {
      const c = document.createElement("canvas");
      const w = (width - 96 - gap * (cols - 1)) / cols,
        h = (photoH - gap * (rows - 1)) / rows;
      const labels = ims.length > 1 || channel === "carousel" ? 54 : 0;
      drawPhoto(c, im, Math.round(w), Math.round(h - labels), layout, brand);
      const x = 48 + (i % cols) * (w + gap),
        y = photoY + Math.floor(i / cols) * (h + gap);
      ctx.drawImage(c, x, y);
      if (labels) {
        ctx.fillStyle = ink;
        ctx.textBaseline = "top";
        drawText(
          ctx,
          `${items[i].quantity || 1} × ${items[i].name}`,
          x + 8,
          y + h - labels + 12,
          w - 16,
          38,
          25,
          true,
        );
      }
    });
    ctx.textBaseline = "top";
    ctx.fillStyle = ink;
    drawText(
      ctx,
      restaurant.name || "",
      52,
      story ? 88 : 26,
      930,
      55,
      29,
      true,
    );
    if (restaurant.logo_id) {
      const logo = await imageBitmap(`/api/assets/${restaurant.logo_id}`);
      const scale = Math.min(50 / logo.width, 50 / logo.height);
      ctx.drawImage(
        logo,
        965,
        story ? 80 : 15,
        logo.width * scale,
        logo.height * scale,
      );
      logo.close();
    }
    const offset = (draft.textY ?? 0) * 2;
    const y = height - bottom + 28 + offset;
    if (price) {
      ctx.fillStyle = "#f4f1e7";
      ctx.fillRect(0, height - bottom + 5, width, bottom);
      ctx.fillStyle = "#183e31";
      drawText(
        ctx,
        draft.title || items[0]?.name || "",
        52,
        y,
        976,
        100,
        68,
        true,
      );
      let detailY = y + 112;
      if (bPrice(draft)) {
        drawText(
          ctx,
          money(Math.round(Number(draft.price) * 100), restaurant.currency),
          52,
          detailY,
          976,
          120,
          110,
          true,
        );
        detailY += 138;
      }
      drawText(ctx, draft.description || "", 52, detailY, 976, 70, 28);
      if (draft.validity)
        drawText(ctx, draft.validity, 52, height - 65, 976, 44, 27, true);
      return;
    }
    drawText(
      ctx,
      draft.title || items[0]?.name || "",
      52,
      y,
      976,
      photoFirst ? 110 : 125,
      photoFirst ? 64 : 76,
      true,
      photoFirst ? "Arial" : "Georgia",
    );
    let next = y + (photoFirst ? 122 : 137);
    if (draft.showPrice && draft.price !== null && draft.price !== "") {
      ctx.fillStyle =
        ink === "#ffffff" && colorInk(accent) === "#183e31" ? accent : ink;
      drawText(
        ctx,
        money(Math.round(Number(draft.price) * 100), restaurant.currency),
        52,
        next,
        976,
        85,
        73,
        true,
      );
      next += 97;
      ctx.fillStyle = ink;
    }
    if (!photoFirst) {
      drawText(ctx, draft.description || "", 52, next, 976, 80, 30);
      next += 90;
    }
    if (draft.validity)
      drawText(
        ctx,
        draft.validity,
        52,
        Math.min(height - 62, next),
        976,
        44,
        25,
      );
  } finally {
    ims.forEach((i) => i.close());
  }
}
export async function campaignZip(draft: Row, restaurant: Row) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const channel of draft.channels) {
    const n = channel === "carousel" ? draft.items.length : 1;
    for (let i = 0; i < n; i++) {
      const canvas = document.createElement("canvas");
      await renderPost(canvas, draft, restaurant, channel, i);
      files[`${channel}${n > 1 ? "-" + (i + 1) : ""}.png`] = new Uint8Array(
        await (await canvasBlob(canvas, "image/png")).arrayBuffer(),
      );
    }
  }
  files["caption.txt"] = strToU8(draft.caption || "");
  return new Blob([zipSync(files, { level: 1 }) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export async function menuPdf(menu: Row) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = await import("@pdf-lib/fontkit");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit.default);
  const [regular, bold] = await Promise.all(
    ["Regular", "Bold"].map(async (name) =>
      doc.embedFont(
        await (await fetch(`/fonts/MenuSans-${name}.ttf`)).arrayBuffer(),
        { subset: true },
      ),
    ),
  );
  const size: [number, number] =
    menu.paper === "a4" ? [595.28, 841.89] : [612, 792];
  const margin = 42,
    width = size[0] - margin * 2,
    warnings: string[] = [];
  let page = doc.addPage(size),
    y = size[1] - margin;
  const dark = menu.appearance === "dark",
    ink = dark ? rgb(0.96, 0.96, 0.93) : rgb(0.1, 0.16, 0.12),
    muted = dark ? rgb(0.76, 0.8, 0.75) : rgb(0.37, 0.42, 0.38);
  const lineWrap = (text: string, max: number, font = regular, fs = 10) => {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (
          font.widthOfTextAtSize((line ? line + " " : "") + word, fs) <= max
        ) {
          line += (line ? " " : "") + word;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const ch of word) {
          if (font.widthOfTextAtSize(line + ch, fs) > max) {
            lines.push(line);
            line = "";
          }
          line += ch;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  };
  const logoId = menu.restaurant.logoId || menu.restaurant.logo_id;
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoId) {
    const res = await fetch(`/api/assets/${logoId}`);
    if (!res.ok) throw Error("Your restaurant logo could not be loaded.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    logo =
      bytes[0] === 137 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  }
  const primary = menu.restaurant.style?.primary || "#235b48";
  const headingColor =
    !dark && colorInk(primary) === "#ffffff"
      ? rgb(
          ...([0, 2, 4].map(
            (i) => parseInt(primary.slice(1 + i, 3 + i), 16) / 255,
          ) as [number, number, number]),
        )
      : ink;
  const supported = new Set(regular.getCharacterSet());
  const fullText = [
    menu.restaurant.name,
    ...menu.sections.flatMap((s: Row) => [
      s.name,
      ...s.items.flatMap((i: Row) => [
        i.name,
        i.description || "",
        money(i.price, menu.restaurant.currency),
      ]),
    ]),
  ].join(" ");
  if (
    [...fullText].some((ch) => ch.trim() && !supported.has(ch.codePointAt(0)!))
  )
    throw Error(
      "Our print font cannot display every character in this menu yet. Your digital menu keeps the original text.",
    );
  const setup = () => {
    if (dark)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: size[0],
        height: size[1],
        color: rgb(0.09, 0.17, 0.13),
      });
    const titleX = margin + (logo ? 60 : 0);
    if (logo) {
      const scale = Math.min(46 / logo.width, 46 / logo.height);
      page.drawImage(logo, {
        x: margin,
        y: y - 46,
        width: logo.width * scale,
        height: logo.height * scale,
      });
    }
    const title = lineWrap(
      menu.restaurant.name,
      width - (logo ? 60 : 0),
      bold,
      24,
    );
    for (const line of title) {
      page.drawText(line, {
        x: titleX,
        y: y - 24,
        size: 24,
        font: bold,
        color: headingColor,
      });
      y -= 30;
    }
    y -= 16;
  };
  setup();
  const nextPage = () => {
    page = doc.addPage(size);
    y = size[1] - margin;
    setup();
  };
  const putPhoto = async (
    aid: string,
    x: number,
    py: number,
    w: number,
    h: number,
    name: string,
  ) => {
    const res = await fetch(`/api/assets/${aid}`);
    if (!res.ok) throw Error("A menu photo could not be loaded.");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const img =
      bytes[0] === 137 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const scale = Math.min(w / img.width, h / img.height),
      dw = img.width * scale,
      dh = img.height * scale;
    page.drawImage(img, {
      x: x + (w - dw) / 2,
      y: py + (h - dh) / 2,
      width: dw,
      height: dh,
    });
    const ppi = img.width / (dw / 72);
    if (ppi < 200)
      warnings.push(
        `${name}: ${Math.round(ppi)} PPI at this size. Use a smaller photo placement or a larger original.`,
      );
  };
  for (const section of menu.sections) {
    if (y < margin + 85) nextPage();
    page.drawText(section.name, {
      x: margin,
      y: y - 16,
      font: bold,
      size: 15,
      color: ink,
    });
    y -= 32;
    if (menu.layout === "grid") {
      const gap = 24,
        cw = (width - gap) / 2;
      for (let i = 0; i < section.items.length; i += 2) {
        const cards = section.items.slice(i, i + 2).map((item: Row) => ({
          item,
          names: lineWrap(item.name, cw, bold, 12),
          descs: lineWrap(item.description || "", cw, regular, 10),
        }));
        const photoH = cards.some((c: Row) => c.item.photoId) ? 145 : 0;
        const height = Math.max(
          ...cards.map(
            (c: Row) =>
              photoH +
              c.names.length * 15 +
              c.descs.length * 13 +
              (!c.item.available ? 16 : 0) +
              53,
          ),
        );
        if (height > size[1] - margin * 2 - 80)
          throw Error(
            "A dish description is too long for the photo grid. Shorten it or choose Classic text.",
          );
        if (y - height < margin + 30) {
          nextPage();
          page.drawText(section.name + " (continued)", {
            x: margin,
            y: y - 16,
            font: bold,
            size: 15,
            color: ink,
          });
          y -= 32;
        }
        for (let j = 0; j < cards.length; j++) {
          const { item, names, descs } = cards[j],
            x = margin + j * (cw + gap);
          if (item.photoId)
            await putPhoto(item.photoId, x, y - photoH, cw, photoH, item.name);
          let ty = y - photoH - 18;
          for (const line of names) {
            page.drawText(line, { x, y: ty, size: 12, font: bold, color: ink });
            ty -= 15;
          }
          ty -= 4;
          for (const line of descs) {
            page.drawText(line, {
              x,
              y: ty,
              size: 10,
              font: regular,
              color: muted,
            });
            ty -= 13;
          }
          ty -= 5;
          page.drawText(money(item.price, menu.restaurant.currency), {
            x,
            y: ty,
            size: 11,
            font: bold,
            color: ink,
          });
          if (!item.available)
            page.drawText("Currently unavailable", {
              x,
              y: ty - 16,
              size: 9,
              font: regular,
              color: muted,
            });
        }
        y -= height;
      }
      y -= 12;
      continue;
    }
    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i],
        featured = menu.layout === "featured" && i === 0 && item.photoId,
        grid = menu.layout === "grid";
      const photo = !!item.photoId && (grid || featured);
      const pw = featured ? width : 100,
        ph = featured ? 180 : 90;
      const tw = photo && !featured ? width - 118 : width;
      const names = lineWrap(item.name, tw - 75, bold, 12),
        descs = lineWrap(item.description || "", tw, regular, 10);
      const textH =
          names.length * 15 +
          descs.length * 13 +
          (!item.available ? 16 : 0) +
          18,
        h = featured ? ph + textH + 10 : Math.max(photo ? ph + 14 : 0, textH);
      if (h > size[1] - margin * 2 - 80)
        throw Error(
          `${item.name}: the description is too long for a print page. Shorten it before exporting.`,
        );
      if (y - h < margin + 30) {
        nextPage();
        page.drawText(section.name + " (continued)", {
          x: margin,
          y: y - 16,
          font: bold,
          size: 15,
          color: ink,
        });
        y -= 32;
      }
      if (photo)
        await putPhoto(
          item.photoId,
          featured ? margin : size[0] - margin - pw,
          y - ph,
          pw,
          ph,
          item.name,
        );
      if (featured) y -= ph + 10;
      names.forEach((line, j) =>
        page.drawText(line, {
          x: margin,
          y: y - 13 - j * 15,
          size: 12,
          font: bold,
          color: ink,
        }),
      );
      const price = money(item.price, menu.restaurant.currency);
      page.drawText(price, {
        x: margin + tw - bold.widthOfTextAtSize(price, 11),
        y: y - 13,
        size: 11,
        font: bold,
        color: ink,
      });
      const dy = y - names.length * 15 - 12;
      descs.forEach((line, j) =>
        page.drawText(line, {
          x: margin,
          y: dy - j * 13,
          size: 10,
          font: regular,
          color: muted,
        }),
      );
      if (!item.available)
        page.drawText("Currently unavailable", {
          x: margin,
          y: dy - descs.length * 13 - 4,
          size: 9,
          font: regular,
          color: muted,
        });
      y -= featured ? textH : h;
      page.drawLine({
        start: { x: margin, y: y + 7 },
        end: { x: size[0] - margin, y: y + 7 },
        thickness: 0.4,
        color: muted,
      });
    }
    y -= 12;
  }
  if (menu.qrUrl) {
    if (y < margin + 95) nextPage();
    const { default: QR } = await import("qrcode");
    const data = await QR.toDataURL(menu.qrUrl, {
      width: 512,
      margin: 4,
      errorCorrectionLevel: "M",
    });
    const qr = await doc.embedPng(data);
    page.drawImage(qr, { x: margin, y: y - 72, width: 72, height: 72 });
    page.drawText("View our current menu", {
      x: margin + 84,
      y: y - 32,
      size: 11,
      font: regular,
      color: ink,
    });
  }
  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: size[0] - margin - 35,
      y: 24,
      size: 9,
      font: regular,
      color: muted,
    }),
  );
  doc.setTitle(`${menu.restaurant.name} — Menu`);
  return {
    blob: new Blob([(await doc.save()) as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    }),
    warnings: [...new Set(warnings)],
    pages: pages.length,
  };
}

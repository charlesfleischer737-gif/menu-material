import { renderPost } from "./post-render";
import { postSlideCount } from "./post-composition";
import {
  formats,
  catalogProfiles,
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
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
  const original = await fetch(`/api/assets/${aid}?original=1&download=1`);
  if (!original.ok)
    throw Error("This photo could not be opened. Please try again.");
  const originalBlob = await original.blob();
  // HEIC/HEIF originals stay available unchanged; browsers use their normalized JPEG for crops.
  const im = ["image/heic", "image/heif"].includes(originalBlob.type)
    ? await imageBitmap(`/api/assets/${aid}?download=1`)
    : await createImageBitmap(originalBlob);
  try {
    const profile = formats[format];
    const delivery = format in catalogProfiles;
    const spec = catalogProfiles[format as keyof typeof catalogProfiles];
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
      if (cropW < spec.minWidth || cropH < spec.minHeight)
        throw Error(
          `This crop is too small for ${profile.label}. Use a wider, higher-resolution photo; enlarging it will not add detail.`,
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
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.round(width / profile.ratio));
    }
    const canvas = document.createElement("canvas");
    drawPhoto(canvas, im, width, height, e);
    let blob = await canvasBlob(canvas, "image/jpeg", 0.96);
    const max = delivery ? spec.maxBytes : Infinity;
    for (const quality of [0.95, 0.94]) {
      if (blob.size <= max) break;
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (blob.size > max)
      throw Error(
        "This file exceeds the destination’s size limit at full quality. Try a different crop or download the full-quality image.",
      );
    return { blob, width, height };
  } finally {
    im.close();
  }
}
export async function masterPhotoExport(aid: string) {
  const res = await fetch(`/api/assets/${aid}?original=1&download=1`);
  if (!res.ok)
    throw Error("This photo could not be downloaded. Please try again.");
  const blob = await res.blob();
  const extension = (
    {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    } as Record<string, string>
  )[blob.type];
  if (!extension) throw Error("This file is not a supported image.");
  return { blob, extension };
}
export { renderPost } from "./post-render";
export async function campaignZip(draft: Row, restaurant: Row) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const channel of draft.channels) {
    const n = postSlideCount(draft, channel);
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
  const { brandTypeface, readableBrandInk } = await import("./restaurant-look");
  const { menuCrop } = await import("./menu-design");
  if (!menu.sections?.some((s: Row) => s.items.length))
    throw Error("Add a dish before preparing a print menu.");
  for (const s of menu.sections)
    for (const i of s.items)
      if (!i.name?.trim() || !Number.isFinite(i.price) || i.price < 0)
        throw Error(
          `${i.name || "Untitled dish"}: check the name and price before printing.`,
        );
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit.default);
  const regular = await doc.embedFont(
    await (await fetch("/fonts/MenuSans-Regular.ttf")).arrayBuffer(),
    { subset: true },
  );
  const typeface = brandTypeface(menu.restaurant.style);
  const heading = await doc.embedFont(
    await (await fetch(typeface.printFile)).arrayBuffer(),
    {
      subset: false,
      features: { liga: false, clig: false, dlig: false, hlig: false },
    },
  );
  const size: [number, number] =
    menu.paper === "a4" ? [595.28, 841.89] : [612, 792];
  const margin = 42,
    width = size[0] - margin * 2,
    dark = menu.appearance === "dark",
    design = menu.design || "bistro";
  const spacing =
    menu.density === "compact" ? 12 : menu.density === "spacious" ? 28 : 20;
  const color = (hex: string) =>
    rgb(
      ...([0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
  const background = dark ? "#172b21" : "#faf9f5",
    ink = color(dark ? "#f5f5ed" : "#26382e"),
    muted = color(dark ? "#bdcbbd" : "#69715f");
  const primary = menu.restaurant.style?.primary || "#235b48",
    accent = menu.restaurant.style?.accent || "#f0e3c3";
  const brand = color(
      readableBrandInk(primary) === "#ffffff" ? primary : "#203b2c",
    ),
    headingInk = dark ? ink : brand;
  const warnings: string[] = [];
  const wrap = (value: string, max: number, font = regular, fs = 10) => {
    const lines: string[] = [];
    for (const paragraph of String(value || "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(candidate, fs) <= max) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        line = "";
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
  const supported = new Set(regular.getCharacterSet()),
    headingSupported = new Set(heading.getCharacterSet());
  const texts = [
    menu.restaurant.name,
    menu.title || menu.restaurant.cuisine || "",
    ...menu.sections.flatMap((s: Row) => [
      s.name,
      ...s.items.flatMap((i: Row) => [
        i.name,
        i.description || "",
        money(i.price, menu.restaurant.currency),
      ]),
    ]),
  ];
  if (
    texts.some((t) =>
      [...String(t)].some(
        (ch) =>
          ch.trim() &&
          (!supported.has(ch.codePointAt(0)!) ||
            !headingSupported.has(ch.codePointAt(0)!)),
      ),
    )
  )
    throw Error(
      "Our print fonts cannot display every character in this menu yet. Your digital menu keeps the original text.",
    );
  let page = doc.addPage(size),
    y = size[1] - margin;
  const logoId = menu.restaurant.logoId || menu.restaurant.logo_id;
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoId) {
    const response = await fetch(`/api/assets/${logoId}`);
    if (!response.ok) throw Error("Your restaurant logo could not be loaded.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    logo =
      bytes[0] === 137 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  }
  const setup = () => {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: size[0],
      height: size[1],
      color: color(background),
    });
    const centered = design === "fine";
    const titleX = margin + (logo && !centered ? 60 : 0);
    if (logo) {
      const scale = Math.min(46 / logo.width, 46 / logo.height);
      page.drawImage(logo, {
        x: centered ? (size[0] - logo.width * scale) / 2 : margin,
        y: y - 46,
        width: logo.width * scale,
        height: logo.height * scale,
      });
      if (centered) y -= 58;
    }
    for (const line of wrap(
      menu.restaurant.name,
      width - (logo && !centered ? 60 : 0),
      heading,
      24,
    )) {
      page.drawText(line, {
        x: centered
          ? (size[0] - heading.widthOfTextAtSize(line, 24)) / 2
          : titleX,
        y: y - 24,
        size: 24,
        font: heading,
        color: headingInk,
      });
      y -= 30;
    }
    const subtitle = menu.title || menu.restaurant.cuisine || "";
    if (subtitle)
      for (const line of wrap(
        subtitle,
        width - (logo && !centered ? 60 : 0),
        regular,
        10,
      )) {
        page.drawText(line, {
          x: centered
            ? (size[0] - regular.widthOfTextAtSize(line, 10)) / 2
            : titleX,
          y: y - 12,
          size: 10,
          font: regular,
          color: muted,
        });
        y -= 15;
      }
    if (!centered)
      page.drawLine({
        start: { x: margin, y: y - 10 },
        end: { x: margin + width, y: y - 10 },
        thickness: design === "casual" ? 2 : 0.6,
        color: color(accent),
      });
    y -= centered ? 30 : 28;
  };
  setup();
  let contentTop = y;
  const nextPage = () => {
    page = doc.addPage(size);
    y = size[1] - margin;
    setup();
    contentTop = y;
  };
  const sectionTitle = (name: string, continued = false) => {
    const title = name + (continued ? " (continued)" : ""),
      fs = design === "cafe" ? 12 : 15;
    const font = design === "cafe" ? regular : heading;
    const lines = wrap(
      design === "cafe" ? title.toUpperCase() : title,
      width - 24,
      font,
      fs,
    );
    const h = lines.length * 19 + 14;
    if (design === "cafe" || design === "casual")
      page.drawRectangle({
        x: margin,
        y: y - h + 5,
        width,
        height: h,
        color: design === "cafe" ? color(accent) : brand,
      });
    lines.forEach((line, n) =>
      page.drawText(line, {
        x:
          design === "fine"
            ? (size[0] - font.widthOfTextAtSize(line, fs)) / 2
            : margin + (design === "cafe" || design === "casual" ? 12 : 0),
        y: y - 17 - n * 19,
        size: fs,
        font,
        color:
          design === "casual"
            ? rgb(1, 1, 1)
            : design === "cafe"
              ? color(readableBrandInk(accent))
              : headingInk,
      }),
    );
    y -= h + 10;
  };
  const sectionHeight = (name: string, continued = false) =>
    wrap(
      (design === "cafe" ? name.toUpperCase() : name) +
        (continued ? " (continued)" : ""),
      width - 24,
      design === "cafe" ? regular : heading,
      design === "cafe" ? 12 : 15,
    ).length *
      19 +
    24;
  const ensure = (height: number, section: string, first: boolean) => {
    const sh = sectionHeight(section, !first);
    if (height + sh > contentTop - margin - 24)
      throw Error(
        `${section}: a dish is too long for one page. Shorten its description or choose a text layout.`,
      );
    if (y - height - (first ? sh : 0) < margin + 24) {
      nextPage();
      sectionTitle(section, !first);
    } else if (first) sectionTitle(section);
  };
  const putPhoto = async (
    item: Row,
    x: number,
    py: number,
    w: number,
    h: number,
  ) => {
    const im = await imageBitmap(`/api/assets/${item.photoId}`);
    try {
      const frame = menuCrop(item.crop),
        scale =
          (frame.fit
            ? Math.min(w / im.width, h / im.height)
            : Math.max(w / im.width, h / im.height)) * frame.zoom;
      const ppi = 72 / scale,
        minimum = menu.printProfile === "press" ? 300 : 200;
      if (ppi < minimum)
        warnings.push(
          `${item.name}: ${Math.round(ppi)} PPI at this size. ${minimum} PPI is preferred; choose a larger original or a smaller placement.`,
        );
      const c = document.createElement("canvas"),
        pixelScale = Math.min(300 / 72, 1 / scale);
      drawPhoto(
        c,
        im,
        Math.max(1, Math.round(w * pixelScale)),
        Math.max(1, Math.round(h * pixelScale)),
        frame,
      );
      const pic = await doc.embedJpg(await (await canvasBlob(c)).arrayBuffer());
      page.drawImage(pic, { x, y: py, width: w, height: h });
    } finally {
      im.close();
    }
  };
  for (const section of menu.sections) {
    if (!section.items.length) continue;
    if (menu.layout === "grid") {
      const gap = 24,
        cw = (width - gap) / 2;
      for (let i = 0; i < section.items.length; i += 2) {
        const cards = section.items.slice(i, i + 2).map((item: Row) => ({
          item,
          names: wrap(item.name, cw, heading, 12),
          descs: wrap(item.description || "", cw, regular, 10),
        }));
        const photoH = cards.some((c: Row) => c.item.photoId)
          ? (cw * 3) / 4
          : 0;
        const h =
          photoH +
          Math.max(
            ...cards.map(
              (c: Row) =>
                c.names.length * 15 +
                c.descs.length * 13 +
                (!c.item.available ? 16 : 0) +
                36,
            ),
          ) +
          spacing;
        ensure(h, section.name, i === 0);
        for (let j = 0; j < cards.length; j++) {
          const { item, names, descs } = cards[j],
            x = margin + j * (cw + gap);
          if (item.photoId) await putPhoto(item, x, y - photoH, cw, photoH);
          let ty = y - photoH - 17;
          for (const line of names) {
            page.drawText(line, {
              x,
              y: ty,
              size: 12,
              font: heading,
              color: ink,
            });
            ty -= 15;
          }
          page.drawText(money(item.price, menu.restaurant.currency), {
            x,
            y: ty - 3,
            size: 11,
            font: heading,
            color: ink,
          });
          ty -= 23;
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
          if (!item.available)
            page.drawText("Currently unavailable", {
              x,
              y: ty - 3,
              size: 9,
              font: regular,
              color: muted,
            });
        }
        y -= h;
      }
    } else {
      for (let i = 0; i < section.items.length; i++) {
        const item = section.items[i],
          featured =
            !!item.photoId &&
            menu.layout === "featured" &&
            (item.featured ?? i === 0),
          photoH = featured ? (width * 9) / 16 : 0;
        const price = money(item.price, menu.restaurant.currency),
          priceW = heading.widthOfTextAtSize(price, 11);
        const names = wrap(item.name, width - priceW - 24, heading, 12),
          descs = wrap(item.description || "", width, regular, 10);
        const textH =
          names.length * 15 +
          descs.length * 13 +
          (!item.available ? 16 : 0) +
          14;
        const h = photoH + (featured ? 12 : 0) + textH + spacing;
        ensure(h, section.name, i === 0);
        if (featured) {
          await putPhoto(item, margin, y - photoH, width, photoH);
          y -= photoH + 12;
        }
        names.forEach((line, n) =>
          page.drawText(line, {
            x: margin,
            y: y - 13 - n * 15,
            size: 12,
            font: heading,
            color: ink,
          }),
        );
        page.drawText(price, {
          x: margin + width - priceW,
          y: y - 13,
          size: 11,
          font: heading,
          color: ink,
        });
        const dy = y - names.length * 15 - 12;
        descs.forEach((line, n) =>
          page.drawText(line, {
            x: margin,
            y: dy - n * 13,
            size: 10,
            font: regular,
            color: muted,
          }),
        );
        if (!item.available)
          page.drawText("Currently unavailable", {
            x: margin,
            y: dy - descs.length * 13 - 3,
            size: 9,
            font: regular,
            color: muted,
          });
        y -= textH + spacing;
        if (design !== "fine")
          page.drawLine({
            start: { x: margin, y: y + spacing / 2 },
            end: { x: size[0] - margin, y: y + spacing / 2 },
            thickness: 0.35,
            color: muted,
          });
      }
    }
    y -= 12;
  }
  if (menu.qrUrl) {
    if (y < margin + 95) nextPage();
    const { default: QR } = await import("qrcode");
    const qr = await doc.embedPng(
      await QR.toDataURL(menu.qrUrl, {
        width: 512,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
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
  doc.setTitle(`${menu.restaurant.name} — ${menu.title || "Menu"}`);
  let output = doc;
  if (menu.printProfile === "press") {
    output = await PDFDocument.create();
    const offset = 24,
      bleed = 9;
    const embedded = await output.embedPdf(await doc.save());
    embedded.forEach((embeddedPage) => {
      const sheet = output.addPage([
        size[0] + offset * 2,
        size[1] + offset * 2,
      ]);
      sheet.setTrimBox(offset, offset, size[0], size[1]);
      sheet.setBleedBox(
        offset - bleed,
        offset - bleed,
        size[0] + bleed * 2,
        size[1] + bleed * 2,
      );
      sheet.drawRectangle({
        x: offset - bleed,
        y: offset - bleed,
        width: size[0] + bleed * 2,
        height: size[1] + bleed * 2,
        color: color(background),
      });
      sheet.drawPage(embeddedPage, {
        x: offset,
        y: offset,
        width: size[0],
        height: size[1],
      });
      for (const x of [offset, offset + size[0]])
        for (const yy of [offset, offset + size[1]]) {
          const dx = x === offset ? -1 : 1,
            dy = yy === offset ? -1 : 1;
          sheet.drawLine({
            start: { x: x + dx * 12, y: yy },
            end: { x: x + dx * 21, y: yy },
            thickness: 0.4,
            color: rgb(0, 0, 0),
          });
          sheet.drawLine({
            start: { x, y: yy + dy * 12 },
            end: { x, y: yy + dy * 21 },
            thickness: 0.4,
            color: rgb(0, 0, 0),
          });
        }
    });
    output.setTitle(
      `${menu.restaurant.name} — ${menu.title || "Menu"} · print shop`,
    );
    warnings.push(
      "Print shop file: RGB color, ⅛-inch bleed and crop marks. Confirm the printer’s color-profile and finishing requirements.",
    );
  }
  return {
    blob: new Blob([(await output.save()) as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    }),
    warnings: [...new Set(warnings)],
    pages: pages.length,
  };
}

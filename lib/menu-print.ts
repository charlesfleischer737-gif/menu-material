import type { Row } from "./client";
import { money } from "./client";
import { imageBitmap, drawPhoto, canvasBlob } from "./creation-export";
import { menuCrop, menuHero, menuAppearance } from "./menu-design";
import { paintMaterial, gradient, glow, mixColor } from "./template-materials";
import { readableBrandInk } from "./restaurant-look";

/** Original print compositions. All sizes are PDF points; content stays searchable. */
export async function renderMenuPdf(menu: Row) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = await import("@pdf-lib/fontkit");
  if (!menu.sections?.some((s: Row) => s.items.length))
    throw Error("Add a dish before preparing a print menu.");
  for (const section of menu.sections)
    for (const item of section.items)
      if (!item.name?.trim() || !Number.isFinite(item.price) || item.price < 0)
        throw Error(
          `${item.name || "Untitled dish"}: check the name and price before printing.`,
        );
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit.default);
  const embed = async (path: string, subset = false) =>
    doc.embedFont(await (await fetch(path)).arrayBuffer(), {
      subset,
      features: { liga: false, clig: false, dlig: false, hlig: false },
    });
  const [regular, serif, sans, bold] = await Promise.all([
    embed("/fonts/MenuSans-Regular.ttf", true),
    embed("/fonts/print/CormorantGaramond-Semibold.ttf"),
    embed("/fonts/print/DMSans-Semibold.ttf"),
    embed("/fonts/social/BarlowCondensed-Bold.ttf"),
  ]);
  const size: [number, number] =
    menu.paper === "a4" ? [595.28, 841.89] : [612, 792];
  const design = menu.design || "bistro",
    fine = design === "fine",
    cafe = design === "cafe",
    casual = design === "casual",
    columns =
      (design === "bistro" || casual) &&
      (menu.layout === "grid" ||
        menu.sections.filter((s: Row) => s.items.length).length > 1 ||
        menu.sections.flatMap((s: Row) => s.items).length >= 6);
  const heading =
    fine || cafe || design === "bistro" ? serif : casual ? bold : sans;
  const itemFont = casual || cafe ? sans : heading;
  const margin = fine ? 54 : 42,
    width = size[0] - margin * 2,
    gap = 30;
  const dark = menuAppearance(menu) === "dark",
    background = dark
      ? "#1c2623"
      : fine
        ? "#fffefa"
        : cafe
          ? "#f7f2e8"
          : "#fcf9f1";
  const color = (hex: string) =>
    rgb(
      ...([0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
  const primary = menu.restaurant.style?.primary || "#235b48";
  const brandHex =
    readableBrandInk(primary) === "#ffffff" ? primary : "#24372e";
  const readingDark = dark && !casual;
  const ink = color(readingDark ? "#fbf8ed" : "#252c26"),
    muted = color(readingDark ? "#cdc4b4" : "#686b61"),
    brand = color(readingDark ? "#d6b97f" : brandHex),
    faint = color(readingDark ? "#625644" : "#cecbbf");
  const spacing =
    menu.density === "compact"
      ? cafe
        ? 4
        : fine
          ? 5
          : 9
      : menu.density === "spacious"
        ? cafe
          ? 18
          : 23
        : cafe
          ? 6
          : fine
            ? 7
            : 15;
  const descriptionGap = fine || cafe ? 4 : 5;
  const warnings: string[] = [];
  const wrap = (value: string, max: number, font = regular, fs = 10) => {
    const lines: string[] = [];
    for (const paragraph of String(value || "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
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
  const charsets = [regular, heading, sans].map(
    (f) => new Set(f.getCharacterSet()),
  );
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
          ch.trim() && charsets.some((set) => !set.has(ch.codePointAt(0)!)),
      ),
    )
  )
    throw Error(
      "Our print fonts cannot display every character in this menu yet. Your digital menu keeps the original text.",
    );
  let page = doc.addPage(size),
    y = size[1] - margin,
    contentTop = 0,
    column = 0;
  const pageContent = new Map<
    typeof page,
    { top: number; bottom: number; right: boolean }
  >();
  const colWidths = columns
    ? [
        casual ? (width - gap) * 0.58 : (width - gap) / 2,
        casual ? (width - gap) * 0.42 : (width - gap) / 2,
      ]
    : [fine ? width * 0.84 : width];
  const colX = () =>
    columns
      ? margin + (column ? colWidths[0] + gap : 0)
      : fine
        ? (size[0] - colWidths[0]) / 2
        : margin;
  const colW = () => colWidths[column] || colWidths[0];
  let rail = 0;
  const bodyX = () => colX() + rail,
    bodyW = () => colW() - rail;
  const line = (x: number, yy: number, w: number, c = faint, thickness = 0.5) =>
    page.drawLine({
      start: { x, y: yy },
      end: { x: x + w, y: yy },
      color: c,
      thickness,
    });
  const put = (
    value: string,
    x: number,
    yy: number,
    w: number,
    fs: number,
    font = regular,
    c = ink,
    align = "left",
    leading = fs * 1.24,
  ) => {
    const lines = wrap(value, w, font, fs);
    lines.forEach((v, n) =>
      page.drawText(v, {
        x:
          align === "center"
            ? x + (w - font.widthOfTextAtSize(v, fs)) / 2
            : align === "right"
              ? x + w - font.widthOfTextAtSize(v, fs)
              : x,
        y: yy - fs - n * leading,
        size: fs,
        font,
        color: c,
      }),
    );
    return lines.length * leading;
  };
  const logoId = menu.restaurant.logoId || menu.restaurant.logo_id;
  let logo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoId) {
    const response = await fetch(`/api/assets/${logoId}`);
    if (!response.ok) throw Error("Your restaurant logo could not be loaded.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    logo =
      bytes[0] === 137 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  }
  const hero = menuHero(menu);
  const surface = document.createElement("canvas");
  surface.width = 1224;
  surface.height = Math.round((size[1] / size[0]) * 1224);
  await paintMaterial(
    surface.getContext("2d")!,
    surface.width,
    surface.height,
    dark ? "dark" : "paper",
    primary,
  );
  const ground = await doc.embedJpg(
    await (await canvasBlob(surface)).arrayBuffer(),
  );
  const topIsDark = dark || design === "bistro" || casual;
  const headInk = color(topIsDark ? "#fff5df" : brandHex),
    headMuted = color(topIsDark ? "#d5bd93" : "#69685b");
  const nameSize = fine ? 34 : casual ? 44 : cafe ? 32 : 36;
  const nameWidth = hero && !fine ? width * 0.52 : width;
  const nameHeight =
    wrap(menu.restaurant.name, nameWidth, heading, nameSize).length *
    nameSize *
    1.12;
  const headerH = Math.max(
    hero ? (fine ? 252 : cafe ? 154 : 225) : cafe ? 130 : 164,
    nameHeight + 92 + (hero && fine ? 105 : 0),
  );
  const mast = document.createElement("canvas");
  mast.width = 1224;
  mast.height = Math.ceil((headerH / size[0]) * 1224);
  const mc = mast.getContext("2d")!;
  await paintMaterial(
    mc,
    mast.width,
    mast.height,
    topIsDark ? "dark" : "silk",
    primary,
  );
  if (casual)
    glow(
      mc,
      mast.width * 0.85,
      mast.height * 0.1,
      mast.width * 0.9,
      mixColor(primary, "#d37b46", 0.6),
      0.8,
    );
  if (hero) {
    const im = await imageBitmap(`/api/assets/${hero.photoId}`);
    try {
      const factor = 1224 / size[0],
        pw = (fine ? width * 0.62 : width * 0.48) * factor,
        ph = (fine ? 105 : headerH - 24) * factor;
      const frame = menuCrop(hero.crop);
      const effectiveScale =
        (frame.fit
          ? Math.min(pw / factor / im.width, ph / factor / im.height)
          : Math.max(pw / factor / im.width, ph / factor / im.height)) *
        frame.zoom;
      const ppi = 72 / effectiveScale,
        minimum = menu.printProfile === "press" ? 300 : 200;
      if (ppi < minimum)
        warnings.push(
          `${hero.name}: ${Math.round(ppi)} PPI in the feature photograph. ${minimum} PPI is preferred; choose a larger original.`,
        );
      const pc = document.createElement("canvas");
      drawPhoto(
        pc,
        im,
        Math.round(pw),
        Math.round(ph),
        menuCrop(hero.crop),
        topIsDark ? "#17130f" : "#f5f0e6",
      );
      const px = fine ? (1224 - pw) / 2 : 1224 - pw - 15 * factor,
        py = fine ? mast.height - ph - 8 * factor : 12 * factor;
      const pcx = pc.getContext("2d")!;
      pcx.globalCompositeOperation = "destination-in";
      pcx.fillStyle = gradient(
        pcx,
        0,
        0,
        fine ? 0 : pw,
        fine ? ph : 0,
        fine
          ? [
              [0, "#ffffff00"],
              [0.12, "#ffffff"],
              [0.86, "#ffffff"],
              [1, "#ffffff00"],
            ]
          : [
              [0, "#ffffff00"],
              [0.18, "#ffffff"],
              [1, "#ffffff"],
            ],
      );
      pcx.fillRect(0, 0, pw, ph);
      mc.save();
      mc.beginPath();
      mc.roundRect(px, py, pw, ph, cafe ? [pw / 2, pw / 2, 0, 0] : 12);
      mc.clip();
      mc.drawImage(pc, px, py, pw, ph);
      mc.restore();
    } finally {
      im.close();
    }
  }
  const masthead = await doc.embedJpg(
    await (await canvasBlob(mast)).arrayBuffer(),
  );
  const setup = () => {
    const first = doc.getPageCount() === 1;
    page.drawImage(ground, { x: 0, y: 0, width: size[0], height: size[1] });
    const height = first ? headerH : 86;
    if (first)
      page.drawImage(masthead, {
        x: 0,
        y: size[1] - height,
        width: size[0],
        height,
      });
    else if (topIsDark)
      page.drawRectangle({
        x: 0,
        y: size[1] - height,
        width: size[0],
        height,
        color: color(dark ? "#171713" : brandHex),
      });
    const centered = fine || (!hero && design === "bistro");
    const x = margin,
      w = first ? nameWidth : width,
      align = centered ? "center" : "left";
    y = size[1] - (first ? 27 : 22);
    if (first) {
      if (logo) {
        const sc = Math.min(25 / logo.width, 25 / logo.height);
        page.drawImage(logo, {
          x: centered ? (size[0] - logo.width * sc) / 2 : x,
          y: y - 25,
          width: logo.width * sc,
          height: logo.height * sc,
        });
        y -= 36;
      } else if (!cafe && !casual) {
        const mark = String(menu.restaurant.name)
          .split(/\s+/)
          .filter((v: string) => /[a-z]/i.test(v))
          .slice(0, 2)
          .map((v: string) => v[0])
          .join("");
        const mx = centered ? size[0] / 2 : x + 12;
        page.drawCircle({
          x: mx,
          y: y - 13,
          size: 14,
          borderColor: headMuted,
          borderWidth: 0.6,
        });
        put(mark, mx - 14, y - 4, 28, 12, serif, headMuted, "center");
        y -= 40;
      }
    }
    y -= put(
      casual ? menu.restaurant.name.toUpperCase() : menu.restaurant.name,
      x,
      y,
      w,
      first ? nameSize : 19,
      heading,
      headInk,
      align,
      first ? nameSize * 1.12 : 23,
    );
    const sub = menu.title || menu.restaurant.cuisine || "";
    if (sub) {
      y -= first ? 10 : 5;
      y -= put(
        sub.toUpperCase(),
        x,
        y,
        w,
        first ? 9 : 8,
        sans,
        headMuted,
        align,
      );
    }
    contentTop = size[1] - height - 27;
    y = contentTop;
    if (casual) {
      page.drawRectangle({
        x: margin - 17,
        y: margin + 16,
        width: width + 34,
        height: contentTop - margin - 3,
        color: color("#fbf5e8"),
      });
    } else if (!readingDark) {
      page.drawRectangle({
        x: margin - 14,
        y: margin + 14,
        width: width + 28,
        height: contentTop - margin + 2,
        color: color("#fffcf5"),
        opacity: 0.77,
      });
    } else {
      page.drawRectangle({
        x: margin - 14,
        y: margin + 14,
        width: width + 28,
        height: contentTop - margin + 2,
        color: color("#101711"),
        opacity: 0.56,
      });
    }
    pageContent.set(page, {
      top: contentTop,
      bottom: contentTop,
      right: false,
    });
  };
  setup();
  // Balance short menus across two columns, then flow longer menus at their natural type size.
  const itemMetrics = (item: Row, index: number, w: number) => {
    const hasPhoto =
      !!item.photoId &&
      item.photoId !== hero?.photoId &&
      (menu.layout === "grid" ||
        (menu.layout === "featured" && (item.featured ?? index === 0)));
    const photoH = hasPhoto ? w * (menu.layout === "grid" ? 3 / 4 : 9 / 16) : 0;
    const fs = fine || design === "bistro" ? 13 : 12,
      price = money(item.price, menu.restaurant.currency),
      pw = regular.widthOfTextAtSize(price, 9.5);
    const names = wrap(item.name, w - (fine ? 0 : pw + 13), itemFont, fs),
      descs = wrap(item.description || "", w, regular, 9.5);
    const textH =
      names.length * fs * 1.2 +
      (descs.length ? descriptionGap + descs.length * 12.5 : 0) +
      (fine ? 5 + 9.5 * 1.24 : 0) +
      (item.available === false ? 16 : 0);
    return {
      hasPhoto,
      photoH,
      fs,
      price,
      pw,
      names,
      descs,
      height: photoH + (hasPhoto ? 11 : 0) + textH + spacing,
    };
  };
  const estimate = menu.sections.reduce(
    (total: number, s: Row) =>
      total +
      44 +
      s.items.reduce(
        (sum: number, i: Row, n: number) =>
          sum + itemMetrics(i, n, Math.min(...colWidths)).height,
        0,
      ),
    0,
  );
  const balanceHeight = columns
    ? Math.min(contentTop - margin - 30, Math.max(180, (estimate + 40) / 2))
    : contentTop - margin - 30;
  const nextColumn = () => {
    if (columns && column === 0) {
      column = 1;
      pageContent.get(page)!.right = true;
      y = contentTop;
    } else {
      page = doc.addPage(size);
      column = 0;
      setup();
    }
  };
  const sectionHeight = (name: string) =>
    cafe
      ? Math.max(38, wrap(name, colW() * 0.25 - 12, serif, 20).length * 23 + 15)
      : fine
        ? 35
        : wrap(name, colW() - 22, casual ? bold : sans, casual ? 23 : 10)
            .length *
            (casual ? 27 : 13) +
          23;
  const sectionTitle = (name: string, index: number, continued = false) => {
    const label = name + (continued ? " (continued)" : "");
    rail = cafe ? colW() * 0.28 : 0;
    if (cafe) {
      line(colX(), y + 8, colW());
      put(
        String(index + 1).padStart(2, "0"),
        colX(),
        y,
        rail - 16,
        8,
        sans,
        muted,
      );
      put(label, colX(), y - 17, rail - 16, 20, serif, brand);
      y -= 8;
    } else if (fine) {
      y -= put(
        label.toUpperCase(),
        colX(),
        y,
        colW(),
        9,
        sans,
        brand,
        "center",
      );
      y -= 23;
    } else {
      const fs = casual ? 23 : 10;
      y -= put(
        label.toUpperCase(),
        colX(),
        y,
        colW(),
        fs,
        casual ? bold : sans,
        brand,
      );
      y -= 8;
      line(colX(), y, colW(), brand, casual ? 1 : 0.4);
      y -= 13;
    }
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
            : Math.max(w / im.width, h / im.height)) * frame.zoom,
        ppi = 72 / scale,
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
  for (const [si, section] of (menu.sections as Row[]).entries()) {
    if (!section.items.length) continue;
    let sectionStarted = false,
      sectionY = y;
    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i];
      rail = cafe ? colW() * 0.28 : 0;
      let m = itemMetrics(item, i, bodyW());
      const sh = sectionStarted ? 0 : sectionHeight(section.name);
      if (m.height + sh > contentTop - margin - 24)
        throw Error(
          `${section.name}: a dish is too long for one page. Shorten its description or choose a text layout.`,
        );
      if (
        y - m.height - sh < margin + 28 ||
        (columns &&
          column === 0 &&
          (!sectionStarted || section.items.length > 6) &&
          contentTop - y + m.height + sh > balanceHeight &&
          y < contentTop - 2)
      ) {
        nextColumn();
        rail = cafe ? colW() * 0.28 : 0;
        m = itemMetrics(item, i, bodyW());
        if (
          m.height +
            sectionHeight(
              section.name + (sectionStarted ? " (continued)" : ""),
            ) >
          contentTop - margin - 24
        )
          throw Error(
            `${section.name}: a dish is too long for one column. Shorten its description or choose a text layout.`,
          );
        sectionTitle(section.name, si, sectionStarted);
        sectionStarted = true;
        sectionY = y;
      } else if (!sectionStarted) {
        sectionTitle(section.name, si);
        sectionStarted = true;
        sectionY = y;
      }
      const x = bodyX(),
        w = bodyW();
      if (m.hasPhoto) {
        await putPhoto(item, x, y - m.photoH, w, m.photoH);
        y -= m.photoH + 11;
      }
      const align = fine ? "center" : "left";
      const nameH = put(
        item.name,
        x,
        y,
        w - (fine ? 0 : m.pw + 13),
        m.fs,
        itemFont,
        ink,
        align,
        m.fs * 1.2,
      );
      if (!fine) put(m.price, x, y - m.fs + 9.5, w, 9.5, regular, ink, "right");
      y -= nameH;
      if (m.descs.length) {
        y -= descriptionGap;
        y -= put(item.description, x, y, w, 9.5, regular, muted, align, 12.5);
      }
      if (fine) {
        y -= 5;
        y -= put(m.price, x, y, w, 9.5, regular, muted, "center");
      }
      if (item.available === false) {
        y -= 5;
        y -= put("Currently unavailable", x, y, w, 8, regular, muted, align);
      }
      y -= spacing;
      pageContent.get(page)!.bottom = Math.min(
        pageContent.get(page)!.bottom,
        y,
      );
    }
    if (cafe) y = Math.min(y, sectionY - sectionHeight(section.name));
    y -= fine ? 17 : cafe ? 12 : 18;
  }
  if (menu.qrUrl) {
    if (y < margin + 90) nextColumn();
    const { default: QR } = await import("qrcode");
    const qr = await doc.embedPng(
      await QR.toDataURL(menu.qrUrl, {
        width: 512,
        margin: 4,
        errorCorrectionLevel: "M",
      }),
    );
    page.drawImage(qr, { x: colX(), y: y - 58, width: 58, height: 58 });
    put(
      "View our current menu",
      colX() + 68,
      y - 14,
      colW() - 68,
      9,
      regular,
      muted,
    );
  }
  const pages = doc.getPages();
  for (const [p, bounds] of pageContent)
    if (columns && bounds.right)
      p.drawLine({
        start: { x: margin + colWidths[0] + gap / 2, y: bounds.top },
        end: {
          x: margin + colWidths[0] + gap / 2,
          y: Math.max(margin + 22, bounds.bottom - 6),
        },
        color: faint,
        thickness: 0.4,
      });
  if (pages.length > 1)
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

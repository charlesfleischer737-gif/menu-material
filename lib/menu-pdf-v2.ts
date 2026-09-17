import { menuContentIssues, type DesignedMenu } from "./menu-document";
import { composeMenu, type MenuLayout } from "./menu-layout";
import type { MenuFont } from "./menu-design-system";
import { imageBitmap, drawPhoto, canvasBlob } from "./photo-export";

const fontPaths: Record<MenuFont, string> = {
  sans: "/fonts/MenuSans-Regular.ttf",
  serif: "/fonts/print/CormorantGaramond-Semibold.ttf",
  display: "/fonts/social/BarlowCondensed-Bold.ttf",
  italic: "/fonts/social/CormorantGaramond-Italic.ttf",
};
const fonts = new Map<string, Promise<ArrayBuffer>>();
function fontBytes(path: string) {
  if (!fonts.has(path))
    fonts.set(
      path,
      fetch(path)
        .then((r) => {
          if (!r.ok)
            throw Error("The menu fonts could not load. Please try again.");
          return r.arrayBuffer();
        })
        .catch((e) => {
          fonts.delete(path);
          throw e;
        }),
    );
  return fonts.get(path)!;
}
export type MenuPdfResult = {
  signature: string;
  blob: Blob;
  pages: number;
  warnings: string[];
  layout: MenuLayout;
};
export async function renderDesignedMenuPdf(
  menu: DesignedMenu,
  options: { proof?: boolean } = {},
): Promise<MenuPdfResult> {
  const issues = menuContentIssues(menu);
  if (!options.proof && issues.length) throw Error(issues[0].message);
  const { PDFDocument, rgb } = await import("pdf-lib"),
    fontkit = await import("@pdf-lib/fontkit");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit.default);
  const entries = await Promise.all(
    Object.entries(fontPaths).map(
      async ([name, path]) =>
        [
          name,
          await doc.embedFont(await fontBytes(path), {
            subset: false,
            features: { liga: false, clig: false, dlig: false, hlig: false },
          }),
        ] as const,
    ),
  );
  const embedded = Object.fromEntries(entries) as Record<
    MenuFont,
    (typeof entries)[0][1]
  >;
  const charsets = Object.fromEntries(
    entries.map(([key, font]) => [key, new Set(font.getCharacterSet())]),
  );
  const layout = composeMenu(menu, (text, font, size) =>
    embedded[font].widthOfTextAtSize(text, size),
  );
  for (const page of layout.pages)
    for (const el of page.elements)
      if (el.kind === "text") {
        const missing = [...el.text].find(
          (ch) => ch.trim() && !charsets[el.font].has(ch.codePointAt(0)!),
        );
        if (missing)
          throw Error(
            `The print font cannot display “${missing}” in “${el.text.slice(0, 50)}”. Your original text is preserved. Choose supported text before exporting.`,
          );
      }
  const color = (hex: string) =>
    rgb(
      ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
  const press = menu.printProfile === "press",
    offset = press ? 24 : 0,
    bleed = press ? 9 : 0;
  const warnings = new Set(layout.warnings);
  const preparedPhotos = new Map<
    string,
    Awaited<ReturnType<typeof doc.embedJpg>>
  >();
  for (const page of layout.pages) {
    const sheet = doc.addPage([
      layout.width + offset * 2,
      layout.height + offset * 2,
    ]);
    sheet.setTrimBox(offset, offset, layout.width, layout.height);
    if (press)
      sheet.setBleedBox(
        offset - bleed,
        offset - bleed,
        layout.width + bleed * 2,
        layout.height + bleed * 2,
      );
    sheet.drawRectangle({
      x: offset - bleed,
      y: offset - bleed,
      width: layout.width + bleed * 2,
      height: layout.height + bleed * 2,
      color: color(layout.theme.background),
    });
    for (const el of page.elements) {
      const x = offset + el.x,
        top = offset + layout.height - el.y;
      if (el.kind === "text") {
        const font = embedded[el.font],
          actual = font.widthOfTextAtSize(el.text, el.size);
        const xx =
          x +
          (el.align === "right"
            ? el.width - actual
            : el.align === "center"
              ? (el.width - actual) / 2
              : 0);
        sheet.drawText(el.text, {
          x: xx,
          y: top - el.size,
          size: el.size,
          font,
          color: color(el.color),
        });
      } else if (el.kind === "rect") {
        const ex = Math.max(el.x, -bleed),
          ey = Math.max(el.y, -bleed),
          ew = Math.min(el.x + el.width, layout.width + bleed) - ex,
          eh = Math.min(el.y + el.height, layout.height + bleed) - ey;
        sheet.drawRectangle({
          x: offset + ex,
          y: offset + layout.height - ey - eh,
          width: ew,
          height: eh,
          color: color(el.color),
        });
      } else if (el.kind === "line")
        sheet.drawLine({
          start: { x, y: top },
          end: { x: x + el.width, y: top - el.height },
          thickness: el.thickness || 0.5,
          color: color(el.color),
        });
      else if (el.kind === "photo" || el.kind === "logo") {
        const key = JSON.stringify(el);
        let pic = preparedPhotos.get(key);
        if (!pic) {
          const im = await imageBitmap(`/api/assets/${el.photoId}`);
          try {
            const frame =
              el.kind === "logo"
                ? { fit: true, x: 50, y: 50, zoom: 1 }
                : el.crop || { fit: true, x: 50, y: 50, zoom: 1 };
            const scale =
              (frame.fit
                ? Math.min(el.width / im.width, el.height / im.height)
                : Math.max(el.width / im.width, el.height / im.height)) *
              frame.zoom;
            const ppi = Math.min(300, 72 / scale),
              floor = press ? 300 : 200;
            if (el.kind === "photo" && ppi < floor - 1) {
              const item = menu.sections
                .flatMap((s) => s.items)
                .find((i) => i.id === el.entryId);
              warnings.add(
                `${item?.name || "Photo"}: ${Math.round(ppi)} PPI at this printed size. Choose a larger photo or a smaller placement for ${floor} PPI.`,
              );
            }
            const canvas = document.createElement("canvas"),
              pixelScale = 300 / 72;
            drawPhoto(
              canvas,
              im,
              Math.ceil(el.width * pixelScale),
              Math.ceil(el.height * pixelScale),
              frame,
              el.kind === "logo" ? "rgba(0,0,0,0)" : layout.theme.background,
            );
            pic =
              el.kind === "logo"
                ? await doc.embedPng(
                    await (await canvasBlob(canvas, "image/png")).arrayBuffer(),
                  )
                : await doc.embedJpg(
                    await (await canvasBlob(canvas)).arrayBuffer(),
                  );
            preparedPhotos.set(key, pic);
          } finally {
            im.close();
          }
        }
        sheet.drawImage(pic, {
          x,
          y: top - el.height,
          width: el.width,
          height: el.height,
        });
      }
    }
    if (press)
      for (const x of [offset, offset + layout.width])
        for (const y of [offset, offset + layout.height]) {
          const dx = x === offset ? -1 : 1,
            dy = y === offset ? -1 : 1;
          sheet.drawLine({
            start: { x: x + dx * 12, y },
            end: { x: x + dx * 21, y },
            thickness: 0.4,
            color: rgb(0, 0, 0),
          });
          sheet.drawLine({
            start: { x, y: y + dy * 12 },
            end: { x, y: y + dy * 21 },
            thickness: 0.4,
            color: rgb(0, 0, 0),
          });
        }
  }
  if (press)
    warnings.add(
      "Print shop: RGB color, ⅛-inch artwork bleed, and crop marks. Confirm the color profile with your printer.",
    );
  doc.setTitle(`${menu.restaurant.name} — ${menu.title || menu.name}`);
  doc.setSubject("Restaurant menu");
  doc.setCreator("Menu Material");
  return {
    blob: new Blob([(await doc.save()) as Uint8Array<ArrayBuffer>], {
      type: "application/pdf",
    }),
    pages: layout.pages.length,
    signature: JSON.stringify(menu),
    warnings: [...warnings],
    layout,
  };
}

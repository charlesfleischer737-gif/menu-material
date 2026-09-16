import { brandTypeface, readableBrandInk } from "./restaurant-look";
import type { Row } from "./client";

/** A 4 × 6 inch vector-text card; the QR retains its white quiet zone. */
export async function menuQrCard(restaurant: Row, url: string, qr: string) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const { default: fontkit } = await import("@pdf-lib/fontkit");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = brandTypeface(restaurant.style);
  const [heading, body] = await Promise.all([
    fetch(font.printFile)
      .then((r) => {
        if (!r.ok) throw Error("The print font couldn’t load. Try again.");
        return r.arrayBuffer();
      })
      .then((b) =>
        doc.embedFont(b, {
          subset: false,
          features: { liga: false, clig: false, dlig: false, hlig: false },
        }),
      ),
    fetch("/fonts/MenuSans-Regular.ttf")
      .then((r) => {
        if (!r.ok) throw Error("The print font couldn’t load. Try again.");
        return r.arrayBuffer();
      })
      .then((b) => doc.embedFont(b, { subset: true })),
  ]);
  const name = String(restaurant.name || "Our restaurant");
  const glyphs = new Set(heading.getCharacterSet());
  if ([...name].some((c) => c.trim() && !glyphs.has(c.codePointAt(0)!)))
    throw Error(
      "This print font can’t display every character in your name. Download the QR image to use in your own design.",
    );
  const color = (hex: string) =>
    rgb(
      ...([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
  const primary = restaurant.style?.primary || "#244638";
  const accent = restaurant.style?.accent || "#f4e8c8";
  const page = doc.addPage([288, 432]);
  page.drawRectangle({
    x: 0,
    y: 324,
    width: 288,
    height: 108,
    color: color(primary),
  });
  page.drawRectangle({
    x: 0,
    y: 319,
    width: 288,
    height: 5,
    color: color(accent),
  });
  function wrap(text: string, size: number, maxWidth: number, face = heading) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      if (line && face.widthOfTextAtSize(line + " " + word, size) > maxWidth) {
        lines.push(line);
        line = "";
      }
      for (const c of (line ? " " : "") + word) {
        if (line && face.widthOfTextAtSize(line + c, size) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += c;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  let size = 27;
  let names = wrap(name, size, 240);
  while (names.length * size * 1.2 > 76 && size > 10) {
    size--;
    names = wrap(name, size, 240);
  }
  const nameTop = 378 + ((names.length - 1) * size * 1.2) / 2;
  for (const [i, line] of names.entries())
    page.drawText(line, {
      x: (288 - heading.widthOfTextAtSize(line, size)) / 2,
      y: nameTop - i * size * 1.2 - size * 0.35,
      size,
      font: heading,
      color: color(readableBrandInk(primary)),
    });
  const center = (text: string, y: number, size: number, ink = "#263b2d") =>
    page.drawText(text, {
      x: (288 - body.widthOfTextAtSize(text, size)) / 2,
      y,
      size,
      font: body,
      color: color(ink),
    });
  center("Something good is on the menu.", 290, 12);
  const image = await doc.embedPng(await (await fetch(qr)).arrayBuffer());
  page.drawImage(image, { x: 54, y: 98, width: 180, height: 180 });
  center("Scan to explore our menu", 78, 13);
  center("Open your camera and point it at the code.", 59, 8);
  const link = new URL(url);
  const address = link.host + link.pathname;
  const addressGlyphs = new Set(body.getCharacterSet());
  if ([...address].some((c) => !addressGlyphs.has(c.codePointAt(0)!)))
    throw Error(
      "The menu address can’t be printed with this font. Download the QR image instead.",
    );
  const linkLines = wrap(address, 7, 250, body);
  for (const [i, line] of linkLines.entries())
    center(line, 35 - i * 9, 7, "#52614e");
  doc.setTitle(`${name} — menu QR card`);
  doc.setSubject(
    "Print at actual size on 4 × 6 inch paper, or center on larger paper. Scan a printed copy before distributing.",
  );
  return new Blob([new Uint8Array(await doc.save())], {
    type: "application/pdf",
  });
}

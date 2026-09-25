import { assert } from "./core";
// Inspect dimensions without decoding a potentially enormous image into memory.
export function validateImageDimensions(
  bytes: Uint8Array,
  mime: string,
  working = false,
) {
  if (mime === "image/heic") return; // The retained HEIC original is not decoded server-side; its normalized JPEG is checked separately.
  let width = 0,
    height = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    mime === "image/png" &&
    bytes.length >= 24 &&
    Buffer.from(bytes.subarray(12, 16)).toString() === "IHDR"
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (mime === "image/jpeg") {
    let position = 2;
    while (position + 3 < bytes.length) {
      if (bytes[position++] !== 0xff) break;
      while (bytes[position] === 0xff) position++;
      const marker = bytes[position++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (position + 2 > bytes.length) break;
      const length = view.getUint16(position);
      if (length < 2 || position + length > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        length >= 8
      ) {
        height = view.getUint16(position + 3);
        width = view.getUint16(position + 5);
        break;
      }
      position += length;
    }
  } else if (mime === "image/webp" && bytes.length >= 30) {
    // The first chunk after RIFF….WEBP: lossy, lossless or extended.
    const chunk = Buffer.from(bytes.subarray(12, 16)).toString("latin1");
    if (
      chunk === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    } else if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (chunk === "VP8X") {
      width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    }
  }
  assert(
    width > 0 && height > 0,
    400,
    "This image could not be read. Please export a fresh JPEG or PNG.",
  );
  assert(
    width * height <= 80000000 && (!working || Math.max(width, height) <= 4096),
    413,
    "This image is too large to process safely. Please choose a smaller version.",
  );
}

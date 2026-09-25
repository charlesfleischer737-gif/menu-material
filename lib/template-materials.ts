/** Original photographic materials, composited with each restaurant's color. */
const materials = new Map<string, Promise<ImageBitmap>>();
function material(path: string) {
  let promise = materials.get(path);
  if (!promise) {
    promise = fetch(path)
      .then((r) => {
        if (!r.ok)
          throw Error("The design artwork could not load. Please try again.");
        return r.blob();
      })
      .then((b) => createImageBitmap(b))
      .catch((e) => {
        materials.delete(path);
        throw e;
      });
    materials.set(path, promise);
  }
  return promise;
}
export function mixColor(a: string, b: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - amount) +
            parseInt(b.slice(i, i + 2), 16) * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function gradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  stops: [number, string][],
) {
  const g = ctx.createLinearGradient(x, y, x + width, y + height);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}
export function foil(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return gradient(ctx, x, y, w, h, [
    [0, "#d4b578"],
    [0.32, "#edcf93"],
    [0.53, "#fff0c9"],
    [0.72, "#ddc18c"],
    [1, "#ebcea0"],
  ]);
}
/**
 * Paints a material texture over the whole artwork. The texture is cropped
 * to cover the frame, never stretched, so its grain keeps its shape in every
 * format.
 */
export async function paintMaterial(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "dark" | "paper",
  tint: string,
  strength = 1,
) {
  const im = await material(
    kind === "dark"
      ? "/design-materials/copper-velvet.webp"
      : "/design-materials/botanical-paper.webp",
  );
  const scale = Math.max(width / im.width, height / im.height);
  const sw = width / scale,
    sh = height / scale;
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.drawImage(
    im,
    (im.width - sw) / 2,
    (im.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    width,
    height,
  );
  ctx.globalAlpha = 1;
  // The restaurant's color takes over the texture's own hue.
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = kind === "dark" ? 0.55 : 0.35;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

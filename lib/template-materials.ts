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
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.5,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, color + "00");
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}
export async function paintMaterial(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "dark" | "paper" | "silk",
  primary = "#235b48",
) {
  const im = await material(
    kind === "dark"
      ? "/design-materials/copper-velvet.webp"
      : "/design-materials/botanical-paper.webp",
  );
  ctx.save();
  ctx.fillStyle = kind === "dark" ? "#17130e" : "#f8f2e8";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(im, 0, 0, width, height);
  if (kind === "dark") {
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient(ctx, 0, 0, width, height, [
      [0, "#04090875"],
      [0.55, "#04090800"],
      [1, "#04090826"],
    ]);
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.globalAlpha = kind === "silk" ? 0.76 : 0.36;
    ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    glow(
      ctx,
      width * 0.02,
      height * 0.04,
      width * 0.8,
      mixColor(primary, "#ffffff", 0.8),
      kind === "silk" ? 0.75 : 0.4,
    );
    glow(
      ctx,
      width * 0.94,
      height * 0.85,
      width * 0.7,
      "#eab87c",
      kind === "silk" ? 0.28 : 0.14,
    );
  }
  ctx.restore();
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

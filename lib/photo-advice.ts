export async function photoAdvice(file: File) {
  if (/hei[cf]/i.test(file.type + file.name))
    return "Show the full dish and compare the prepared photo before generating.";
  const im = await createImageBitmap(file),
    messages = [];
  if (Math.min(im.width, im.height) < 800)
    messages.push(
      "This photo is small. Retake at your phone’s full resolution.",
    );
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(im, 0, 0, 64, 64);
  im.close();
  const pixels = ctx.getImageData(0, 0, 64, 64).data;
  let light = 0,
    dark = 0,
    bright = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const v =
      0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    light += v;
    if (v < 20) dark++;
    if (v > 245) bright++;
  }
  if (light / 4096 < 55 && dark / 4096 > 0.4)
    messages.push(
      "Much of the frame is dark. Try moving the dish closer to a window and tap the food to set exposure.",
    );
  if (bright / 4096 > 0.7)
    messages.push(
      "Much of the frame is very bright. If food details are washed out, lower exposure and move out of direct sun.",
    );
  return (
    messages.join(" ") ||
    "Show the whole dish, use soft window light and avoid digital zoom. Review focus and ingredients yourself."
  );
}

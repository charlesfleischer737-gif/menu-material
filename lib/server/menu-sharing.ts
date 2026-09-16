import { assert, config, response, type Row } from "./core";

export async function checkMenuSharing(req: Request, restaurant: Row) {
  assert(
    restaurant.published,
    400,
    "Publish your menu before checking its guest link.",
  );
  const requestOrigin = new URL(req.url).origin;
  const origin = new URL(
    config("LOCAL_DEVELOPMENT") === "true"
      ? requestOrigin
      : config("APP_ORIGIN", requestOrigin),
  ).origin;
  const url = `${origin}/m/${encodeURIComponent(restaurant.slug)}`;
  let accessible = false;
  try {
    // No owner cookies, authorization headers, or redirects are forwarded.
    const check = await fetch(
      `${origin}/api/public/${encodeURIComponent(restaurant.slug)}`,
      {
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      },
    );
    if (
      check.ok &&
      check.headers.get("content-type")?.includes("application/json")
    ) {
      const data = (await check.json()) as Row;
      accessible =
        !!data.menu?.restaurant?.name && Array.isArray(data.menu?.sections);
    }
  } catch {
    /* A check failure never changes the published menu. */
  }
  return response({
    url,
    accessible,
    checkedAt: Date.now(),
    message: accessible
      ? "Guests can open this menu without signing in."
      : "We couldn’t confirm guest access. Try again before printing your QR code.",
  });
}

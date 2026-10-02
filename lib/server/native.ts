import {
  AppError,
  config,
  nativeClient,
  nativeVersion,
  response,
} from "./core";
import { siteContact } from "../site-contact";
import { PRO_PLAN, PRO_PRICE_LABEL } from "../plans";
import { looks, photoStyles, styleCategories, styleFor } from "../studio";
import { styleThumbnail, type PhotoStyle } from "../photo-styles";
import { appleSignInEnabled } from "./apple-auth";
import { googleIosClientId } from "./google-auth";
import { appStoreBillingEnabled, appStoreProductId } from "./app-store";

/** -1, 0 or 1, comparing dotted versions such as "1.2" and "1.10.0". */
export function compareVersions(a: string, b: string) {
  const left = a.split(".").map(Number),
    right = b.split(".").map(Number);
  for (let n = 0; n < Math.max(left.length, right.length); n++) {
    const d = (left[n] || 0) - (right[n] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function minimumVersion() {
  const v = config("IOS_MIN_VERSION").trim();
  return /^\d{1,4}(\.\d{1,4}){0,2}$/.test(v) ? v : "";
}

/**
 * Phones keep old versions of the app for months. When a change needs a newer
 * app, IOS_MIN_VERSION turns older ones away with code "update_required",
 * which the app answers by asking for an update. A request without a version
 * counts as the oldest. The config route stays open so the app can learn
 * what to ask for.
 */
export function requireSupportedApp(req: Request, path: string[]) {
  if (!nativeClient(req) || path[0] === "health" || path[0] === "native")
    return;
  const minimum = minimumVersion();
  if (minimum && compareVersions(nativeVersion(req) || "0", minimum) < 0)
    throw new AppError(
      426,
      "A newer version of Menu Material is available. Update the app to keep going; your work is saved.",
      "update_required",
    );
}

/** What the app needs before anyone signs in. Nothing here is secret. */
export function nativeConfigRoute() {
  const contact = siteContact(config),
    origin = config("APP_ORIGIN").replace(/\/+$/, "");
  return response({
    minimumVersion: minimumVersion() || null,
    signIn: {
      apple: appleSignInEnabled(),
      google: googleIosClientId() || null,
    },
    billing: {
      appStore: appStoreBillingEnabled(),
      productId: appStoreProductId(),
      priceLabel: PRO_PRICE_LABEL,
      imagesPerPeriod: PRO_PLAN.imagesPerPeriod,
    },
    links: {
      support: contact.supportEmail ? `mailto:${contact.supportEmail}` : null,
      terms: contact.termsUrl || null,
      privacy: origin ? `${origin}/privacy` : null,
    },
  });
}

// A look as the app shows and sends it. `photoStyle` and `photoPreset` come
// from the web's own styleFor, with the original angle kept, so the app
// sends exactly what the web does for the same look.
function nativeLook(look: PhotoStyle) {
  const style = styleFor({ look: look.id, angle: "keep" }, {});
  return {
    id: look.id,
    name: look.name,
    cue: look.cue,
    category: look.category ?? null,
    description: look.description ?? null,
    bestFor: look.bestFor ?? null,
    traits: look.traits ?? [],
    pro: !!look.pro,
    plate: look.plate || "keep",
    image: look.image,
    thumbnail: styleThumbnail(look.image),
    photoStyle: String(style.photoStyle),
    photoPreset: String(style.photoPreset),
  };
}

/**
 * The Photo Studio's catalog for the app (`GET /api/native/styles`), read
 * from the same source as the web's, so a new or changed look reaches the
 * app without an app update. Looks an administrator turns off are in
 * `/api/state` (studioAvailability.disabledStyleIds).
 */
export function nativeStylesRoute() {
  const polish = looks.find((look) => look.id === "keep")!;
  return response(
    {
      categories: styleCategories.map(({ id, name, description, use }) => ({
        id,
        name,
        description,
        use,
      })),
      polish: { ...nativeLook(polish), plate: "keep" },
      styles: photoStyles.filter((style) => !style.legacy).map(nativeLook),
    },
    200,
    { "Cache-Control": "public, max-age=3600" },
  );
}

import type { Row } from "./core";
import { z } from "zod";
import {
  studioJobContext,
  recordStudioJob,
  studioProgressReport,
} from "./studio-progress";
import {
  studioAvailability,
  studioReleaseControls,
  saveStudioRelease,
} from "./studio-release";
import { billingRoute, billingSummary, billingEnabled } from "./billing";
import { validateImageDimensions } from "./image-validation";
import { checkMenuSharing } from "./menu-sharing";
import {
  changeMenuAddress,
  menuAddressAvailable,
  releaseMenuAddress,
  resolveMenuAddress,
  suggestMenuAddress,
} from "./menu-address";
import {
  isPlaceholderRestaurantName,
  restaurantNameMessage,
  slugify,
} from "../restaurant-identity";
import { normalizeDietary } from "../dietary";
import {
  menuDocumentsRoute,
  assetInPublishedDocuments,
  pruneDocumentAsset,
  publicDocumentSnapshot,
  syncDishToMenus,
} from "./menu-documents";
import {
  limitedForm,
  reserveStorage,
  releaseStorage,
  loginLimit,
  loginSucceeded,
  publicLimit,
  housekeeping,
  aiControls,
  caller,
} from "./safeguards";
import {
  all,
  admin,
  AppError,
  assert,
  body,
  bucket,
  checkPassword,
  config,
  createSession,
  db,
  digest,
  event,
  hashPassword,
  id,
  limit,
  now,
  one,
  owner,
  passwordNeedsUpgrade,
  remaining,
  response,
  run,
  sameOrigin,
  token,
  viewer,
  withRenewedSession,
} from "./core";
import {
  enqueue,
  updateJob,
  generateCaption,
  jobStatus,
  tick,
  withRenderEstimates,
} from "./generation";
import {
  checkAlertsInBackground,
  clientErrorRoute,
  readiness,
  readinessRoute,
  reportError,
  workerStatus,
} from "./monitoring";
import {
  studioReferenceAvailability,
  studioReferenceRequest,
} from "./studio-references";
import { creationRoute } from "./creation";
import { libraryRoute } from "./library";
import {
  advanceBatches,
  menuTools,
  publicEvent,
  staffAccess,
} from "./menu-tools";
import {
  offerRow,
  promotionRoute,
  publicMenu,
  styleSchema,
  validateStyle,
} from "./promotions";
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((x) => x.toLowerCase());
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters for your password.")
  .max(128);
const dishSchema = z.object({
  creationId: z.string().uuid().optional(),
  revision: z.number().int().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).default(""),
  category: z.string().trim().max(100).default("Dishes"),
  preserve: z.string().max(600).default(""),
  portion: z.string().max(300).default(""),
  plating: z.string().max(300).default(""),
  setting: z.string().max(300).default("Natural daylight"),
  price: z.number().min(0).max(1000000).default(0),
  available: z.boolean().default(true),
  confirmed: z.boolean().default(false),
  // Owner-set tags; saves that leave them out keep the dish's current tags.
  dietary: z
    .preprocess(
      (value) => (value == null ? undefined : normalizeDietary(value)),
      z.array(z.string().max(40)).max(16),
    )
    .optional(),
  // Dish rows store 0/1; only honored when a dish is created.
  sample: z
    .union([z.boolean(), z.number()])
    .transform((value) => !!value)
    .default(false),
});
const menuSchema = z.object({
  design: z.enum(["bistro", "cafe", "fine", "casual"]).default("bistro"),
  density: z
    .enum(["spacious", "comfortable", "compact"])
    .default("comfortable"),
  printProfile: z.enum(["home", "press"]).default("home"),
  title: z.string().max(100).default(""),
  layout: z.enum(["classic", "grid", "featured"]).default("classic"),
  appearance: z.enum(["light", "dark"]).default("light"),
  paper: z.enum(["letter", "a4"]).default("letter"),
  sections: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().trim().min(1).max(100),
        items: z
          .array(
            z.object({
              dishId: z.string().uuid(),
              photoId: z.string().uuid().nullable().optional(),
              featured: z.boolean().optional(),
              crop: z
                .object({
                  fit: z.boolean().default(true),
                  x: z.number().min(0).max(100).default(50),
                  y: z.number().min(0).max(100).default(50),
                  zoom: z.number().min(1).max(2).default(1),
                })
                .optional(),
            }),
          )
          .max(100),
      }),
    )
    .max(30),
});
// A saved look can outlive what it names (a photo style later removed from
// the catalog). Keep the values that are still valid and use defaults for
// the rest, rather than refusing to open the workspace.
function validParts(schema: z.AnyZodObject, value: unknown): Row {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const field = schema.shape[key] as z.ZodTypeAny | undefined;
      if (!field) return [];
      if (field.safeParse(entry).success) return [[key, entry]];
      const inner = field instanceof z.ZodOptional ? field.unwrap() : field;
      return inner instanceof z.ZodObject
        ? [[key, validParts(inner, entry)]]
        : [];
    }),
  );
}
function storedStyle(raw: string) {
  let saved: unknown = {};
  try {
    saved = JSON.parse(raw);
  } catch {}
  const parsed = styleSchema.safeParse(saved);
  return parsed.success
    ? parsed.data
    : styleSchema.parse(validParts(styleSchema, saved));
}
async function signup(req: Request, b: Row) {
  const email = emailSchema.parse(b.email),
    password = passwordSchema.parse(b.password),
    hash = digest(String(b.invite || ""));
  await limit(`signup:${caller(req)}:${email}`, 10);
  const invited = !!String(b.invite || "").trim();
  const invite = invited
    ? await one(
        "SELECT * FROM invites WHERE hash=? AND email=? AND used_by IS NULL AND expires_at>?",
        hash,
        email,
        now(),
      )
    : { role: "owner", allowance: 5 };
  assert(!b.website, 400, "Please check the form and try again.");
  assert(
    invite,
    403,
    "This invitation is invalid, expired, or belongs to another email. Request a new link from the administrator.",
  );
  if (invite.role === "reset") {
    const u = await one("SELECT id FROM users WHERE email=?", email);
    assert(u, 400, "Account not found.");
    const resetClaim = id();
    await db().batch([
      db()
        .prepare(
          "UPDATE users SET password=? WHERE id=? AND EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by IS NULL)",
        )
        .bind(hashPassword(password), u.id, hash),
      db()
        .prepare(
          "DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by IS NULL)",
        )
        .bind(u.id, hash),
      db()
        .prepare(
          "UPDATE invites SET used_by=? WHERE hash=? AND used_by IS NULL",
        )
        .bind(resetClaim, hash),
      // Any other reset link for this account stops working too.
      db()
        .prepare(
          "UPDATE invites SET used_by='superseded' WHERE email=? AND role='reset' AND used_by IS NULL AND EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by=?)",
        )
        .bind(email, hash, resetClaim),
    ]);
    assert(
      (await one("SELECT used_by FROM invites WHERE hash=?", hash))?.used_by ===
        resetClaim,
      409,
      "This reset invitation has already been used.",
    );
    return await createSession(req, u.id);
  }
  assert(
    !(await one("SELECT id FROM users WHERE email=?", email)),
    409,
    "You already have an account. Please sign in.",
  );
  // Setup invitations only make the first administrator.
  assert(
    invite.role !== "admin" ||
      !(await one("SELECT id FROM users WHERE role='admin'")),
    409,
    "An administrator already exists. Ask them for an invitation.",
  );
  const userId = id(),
    rid = id(),
    restaurant = z
      .string()
      .trim()
      .min(1)
      .max(100)
      .parse(b.restaurant || "My restaurant");
  const t = now();
  await db().batch([
    db()
      .prepare(
        "INSERT INTO users (id,email,password,role,created_at) SELECT ?,?,?,?,? WHERE (?=0 OR EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by IS NULL AND expires_at>?)) AND (?!='admin' OR NOT EXISTS(SELECT 1 FROM users WHERE role='admin'))",
      )
      .bind(
        userId,
        email,
        hashPassword(password),
        invite.role,
        t,
        invited ? 1 : 0,
        hash,
        t,
        invite.role,
      ),
    db()
      .prepare(
        "INSERT INTO restaurants (id,user_id,name,slug,allowance,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=?)",
      )
      .bind(
        rid,
        userId,
        restaurant,
        slugify(restaurant) + "-" + rid.slice(0, 8),
        invite.allowance,
        t,
        userId,
      ),
    db()
      .prepare(
        "UPDATE invites SET used_by=? WHERE hash=? AND used_by IS NULL AND EXISTS(SELECT 1 FROM users WHERE id=?)",
      )
      .bind(userId, hash, userId),
  ]);
  assert(
    await one("SELECT id FROM users WHERE id=?", userId),
    409,
    "This invitation has already been used.",
  );
  await event(rid, "onboarded");
  return await createSession(req, userId);
}
async function issueInvite(email: string, allowance: number, role = "owner") {
  const raw = token();
  await db().batch([
    // A new reset link replaces any earlier one for the account.
    db()
      .prepare(
        "UPDATE invites SET used_by='superseded' WHERE email=? AND role='reset' AND ?='reset' AND used_by IS NULL",
      )
      .bind(email, role),
    db()
      .prepare(
        "INSERT INTO invites (hash,email,role,allowance,expires_at,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(digest(raw), email, role, allowance, now() + 7 * 86400000, now()),
  ]);
  return {
    invite: raw,
    path: `/?invite=${encodeURIComponent(raw)}&email=${encodeURIComponent(email)}${role === "reset" ? "&reset=1" : ""}`,
    expiresAt: now() + 7 * 86400000,
  };
}
async function snapshot(r: Row, draft: Row) {
  const sections = [];
  for (const section of draft.sections) {
    const items = [];
    for (const item of section.items) {
      const d = await one(
        "SELECT * FROM dishes WHERE id=? AND restaurant_id=?",
        item.dishId,
        r.id,
      );
      assert(d, 400, "One of the dishes in this menu is missing.");
      let photoId = null;
      if (item.photoId) {
        const a = await one(
          "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND dish_id=? AND approved_at IS NOT NULL AND deleted_at IS NULL",
          item.photoId,
          r.id,
          d.id,
        );
        assert(a, 400, "Menu photos must be approved and belong to this dish.");
        const obj = await bucket().get(a.working_key || a.key);
        assert(obj, 400, "A menu photo is unavailable. Choose another photo.");
        await bucket().put(`public/${r.id}/${a.id}`, await obj.arrayBuffer(), {
          httpMetadata: { contentType: a.working_key ? "image/jpeg" : a.mime },
        });
        photoId = a.id;
      }
      items.push({
        id: d.id,
        name: d.name,
        description: d.description,
        price: d.price,
        available: !!d.available,
        photoId,
        featured: item.featured,
        crop: item.crop,
      });
    }
    sections.push({ id: section.id, name: section.name, items });
  }
  let logoId = null;
  if (r.logo_id) {
    const a = await one(
      "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND kind='logo' AND deleted_at IS NULL",
      r.logo_id,
      r.id,
    );
    if (a) {
      const obj = await bucket().get(
        transparentLogo(a) ? a.key : a.working_key || a.key,
      );
      if (obj) {
        await bucket().put(`public/${r.id}/${a.id}`, await obj.arrayBuffer(), {
          httpMetadata: {
            contentType: transparentLogo(a) ? a.mime : "image/jpeg",
          },
        });
        logoId = a.id;
      }
    }
  }
  return {
    restaurant: {
      name: r.name,
      cuisine: r.cuisine,
      currency: r.currency,
      brand: r.brand,
      style: JSON.parse(r.style || "{}"),
      orderingUrl: r.ordering_url,
      timezone: r.timezone,
      hours: JSON.parse(r.hours),
      logoId,
    },
    sections,
    design: draft.design,
    density: draft.density,
    printProfile: draft.printProfile,
    title: draft.title,
    layout: draft.layout,
    appearance: draft.appearance,
    paper: draft.paper,
  };
}
function assetIsPublished(menu: Row, assetId: string) {
  return (
    menu.restaurant?.logoId === assetId ||
    menu.specials?.some(
      (p: Row) =>
        p.items.some((i: Row) => i.photoId === assetId) ||
        p.restaurant?.logoId === assetId,
    ) ||
    menu.sections?.some((s: Row) =>
      s.items.some((i: Row) => i.photoId === assetId),
    )
  );
}
// Logos keep their transparency: a PNG or WebP original is used as it is,
// not the white-filled JPEG working copy made for photos.
const transparentLogo = (a: Row) =>
  a.kind === "logo" && ["image/png", "image/webp"].includes(a.mime);
function imageMime(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  if (
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return "image/webp";
  if (Buffer.from(bytes.slice(4, 8)).toString() === "ftyp") {
    // AVIF files list the same HEIF base brands (mif1) as HEIC photos.
    const brands = Buffer.from(bytes.slice(8, 32)).toString();
    if (/avif|avis/.test(brands) && !/heic|heix|hevc/.test(brands))
      return "image/avif";
    if (/heic|heix|hevc|mif1|msf1/.test(brands)) return "image/heic";
  }
  return null;
}
async function upload(req: Request, r: Row, forcedKind?: string) {
  // Staff links have their own hourly allowance, so they never use up the owner's.
  await limit(
    (forcedKind === "staff" ? "staff-uploads:" : "uploads:") + r.id,
    100,
    3600,
  );
  assert(
    Number(req.headers.get("content-length") || 0) <= 30 * 1024 * 1024,
    413,
    "Photos must be 20 MB or smaller.",
  );
  const f = await limitedForm(req, 30 * 1024 * 1024),
    file = f.get("file"),
    normalized = f.get("normalized"),
    kind =
      forcedKind ||
      (f.get("kind") === "logo"
        ? "logo"
        : f.get("kind") === "reference"
          ? "reference"
          : "source");
  assert(
    file instanceof File && file.size > 0 && file.size <= 20 * 1024 * 1024,
    400,
    "Choose a JPEG, PNG, WebP or HEIC file up to 20 MB.",
  );
  assert(
    normalized instanceof File &&
      normalized.size > 0 &&
      normalized.size <= 8 * 1024 * 1024,
    400,
    "The photo could not be prepared. Please choose it again.",
  );
  const bytes = new Uint8Array(await file.arrayBuffer()),
    working = new Uint8Array(await normalized.arrayBuffer());
  const mime = imageMime(bytes);
  assert(
    mime !== "image/avif",
    400,
    "AVIF photos aren’t supported yet. Export a JPEG or PNG.",
  );
  assert(
    mime && imageMime(working) === "image/jpeg",
    400,
    "This file is not a supported photo.",
  );
  validateImageDimensions(bytes, mime);
  validateImageDimensions(working, "image/jpeg", true);
  const dishId =
    kind === "source" || kind === "staff"
      ? String(f.get("dishId") || "")
      : null;
  if (dishId)
    assert(
      await one(
        "SELECT 1 FROM dishes WHERE id=? AND restaurant_id=? AND (?!='staff' OR (archived_at IS NULL AND sample=0))",
        dishId,
        r.id,
        kind,
      ),
      404,
      "Dish not found.",
    );
  assert(
    !["source", "staff"].includes(kind) || dishId,
    400,
    "Save your dish first.",
  );
  const uploadKey = f.get("requestKey")
    ? z.string().uuid().parse(f.get("requestKey"))
    : null;
  const uploadFingerprint = uploadKey
    ? digest(
        JSON.stringify({
          dishId,
          kind,
          file: digest(Buffer.from(bytes).toString("base64")),
          working: digest(Buffer.from(working).toString("base64")),
        }),
      )
    : null;
  const existingUpload =
    uploadKey &&
    (await one(
      "SELECT id,upload_fingerprint,deleted_at FROM assets WHERE restaurant_id=? AND upload_key=?",
      r.id,
      uploadKey,
    ));
  if (existingUpload) {
    assert(
      !existingUpload.deleted_at,
      409,
      "This transferred photo was removed. Choose it again to upload a new copy.",
    );
    assert(
      existingUpload.upload_fingerprint === uploadFingerprint,
      409,
      "This upload request belongs to a different photo. Choose the photo again.",
    );
    return response({ id: existingUpload.id }, 201);
  }
  const aid = id(),
    key = `private/${r.id}/source/${aid}`,
    workingKey = `private/${r.id}/working/${aid}.jpg`;
  await reserveStorage(r.id, aid, 2 * (bytes.byteLength + working.byteLength));
  try {
    await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
    await bucket().put(workingKey, working, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    const inserted = await run(
      "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,working_key,mime,name,created_at,upload_key,upload_fingerprint) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(restaurant_id,upload_key) DO NOTHING",
      aid,
      r.id,
      dishId,
      kind,
      key,
      workingKey,
      mime,
      file.name.slice(0, 150),
      now(),
      uploadKey,
      uploadFingerprint,
    );
    if (!inserted.meta.changes) {
      const winner = await one(
        "SELECT id,upload_fingerprint,deleted_at FROM assets WHERE restaurant_id=? AND upload_key=?",
        r.id,
        uploadKey,
      );
      await bucket().delete([key, workingKey]);
      await releaseStorage(aid);
      assert(
        winner &&
          !winner.deleted_at &&
          winner.upload_fingerprint === uploadFingerprint,
        409,
        "This upload request belongs to a different photo. Choose the photo again.",
      );
      return response({ id: winner.id }, 201);
    }
    if (kind === "logo") {
      await run("UPDATE restaurants SET logo_id=? WHERE id=?", aid, r.id);
      await run(
        "UPDATE promotions SET approved_hash=NULL,approved_at=NULL WHERE restaurant_id=?",
        r.id,
      );
    }
  } catch (e) {
    await bucket().delete([key, workingKey]);
    await releaseStorage(aid);
    throw e;
  }
  if (kind === "source")
    await event(r.id, "source_ready", aid, { dishId }, aid).catch(() => {});
  return response({ id: aid }, 201);
}
async function downloadAsset(
  req: Request,
  a: Row,
  key: string,
  publicImage = false,
) {
  // Whichever copy a menu published, including JPEG copies made elsewhere.
  if (transparentLogo(a)) key = a.key;
  const obj = await bucket().get(key);
  assert(obj, 404, "Image not found.");
  const type =
    key === a.working_key
      ? "image/jpeg"
      : obj.httpMetadata?.contentType || a.mime;
  const h = new Headers({
    "Content-Type": type,
    // An asset ID's image never changes, and each request is still checked
    // against the published menu; guests need not download it every visit.
    "Cache-Control": publicImage
      ? "public, max-age=300, stale-while-revalidate=86400"
      : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  // Named after what is sent: the working copy of any upload is a JPEG.
  if (new URL(req.url).searchParams.has("download"))
    h.set(
      "Content-Disposition",
      `attachment; filename="menu-material-${a.id}.${type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg"}"`,
    );
  return new Response(obj.body, { headers: h });
}
export async function handle(req: Request) {
  return withRenewedSession(req, await route(req));
}
async function route(req: Request) {
  try {
    const url = new URL(req.url),
      p = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean);
    const method = req.method;
    if (!(p[0] === "billing" && p[1] === "webhook") && method !== "GET")
      sameOrigin(req);
    if (p[0] === "billing") return await billingRoute(req, p);
    const staffResponse = await staffAccess(req, p, upload);
    if (staffResponse) return staffResponse;
    if (
      p[0] === "health" &&
      p[1] === "ready" &&
      ["GET", "HEAD"].includes(method)
    )
      return await readinessRoute(req);
    if (p[0] === "health") return response({ ok: true });
    if (p[0] === "client-errors" && method === "POST")
      return await clientErrorRoute(req);
    if (p[0] === "access-requests" && method === "POST") {
      await publicLimit(req, "access-request", 5, 3600);
      const b = z
        .object({
          email: emailSchema,
          restaurant: z.string().trim().min(1).max(100),
          website: z.string().max(200).optional(),
        })
        .parse(await body(req));
      if (!b.website) {
        await run(
          "INSERT OR IGNORE INTO launch_requests (id,kind,email,restaurant,created_at) VALUES (?,'access',?,?,?)",
          id(),
          b.email,
          b.restaurant,
          now(),
        );
      }
      // No account details, availability promise or email-delivery claim.
      return response({ ok: true }, 202);
    }
    if (p[0] === "public" && p[1]) {
      // Earlier addresses (printed QR codes) resolve to the restaurant's menu.
      const r = (await resolveMenuAddress(p[1])).restaurant;
      assert(r?.published, 404, "This menu is not currently available.");
      const requestedMenu = url.searchParams.get("menu");
      const selected = requestedMenu
        ? await publicDocumentSnapshot(r.id, requestedMenu)
        : null;
      assert(
        !requestedMenu || selected,
        404,
        "This menu is not currently available.",
      );
      const snapshot = selected || JSON.parse(r.published);
      const menu =
        p[2] === "assets" && p[3] && assetIsPublished(snapshot, p[3])
          ? snapshot
          : (await publicMenu(
              selected ? { ...r, published: JSON.stringify(selected) } : r,
            ))!;
      const tracked = await publicEvent(req, p, r, menu);
      if (tracked) return tracked;
      assert(method === "GET", 405, "Method not allowed.");
      if (p[2] === "assets" && p[3]) {
        assert(
          assetIsPublished(menu, p[3]) ||
            (await assetInPublishedDocuments(r.id, p[3])),
          404,
          "Image not found.",
        );
        const a = await one(
          "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL AND (approved_at IS NOT NULL OR kind=?)",
          p[3],
          r.id,
          "logo",
        );
        assert(a, 404, "Image not found.");
        return await downloadAsset(req, a, `public/${r.id}/${a.id}`, true);
      }
      return response({ menu, publishedAt: r.published_at, serverNow: now() });
    }
    if (p[0] === "internal" && p[1] === "tick" && method === "POST") {
      assert(
        config("JOB_RUNNER_SECRET") &&
          req.headers.get("authorization") ===
            `Bearer ${config("JOB_RUNNER_SECRET")}`,
        403,
        "Access denied.",
      );
      await advanceBatches();
      await tick();
      await housekeeping();
      checkAlertsInBackground();
      return response({ ok: true });
    }
    if (p[0] === "auth") {
      // Per network and before the body is read, so malformed floods stay
      // cheap and only slow their sender.
      if (
        method === "POST" &&
        ["signup", "bootstrap", "owner-invite"].includes(p[1])
      )
        await publicLimit(req, "registration", 20);
      if (method === "POST" && p[1] === "login")
        await publicLimit(req, "login", 30);
      if (p[1] === "logout" && method === "POST") {
        const s = req.headers
          .get("cookie")
          ?.match(/(?:^|;\s*)menu_material_session=([^;]+)/)?.[1];
        if (s) await run("DELETE FROM sessions WHERE hash=?", digest(s));
        return response({ ok: true }, 200, {
          "Set-Cookie":
            "menu_material_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        });
      }
      if (p[1] === "dev" && method === "POST") {
        assert(config("LOCAL_DEVELOPMENT") === "true", 404, "Not found.");
        let u = await one(
          "SELECT * FROM users WHERE email='pilot@menu-material.test'",
        );
        if (!u) {
          const uid = id(),
            rid = id();
          await run(
            "INSERT INTO users (id,email,password,role,created_at) VALUES (?,'pilot@menu-material.test',?,'admin',?)",
            uid,
            hashPassword(token()),
            now(),
          );
          await run(
            "INSERT INTO restaurants (id,user_id,name,slug,allowance,created_at) VALUES (?,?,'Your restaurant','local-pilot',20,?)",
            rid,
            uid,
            now(),
          );
          u = { id: uid };
        }
        return await createSession(req, u.id);
      }
      if (p[1] === "owner-invite" && method === "POST") {
        const trustedEmail = req.headers
          .get("oai-authenticated-user-email")
          ?.toLowerCase();
        assert(
          config("BOOTSTRAP_OWNER_EMAIL") &&
            trustedEmail === config("BOOTSTRAP_OWNER_EMAIL").toLowerCase() &&
            req.headers.get("oai-authenticated-user-id"),
          403,
          "Only the signed-in Site owner can initialize administration.",
        );
        assert(
          !(await one("SELECT id FROM users WHERE role='admin'")),
          409,
          "An administrator already exists.",
        );
        await limit("owner-bootstrap:" + trustedEmail, 5);
        return response({
          ...(await issueInvite(trustedEmail!, 20, "admin")),
          email: trustedEmail,
        });
      }
      const b = await body(req);
      if (p[1] === "signup" && method === "POST") return await signup(req, b);
      if (p[1] === "login" && method === "POST") {
        const email = emailSchema.parse(b.email),
          password = z.string().max(128).parse(b.password);
        // Only well-formed attempts count toward the per-account slowdown.
        await loginLimit(req, email);
        const u = await one("SELECT * FROM users WHERE email=?", email);
        assert(
          checkPassword(password, u?.password) && u,
          401,
          "Email or password is incorrect.",
        );
        await loginSucceeded(email);
        if (passwordNeedsUpgrade(u.password))
          // Unless a reset changed it meanwhile.
          await run(
            "UPDATE users SET password=? WHERE id=? AND password=?",
            hashPassword(password),
            u.id,
            u.password,
          );
        return await createSession(req, u.id);
      }
      if (p[1] === "bootstrap" && method === "POST") {
        await limit("bootstrap:" + caller(req), 5);
        assert(
          config("ADMIN_SETUP_KEY") &&
            digest(String(b.setupKey)) === digest(config("ADMIN_SETUP_KEY")),
          403,
          "The setup key is incorrect or admin setup is not enabled.",
        );
        assert(
          !(await one("SELECT id FROM users WHERE role='admin'")),
          409,
          "An administrator already exists.",
        );
        const invite = await issueInvite(
          emailSchema.parse(b.email),
          20,
          "admin",
        );
        return response(invite);
      }
      throw new AppError(404, "Not found.");
    }
    if (p[0] === "state" && method === "GET") {
      const u = await viewer(req);
      if (!u)
        return response({
          user: null,
          studioAvailability: await studioAvailability(),
          billingEnabled: billingEnabled(),
          ownerSetup:
            !!config("BOOTSTRAP_OWNER_EMAIL") &&
            req.headers.get("oai-authenticated-user-email")?.toLowerCase() ===
              config("BOOTSTRAP_OWNER_EMAIL").toLowerCase() &&
            !!req.headers.get("oai-authenticated-user-id") &&
            !(await one("SELECT id FROM users WHERE role='admin'")),
          local: config("LOCAL_DEVELOPMENT") === "true",
          aiConnected: !!config("OPENAI_API_KEY"),
        });
      const { r } = await owner(req);
      return response({
        user: u,
        studioAvailability: await studioAvailability(r.id),
        restaurant: {
          ...r,
          style: storedStyle(r.style),
          hours: JSON.parse(r.hours),
          menuDraft: JSON.parse(r.menu_draft),
          published: r.published ? JSON.parse(r.published) : null,
        },
        remaining: await remaining(r.id),
        billing: await billingSummary(r.id),
        aiConnected: !!config("OPENAI_API_KEY"),
        local: config("LOCAL_DEVELOPMENT") === "true",
        workerHealthy: (await workerStatus()).healthy,
        dishes: (
          await all(
            "SELECT * FROM dishes WHERE restaurant_id=? ORDER BY created_at DESC",
            r.id,
          )
        ).map((d) => ({ ...d, dietary: normalizeDietary(d.dietary) })),
        assets: await all(
          "SELECT id,dish_id,kind,mime,name,approved_at,needs_correction,created_at FROM assets WHERE restaurant_id=? AND deleted_at IS NULL ORDER BY created_at DESC",
          r.id,
        ),
        assetEdits: await all(
          "SELECT e.* FROM asset_edits e JOIN assets a ON a.id=e.asset_id WHERE a.restaurant_id=? AND a.deleted_at IS NULL",
          r.id,
        ),
        jobs: await withRenderEstimates(
          await all(
            "SELECT id,restaurant_id,dish_id,request_key,credit_period,fingerprint,prompt,json_remove(details,'$.generationPrompts') AS details,input_method,source_id,parent_id,status,created_at FROM jobs WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 100",
            r.id,
          ),
        ),
        outputs: await all(
          "SELECT id,job_id,slot,status,asset_id,error,attempts,submitted_at FROM outputs WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 200",
          r.id,
        ),
        promotions: (
          await all(
            "SELECT * FROM promotions WHERE restaurant_id=? ORDER BY updated_at DESC",
            r.id,
          )
        ).map(offerRow),
        imports: await all(
          "SELECT id,name,mime,draft,status,error,created_at FROM menu_imports WHERE restaurant_id=? ORDER BY created_at DESC",
          r.id,
        ),
        batchItems: await all(
          "SELECT b.*,j.status AS job_status FROM batch_items b LEFT JOIN jobs j ON j.id=b.job_id WHERE b.restaurant_id=? ORDER BY b.created_at DESC LIMIT 100",
          r.id,
        ),
        captions: await all(
          "SELECT id,dish_id,body,created_at FROM captions WHERE restaurant_id=? ORDER BY created_at DESC",
          r.id,
        ),
        // Last, so it is as close as possible to when the page receives it.
        serverTime: now(),
      });
    }
    if (p[0] === "admin") {
      await admin(req);
      if (method === "GET" && p[1] === "studio-report") {
        const mode = z
          .enum(["production", "internal"])
          .parse(url.searchParams.get("mode") || "production");
        const days = z.coerce
          .number()
          .int()
          .min(7)
          .max(90)
          .parse(url.searchParams.get("days") || 30);
        return response(await studioProgressReport(mode, days));
      }
      if (
        method === "GET" &&
        p[1] === "photo-correction" &&
        p[2] &&
        ["original", "reported"].includes(p[3])
      ) {
        const report = await one(
          "SELECT * FROM photo_corrections WHERE original_job_id=?",
          z.string().uuid().parse(p[2]),
        );
        assert(report, 404, "Report not found.");
        const asset = await one(
          "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
          p[3] === "original" ? report.source_id : report.reported_asset_id,
          report.restaurant_id,
        );
        assert(asset, 404, "This photo is no longer available.");
        return downloadAsset(req, asset, asset.working_key || asset.key);
      }
      if (method === "GET")
        return response({
          restaurants: await all(
            "SELECT r.id,r.name,r.slug,r.public_suspended,r.allowance,r.paused,r.daily_budget_cents,r.created_at,u.email,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status='completed') AS completed,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status NOT IN ('completed','failed')) AS reserved,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status='failed') AS failed,(SELECT sum(cost_estimate) FROM outputs WHERE restaurant_id=r.id) AS cost_estimate,(SELECT count(*) FROM assets WHERE restaurant_id=r.id AND approved_at IS NOT NULL AND kind='generated') AS approved,(SELECT sum(CAST(json_extract(details,'$.minutes') AS INTEGER)) FROM events WHERE restaurant_id=r.id AND kind='support_time') AS support_minutes FROM restaurants r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC",
          ),
          controls: await aiControls(),
          studioRelease: await studioReleaseControls(),
          studioPipelines: await all(
            "SELECT DISTINCT COALESCE(json_extract(details,'$.pipelineVersion'),'legacy') AS version FROM jobs ORDER BY version LIMIT 50",
          ),
          worker: {
            configured: !!config("JOB_RUNNER_SECRET"),
            lastSeen: Number(
              (
                await one(
                  "SELECT value FROM app_settings WHERE key='worker-heartbeat'",
                )
              )?.value || 0,
            ),
          },
          readiness: await readiness(),
          spend: await all(
            "SELECT restaurant_id,kind,SUM(reserved_cents) AS cents FROM ai_spend WHERE budget_day=? AND status!='rejected' GROUP BY restaurant_id,kind",
            new Date(now()).toISOString().slice(0, 10),
          ),
          requests: await all(
            "SELECT id,kind,email,restaurant,status,created_at FROM launch_requests WHERE kind IN ('access','pro') ORDER BY status='new' DESC,created_at DESC LIMIT 200",
          ),
          // Links that still work: invitations, setup invitations and resets.
          invites: await all(
            "SELECT hash AS id,email,role,allowance,expires_at,created_at FROM invites WHERE used_by IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 100",
            now(),
          ),
          events: await all(
            "SELECT * FROM events ORDER BY created_at DESC LIMIT 100",
          ),
          photoCorrections: await all(
            "SELECT c.*,r.name AS restaurant_name FROM photo_corrections c JOIN restaurants r ON r.id=c.restaurant_id WHERE c.status='review' ORDER BY c.created_at LIMIT 200",
          ),
          outputs: await all(
            "SELECT id,restaurant_id,job_id,status,attempts,usage,cost_estimate,error FROM outputs ORDER BY created_at DESC LIMIT 200",
          ),
        });
      const b = await body(req);
      if (p[1] === "studio-release")
        return response(await saveStudioRelease(b));
      if (p[1] === "photo-correction") {
        const input = z
          .object({
            originalJobId: z.string().uuid(),
            action: z.enum(["restore", "resolve"]),
            resolution: z.string().trim().min(5).max(500),
          })
          .parse(b);
        const report = await one(
          "SELECT * FROM photo_corrections WHERE original_job_id=?",
          input.originalJobId,
        );
        assert(report, 404, "Report not found.");
        if (input.action === "restore") {
          const { restoreCorrectionCredit } =
            await import("./correction-policy");
          const restored = await restoreCorrectionCredit(
            input.originalJobId,
            true,
            input.resolution,
          );
          assert(
            restored?.credited_at,
            409,
            "There is no eligible original image charge to restore.",
          );
        } else
          await run(
            "UPDATE photo_corrections SET status=CASE WHEN credited_at IS NULL THEN 'resolved' ELSE 'credited' END,resolution=?,updated_at=? WHERE original_job_id=?",
            input.resolution,
            now(),
            input.originalJobId,
          );
        await event(
          report.restaurant_id,
          "food_error_reviewed",
          report.reported_asset_id,
          { action: input.action },
        );
        return response({ ok: true });
      }
      if (p[1] === "ai-controls") {
        const settings = z
          .object({
            paused: z.boolean(),
            dailyBudgetCents: z.number().int().min(0).max(1000000),
          })
          .parse(b);
        await run(
          "INSERT INTO app_settings (key,value) VALUES ('ai-controls',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          JSON.stringify(settings),
        );
        await event(null, "ai_controls_updated", null, settings);
        return response({ ok: true });
      }
      if (p[1] === "access-request") {
        const data = z
          .object({
            id: z.string().uuid(),
            status: z.enum(["new", "reviewed"]),
          })
          .parse(b);
        await run(
          "UPDATE launch_requests SET status=? WHERE id=?",
          data.status,
          data.id,
        );
        return response({ ok: true });
      }
      if (p[1] === "invite") {
        return response(
          await issueInvite(
            emailSchema.parse(b.email),
            z
              .number()
              .int()
              .min(0)
              .max(10000)
              .parse(b.allowance ?? 20),
            b.reset === true ? "reset" : "owner",
          ),
        );
      }
      if (p[1] === "invite-revoke") {
        const revoked = await run(
          "UPDATE invites SET used_by='revoked' WHERE hash=? AND used_by IS NULL",
          z
            .string()
            .regex(/^[0-9a-f]{64}$/, "Choose a link to revoke.")
            .parse(b.id),
        );
        assert(
          revoked.meta.changes,
          404,
          "This link was already used or revoked.",
        );
        return response({ ok: true });
      }
      if (p[1] === "restaurant") {
        const rid = z.string().uuid().parse(b.id);
        assert(
          await one("SELECT id FROM restaurants WHERE id=?", rid),
          404,
          "Restaurant not found.",
        );
        await run(
          "UPDATE restaurants SET allowance=?,paused=?,daily_budget_cents=COALESCE(?,daily_budget_cents) WHERE id=?",
          z.number().int().min(0).max(100000).parse(b.allowance),
          b.paused ? 1 : 0,
          b.dailyBudgetCents === undefined
            ? null
            : z.number().int().min(0).max(1000000).parse(b.dailyBudgetCents),
          rid,
        );
        await event(rid, "allowance_updated", null, {
          allowance: b.allowance,
          paused: !!b.paused,
        });
        return response({ ok: true });
      }
      if (p[1] === "release-address") {
        const address = z
          .string()
          .trim()
          .toLowerCase()
          .min(1)
          .max(60)
          .parse(b.address);
        const released = await releaseMenuAddress(address);
        assert(released, 404, "No menu uses that address.");
        await event(released.restaurantId, "menu_address_released", null, {
          address,
          moved: released.moved,
        });
        return response({ ok: true, moved: released.moved });
      }
      if (p[1] === "takedown") {
        // Public menu pages and specials go offline (and stay unpublishable)
        // until an administrator restores them; nothing is deleted.
        const input = z
          .object({ id: z.string().uuid(), offline: z.boolean() })
          .parse(b);
        const changed = await run(
          "UPDATE restaurants SET public_suspended=? WHERE id=?",
          input.offline ? 1 : 0,
          input.id,
        );
        assert(changed.meta.changes, 404, "Restaurant not found.");
        await event(
          input.id,
          input.offline ? "public_pages_taken_down" : "public_pages_restored",
        );
        return response({ ok: true });
      }
      if (p[1] === "support") {
        await event(
          z.string().uuid().parse(b.restaurantId),
          "support_time",
          null,
          { minutes: z.number().int().min(1).max(600).parse(b.minutes) },
        );
        return response({ ok: true });
      }
      throw new AppError(404, "Not found.");
    }
    if (p[0] === "plan-waitlist" && method === "POST") {
      // One entry per owner; asking again changes nothing.
      const { u, r } = await owner(req);
      await run(
        "INSERT OR IGNORE INTO launch_requests (id,kind,email,restaurant,created_at) VALUES (?,'pro',?,?,?)",
        id(),
        u.email,
        r.name,
        now(),
      );
      return response({ ok: true });
    }
    const { r } = await owner(req);
    if (
      r.public_suspended &&
      method === "POST" &&
      ((p[0] === "menu" && p[1] === "publish") ||
        (["menus", "promotions"].includes(p[0]) &&
          ["publish", "primary", "live"].includes(p[2])))
    )
      throw new AppError(
        403,
        "An administrator has taken your public menu pages offline, so nothing can be published. Contact support to restore them.",
      );
    if (p[0] === "studio-references" && !p[1] && method === "POST") {
      const input = studioReferenceRequest.parse(await body(req));
      return response(
        await studioReferenceAvailability(r.id, input.referenceIds),
      );
    }
    const libraryResponse = await libraryRoute(req, p, r);
    if (libraryResponse) return libraryResponse;
    const menuDocumentResponse = await menuDocumentsRoute(req, p, r);
    if (menuDocumentResponse) return menuDocumentResponse;
    const creationResponse = await creationRoute(req, p, r);
    if (creationResponse) return creationResponse;
    if (p[0] === "batches" && p[1] === "retry" && method === "POST")
      z.object({ id: z.string().uuid("Choose a batch item.") }).parse(
        await body(req.clone() as Request),
      );
    const toolsResponse = await menuTools(req, p, r);
    if (toolsResponse) return toolsResponse;
    const promotionResponse = await promotionRoute(req, p, r);
    if (promotionResponse) return promotionResponse;
    if (p[0] === "sharing" && p[1] === "check" && method === "POST")
      return await checkMenuSharing(req, r);
    if (p[0] === "restaurant" && p[1] === "name" && method === "POST") {
      const { name } = z
        .object({ name: z.string().trim().min(1).max(100) })
        .parse(await body(req));
      assert(
        !isPlaceholderRestaurantName(name),
        400,
        "Enter your restaurant’s real name.",
      );
      await run("UPDATE restaurants SET name=? WHERE id=?", name, r.id);
      if (name !== r.name)
        await run(
          "UPDATE promotions SET approved_hash=NULL,approved_at=NULL WHERE restaurant_id=?",
          r.id,
        );
      return response({ ok: true, name });
    }
    if (p[0] === "restaurant" && p[1] === "address") {
      if (method === "GET") {
        const requested = (url.searchParams.get("check") || "")
          .trim()
          .toLowerCase();
        return response({
          current: r.slug,
          suggestion: await suggestMenuAddress(r.name, r.id),
          ...(requested
            ? {
                requested,
                available:
                  requested === r.slug ||
                  (await menuAddressAvailable(requested, r.id)),
              }
            : {}),
        });
      }
      assert(method === "POST", 405, "Method not allowed.");
      await limit("menu-address:" + r.id, 10, 3600);
      const { address } = z
        .object({ address: z.string().trim().toLowerCase().max(60) })
        .parse(await body(req));
      const slug = await changeMenuAddress(r, address);
      await event(r.id, "menu_address_changed");
      return response({ ok: true, slug });
    }
    if (p[0] === "restaurant" && method === "POST") {
      const b = z
        .object({
          name: z.string().trim().min(1).max(100),
          cuisine: z.string().max(100),
          brand: z.string().max(500),
          currency: z.enum(["USD", "GBP", "EUR", "JPY", "CAD", "AUD"]),
          style: styleSchema.optional(),
          timezone: z
            .string()
            .max(80)
            .refine((v) => {
              try {
                new Intl.DateTimeFormat("en", { timeZone: v });
                return true;
              } catch {
                return false;
              }
            }, "Choose a valid timezone.")
            .optional(),
          orderingUrl: z
            .union([
              z.literal(""),
              z
                .string()
                .url()
                .max(1500)
                .refine(
                  (v) => /^https?:\/\//.test(v),
                  "Use an http or https ordering link.",
                ),
            ])
            .optional(),
          reservationUrl: z
            .union([
              z.literal(""),
              z
                .string()
                .url()
                .max(1500)
                .refine(
                  (v) => /^https?:\/\//.test(v),
                  "Use an http or https reservation link.",
                ),
            ])
            .optional(),
          address: z.string().trim().max(300).optional(),
          phone: z
            .string()
            .trim()
            .max(40)
            .regex(
              /^[+()\d\s.-]*$/,
              "Use digits, spaces, +, - or parentheses for the phone number.",
            )
            .optional(),
          hours: z
            .array(
              z.object({
                day: z.number().int().min(0).max(6),
                open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
                closed: z.boolean(),
              }),
            )
            .refine(
              (hours) => hours.length === 0 || hours.length === 7,
              "Set all seven days or leave opening hours empty.",
            )
            .optional(),
        })
        .parse(await body(req));
      if (b.style) await validateStyle(r, b.style);
      if (b.hours?.length)
        assert(
          new Set(b.hours.map((h) => h.day)).size === 7,
          400,
          "Set each day once.",
        );
      await run(
        "UPDATE restaurants SET name=?,cuisine=?,brand=?,currency=?,style=?,timezone=?,ordering_url=?,reservation_url=?,address=?,phone=?,hours=? WHERE id=?",
        b.name,
        b.cuisine,
        b.brand,
        b.currency,
        b.style ? JSON.stringify(b.style) : r.style,
        b.timezone ?? r.timezone,
        b.orderingUrl ?? r.ordering_url,
        b.reservationUrl ?? r.reservation_url,
        b.address ?? r.address,
        b.phone ?? r.phone,
        b.hours ? JSON.stringify(b.hours) : r.hours,
        r.id,
      );
      if (
        b.name !== r.name ||
        b.currency !== r.currency ||
        (b.timezone && b.timezone !== r.timezone)
      )
        await run(
          "UPDATE promotions SET approved_hash=NULL,approved_at=NULL WHERE restaurant_id=?",
          r.id,
        );
      return response({ ok: true });
    }
    if (p[0] === "dishes" && method === "POST") {
      const b = dishSchema.parse(await body(req));
      const did = p[1] || b.creationId || id();
      let before: Row | null = null;
      if (p[1]) {
        before = await one(
          "SELECT * FROM dishes WHERE id=? AND restaurant_id=?",
          did,
          r.id,
        );
        assert(before, 404, "Dish not found.");
        const changed = await run(
          "UPDATE dishes SET name=?,description=?,portion=?,plating=?,setting=?,price=?,available=?,confirmed_at=?,category=?,preserve=?,dietary=COALESCE(?,dietary),updated_at=?,revision=revision+1 WHERE id=? AND restaurant_id=? AND (? IS NULL OR revision=?)",
          b.name,
          b.description,
          b.portion,
          b.plating,
          b.setting,
          Math.round(b.price * 100),
          b.available ? 1 : 0,
          b.confirmed ? now() : null,
          b.category,
          b.preserve,
          b.dietary ? JSON.stringify(b.dietary) : null,
          now(),
          did,
          r.id,
          b.revision ?? null,
          b.revision ?? null,
        );
        assert(
          changed.meta.changes,
          409,
          "This dish changed in another window. Reopen it to keep the latest details.",
        );
      } else
        await run(
          "INSERT INTO dishes (id,restaurant_id,name,description,portion,plating,setting,price,available,confirmed_at,created_at,category,preserve,sample,dietary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
          did,
          r.id,
          b.name,
          b.description,
          b.portion,
          b.plating,
          b.setting,
          Math.round(b.price * 100),
          b.available ? 1 : 0,
          b.confirmed ? now() : null,
          now(),
          b.category,
          b.preserve,
          b.sample ? 1 : 0,
          JSON.stringify(b.dietary || []),
        );
      const saved = await one(
        "SELECT * FROM dishes WHERE id=? AND restaurant_id=?",
        did,
        r.id,
      );
      assert(saved, 404, "Dish not found.");
      // Menus showing the dish's previous details follow the edit.
      const menus = before ? await syncDishToMenus(r.id, before, saved) : [];
      return response({ id: did, revision: saved.revision, menus });
    }
    if (p[0] === "assets") {
      if (method === "POST" && !p[1]) return await upload(req, r);
      const a = await one(
        "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND (deleted_at IS NULL OR ?='DELETE')",
        z.string().uuid("Choose an image.").parse(p[1]),
        r.id,
        method,
      );
      assert(a, 404, "Image not found.");
      if (method === "GET" && p[2] === "context") {
        const { originalPhotoJob } = await import("./correction-policy");
        const job = await originalPhotoJob(r.id, a.id);
        const edit = await one(
          "SELECT source_id FROM asset_edits WHERE asset_id=?",
          a.id,
        );
        return response({
          assetId: a.id,
          jobId: job?.id || null,
          sourceId:
            job?.source_id ||
            edit?.source_id ||
            (["source", "staff"].includes(a.kind) ? a.id : null),
          inputMethod: job?.input_method || "photo",
          details: job ? JSON.parse(job.details) : null,
        });
      }
      if (method === "GET") {
        if (
          url.searchParams.has("download") &&
          ["generated", "edited"].includes(a.kind)
        )
          assert(
            a.approved_at,
            403,
            "Confirm this image is accurate before downloading.",
          );
        return await downloadAsset(
          req,
          a,
          url.searchParams.has("original") ? a.key : a.working_key || a.key,
        );
      }
      if (method === "DELETE") {
        const prune = (menu: Row) => ({
          ...menu,
          ...(menu.restaurant
            ? {
                restaurant: {
                  ...menu.restaurant,
                  logoId:
                    menu.restaurant.logoId === a.id
                      ? null
                      : menu.restaurant.logoId,
                },
              }
            : {}),
          sections: menu.sections.map((s: Row) => ({
            ...s,
            items: s.items.map((i: Row) => ({
              ...i,
              photoId: i.photoId === a.id ? null : i.photoId,
            })),
          })),
        });
        await run(
          "UPDATE assets SET deleted_at=COALESCE(deleted_at,?) WHERE id=? AND restaurant_id=?",
          now(),
          a.id,
          r.id,
        );
        await pruneDocumentAsset(r.id, a.id);
        // The request's restaurant snapshot may predate a concurrent publication.
        // Retry against current values instead of writing that older snapshot back.
        let pruned = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const current = await one(
            "SELECT published,menu_draft FROM restaurants WHERE id=?",
            r.id,
          );
          assert(current, 404, "Restaurant not found.");
          const saved = await run(
            "UPDATE restaurants SET published=?,menu_draft=?,logo_id=CASE WHEN logo_id=? THEN NULL ELSE logo_id END WHERE id=? AND published IS ? AND menu_draft IS ?",
            current.published
              ? JSON.stringify(prune(JSON.parse(current.published)))
              : null,
            JSON.stringify(prune(JSON.parse(current.menu_draft))),
            a.id,
            r.id,
            current.published,
            current.menu_draft,
          );
          if (saved.meta.changes) {
            pruned = true;
            break;
          }
        }
        assert(
          pruned,
          409,
          "A menu changed while removing this photo. Please retry the removal.",
        );
        await bucket().delete([
          a.key,
          ...(a.working_key ? [a.working_key] : []),
          `public/${r.id}/${a.id}`,
        ]);
        await releaseStorage(a.id);
        await event(r.id, "asset_deleted", a.id);
        return response({ ok: true });
      }
      if (method === "POST" && p[2] === "approve") {
        const b = await body(req);
        assert(
          b.accurate === true,
          400,
          "Please confirm this image represents the dish you serve.",
        );
        assert(
          ["source", "generated", "edited", "staff"].includes(a.kind),
          400,
          "Only dish photos can be approved.",
        );
        await run(
          "UPDATE assets SET approved_at=COALESCE(approved_at,?),kind=CASE WHEN kind='staff' THEN 'source' ELSE kind END WHERE id=?",
          now(),
          a.id,
        );
        const outputJob = await one(
          "SELECT j.* FROM jobs j JOIN outputs o ON o.job_id=j.id WHERE o.asset_id=? AND j.restaurant_id=?",
          a.id,
          r.id,
        );
        const hasRevision =
          outputJob &&
          (await one(
            "SELECT id FROM jobs WHERE dish_id=? AND restaurant_id=? AND parent_id IS NOT NULL AND created_at<=?",
            a.dish_id,
            r.id,
            now(),
          ));
        if (!a.approved_at)
          await event(
            r.id,
            "image_approved",
            a.id,
            outputJob
              ? {
                  firstResult: !hasRevision && outputJob.parent_id === null,
                  jobId: outputJob.id,
                }
              : {},
            a.id,
          ).catch(() => {});
        return response({ ok: true });
      }
      if (method === "POST" && p[2] === "reject") {
        const b = await body(req);
        await event(r.id, "image_rejected", a.id, {
          reason: z
            .enum(["ingredients", "portion", "artificial", "plating", "other"])
            .parse(b.reason),
        });
        return response({ ok: true });
      }
    }
    if (p[0] === "jobs" && p[1] === "status" && method === "GET")
      return response(await jobStatus(r.id));
    if (p[0] === "jobs" && method === "POST") {
      if (p[1] === "tick") {
        await advanceBatches(r.id);
        // Each image call lasts its whole render. A running worker makes those
        // calls, so closing this page cannot cut one off.
        await tick(r.id, { startNew: !(await workerStatus()).healthy });
        checkAlertsInBackground();
        return response({ ok: true });
      }
      if (p[1] && p[2] === "cancel") {
        const job = await one(
          "SELECT id,credit_period FROM jobs WHERE id=? AND restaurant_id=?",
          z.string().uuid().parse(p[1]),
          r.id,
        );
        assert(job, 404, "Generation not found.");
        // A correction uses none of the owner's images; cancelling it must
        // not count as a failed correction that gives one back.
        assert(
          !String(job.credit_period).startsWith("complimentary:"),
          409,
          "A complimentary correction can’t be cancelled once requested. It doesn’t use any of your images.",
        );
        const cancelled = await run(
          "UPDATE outputs SET status='failed',error='Cancelled before creation. No images used.',lease_until=0 WHERE job_id=? AND status='queued' AND response_id IS NULL AND lease_until<?",
          job.id,
          now(),
        );
        assert(
          cancelled.meta.changes,
          409,
          "This image has already started. We’ll keep recovering its result.",
        );
        await updateJob(job.id);
        return response({ ok: true });
      }
      const b = await body(req);
      const context = await studioJobContext(r.id, b);
      const job = await enqueue(r, b);
      await recordStudioJob(r.id, b, job, context);
      return response(job, 202);
    }
    if (p[0] === "captions" && method === "POST") {
      const b = await body(req),
        dishId = z.string().uuid("Choose a dish.").parse(b.dishId);
      const d = await one(
        "SELECT id FROM dishes WHERE id=? AND restaurant_id=?",
        dishId,
        r.id,
      );
      assert(d, 404, "Dish not found.");
      if (p[1] === "generate")
        return response(
          await generateCaption(
            r,
            dishId,
            z
              .string()
              .uuid("Choose a promotion.")
              .nullish()
              .parse(b.promotionId) ?? undefined,
          ),
        );
      const cid = id();
      await run(
        "INSERT INTO captions (id,restaurant_id,dish_id,body,created_at) VALUES (?,?,?,?,?)",
        cid,
        r.id,
        dishId,
        z.string().max(2200).parse(b.body),
        now(),
      );
      return response({ id: cid });
    }
    if (p[0] === "events" && method === "POST") {
      const b = await body(req);
      await event(
        r.id,
        z.enum(["image_downloaded", "caption_copied", "visit"]).parse(b.kind),
        b.entityId ? z.string().uuid().parse(b.entityId) : null,
      );
      return response({ ok: true });
    }
    if (p[0] === "menu" && method === "POST") {
      assert(
        !(await one(
          "SELECT id FROM menu_documents WHERE restaurant_id=? LIMIT 1",
          r.id,
        )),
        409,
        "Menu Studio has been upgraded. Reload the workspace to keep editing or publishing your saved menus.",
      );
      if (p[1] === "unpublish") {
        await run(
          "UPDATE restaurants SET published=NULL,published_at=NULL WHERE id=?",
          r.id,
        );
        await event(r.id, "menu_unpublished");
        return response({ ok: true });
      }
      if (p[1] === "publish") {
        const draft = menuSchema.parse(JSON.parse(r.menu_draft));
        assert(
          draft.sections.some((s) => s.items.length),
          400,
          "Add at least one dish before publishing.",
        );
        assert(
          !isPlaceholderRestaurantName(r.name),
          400,
          restaurantNameMessage,
        );
        const menu = await snapshot(r, draft);
        await run(
          "UPDATE restaurants SET published=?,published_at=? WHERE id=?",
          JSON.stringify(menu),
          now(),
          r.id,
        );
        await event(r.id, "menu_published");
        return response({ ok: true, path: "/m/" + r.slug });
      }
      const draft = menuSchema.parse(await body(req));
      for (const section of draft.sections)
        for (const item of section.items)
          assert(
            await one(
              "SELECT id FROM dishes WHERE id=? AND restaurant_id=?",
              item.dishId,
              r.id,
            ),
            400,
            "Menu dish not found.",
          );
      await run(
        "UPDATE restaurants SET menu_draft=? WHERE id=?",
        JSON.stringify(draft),
        r.id,
      );
      return response({ ok: true });
    }
    throw new AppError(404, "Not found.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return response({ error: e.issues.map((x) => x.message).join(" ") }, 400);
    if (e instanceof AppError && e.status < 500)
      return response({ error: e.message }, e.status);
    await reportError(e, {
      request: req,
      status: e instanceof AppError ? e.status : 500,
    });
    if (e instanceof AppError) return response({ error: e.message }, e.status);
    return response(
      {
        error:
          "We could not finish that request. Your form is still here—please try again.",
      },
      500,
    );
  }
}

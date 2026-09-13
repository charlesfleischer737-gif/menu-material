import type { Row } from "./core";
import { z } from "zod";
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
  remaining,
  response,
  run,
  sameOrigin,
  token,
  viewer,
} from "./core";
import { enqueue, generateCaption, tick } from "./generation";
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
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(2000),
  portion: z.string().max(300).default(""),
  plating: z.string().max(300).default(""),
  setting: z.string().max(300).default("Natural daylight"),
  price: z.number().min(0).max(1000000).default(0),
  available: z.boolean().default(true),
  confirmed: z.boolean().default(false),
});
const menuSchema = z.object({
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
            }),
          )
          .max(100),
      }),
    )
    .max(30),
});
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "restaurant";
async function signup(req: Request, b: Row) {
  const email = emailSchema.parse(b.email),
    password = passwordSchema.parse(b.password),
    hash = digest(String(b.invite || ""));
  await limit("signup:" + email, 10);
  const invite = await one(
    "SELECT * FROM invites WHERE hash=? AND email=? AND used_by IS NULL AND expires_at>?",
    hash,
    email,
    now(),
  );
  assert(
    invite,
    403,
    "This invitation is invalid, expired, or belongs to another email. Ask your pilot coordinator for a new link.",
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
        "INSERT INTO users (id,email,password,role,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM invites WHERE hash=? AND used_by IS NULL AND expires_at>?)",
      )
      .bind(userId, email, hashPassword(password), invite.role, t, hash, t),
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
  await run(
    "INSERT INTO invites (hash,email,role,allowance,expires_at,created_at) VALUES (?,?,?,?,?,?)",
    digest(raw),
    email,
    role,
    allowance,
    now() + 7 * 86400000,
    now(),
  );
  return {
    invite: raw,
    path: `/?invite=${encodeURIComponent(raw)}&email=${encodeURIComponent(email)}`,
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
      const obj = await bucket().get(a.working_key || a.key);
      if (obj) {
        await bucket().put(`public/${r.id}/${a.id}`, await obj.arrayBuffer(), {
          httpMetadata: { contentType: "image/jpeg" },
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
      logoId,
    },
    sections,
  };
}
function assetIsPublished(menu: Row, assetId: string) {
  return (
    menu.restaurant?.logoId === assetId ||
    menu.sections?.some((s: Row) =>
      s.items.some((i: Row) => i.photoId === assetId),
    )
  );
}
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
    Buffer.from(bytes.slice(4, 8)).toString() === "ftyp" &&
    /heic|heix|hevc|mif1|msf1/.test(Buffer.from(bytes.slice(8, 32)).toString())
  )
    return "image/heic";
  return null;
}
async function upload(req: Request, r: Row) {
  assert(
    Number(req.headers.get("content-length") || 0) <= 30 * 1024 * 1024,
    413,
    "Photos must be 20 MB or smaller.",
  );
  const f = await req.formData(),
    file = f.get("file"),
    normalized = f.get("normalized"),
    kind = f.get("kind") === "logo" ? "logo" : "source";
  assert(
    file instanceof File && file.size > 0 && file.size <= 20 * 1024 * 1024,
    400,
    "Choose a JPEG, PNG or HEIC file up to 20 MB.",
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
    mime && imageMime(working) === "image/jpeg",
    400,
    "This file is not a supported photo.",
  );
  const dishId = kind === "source" ? String(f.get("dishId") || "") : null;
  if (dishId)
    assert(
      await one(
        "SELECT 1 FROM dishes WHERE id=? AND restaurant_id=?",
        dishId,
        r.id,
      ),
      404,
      "Dish not found.",
    );
  assert(kind === "logo" || dishId, 400, "Save your dish first.");
  await limit("uploads:" + r.id, 100, 3600);
  const aid = id(),
    key = `private/${r.id}/source/${aid}`,
    workingKey = `private/${r.id}/working/${aid}.jpg`;
  await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await bucket().put(workingKey, working, {
      httpMetadata: { contentType: "image/jpeg" },
    });
    await run(
      "INSERT INTO assets (id,restaurant_id,dish_id,kind,key,working_key,mime,name,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      aid,
      r.id,
      dishId,
      kind,
      key,
      workingKey,
      mime,
      file.name.slice(0, 150),
      now(),
    );
    if (kind === "logo")
      await run("UPDATE restaurants SET logo_id=? WHERE id=?", aid, r.id);
  } catch (e) {
    await bucket().delete([key, workingKey]);
    throw e;
  }
  return response({ id: aid }, 201);
}
async function downloadAsset(
  req: Request,
  a: Row,
  key: string,
  publicImage = false,
) {
  const obj = await bucket().get(key);
  assert(obj, 404, "Image not found.");
  const h = new Headers({
    "Content-Type":
      key === a.working_key
        ? "image/jpeg"
        : obj.httpMetadata?.contentType || a.mime,
    "Cache-Control": publicImage ? "no-store" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (new URL(req.url).searchParams.has("download"))
    h.set(
      "Content-Disposition",
      `attachment; filename="plateworthy-${a.id}.${a.mime === "image/png" ? "png" : a.mime === "image/heic" ? "heic" : "jpg"}"`,
    );
  return new Response(obj.body, { headers: h });
}
export async function handle(req: Request) {
  try {
    const url = new URL(req.url),
      p = url.pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean);
    const method = req.method;
    if (method !== "GET") sameOrigin(req);
    if (p[0] === "health") return response({ ok: true });
    if (p[0] === "public" && p[1]) {
      const r = await one(
        "SELECT * FROM restaurants WHERE slug=? AND published IS NOT NULL",
        p[1],
      );
      assert(r, 404, "This menu is not currently available.");
      const menu = JSON.parse(r.published);
      if (p[2] === "assets" && p[3]) {
        assert(assetIsPublished(menu, p[3]), 404, "Image not found.");
        const a = await one(
          "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL AND (approved_at IS NOT NULL OR kind=?)",
          p[3],
          r.id,
          "logo",
        );
        assert(a, 404, "Image not found.");
        return await downloadAsset(req, a, `public/${r.id}/${a.id}`, true);
      }
      return response({ menu, publishedAt: r.published_at });
    }
    if (p[0] === "internal" && p[1] === "tick" && method === "POST") {
      assert(
        config("JOB_RUNNER_SECRET") &&
          req.headers.get("authorization") ===
            `Bearer ${config("JOB_RUNNER_SECRET")}`,
        403,
        "Access denied.",
      );
      await tick();
      return response({ ok: true });
    }
    if (p[0] === "auth") {
      if (p[1] === "logout" && method === "POST") {
        const s = req.headers
          .get("cookie")
          ?.match(/(?:^|;\s*)dishlight_session=([^;]+)/)?.[1];
        if (s) await run("DELETE FROM sessions WHERE hash=?", digest(s));
        return response({ ok: true }, 200, {
          "Set-Cookie":
            "dishlight_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        });
      }
      if (p[1] === "dev" && method === "POST") {
        assert(config("LOCAL_DEVELOPMENT") === "true", 404, "Not found.");
        let u = await one(
          "SELECT * FROM users WHERE email='pilot@dishlight.test'",
        );
        if (!u) {
          const uid = id(),
            rid = id();
          await run(
            "INSERT INTO users (id,email,password,role,created_at) VALUES (?,'pilot@dishlight.test',?,'admin',?)",
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
          "Only the signed-in Site owner can initialize this pilot.",
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
        const email = emailSchema.parse(b.email);
        await limit("login:" + email, 10);
        const password = z.string().max(128).parse(b.password);
        const u = await one("SELECT * FROM users WHERE email=?", email);
        assert(
          checkPassword(password, u?.password || "dummy:" + "00".repeat(64)) &&
            u,
          401,
          "Email or password is incorrect.",
        );
        return await createSession(req, u.id);
      }
      if (p[1] === "bootstrap" && method === "POST") {
        await limit("bootstrap:" + req.headers.get("cf-connecting-ip"), 5);
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
        restaurant: {
          ...r,
          menuDraft: JSON.parse(r.menu_draft),
          published: r.published ? JSON.parse(r.published) : null,
        },
        remaining: await remaining(r.id),
        aiConnected: !!config("OPENAI_API_KEY"),
        local: config("LOCAL_DEVELOPMENT") === "true",
        dishes: await all(
          "SELECT * FROM dishes WHERE restaurant_id=? ORDER BY created_at DESC",
          r.id,
        ),
        assets: await all(
          "SELECT id,dish_id,kind,mime,name,approved_at,created_at FROM assets WHERE restaurant_id=? AND deleted_at IS NULL ORDER BY created_at DESC",
          r.id,
        ),
        jobs: await all(
          "SELECT * FROM jobs WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 100",
          r.id,
        ),
        outputs: await all(
          "SELECT id,job_id,slot,status,asset_id,error,attempts FROM outputs WHERE restaurant_id=? ORDER BY created_at DESC LIMIT 200",
          r.id,
        ),
        captions: await all(
          "SELECT id,dish_id,body,created_at FROM captions WHERE restaurant_id=? ORDER BY created_at DESC",
          r.id,
        ),
      });
    }
    if (p[0] === "admin") {
      await admin(req);
      if (method === "GET")
        return response({
          restaurants: await all(
            "SELECT r.id,r.name,r.allowance,r.paused,r.created_at,u.email,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status='completed') AS completed,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status NOT IN ('completed','failed')) AS reserved,(SELECT count(*) FROM outputs WHERE restaurant_id=r.id AND status='failed') AS failed,(SELECT sum(cost_estimate) FROM outputs WHERE restaurant_id=r.id) AS cost_estimate,(SELECT count(*) FROM assets WHERE restaurant_id=r.id AND approved_at IS NOT NULL AND kind='generated') AS approved,(SELECT sum(CAST(json_extract(details,'$.minutes') AS INTEGER)) FROM events WHERE restaurant_id=r.id AND kind='support_time') AS support_minutes FROM restaurants r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC",
          ),
          invites: await all(
            "SELECT email,role,allowance,expires_at,used_by FROM invites ORDER BY created_at DESC LIMIT 100",
          ),
          events: await all(
            "SELECT * FROM events ORDER BY created_at DESC LIMIT 100",
          ),
          outputs: await all(
            "SELECT id,restaurant_id,job_id,status,attempts,usage,cost_estimate,error FROM outputs ORDER BY created_at DESC LIMIT 200",
          ),
        });
      const b = await body(req);
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
      if (p[1] === "restaurant") {
        const rid = z.string().uuid().parse(b.id);
        assert(
          await one("SELECT id FROM restaurants WHERE id=?", rid),
          404,
          "Restaurant not found.",
        );
        await run(
          "UPDATE restaurants SET allowance=?,paused=? WHERE id=?",
          z.number().int().min(0).max(100000).parse(b.allowance),
          b.paused ? 1 : 0,
          rid,
        );
        await event(rid, "allowance_updated", null, {
          allowance: b.allowance,
          paused: !!b.paused,
        });
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
    const { r } = await owner(req);
    if (p[0] === "restaurant" && method === "POST") {
      const b = z
        .object({
          name: z.string().trim().min(1).max(100),
          cuisine: z.string().max(100),
          brand: z.string().max(500),
          currency: z.enum(["USD", "GBP", "EUR", "JPY", "CAD", "AUD"]),
        })
        .parse(await body(req));
      await run(
        "UPDATE restaurants SET name=?,cuisine=?,brand=?,currency=? WHERE id=?",
        b.name,
        b.cuisine,
        b.brand,
        b.currency,
        r.id,
      );
      return response({ ok: true });
    }
    if (p[0] === "dishes" && method === "POST") {
      const b = dishSchema.parse(await body(req));
      const did = p[1] || id();
      if (p[1]) {
        assert(
          await one(
            "SELECT id FROM dishes WHERE id=? AND restaurant_id=?",
            did,
            r.id,
          ),
          404,
          "Dish not found.",
        );
        await run(
          "UPDATE dishes SET name=?,description=?,portion=?,plating=?,setting=?,price=?,available=?,confirmed_at=? WHERE id=? AND restaurant_id=?",
          b.name,
          b.description,
          b.portion,
          b.plating,
          b.setting,
          Math.round(b.price * 100),
          b.available ? 1 : 0,
          b.confirmed ? now() : null,
          did,
          r.id,
        );
      } else
        await run(
          "INSERT INTO dishes (id,restaurant_id,name,description,portion,plating,setting,price,available,confirmed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
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
        );
      return response({ id: did });
    }
    if (p[0] === "assets") {
      if (method === "POST" && !p[1]) return await upload(req, r);
      const a = await one(
        "SELECT * FROM assets WHERE id=? AND restaurant_id=? AND deleted_at IS NULL",
        p[1],
        r.id,
      );
      assert(a, 404, "Image not found.");
      if (method === "GET") {
        if (url.searchParams.has("download") && a.kind === "generated")
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
        await db().batch([
          db()
            .prepare("UPDATE assets SET deleted_at=? WHERE id=?")
            .bind(now(), a.id),
          db()
            .prepare(
              "UPDATE restaurants SET published=?,menu_draft=?,logo_id=CASE WHEN logo_id=? THEN NULL ELSE logo_id END WHERE id=?",
            )
            .bind(
              r.published
                ? JSON.stringify(prune(JSON.parse(r.published)))
                : null,
              JSON.stringify(prune(JSON.parse(r.menu_draft))),
              a.id,
              r.id,
            ),
        ]);
        await bucket().delete([
          a.key,
          ...(a.working_key ? [a.working_key] : []),
          `public/${r.id}/${a.id}`,
        ]);
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
        await run("UPDATE assets SET approved_at=? WHERE id=?", now(), a.id);
        await event(r.id, "image_approved", a.id);
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
    if (p[0] === "jobs" && method === "POST") {
      if (p[1] === "tick") {
        await tick(r.id);
        return response({ ok: true });
      }
      const b = await body(req);
      return response(await enqueue(r, b), 202);
    }
    if (p[0] === "captions" && method === "POST") {
      const b = await body(req);
      const d = await one(
        "SELECT id FROM dishes WHERE id=? AND restaurant_id=?",
        b.dishId,
        r.id,
      );
      assert(d, 404, "Dish not found.");
      if (p[1] === "generate")
        return response(await generateCaption(r, b.dishId));
      const cid = id();
      await run(
        "INSERT INTO captions (id,restaurant_id,dish_id,body,created_at) VALUES (?,?,?,?,?)",
        cid,
        r.id,
        b.dishId,
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
    if (e instanceof AppError) return response({ error: e.message }, e.status);
    console.error("Request failed", e);
    return response(
      {
        error:
          "We could not finish that request. Your form is still here—please try again.",
      },
      500,
    );
  }
}

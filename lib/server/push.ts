import { z } from "zod";
import {
  all,
  AppError,
  assert,
  body,
  db,
  digest,
  limit,
  nativeClient,
  now,
  one,
  owner,
  response,
  run,
  type Row,
} from "./core";
import { appleBundleId } from "./apple-auth";

// Push notifications for the iPhone app: "Your photo is ready", and the end
// of the photo's Live Activity. The app registers its APNs token; a finished
// job queues messages in push_outbox; the job runner (scripts/job-runner.mjs),
// which holds the APNs key and speaks HTTP/2, claims and delivers them.

const pushToken = z
  .string()
  .regex(/^[0-9a-fA-F]{64,200}$/)
  .transform((v) => v.toLowerCase());
const environment = z.enum(["production", "sandbox"]).default("production");

/** /api/devices: the app's APNs registration, and its Live Activities. */
export async function devicesRoute(req: Request, path: string[]) {
  assert(nativeClient(req), 404, "Not found.");
  const { u, r } = await owner(req);
  await limit("devices:" + u.id, 60, 3600);
  if (path[1] === "live-activity" && req.method === "POST") {
    const input = z
      .object({ jobId: z.string().max(80), token: pushToken, environment })
      .parse(await body(req));
    assert(
      await one(
        "SELECT id FROM jobs WHERE id=? AND restaurant_id=?",
        input.jobId,
        r.id,
      ),
      404,
      "Photo not found.",
    );
    await run(
      "INSERT INTO live_activities (job_id,restaurant_id,token,environment,created_at) VALUES (?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET token=excluded.token,environment=excluded.environment",
      input.jobId,
      r.id,
      input.token,
      input.environment,
      now(),
    );
    return response({ ok: true });
  }
  if (req.method === "POST" && !path[1]) {
    const input = z
      .object({ token: pushToken, environment })
      .parse(await body(req));
    // A token moves with the phone: whoever signs in on it now hears.
    await run(
      `INSERT INTO push_devices (token,user_id,restaurant_id,environment,created_at,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,restaurant_id=excluded.restaurant_id,environment=excluded.environment,updated_at=excluded.updated_at`,
      input.token,
      u.id,
      r.id,
      input.environment,
      now(),
      now(),
    );
    return response({ ok: true });
  }
  if (req.method === "DELETE" && path[1]) {
    // Signing out of the app stops its notifications.
    await run(
      "DELETE FROM push_devices WHERE token=? AND user_id=?",
      pushToken.parse(path[1]),
      u.id,
    );
    return response({ ok: true });
  }
  throw new AppError(404, "Not found.");
}

/**
 * After a job settles: tell the restaurant's phones, and end the photo's Live
 * Activity. Each message's ID names the job's outcome and the phone, so a job
 * settled twice isn't announced twice.
 */
export async function queueJobPush(jobId: string, status: string) {
  if (!["completed", "partial", "failed"].includes(status)) return;
  const job = await one(
    "SELECT j.id,j.restaurant_id,d.name AS dish FROM jobs j LEFT JOIN dishes d ON d.id=j.dish_id WHERE j.id=?",
    jobId,
  );
  if (!job) return;
  const devices = await all(
    "SELECT token,environment FROM push_devices WHERE restaurant_id=?",
    job.restaurant_id,
  );
  const activity = await one(
    "SELECT token,environment FROM live_activities WHERE job_id=?",
    jobId,
  );
  if (!devices.length && !activity) return;
  const asset = await one(
    "SELECT asset_id FROM outputs WHERE job_id=? AND status='completed' AND asset_id IS NOT NULL ORDER BY slot LIMIT 1",
    jobId,
  );
  const ready = status !== "failed",
    seconds = Math.floor(now() / 1000),
    dish =
      typeof job.dish === "string" && job.dish.trim() ? job.dish.trim() : "";
  const alert = ready
    ? {
        title: "Your photo is ready",
        body: dish
          ? `${dish} is ready to review.`
          : "Open Menu Material to review it.",
      }
    : {
        title: "Your photo couldn’t be made",
        body: "It wasn’t counted against your images. Open Menu Material to try again.",
      };
  const insert = (
    key: string,
    target: Row,
    pushType: string,
    payload: object,
    collapseId: string | null,
  ) =>
    db()
      .prepare(
        "INSERT OR IGNORE INTO push_outbox (id,restaurant_id,token,environment,push_type,payload,collapse_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(
        digest(key),
        job.restaurant_id,
        target.token,
        target.environment,
        pushType,
        JSON.stringify(payload),
        collapseId,
        now(),
      );
  const statements = devices.map((device) =>
    insert(
      `job:${jobId}:${status}:${device.token}`,
      device,
      "alert",
      {
        aps: { alert, sound: "default", "thread-id": "photos" },
        kind: ready ? "photo_ready" : "photo_failed",
        jobId,
        assetId: asset?.asset_id || null,
      },
      jobId,
    ),
  );
  // The app's ActivityAttributes.ContentState decodes "content-state".
  if (activity)
    statements.push(
      insert(
        `activity:${jobId}:${status}`,
        activity,
        "liveactivity",
        {
          aps: {
            timestamp: seconds,
            event: "end",
            "content-state": {
              phase: ready ? "ready" : "failed",
              assetId: asset?.asset_id || null,
            },
            "dismissal-date": seconds + 15 * 60,
          },
        },
        null,
      ),
    );
  await db().batch(statements);
}

/** For the job runner: up to `count` messages, leased for a minute. */
export async function claimPushes(count = 50) {
  const t = now();
  await run("DELETE FROM push_outbox WHERE created_at<?", t - 86400000);
  const bundle = appleBundleId();
  if (!bundle) return [];
  const rows = await all(
    `UPDATE push_outbox SET lease_until=?,attempts=attempts+1 WHERE id IN (
      SELECT id FROM push_outbox WHERE sent_at IS NULL AND lease_until<? AND attempts<5
      ORDER BY created_at LIMIT ?) RETURNING id,token,environment,push_type,payload,collapse_id`,
    t + 60000,
    t,
    count,
  );
  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    environment: row.environment,
    pushType: row.push_type,
    topic:
      row.push_type === "liveactivity"
        ? `${bundle}.push-type.liveactivity`
        : bundle,
    collapseId: row.collapse_id,
    payload: JSON.parse(row.payload),
  }));
}

const ackSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string().max(80),
        status: z.number().int(),
        reason: z.string().max(100).optional(),
      }),
    )
    .max(200),
});
/**
 * What APNs said. Delivered messages are marked sent. A phone that no longer
 * has the app (410, or a bad token) is forgotten. Other refusals of the
 * message itself are given up on. Network and server errors, rate limits
 * (429) and refused provider tokens (403, which the runner renews) wait for
 * their lease to run out and are tried again, five times in all.
 */
export async function acknowledgePushes(input: unknown) {
  const { results } = ackSchema.parse(input);
  const t = now();
  for (const result of results) {
    const message = await one(
      "SELECT token FROM push_outbox WHERE id=?",
      result.id,
    );
    if (!message) continue;
    const gone =
      result.status === 410 ||
      (result.status === 400 &&
        ["BadDeviceToken", "DeviceTokenNotForTopic"].includes(
          result.reason || "",
        ));
    if (gone)
      await db().batch([
        db()
          .prepare("DELETE FROM push_devices WHERE token=?")
          .bind(message.token),
        db()
          .prepare("DELETE FROM live_activities WHERE token=?")
          .bind(message.token),
      ]);
    const retry = [0, 403, 429].includes(result.status) || result.status >= 500;
    if (!retry)
      await run("UPDATE push_outbox SET sent_at=? WHERE id=?", t, result.id);
  }
  return { ok: true };
}

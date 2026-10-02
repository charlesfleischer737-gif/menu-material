// Delivers the iPhone app's notifications to Apple Push Notification service.
// APNs only speaks HTTP/2, which the site's Worker can't, so the job runner
// does it: the site queues messages (lib/server/push.ts) and the runner claims,
// sends and acknowledges them. Token-based authentication with a .p8 key.
import { connect } from "node:http2";
import { createPrivateKey, sign } from "node:crypto";

const apple = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
};

/** The runner's APNs key, or null when notifications aren't set up. */
export function apnsSettings(env = process.env) {
  const keyId = env.APNS_KEY_ID?.trim(),
    teamId = (env.APNS_TEAM_ID || env.APPLE_TEAM_ID)?.trim(),
    key = env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return keyId && teamId && key ? { keyId, teamId, key } : null;
}

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
/** An ES256 provider token. Apple accepts one for up to an hour. */
export function providerToken(
  { keyId, teamId, key },
  issuedAt = Math.floor(Date.now() / 1000),
) {
  const unsigned = `${encode({ alg: "ES256", kid: keyId })}.${encode({ iss: teamId, iat: issuedAt })}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key: createPrivateKey(key),
    dsaEncoding: "ieee-p1363",
  });
  return `${unsigned}.${signature.toString("base64url")}`;
}

export function createApnsClient(settings, { origins = apple } = {}) {
  let token = null,
    tokenAt = 0;
  const sessions = new Map();
  // Renewed every 40 minutes; Apple refuses renewals more often than 20.
  function authorization() {
    if (!token || Date.now() - tokenAt > 40 * 60000) {
      token = providerToken(settings);
      tokenAt = Date.now();
    }
    return `bearer ${token}`;
  }
  function session(environment) {
    const origin = origins[environment] || origins.production;
    let current = sessions.get(origin);
    if (!current || current.closed || current.destroyed) {
      current = connect(origin);
      // A broken connection fails its requests; the next send reconnects.
      current.on("error", () => {});
      current.unref();
      sessions.set(origin, current);
    }
    return current;
  }
  /** Resolves with { id, status, reason? }; status 0 is a network failure. */
  function send(message) {
    return new Promise((resolve) => {
      let status = 0,
        text = "",
        done = false;
      const finish = () => {
        if (done) return;
        done = true;
        let reason;
        try {
          reason = JSON.parse(text).reason;
        } catch {}
        // A refused provider token is made again for the retry.
        if (status === 403 && /ProviderToken/.test(reason || "")) token = null;
        resolve({ id: message.id, status, ...(reason ? { reason } : {}) });
      };
      let request;
      try {
        request = session(message.environment).request({
          ":method": "POST",
          ":path": `/3/device/${message.token}`,
          authorization: authorization(),
          "apns-topic": message.topic,
          "apns-push-type": message.pushType,
          "apns-priority": "10",
          ...(message.collapseId
            ? { "apns-collapse-id": String(message.collapseId).slice(0, 64) }
            : {}),
          "content-type": "application/json",
        });
      } catch {
        return finish();
      }
      request.setTimeout(15000, () => request.close());
      request.on("response", (headers) => {
        status = Number(headers[":status"]) || 0;
      });
      request.setEncoding("utf8");
      request.on("data", (chunk) => (text += chunk));
      request.on("end", finish);
      request.on("close", finish);
      request.on("error", finish);
      request.end(JSON.stringify(message.payload));
    });
  }
  function close() {
    for (const current of sessions.values()) current.close();
    sessions.clear();
  }
  return { send, close };
}

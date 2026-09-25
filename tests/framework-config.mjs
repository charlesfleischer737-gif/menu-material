import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveNextConfig } from "../node_modules/vinext/dist/config/next-config.js";
import { applyConfigHeadersToResponse } from "../node_modules/vinext/dist/server/config-headers.js";

// next.config.ts as the framework reads it, not just as written.
const { default: nextConfig } = await import("../next.config.ts");
const resolved = await resolveNextConfig(nextConfig, process.cwd());
let checks = 0;

// vinext applies the server-action body limit to every multipart POST without
// an action ID before the route handler runs, so it must exceed the largest
// multipart body the API accepts (limitedForm caps in lib/server).
const caps = readdirSync("lib/server")
  .filter((name) => name.endsWith(".ts"))
  .flatMap((name) => [
    ...readFileSync(`lib/server/${name}`, "utf8").matchAll(
      /limitedForm\(\s*\w+,\s*(\d+)\s*\*\s*1024\s*\*\s*1024\s*\)/g,
    ),
  ])
  .map((match) => Number(match[1]) * 1024 * 1024);
assert(caps.length, "Upload caps are found in lib/server");
const largestUpload = Math.max(...caps);
assert(largestUpload >= 30 * 1024 * 1024, "Photo uploads accept up to 30 MB");
assert(
  resolved.serverActionsBodySizeLimit > largestUpload,
  `The framework body limit (${resolved.serverActionsBodySizeLimit} bytes) exceeds the ${largestUpload}-byte upload cap`,
);
checks++;

// Security headers, computed the way vinext applies them to a response.
function headersFor(pathname) {
  const headers = new Headers();
  applyConfigHeadersToResponse(headers, {
    configHeaders: resolved.headers,
    pathname,
    requestContext: {
      headers: new Headers(),
      cookies: {},
      query: new URLSearchParams(),
      host: "localhost",
    },
    basePathState: { basePath: "", hadBasePath: true },
  });
  return headers;
}
const pages = ["/", "/pricing", "/privacy", "/guidelines", "/no-such-page"];
const everyPath = [
  ...pages,
  "/api/state",
  "/api/assets/123",
  "/s/staff-token",
  "/m/joes-diner",
  "/api/imports/abc/original",
  "/robots.txt",
];
for (const path of everyPath) {
  const headers = headersFor(path);
  assert.equal(headers.get("x-content-type-options"), "nosniff", path);
  assert.equal(
    headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
    path,
  );
  assert.equal(
    headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=()",
    path,
  );
  assert.equal(
    headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
    path,
  );
  // Pages carry inline React Server Components scripts.
  assert.doesNotMatch(headers.get("content-security-policy") || "", /script/);
  checks += 5;
}
for (const path of [...pages, "/api/state", "/s/staff-token"]) {
  const headers = headersFor(path);
  assert.equal(headers.get("x-frame-options"), "DENY", path);
  assert.equal(
    headers.get("content-security-policy"),
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    path,
  );
  checks += 2;
}
// Restaurants may embed their guest menu on their own site.
const guestMenu = headersFor("/m/joes-diner");
assert.equal(guestMenu.get("x-frame-options"), null);
assert.equal(
  guestMenu.get("content-security-policy"),
  "base-uri 'self'; object-src 'none'",
);
// The menu importer frames the uploaded original inside the workspace.
const importOriginal = headersFor("/api/imports/abc/original");
assert.equal(importOriginal.get("x-frame-options"), "SAMEORIGIN");
assert.equal(
  importOriginal.get("content-security-policy"),
  "frame-ancestors 'self'",
);
checks += 4;

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(join(dir, entry.name))
      : /\.(tsx?|mjs)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );
}
const appSources = [...sourceFiles("app"), ...sourceFiles("lib")];
// Everything else refuses framing, so any frame the app shows must load an
// imported menu's original.
for (const file of appSources)
  for (const [frame] of readFileSync(file, "utf8").matchAll(/<iframe\b[^>]*>/g))
    assert.match(
      frame,
      /src=\{`\/api\/imports\//,
      `${file} frames a page that sends X-Frame-Options: DENY`,
    );
checks++;

// The Permissions-Policy turns these off, so the app must not rely on them.
// (A file input's `capture` attribute opens the camera app and is unaffected.)
for (const file of appSources)
  assert.doesNotMatch(
    readFileSync(file, "utf8"),
    /getUserMedia|navigator\.geolocation/,
    `${file} uses a device feature the Permissions-Policy blocks`,
  );
checks++;

console.log(
  `Framework config: ${checks} checks passed (upload body limit, security headers, framing exceptions).`,
);

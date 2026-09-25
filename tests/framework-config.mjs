import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolveNextConfig } from "../node_modules/vinext/dist/config/next-config.js";

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

console.log(`Framework config: ${checks} checks passed (upload body limit).`);

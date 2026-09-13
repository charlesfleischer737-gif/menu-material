import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { stripTypeScriptTypes } from "node:module";
export async function resolve(specifier, context, next) {
  if (specifier === "cloudflare:workers")
    return {
      url: pathToFileURL(resolvePath("lib/local-runtime.ts")).href,
      shortCircuit: true,
    };
  if (specifier.startsWith("@/"))
    specifier = pathToFileURL(resolvePath(specifier.slice(2))).href;
  if (
    (specifier.startsWith(".") || specifier.startsWith("file:")) &&
    context.parentURL
  ) {
    const url = new URL(specifier, context.parentURL);
    if (!url.pathname.endsWith(".ts") && existsSync(fileURLToPath(url) + ".ts"))
      return { url: url.href + ".ts", shortCircuit: true };
  }
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith(".ts"))
    return {
      format: "module",
      source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), {
        mode: "transform",
        sourceUrl: url,
      }),
      shortCircuit: true,
    };
  return next(url, context);
}

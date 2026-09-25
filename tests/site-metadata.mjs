import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = mkdtempSync(join(tmpdir(), "menu-material-site-metadata-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
delete process.env.APP_ORIGIN;
// Stand in for the incoming request that next/headers reads.
let request = new Headers();
globalThis.__siteMetadataRequest = () => request;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers")
      return {
        url: "data:text/javascript,export async function headers(){return globalThis.__siteMetadataRequest()}",
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const { siteOrigin, pageMetadata, homeStructuredData, shareImage } =
  await import("../app/site-metadata.ts");
const { default: robots } = await import("../app/robots.ts");
const { default: sitemap } = await import("../app/sitemap.ts");
let checks = 0;

try {
  // APP_ORIGIN wins; without it, absolute URLs use the request's own host.
  process.env.APP_ORIGIN = "https://menus.example.com/";
  request = new Headers({ host: "elsewhere.example" });
  assert.equal(await siteOrigin(), "https://menus.example.com");
  delete process.env.APP_ORIGIN;
  for (const [headers, origin] of [
    [{ host: "menus.example.com" }, "https://menus.example.com"],
    [{ host: "localhost:5173" }, "http://localhost:5173"],
    [{ host: "127.0.0.1:8790" }, "http://127.0.0.1:8790"],
    [
      { host: "menus.example.com", "x-forwarded-proto": "http" },
      "http://menus.example.com",
    ],
    // A Host header that is not a bare host never becomes the origin.
    [{ host: "evil.example/path" }, "http://localhost"],
    [{ host: "user@evil.example" }, "http://localhost"],
    [{}, "http://localhost"],
  ]) {
    request = new Headers(headers);
    assert.equal(await siteOrigin(), origin, JSON.stringify(headers));
    checks++;
  }
  request = new Headers({ host: "menus.example.com" });

  // Crawlers may read the site, guest menus and their published photos, but
  // not the rest of the API or staff upload links.
  const rules = await robots();
  assert.deepEqual(rules.rules, {
    userAgent: "*",
    allow: ["/", "/api/public/"],
    disallow: ["/api/", "/s/"],
  });
  assert.equal(rules.sitemap, "https://menus.example.com/sitemap.xml");
  checks += 2;

  // The sitemap lists the public marketing pages with absolute URLs.
  const pages = (await sitemap()).map((entry) => new URL(entry.url));
  assert.deepEqual(
    pages.map((url) => url.href),
    ["/", "/pricing", "/privacy", "/guidelines"].map(
      (path) => "https://menus.example.com" + path,
    ),
  );
  for (const { pathname } of pages) {
    const page = pathname === "/" ? "app/page.tsx" : `app${pathname}/page.tsx`;
    const source = readFileSync(page, "utf8");
    // Each sets its own canonical address and link-preview text.
    assert.match(
      source,
      new RegExp(`pageMetadata\\([\\s\\S]*path: "${pathname}"`),
      page,
    );
    checks += 2;
  }

  const metadata = pageMetadata({
    title: "Usage guidelines · Menu Material",
    description: "Use your own photos.",
    path: "/guidelines",
  });
  assert.deepEqual(metadata.alternates, { canonical: "/guidelines" });
  assert.equal(metadata.openGraph.url, "/guidelines");
  assert.equal(metadata.openGraph.title, "Usage guidelines · Menu Material");
  assert.equal(metadata.twitter.title, "Usage guidelines · Menu Material");
  assert.equal(metadata.twitter.card, "summary_large_image");
  assert.deepEqual(metadata.openGraph.images, [shareImage]);
  checks += 6;

  // The link-preview image exists at the size the tags announce, and is small
  // enough for apps that skip large preview images.
  const file = "public" + shareImage.url;
  const info = await sharp(file).metadata();
  assert.deepEqual(
    [info.format, info.width, info.height],
    ["jpeg", shareImage.width, shareImage.height],
  );
  assert(readFileSync(file).length < 300 * 1024, `${file} is under 300 KB`);
  checks += 2;

  // Homepage structured data: the organization and the web app, whose only
  // offer is the free allowance (Pro is not for sale yet).
  const data = homeStructuredData("https://menus.example.com");
  const types = data["@graph"].map((node) => node["@type"]);
  assert.deepEqual(types, ["Organization", "SoftwareApplication"]);
  const [organization, app] = data["@graph"];
  assert.equal(organization.url, "https://menus.example.com/");
  assert(existsSync("public" + new URL(organization.logo).pathname));
  assert.deepEqual([app.offers.price, app.offers.priceCurrency], ["0", "USD"]);
  assert.doesNotMatch(JSON.stringify(data), /9\.99|Pro\b/);
  checks += 4;

  // /favicon.ico is a real icon file with the classic sizes.
  const icon = readFileSync("public/favicon.ico");
  assert.deepEqual(
    [icon.readUInt16LE(0), icon.readUInt16LE(2)],
    [0, 1],
    "ICO header",
  );
  const sizes = [];
  for (let index = 0; index < icon.readUInt16LE(4); index++) {
    const entry = 6 + 16 * index;
    const png = icon.subarray(
      icon.readUInt32LE(entry + 12),
      icon.readUInt32LE(entry + 12) + icon.readUInt32LE(entry + 8),
    );
    const image = await sharp(png).metadata();
    assert.equal(image.width, icon.readUInt8(entry));
    sizes.push(image.width);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
  checks += 2;
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(
  `Site metadata: ${checks} checks passed (origin, robots.txt, sitemap, canonical and link-preview tags, share image, structured data, favicon.ico).`,
);

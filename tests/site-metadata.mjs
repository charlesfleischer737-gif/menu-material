import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ts from "typescript";

const root = mkdtempSync(join(tmpdir(), "menu-material-site-metadata-"));
process.env.MENU_MATERIAL_DATA_DIR = root;
for (const key of [
  "APP_ORIGIN",
  "SUPPORT_EMAIL",
  "SITE_OPERATOR",
  "TERMS_URL",
  "REFUND_POLICY_URL",
])
  delete process.env[key];
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
const { siteContact } = await import("../lib/site-contact.ts");
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

  // The owner's contact and legal details: trimmed, and ignored unless they
  // are a plain email address or a web link.
  const settings = (values) => (key) => values[key] ?? "";
  const unset = siteContact(settings({}));
  assert.deepEqual(unset, {
    supportEmail: "",
    operator: "",
    termsUrl: "",
    refundPolicyUrl: "",
  });
  assert.deepEqual(
    siteContact(
      settings({
        SUPPORT_EMAIL: " help@menus.example.com ",
        SITE_OPERATOR: " Menu Material LLC,\n 1 Main Street, Springfield ",
        TERMS_URL: "https://legal.example.com/terms",
        REFUND_POLICY_URL: "https://legal.example.com/refunds",
      }),
    ),
    {
      supportEmail: "help@menus.example.com",
      operator: "Menu Material LLC, 1 Main Street, Springfield",
      termsUrl: "https://legal.example.com/terms",
      refundPolicyUrl: "https://legal.example.com/refunds",
    },
  );
  for (const [key, value] of [
    ["SUPPORT_EMAIL", "help"],
    ["SUPPORT_EMAIL", "help@menus.example.com?subject=Hi"],
    ["TERMS_URL", "/terms"],
    ["TERMS_URL", "javascript:alert(1)"],
    ["REFUND_POLICY_URL", "ftp://legal.example.com/refunds"],
  ])
    assert.deepEqual(siteContact(settings({ [key]: value })), unset, value);
  checks += 7;

  // The sitemap lists the public marketing pages with absolute URLs, and
  // the contact page once a support address is set. /terms only redirects
  // to the owner's Terms, so it is never listed.
  const unlisted = (await sitemap()).map((entry) => entry.url);
  assert.deepEqual(
    unlisted,
    ["/", "/pricing", "/privacy", "/guidelines"].map(
      (path) => "https://menus.example.com" + path,
    ),
  );
  process.env.SUPPORT_EMAIL = "help@menus.example.com";
  process.env.TERMS_URL = "https://legal.example.com/terms";
  const pages = (await sitemap()).map((entry) => new URL(entry.url));
  assert.deepEqual(
    pages.map((url) => url.href),
    [...unlisted, "https://menus.example.com/contact"],
  );
  delete process.env.SUPPORT_EMAIL;
  delete process.env.TERMS_URL;
  checks += 2;
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
  // offer is the free allowance (Pro isn't listed).
  const data = homeStructuredData("https://menus.example.com");
  const types = data["@graph"].map((node) => node["@type"]);
  assert.deepEqual(types, ["Organization", "SoftwareApplication"]);
  const [organization, app] = data["@graph"];
  assert.equal(organization.url, "https://menus.example.com/");
  assert(existsSync("public" + new URL(organization.logo).pathname));
  assert.deepEqual([app.offers.price, app.offers.priceCurrency], ["0", "USD"]);
  assert.doesNotMatch(JSON.stringify(data), /9\.99|Pro\b/);
  checks += 4;

  // The homepage's Menus & QR codes and Posts sections, as the server
  // renders them. What they say Free and Pro include stays in step with the
  // plans, and their screenshots are sized and lazy.
  const requireCjs = createRequire(import.meta.url);
  const React = requireCjs("react");
  const { renderToStaticMarkup } = requireCjs("react-dom/server");
  const render = (file, modules) => {
    const { outputText } = ts.transpileModule(
      readFileSync(`app/components/${file}`, "utf8"),
      {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    );
    const compiled = { exports: {} };
    new Function("require", "module", "exports", outputText)(
      (id) => {
        assert(id in modules, `${file} imports ${id}`);
        return modules[id];
      },
      compiled,
      compiled.exports,
    );
    return renderToStaticMarkup(React.createElement(compiled.exports.default));
  };
  const jsx = { "react/jsx-runtime": requireCjs("react/jsx-runtime") };
  const product = render("homepage-product.tsx", {
    ...jsx,
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/lib/homepage-product": await import("../lib/homepage-product.ts"),
  });
  const plans = await import("../lib/plans.ts");
  const { menuDesignSpec } = await import("../lib/menu-design-system.ts");
  assert.match(product, /<h2 id="menus-title">[^<]*QR code menu/);
  assert.match(product, /<h2 id="posts-title">[^<]*Instagram posts/);
  assert.equal(plans.FREE_LIVE_MENUS, 1);
  assert.equal(plans.FREE_POST_TEMPLATES.length, 3);
  for (const claim of [
    `One live menu in ${menuDesignSpec(plans.FREE_MENU_DESIGN.design).name} design`,
    plans.proFeatures.menus.title,
    "Posts and Stories in three designs",
  ])
    assert(product.includes(claim), claim);
  const shots = product.match(/<img [^>]*>/g);
  assert.equal(shots.length, 2);
  for (const tag of shots) {
    for (const attribute of [
      /alt="[^"]{40,}"/,
      /width="\d+"/,
      /height="\d+"/,
      /loading="lazy"/,
      /decoding="async"/,
    ])
      assert.match(tag, attribute);
    for (const [path] of tag.match(/srcSet="([^"]+)"/)[1].matchAll(/\/\S+/g))
      assert(existsSync("public" + path), path);
  }
  checks += 8;

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
  `Site metadata: ${checks} checks passed (origin, robots.txt, contact and legal settings, sitemap, canonical and link-preview tags, share image, structured data, the homepage's product sections, favicon.ico).`,
);

// Where a visitor came from: the referring site's name and the campaign tags
// in the link they arrived by. It's noted in the browser on the first page
// load that has any, and sent once, with signup (lib/server/funnel.ts checks
// it again). Never a full address, and nothing that names a person.

/** The tags read from a link, and the names they're kept under. */
export const attributionParams = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  ref: "ref",
} as const;
export type Attribution = {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  ref?: string;
};

/** A campaign tag as it's kept: plain, short, and never an email address. */
export function cleanTag(value: unknown) {
  if (typeof value !== "string") return undefined;
  const tag = value
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
  return tag && !tag.includes("@") ? tag : undefined;
}

/**
 * A referring site's name (google.com) from its address or host. Paths and
 * queries are dropped, and so are bare network addresses.
 */
export function cleanHost(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const text = value.trim().toLowerCase();
  let host: string;
  try {
    host = new URL(text.includes("://") ? text : `https://${text}`).hostname;
  } catch {
    return undefined;
  }
  host = host.replace(/\.$/, "").replace(/^www\./, "");
  return host.length <= 100 &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) &&
    !/^[\d.]+$/.test(host)
    ? host
    : undefined;
}

/** What one page load says about where its visitor came from, if anything. */
export function pageAttribution(
  href: string,
  referrer: string,
): Attribution | null {
  let page: URL;
  try {
    page = new URL(href);
  } catch {
    return null;
  }
  const found: Attribution = {};
  for (const [param, key] of Object.entries(attributionParams)) {
    const tag = cleanTag(page.searchParams.get(param));
    if (tag) found[key] = tag;
  }
  // Moving between this site's own pages says nothing about the source.
  const site = cleanHost(referrer);
  if (site && site !== cleanHost(page.hostname)) found.referrer = site;
  return Object.keys(found).length ? found : null;
}

/**
 * How the launch funnel groups signups: by campaign source, then a ref link,
 * then the referring site. Medium and campaign ride along when a link set them.
 */
export function signupSource(found: Attribution) {
  return {
    via: found.utmSource
      ? "campaign"
      : found.ref
        ? "ref"
        : found.referrer
          ? "site"
          : "direct",
    name: found.utmSource || found.ref || found.referrer || "",
    medium: found.utmMedium || "",
    campaign: found.utmCampaign || "",
  } as const;
}

const storageKey = "menu-material:first-visit";
// A visit this long before signup no longer explains it.
const keepFor = 30 * 86400000;

/** Notes this page load's source, unless an earlier one is still kept. */
export function captureAttribution() {
  // Diners on a guest menu and staff sending photos aren't signing up.
  if (/^\/(m|s)\//.test(location.pathname)) return;
  const found = pageAttribution(location.href, document.referrer);
  if (!found) return;
  try {
    if (savedAttribution()) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...found, at: Date.now() }),
    );
  } catch {
    // Without storage, signup simply goes without a source.
  }
}

/** The source kept in this browser for signup, while it's recent. */
export function savedAttribution(): Attribution | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || !(Date.now() - Number(saved.at) < keepFor)) return undefined;
    const found: Attribution = {};
    for (const key of [
      "referrer",
      ...Object.values(attributionParams),
    ] as const)
      if (typeof saved[key] === "string") found[key] = saved[key];
    return found;
  } catch {
    return undefined;
  }
}

/** After signup the source has been recorded; the browser doesn't keep it. */
export function forgetAttribution() {
  try {
    localStorage.removeItem(storageKey);
  } catch {}
}

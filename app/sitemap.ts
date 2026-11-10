import type { MetadataRoute } from "next";
import { siteOrigin } from "./site-metadata";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";
import { aboutUpdated, contentPages } from "@/lib/site-pages";

// The public marketing pages: the homepage and pricing, the search pages
// from lib/site-pages.ts with the day each last changed, then the
// information pages. Guest menus belong to restaurants and are found through
// their own links and QR codes. /contact exists once a support address is
// set; /terms only redirects to the owner's Terms, so it's left out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages: { path: string; updated?: string }[] = [
    { path: "/" },
    { path: "/pricing" },
    ...contentPages.map((page) => ({ path: page.path, updated: page.updated })),
    { path: "/about", updated: aboutUpdated },
    { path: "/privacy" },
    { path: "/guidelines" },
  ];
  if (siteContact(config).supportEmail) pages.push({ path: "/contact" });
  return pages.map(({ path, updated }) => ({
    url: new URL(path, origin).href,
    ...(updated ? { lastModified: updated } : {}),
  }));
}

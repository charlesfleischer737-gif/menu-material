import type { MetadataRoute } from "next";
import { siteOrigin } from "./site-metadata";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";

// The public marketing pages. Guest menus belong to restaurants and are found
// through their own links and QR codes. /contact exists once a support
// address is set; /terms only redirects to the owner's Terms, so it's left out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages = ["/", "/pricing", "/privacy", "/guidelines"];
  if (siteContact(config).supportEmail) pages.push("/contact");
  return pages.map((path) => ({
    url: new URL(path, origin).href,
  }));
}

import type { MetadataRoute } from "next";
import { siteOrigin } from "./site-metadata";

// Crawlers may read the public site and guest menus, including the published
// menu data and photos under /api/public/ (link previews show those photos).
// The rest of the API and staff upload links stay out.
export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/public/"],
      disallow: ["/api/", "/s/"],
    },
    sitemap: `${await siteOrigin()}/sitemap.xml`,
  };
}

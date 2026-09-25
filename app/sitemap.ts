import type { MetadataRoute } from "next";
import { siteOrigin } from "./site-metadata";

// The public marketing pages. Guest menus belong to restaurants and are found
// through their own links and QR codes.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return ["/", "/pricing", "/privacy", "/guidelines"].map((path) => ({
    url: new URL(path, origin).href,
  }));
}

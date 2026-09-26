import type { Metadata } from "next";
import { headers } from "next/headers";
import { config } from "@/lib/server/core";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";

// Shared metadata for the public site: its address, link-preview image and
// the fields each public page sets for search engines and link previews.

export const siteName = "Menu Material";

// 1200 × 630 JPEG from scripts/prepare-web-images.mjs (the hero's phone photo
// and studio edit), kept small enough for every link-preview service.
export const shareImage = {
  url: "/menu-material-share.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "The same burger as a phone photo and as an illustrative AI studio edit",
};

const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

// The origin for absolute URLs: APP_ORIGIN when it is set, otherwise the host
// the request was made to (HTTPS unless it is this computer).
export async function siteOrigin() {
  const configured = config("APP_ORIGIN");
  if (configured)
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the request's own host.
    }
  const request = await headers();
  const host = request.get("host") || "localhost";
  const forwarded = request.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol =
    forwarded === "http" || forwarded === "https"
      ? forwarded
      : localHost.test(host)
        ? "http"
        : "https";
  // Only a bare host name or address, with an optional port.
  if (/^[\w.:[\]-]+$/.test(host))
    try {
      return new URL(`${protocol}://${host}`).origin;
    } catch {
      // An unparseable Host header.
    }
  return "http://localhost";
}

// schema.org data for the homepage. The only offer is the free allowance
// every account starts with; Pro is not for sale yet.
export function homeStructuredData(origin: string) {
  const home = new URL("/", origin).href;
  const organization = {
    "@type": "Organization",
    "@id": `${home}#organization`,
    name: siteName,
    url: home,
    logo: new URL("/brand/menu-material-icon-512.png", origin).href,
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "SoftwareApplication",
        name: siteName,
        url: home,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        description:
          "Turn real dish photos into professional images and matching posts for menus, delivery apps, your website and Instagram.",
        publisher: { "@id": organization["@id"] },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: `${FREE_SIGNUP_IMAGES} free images to get started. No credit card needed.`,
        },
      },
    ],
  };
}

// Title, description, canonical address and link previews for a public page.
// Relative URLs resolve against the root layout's metadataBase.
export function pageMetadata({
  title,
  description,
  path,
  shareTitle = title,
  shareDescription = description,
}: {
  title: string;
  description: string;
  path: string;
  shareTitle?: string;
  shareDescription?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName,
      url: path,
      title: shareTitle,
      description: shareDescription,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: shareDescription,
      images: [{ url: shareImage.url, alt: shareImage.alt }],
    },
  };
}

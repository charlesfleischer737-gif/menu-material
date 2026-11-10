import type { Metadata } from "next";
import { headers } from "next/headers";
import { config } from "@/lib/server/core";
import { homeFaqs } from "@/lib/home-faqs";
import { plainText } from "@/lib/inline-links";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";
import { siteSummary } from "@/lib/site-links";

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

// The settings a search engine's webmaster tools ask for to prove ownership:
// GOOGLE_SITE_VERIFICATION (Search Console) and BING_SITE_VERIFICATION (Bing
// Webmaster Tools). Each is the token from the tool's "HTML tag" option, and
// anything that isn't a plain token is ignored.
export function siteVerification(read: (key: string) => string) {
  const token = (key: string) => {
    const value = read(key).trim();
    return /^[\w-]{8,120}$/.test(value) ? value : "";
  };
  const google = token("GOOGLE_SITE_VERIFICATION");
  const bing = token("BING_SITE_VERIFICATION");
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

type Faq = { question: string; answer: string };
type Crumb = { href: string; label: string };

const homeUrl = (origin: string) => new URL("/", origin).href;
const organizationId = (origin: string) => `${homeUrl(origin)}#organization`;
const websiteId = (origin: string) => `${homeUrl(origin)}#website`;

// schema.org nodes shared by every public page: who publishes the site and
// the site itself.
function organizationNode(origin: string) {
  return {
    "@type": "Organization",
    "@id": organizationId(origin),
    name: siteName,
    url: homeUrl(origin),
    logo: new URL("/brand/menu-material-icon-512.png", origin).href,
    description: siteSummary,
  };
}
function websiteNode(origin: string) {
  return {
    "@type": "WebSite",
    "@id": websiteId(origin),
    name: siteName,
    url: homeUrl(origin),
    inLanguage: "en",
    publisher: { "@id": organizationId(origin) },
  };
}
/** A page's questions and answers, as plain text. */
function faqNode(faqs: Faq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: plainText(faq.answer) },
    })),
  };
}
function breadcrumbNode(origin: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: new URL(crumb.href, origin).href,
    })),
  };
}

// schema.org data for the homepage. The only offer is the free allowance
// every account starts with. Pro, sold only while Stripe billing is on
// (billingEnabled()), isn't listed.
export function homeStructuredData(origin: string) {
  const home = homeUrl(origin);
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(origin),
      websiteNode(origin),
      {
        "@type": "SoftwareApplication",
        name: siteName,
        url: home,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        description:
          "Turn real dish photos into professional images and matching posts for menus, delivery apps, your website and Instagram.",
        publisher: { "@id": organizationId(origin) },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: `${FREE_SIGNUP_IMAGES} free images to get started. No credit card needed.`,
        },
      },
      faqNode(homeFaqs),
    ],
  };
}

// schema.org data for any other public page: where it sits in the site, the
// page itself (an Article for guides, with the day it was last changed) and
// its questions, if it has any.
export function pageStructuredData(
  origin: string,
  page: {
    path: string;
    title: string;
    description: string;
    /** The pages above this one, from the homepage down, then this page. */
    breadcrumbs: Crumb[];
    /** YYYY-MM-DD. */
    updated?: string;
    article?: boolean;
    faqs?: Faq[];
  },
) {
  const url = new URL(page.path, origin).href;
  const dates = page.updated
    ? { dateModified: `${page.updated}T00:00:00Z` }
    : {};
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(origin),
      websiteNode(origin),
      breadcrumbNode(origin, page.breadcrumbs),
      page.article
        ? {
            "@type": "Article",
            "@id": `${url}#article`,
            headline: page.title,
            description: page.description,
            mainEntityOfPage: url,
            image: new URL(shareImage.url, origin).href,
            ...(page.updated
              ? { datePublished: `${page.updated}T00:00:00Z` }
              : {}),
            ...dates,
            author: { "@id": organizationId(origin) },
            publisher: { "@id": organizationId(origin) },
            isPartOf: { "@id": websiteId(origin) },
          }
        : {
            "@type": "WebPage",
            "@id": `${url}#page`,
            url,
            name: page.title,
            description: page.description,
            ...dates,
            isPartOf: { "@id": websiteId(origin) },
            about: { "@id": organizationId(origin) },
          },
      ...(page.faqs?.length ? [faqNode(page.faqs)] : []),
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
  article,
}: {
  title: string;
  description: string;
  path: string;
  shareTitle?: string;
  shareDescription?: string;
  /** For guides: the day (YYYY-MM-DD) the article last changed. */
  article?: { modified: string };
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...(article
        ? {
            type: "article" as const,
            modifiedTime: `${article.modified}T00:00:00Z`,
          }
        : { type: "website" as const }),
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

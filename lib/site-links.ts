// The public site's footer links, grouped. Kept apart from lib/site-pages.ts
// (the pages' full copy) because the homepage footer is in the browser bundle.
// tests/site-pages.mjs checks every address here is a real page.

export type SiteLink = { href: string; label: string };

// What Menu Material is, in one sentence: the same words wherever a search
// engine or an AI assistant reads about the site (structured data, /about,
// /llms.txt).
export const siteSummary =
  "Menu Material is an AI food photography studio for restaurants. It turns a phone photo of a real dish into a studio-quality image, then helps put it on menus, delivery apps and Instagram.";

export const footerGroups: { title: string; links: SiteLink[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/ai-food-photography", label: "AI food photography" },
      { href: "/delivery-app-photos", label: "Delivery app photos" },
      { href: "/restaurant-social-media-posts", label: "Instagram posts" },
      { href: "/qr-code-menu", label: "QR code menus" },
      { href: "/pricing", label: "Plans & pricing" },
    ],
  },
  {
    title: "Made for",
    links: [
      { href: "/for/bakeries", label: "Bakeries" },
      { href: "/for/coffee-shops", label: "Coffee shops" },
      { href: "/for/bars", label: "Bars" },
      { href: "/for/fine-dining", label: "Fine dining" },
      { href: "/for/takeout-and-delivery", label: "Takeout & delivery" },
    ],
  },
  {
    title: "Guides",
    links: [
      {
        href: "/guides/doordash-photo-requirements",
        label: "DoorDash photo requirements",
      },
      {
        href: "/guides/uber-eats-photo-requirements",
        label: "Uber Eats photo requirements",
      },
      {
        href: "/guides/instagram-food-photo-sizes",
        label: "Instagram photo sizes",
      },
      {
        href: "/guides/phone-food-photography",
        label: "Food photos with your phone",
      },
      { href: "/guides", label: "All guides" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Photo privacy" },
      { href: "/guidelines", label: "Usage guidelines" },
    ],
  },
];

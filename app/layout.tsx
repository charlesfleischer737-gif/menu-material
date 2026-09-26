import type { Metadata } from "next";
import ErrorReporter from "./components/error-reporter";
import ScrollMemory from "./components/scroll-memory";
import { shareImage, siteName, siteOrigin } from "./site-metadata";
// Imported here rather than from CSS so the build bundles the font files.
import "@fontsource-variable/inter/opsz.css";
import "./globals.css";
import "./workspace.css";
import "./menu-material.css";
import "./creation.css";
import "./studio-onboarding.css";
import "./restaurant-look.css";
import "./launch.css";
import "./marketing.css";
import "./photo-exports.css";
import "./creative-workspace.css";
import "./menu-templates.css";
import "./menu-studio.css";
import "./studio-experience.css";
import "./explore.css";
import "./restaurant-settings.css";
import "./library-filters.css";
import "./workspace-patterns.css";
import "./workspace-shell.css";
import "./photo-studio.css";
import "./kitties.css";
// One control family (buttons, segmented choices); loaded last.
import "./controls.css";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";
// Defaults for every page. Public pages add their own canonical address and
// link-preview text with pageMetadata() from ./site-metadata.
export async function generateMetadata(): Promise<Metadata> {
  return {
    // Makes canonical, og:url and og:image URLs absolute.
    metadataBase: new URL(await siteOrigin()),
    title: "Menu Material — Food photos worth ordering from.",
    description: `Turn real dish photos into professional images and matching posts for Toast, delivery apps, your website, and Instagram. Start with ${FREE_SIGNUP_IMAGES} free images.`,
    icons: {
      icon: "/favicon.svg?v=menu-material-2",
      shortcut: "/favicon.svg?v=menu-material-2",
      apple: "/apple-touch-icon.png?v=menu-material-2",
    },
    openGraph: {
      type: "website",
      siteName,
      title: "Menu Material — Food photos worth ordering from.",
      description:
        "Better food photos for menus, delivery apps, and social media. Made from your actual dish.",
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: "Menu Material",
      description: "Food photos worth ordering from.",
      images: [{ url: shareImage.url, alt: shareImage.alt }],
    },
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorReporter />
        <ScrollMemory />
        {children}
      </body>
    </html>
  );
}

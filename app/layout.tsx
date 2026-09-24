import type { Metadata } from "next";
import { config } from "@/lib/server/core";
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
export async function generateMetadata(): Promise<Metadata> {
  const origin = config("APP_ORIGIN");
  const images = origin
    ? [
        {
          url: new URL("/menu-material-burger.png", origin).href,
          alt: "Menu Material — illustrative AI food photography edit",
        },
      ]
    : [];
  return {
    title: "Menu Material — Food photos worth ordering from.",
    description:
      "Turn real dish photos into professional images and matching posts for Toast, delivery apps, your website, and Instagram. Start with 5 free image generations.",
    icons: {
      icon: "/favicon.svg?v=menu-material-2",
      shortcut: "/favicon.svg?v=menu-material-2",
      apple: "/apple-touch-icon.png?v=menu-material-2",
    },
    openGraph: {
      title: "Menu Material — Food photos worth ordering from.",
      description:
        "Better food photos for menus, delivery apps, and social media. Made from your actual dish.",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: "Menu Material",
      description: "Food photos worth ordering from.",
      images: images.map((i) => i.url),
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
      <body>{children}</body>
    </html>
  );
}

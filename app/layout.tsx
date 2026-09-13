import type { Metadata } from "next";
import { config } from "@/lib/server/core";
import "./globals.css";
import "./sidedish.css";
export async function generateMetadata(): Promise<Metadata> {
  const origin = config("APP_ORIGIN");
  const images = origin
    ? [
        {
          url: new URL("/burger.jpg", origin).href,
          alt: "Food photography inspiration for SideDish",
        },
      ]
    : [];
  return {
    title: "SideDish — Good food. Less on your plate.",
    description:
      "Your restaurant’s new right hand. Food photos, social captions, and your online menu, together in one simple workspace.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "SideDish — Good food. Less on your plate.",
      description:
        "Food photos, social posts, and your online menu. A little help for the restaurant you love.",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: "SideDish",
      description: "Good food. Less on your plate.",
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

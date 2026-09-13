import type { Metadata } from "next";
import { config } from "@/lib/server/core";
import "./globals.css";
import "./workspace.css";
import "./plateworthy.css";
export async function generateMetadata(): Promise<Metadata> {
  const origin = config("APP_ORIGIN");
  const images = origin
    ? [
        {
          url: new URL("/plateworthy-burger.png", origin).href,
          alt: "Plateworthy — illustrative AI food photography edit",
        },
      ]
    : [];
  return {
    title: "Plateworthy — Food photos worth ordering from.",
    description:
      "Turn everyday food photos into studio-quality images for menus, DoorDash, Instagram, and more. Upload your dish, choose a look, and download.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Plateworthy — Food photos worth ordering from.",
      description:
        "Better food photos for menus, delivery apps, and social media. Made from your actual dish.",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: "Plateworthy",
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

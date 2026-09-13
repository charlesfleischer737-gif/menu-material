import type { Metadata } from "next";
import { config } from "@/lib/server/core";
import "./globals.css";
export async function generateMetadata(): Promise<Metadata> {
  const origin = config("APP_ORIGIN");
  const image = origin
    ? [
        {
          url: new URL("/og.png", origin).href,
          width: 1730,
          height: 909,
          alt: "Dishlight — Your food, in its best light",
        },
      ]
    : [];
  return {
    title: "Dishlight — Your food, in its best light",
    description:
      "Believable food photos, social captions, and a beautiful menu. A simple workspace for independent restaurants.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Dishlight",
      description: "Your food, in its best light",
      images: image,
    },
    twitter: {
      card: "summary_large_image",
      title: "Dishlight",
      description: "Your food, in its best light",
      images: image.map((i) => i.url),
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

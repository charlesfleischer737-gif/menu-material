import type { Metadata } from "next";
import { config } from "@/lib/server/core";
import "./globals.css";
import "./workspace.css";
import "./plateworthy.css";
import "./creation.css";
import "./creative-collections.css";
import "./studio-onboarding.css";
import "./studio-workbench.css";
import "./restaurant-look.css";
import "./launch.css";
import "./homepage.css";
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
      "Make hungry customers choose your food. Turn phone photos into professional images, polished menus, and content for DoorDash and Instagram. Start with 5 free image generations. Pro is $9.99/month for 100 images.",
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

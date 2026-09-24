import { notFound, permanentRedirect } from "next/navigation";
import { publicMenu } from "@/lib/server/promotions";
import MenuView from "@/app/components/menu-view";
import { publicDocumentSnapshot } from "@/lib/server/menu-documents";
import { resolveMenuAddress } from "@/lib/server/menu-address";
import { config } from "@/lib/server/core";
import {
  jsonLd,
  menuPreviewImage,
  menuStructuredData,
} from "@/lib/menu-structured-data";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { restaurant: r } = await resolveMenuAddress(slug).catch(() => ({
    restaurant: null,
  }));
  if (!r?.published)
    return {
      title: "Menu not found — Menu Material",
      robots: { index: false, follow: false },
    };
  const published = JSON.parse(r.published),
    name = published.restaurant.name,
    origin = config("APP_ORIGIN");
  // Link previews show a dish (or the logo) and point at the menu's address.
  const image = origin ? menuPreviewImage(published, slug, origin) : null,
    url = origin ? new URL(`/m/${slug}`, origin).href : undefined,
    description = `View the current menu from ${name}${r.address ? `, ${r.address}` : ""}.`;
  return {
    title: name + " — Menu",
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title: name + " — Menu",
      description,
      ...(url ? { url } : {}),
      images: image ? [{ url: image.url, alt: image.alt }] : [],
    },
    twitter: {
      card: image?.large ? "summary_large_image" : "summary",
      title: name + " — Menu",
      description,
      images: image ? [image.url] : [],
    },
  };
}
async function loadMenu(slug: string, requested?: string) {
  const { restaurant: r, redirectTo } = await resolveMenuAddress(slug);
  if (redirectTo) return { kind: "moved" as const, slug: redirectTo };
  if (!r?.published) return { kind: "missing" as const };
  const selected = requested
    ? await publicDocumentSnapshot(r.id, requested)
    : null;
  if (requested && !selected) return { kind: "menu-missing" as const };
  const menu = (await publicMenu(
    selected ? { ...r, published: JSON.stringify(selected) } : r,
  ))!;
  return { kind: "ready" as const, menu };
}
export default async function PublicMenu({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ menu?: string; src?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams,
    requested = query?.menu;
  const result = await loadMenu(slug, requested).catch(() => null);
  if (!result)
    return (
      <main className="unavailable">
        <h1>The menu is taking a moment.</h1>
        <p>Please refresh in a little while.</p>
      </main>
    );
  // An earlier address (for example a printed QR code) opens the current menu.
  if (result.kind === "moved") {
    // Keep the chosen menu and the QR code's placement.
    const kept = new URLSearchParams(
      Object.entries({ menu: requested, src: query?.src }).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ).toString();
    permanentRedirect(`/m/${result.slug}${kept ? `?${kept}` : ""}`);
  }
  if (result.kind === "missing") notFound();
  if (result.kind === "menu-missing")
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <a href={`/m/${slug}`}>View the current menu</a>
      </main>
    );
  const origin = config("APP_ORIGIN"),
    url = origin ? new URL(`/m/${slug}`, origin).href : undefined,
    image = origin ? menuPreviewImage(result.menu, slug, origin) : null;
  return (
    <>
      <MenuView
        menu={result.menu}
        slug={slug}
        serverNow={result.menu.serverNow}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(menuStructuredData(result.menu, url, image?.url)),
        }}
      />
    </>
  );
}

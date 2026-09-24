import { notFound, permanentRedirect } from "next/navigation";
import { publicMenu } from "@/lib/server/promotions";
import MenuView from "@/app/components/menu-view";
import { publicDocumentSnapshot } from "@/lib/server/menu-documents";
import { resolveMenuAddress } from "@/lib/server/menu-address";
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
  const name = JSON.parse(r.published).restaurant.name;
  return {
    title: name + " — Menu",
    description: "View the current menu from " + name,
    openGraph: {
      title: name + " — Menu",
      description: "View the current menu",
      images: [],
    },
    twitter: {
      title: name + " — Menu",
      description: "View the current menu",
      images: [],
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
  searchParams: Promise<{ menu?: string }>;
}) {
  const { slug } = await params;
  const requested = (await searchParams)?.menu;
  const result = await loadMenu(slug, requested).catch(() => null);
  if (!result)
    return (
      <main className="unavailable">
        <h1>The menu is taking a moment.</h1>
        <p>Please refresh in a little while.</p>
      </main>
    );
  // An earlier address (for example a printed QR code) opens the current menu.
  if (result.kind === "moved")
    permanentRedirect(
      `/m/${result.slug}${requested ? `?menu=${encodeURIComponent(requested)}` : ""}`,
    );
  if (result.kind === "missing") notFound();
  if (result.kind === "menu-missing")
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <a href={`/m/${slug}`}>View the current menu</a>
      </main>
    );
  return (
    <MenuView
      menu={result.menu}
      slug={slug}
      serverNow={result.menu.serverNow}
    />
  );
}

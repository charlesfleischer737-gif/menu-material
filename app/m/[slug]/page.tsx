import { publicMenu } from "@/lib/server/promotions";
import { one } from "@/lib/server/core";
import MenuView from "@/app/components/menu-view";
import { publicDocumentSnapshot } from "@/lib/server/menu-documents";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await one(
    "SELECT * FROM restaurants WHERE slug=? AND published IS NOT NULL",
    slug,
  );
  const name = r ? JSON.parse(r.published).restaurant.name : "Menu unavailable";
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
export default async function PublicMenu({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ menu?: string }>;
}) {
  const { slug } = await params;
  const requested = (await searchParams)?.menu;
  const loaded = await loadMenu(slug, requested).catch(() => null);
  if (!loaded)
    return (
      <main className="unavailable">
        <h1>The menu is taking a moment.</h1>
        <p>Please refresh in a little while.</p>
      </main>
    );
  if (loaded === "unpublished")
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <p>Please check with the restaurant for their latest menu.</p>
      </main>
    );
  if (loaded === "unknown")
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <a href={`/m/${slug}`}>View the current menu</a>
      </main>
    );
  return <MenuView menu={loaded} slug={slug} serverNow={loaded.serverNow} />;
}
// Loading stays apart from rendering so a failed lookup shows the retry
// message; a missing published menu resolves to null and shows it too.
async function loadMenu(slug: string, requested?: string) {
  const r = await one(
    "SELECT * FROM restaurants WHERE slug=? AND published IS NOT NULL",
    slug,
  );
  if (!r) return "unpublished" as const;
  const selected = requested
    ? await publicDocumentSnapshot(r.id, requested)
    : null;
  if (requested && !selected) return "unknown" as const;
  return publicMenu(
    selected ? { ...r, published: JSON.stringify(selected) } : r,
  );
}

import { one } from "@/lib/server/core";
import MenuView from "@/app/components/menu-view";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await one(
    "SELECT published FROM restaurants WHERE slug=? AND published IS NOT NULL",
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const r = await one(
      "SELECT published FROM restaurants WHERE slug=? AND published IS NOT NULL",
      slug,
    );
    if (!r)
      return (
        <main className="unavailable">
          <h1>This menu isn’t available right now.</h1>
          <p>Please check with the restaurant for their latest menu.</p>
        </main>
      );
    return <MenuView menu={JSON.parse(r.published)} slug={slug} />;
  } catch {
    return (
      <main className="unavailable">
        <h1>The menu is taking a moment.</h1>
        <p>Please refresh in a little while.</p>
      </main>
    );
  }
}

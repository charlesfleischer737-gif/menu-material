import { cookies } from "next/headers";
import HomeClient from "./components/home-client";
import { homeStructuredData, pageMetadata, siteOrigin } from "./site-metadata";
import { jsonLd } from "@/lib/menu-structured-data";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";

export const metadata = pageMetadata({
  title: "Menu Material — Food photos worth ordering from.",
  description: `Turn real dish photos into professional images and matching posts for Toast, delivery apps, your website, and Instagram. Start with ${FREE_SIGNUP_IMAGES} free images.`,
  path: "/",
  shareDescription:
    "Better food photos for menus, delivery apps, and social media. Made from your actual dish.",
});

// The cookie createSession() sets in lib/server/core.ts. Only its presence is
// read here, as a hint: /api/state still decides who is signed in.
const SESSION_COOKIE = "menu_material_session";

// Visitors without a session get the marketing page in the server HTML, so
// its copy and hero photos arrive without waiting for JavaScript. Visitors
// with one see a short loading state instead of a flash of marketing before
// their workspace opens.
export default async function Home() {
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  return (
    <>
      <HomeClient hasSession={hasSession} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(homeStructuredData(await siteOrigin())),
        }}
      />
    </>
  );
}

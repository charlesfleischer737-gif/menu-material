import { cookies } from "next/headers";
import HomeClient from "./components/home-client";

// The cookie createSession() sets in lib/server/core.ts. Only its presence is
// read here, as a hint: /api/state still decides who is signed in.
const SESSION_COOKIE = "menu_material_session";

// Visitors without a session get the marketing page in the server HTML, so
// its copy and hero photos arrive without waiting for JavaScript. Visitors
// with one see a short loading state instead of a flash of marketing before
// their workspace opens.
export default async function Home() {
  const hasSession = Boolean((await cookies()).get(SESSION_COOKIE)?.value);
  return <HomeClient hasSession={hasSession} />;
}

import ContentPageView, { contentMetadata } from "../components/content-page";

// Copy and structure: lib/site-pages.ts. Rendered per request: addresses in
// its tags and structured data come from the request (siteOrigin()).
export const dynamic = "force-dynamic";
const path = "/guides";
export const metadata = contentMetadata(path);
export default function Page() {
  return <ContentPageView path={path} />;
}

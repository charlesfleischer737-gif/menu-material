import { notFound } from "next/navigation";
import ContentPageView, {
  contentMetadata,
} from "../../components/content-page";
import { contentPage } from "@/lib/site-pages";

// What each platform asks of a menu photo, one platform per page. Copy and
// structure: lib/site-pages.ts.
type Props = { params: Promise<{ guide: string }> };
const pathFor = async ({ params }: Props) => `/guides/${(await params).guide}`;

export async function generateMetadata(props: Props) {
  const path = await pathFor(props);
  return contentPage(path)?.kind === "guide" ? contentMetadata(path) : {};
}
export default async function Page(props: Props) {
  const path = await pathFor(props);
  if (contentPage(path)?.kind !== "guide") notFound();
  return <ContentPageView path={path} />;
}

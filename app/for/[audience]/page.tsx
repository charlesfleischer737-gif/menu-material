import { notFound } from "next/navigation";
import ContentPageView, {
  contentMetadata,
} from "../../components/content-page";
import { contentPage } from "@/lib/site-pages";

// Who Menu Material is for, one kind of kitchen per page. Copy and structure:
// lib/site-pages.ts.
type Props = { params: Promise<{ audience: string }> };
const pathFor = async ({ params }: Props) => `/for/${(await params).audience}`;

export async function generateMetadata(props: Props) {
  const path = await pathFor(props);
  return contentPage(path)?.kind === "audience" ? contentMetadata(path) : {};
}
export default async function Page(props: Props) {
  const path = await pathFor(props);
  if (contentPage(path)?.kind !== "audience") notFound();
  return <ContentPageView path={path} />;
}

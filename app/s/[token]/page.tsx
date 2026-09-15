import StaffUpload from "@/app/components/staff-upload";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff photo upload",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { images: [] },
  twitter: { images: [] },
};
export default async function StaffPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <StaffUpload token={token} />;
}

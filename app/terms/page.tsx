import { notFound, redirect } from "next/navigation";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";
export const dynamic = "force-dynamic";
// A stable address for the owner's Terms, wherever TERMS_URL publishes them:
// signup, Plans and the footer link here. A temporary redirect, so changing
// TERMS_URL takes effect at once. Until it is set, this is a 404.
export default function Terms() {
  const { termsUrl } = siteContact(config);
  if (!termsUrl) notFound();
  redirect(termsUrl);
}

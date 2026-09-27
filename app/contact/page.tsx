import { notFound } from "next/navigation";
import PublicInformation from "../components/public-information";
import { pageMetadata, siteOrigin } from "../site-metadata";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Contact · Menu Material",
  description:
    "How to reach Menu Material about your account, billing, a guest menu or your data.",
  path: "/contact",
});
// Only once the owner sets SUPPORT_EMAIL. Until then this is a 404 like any
// missing page, and nothing links here.
export default async function Contact() {
  const { supportEmail, operator } = siteContact(config);
  if (!supportEmail) notFound();
  const email = <a href={`mailto:${supportEmail}`}>{supportEmail}</a>;
  const menuAddress = `${new URL(await siteOrigin()).host}/m/your-restaurant`;
  return (
    <PublicInformation
      title="Get in touch."
      intro={
        <>
          Email {email} about your account, billing, a guest menu or your data.
        </>
      }
    >
      <section>
        <h2 id="include" tabIndex={-1}>
          What to include
        </h2>
        <p>
          Write from the email address you sign in with, and include your
          restaurant’s name. If it’s about a menu, include its address, such as{" "}
          {menuAddress}. For a new password, write from your account’s email
          address to get a secure reset link.
        </p>
      </section>
      <section>
        <h2 id="report" tabIndex={-1}>
          Report a guest menu
        </h2>
        <p>
          If a menu made with Menu Material uses your photo without permission,
          or shows something wrong or harmful, email {email} with the menu’s
          address and what’s wrong.
        </p>
      </section>
      {operator && (
        <section>
          <h2 id="operator" tabIndex={-1}>
            Who runs Menu Material
          </h2>
          <p>Menu Material is run by {operator}.</p>
        </section>
      )}
    </PublicInformation>
  );
}

"use client";
import { createContext, useContext, type ReactNode } from "react";
import { noSiteContact, type SiteContact } from "@/lib/site-contact";

// The owner's contact and legal settings, from the root layout, for the
// client components that show them: the footer, sign-in, plans and errors.
const SiteContactContext = createContext<SiteContact>(noSiteContact);

export function SiteContactProvider({
  value,
  children,
}: {
  value: SiteContact;
  children: ReactNode;
}) {
  return (
    <SiteContactContext.Provider value={value}>
      {children}
    </SiteContactContext.Provider>
  );
}

export function useSiteContact() {
  return useContext(SiteContactContext);
}

/** The footer's Contact and Terms links, once the owner has set them. */
export function ContactLinks() {
  const { supportEmail, termsUrl } = useSiteContact();
  return (
    <>
      {supportEmail && <a href={`mailto:${supportEmail}`}>Contact</a>}
      {termsUrl && <a href="/terms">Terms</a>}
    </>
  );
}

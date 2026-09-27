// Contact and legal details that only the site's owner can supply, set as
// server settings: SUPPORT_EMAIL, SITE_OPERATOR, TERMS_URL and
// REFUND_POLICY_URL. Each is "" until it is set, and every page keeps its
// earlier wording until then.
export type SiteContact = {
  /** Where owners, guests and rights-holders can write. */
  supportEmail: string;
  /** Who runs the site: a legal name and postal address. */
  operator: string;
  /** The owner's Terms of Service, wherever they are published. */
  termsUrl: string;
  /** Optional: the Terms can cover refunds instead. */
  refundPolicyUrl: string;
};

export const noSiteContact: SiteContact = {
  supportEmail: "",
  operator: "",
  termsUrl: "",
  refundPolicyUrl: "",
};

// A value that isn't a plain address or web link is ignored, so nothing
// shows a broken mailto or link.
const plainEmail = /^[\w.+-]+@[a-z\d-]+(\.[a-z\d-]+)+$/i;
function webLink(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/** The owner's settings, read with the server's config(). */
export function siteContact(read: (key: string) => string): SiteContact {
  const value = (key: string) => read(key).trim();
  const email = value("SUPPORT_EMAIL");
  return {
    supportEmail: plainEmail.test(email) ? email : "",
    operator: value("SITE_OPERATOR").replace(/\s+/g, " "),
    termsUrl: webLink(value("TERMS_URL")),
    refundPolicyUrl: webLink(value("REFUND_POLICY_URL")),
  };
}

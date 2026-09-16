import PublicInformation from "../components/public-information";
export const metadata = {
  title: "Photo & account privacy · Menu Material",
  description:
    "How Menu Material handles private photos, drafts, public menus and AI processing.",
};
export default function Privacy() {
  return (
    <PublicInformation
      title="Your photos, drafts and public menu."
      intro="This page explains Menu Material’s current data handling. Updated September 16, 2026."
    >
      <section>
        <h2>Information used by Menu Material</h2>
        <p>
          Menu Material stores your account email, protected password record,
          restaurant details, uploaded photos, menu files, drafts, generated
          images and usage records. Photos chosen before signup stay in the
          current browser tab until you create an account or sign in and
          generate. Closing that tab discards photos that have not been saved to
          an account.
        </p>
        <p>
          Usage records include creation status, approvals, exports and support
          activity. Published menus record visits and interactions such as dish
          views and ordering-link clicks. Those interactions are not proof of
          purchases.
        </p>
      </section>
      <section>
        <h2>Private until you choose to publish</h2>
        <p>
          Your workspace photos and drafts require access to your restaurant
          account. Publishing a menu makes its selected content, approved photos
          and active specials accessible to anyone with its public link. Staff
          upload links let their holders submit files while the link is active.
        </p>
        <p>
          Unpublishing removes access through the public menu. Deleting a photo
          removes its stored original and working version and stops it being
          served by the site. Copies already downloaded or shared outside
          Menu Material cannot be recalled.
        </p>
      </section>
      <section>
        <h2>AI processing and hosting</h2>
        <p>
          When you request AI work, the relevant photos, dish details and
          instructions are sent to OpenAI. Background image requests retain a
          provider response so an interrupted job can be recovered. Other AI
          features use the details needed for their task. The site uses the
          Sites hosting service with Cloudflare database and file storage.
        </p>
        <p>
          Do not upload private customer information or photos you lack
          permission to process. For provider handling, see{" "}
          <a
            href="https://developers.openai.com/api/docs/guides/your-data"
            rel="noreferrer"
          >
            OpenAI’s API data controls
          </a>
          . This page does not promise a provider retention period that
          Menu Material cannot control.
        </p>
      </section>
      <section>
        <h2>Payments</h2>
        <p>
          When subscriptions are available, Stripe handles checkout and billing.
          Menu Material stores customer and subscription identifiers, subscription
          status, paid billing periods and image usage. Payment-card details are
          entered on Stripe’s hosted pages and are not stored by Menu Material.
        </p>
      </section>
      <section>
        <h2>Saving and retention</h2>
        <p>
          Photos and drafts are retained to let you return to your work.
          Archiving a draft hides it from the active list; it does not delete
          the draft or its photos. Account and workspace removal requests are
          handled by an administrator. There is no automatic account-deletion
          screen yet.
        </p>
        <p>
          The browser uses a sign-in cookie, workspace preferences, temporary
          unsaved-work recovery for the current tab, and a menu-session
          identifier. Unsaved recovery data is cleared after a successful save.
          On a shared device, sign out and close your browser tab when finished.
        </p>
      </section>
      <section>
        <h2>Questions or removal requests</h2>
        <p>
          If you have an administrator contact, use it for privacy or account
          removal requests. A public support email address is not available yet.
        </p>
      </section>
    </PublicInformation>
  );
}

import PublicInformation from "../components/public-information";
import { pageMetadata } from "../site-metadata";
export const metadata = pageMetadata({
  title: "Photo & account privacy · Menu Material",
  description:
    "How Menu Material handles private photos, drafts, public menus and AI processing.",
  path: "/privacy",
});
export default function Privacy() {
  return (
    <PublicInformation
      title="Your photos, drafts and public menu."
      intro="This page explains Menu Material’s current data handling. Updated September 25, 2026."
      sections={[
        { id: "information", label: "Information we store" },
        { id: "publishing", label: "Publishing & sharing" },
        { id: "processing", label: "AI processing" },
        { id: "payments", label: "Payments" },
        { id: "retention", label: "Saving & retention" },
        { id: "requests", label: "Questions & requests" },
      ]}
    >
      <section>
        <h2 id="information" tabIndex={-1}>
          Information used by Menu Material
        </h2>
        <p>
          Menu Material stores your account email, protected password record,
          restaurant details, uploaded photos, menu files, drafts, generated
          images and usage records. Photos chosen before signup are kept only in
          this browser, where they survive a reload or a closed tab, until you
          create an account or sign in and generate. They are then saved to your
          account and removed from the browser. Photos not saved to an account
          expire after 24 hours and are deleted the next time Photo Studio
          opens. To suggest styles before signup, a small copy of the photo is
          sent to OpenAI to see what it shows; Menu Material does not store it.
        </p>
        <p>
          Usage records include creation status, approvals, exports and support
          activity. Published menus record visits and interactions such as dish
          views and ordering-link clicks. Those interactions are not proof of
          purchases.
        </p>
      </section>
      <section>
        <h2 id="publishing" tabIndex={-1}>
          Private until you choose to publish
        </h2>
        <p>
          Your workspace photos and drafts require access to your restaurant
          account. Publishing a menu makes its selected content, approved photos
          and active specials accessible to anyone with its public link. Staff
          upload links let their holders submit files while the link is active.
        </p>
        <p>
          Unpublishing removes access through the public menu. Deleting a photo
          removes its stored original and working version and stops it being
          served by the site. Copies already downloaded or shared outside Menu
          Material cannot be recalled.
        </p>
      </section>
      <section>
        <h2 id="processing" tabIndex={-1}>
          AI processing and hosting
        </h2>
        <p>
          When you request AI work, the relevant photos, dish details and
          instructions are sent to OpenAI. Each image is made by a direct
          request, and the finished image is saved to your workspace when it
          arrives; an interrupted request is not resumed or recovered later.
          Other AI features use the details needed for their task. The site uses
          the Sites hosting service with Cloudflare database and file storage.
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
          . This page does not promise a provider retention period that Menu
          Material cannot control.
        </p>
      </section>
      <section>
        <h2 id="payments" tabIndex={-1}>
          Payments
        </h2>
        <p>
          When subscriptions are available, Stripe handles checkout and billing.
          Menu Material stores customer and subscription identifiers,
          subscription status, paid billing periods and image usage.
          Payment-card details are entered on Stripe’s hosted pages and are not
          stored by Menu Material.
        </p>
      </section>
      <section>
        <h2 id="retention" tabIndex={-1}>
          Saving and retention
        </h2>
        <p>
          Photos and drafts are retained to let you return to your work.
          Archiving a draft hides it from the active list; it does not delete
          the draft or its photos. You can delete your account in Settings,
          under Details: it permanently removes your restaurant’s workspace,
          including dishes, photos, drafts, menus (published ones too), posts
          and captions, and signs you out everywhere. Copies you already
          downloaded or shared can’t be recalled. A record of AI usage costs,
          without your photos or text, is kept for accounting. Accounts with
          billing records are removed by an administrator.
        </p>
        <p>
          The browser uses a sign-in cookie, workspace preferences and a
          menu-session identifier. It also keeps copies of unsaved work so it
          can be recovered: menu drafts in this browser’s storage, where they
          remain after the tab is closed, and Photo Studio, post and campaign
          drafts for the current tab only. Recovery data is cleared after a
          successful save. On a shared device, sign out and close your browser
          tab when finished.
        </p>
      </section>
      <section>
        <h2 id="requests" tabIndex={-1}>
          Questions or removal requests
        </h2>
        <p>
          If you have an administrator contact, use it for privacy or account
          removal requests. A public support email address is not available yet.
        </p>
      </section>
    </PublicInformation>
  );
}

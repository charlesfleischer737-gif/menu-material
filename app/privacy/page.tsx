import PublicInformation from "../components/public-information";
import { pageMetadata } from "../site-metadata";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";
// The support address and operator are server settings, read per request.
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Photo & account privacy · Menu Material",
  description:
    "How Menu Material handles private photos, drafts, public menus and AI processing.",
  path: "/privacy",
});
export default function Privacy() {
  const { supportEmail, operator } = siteContact(config);
  return (
    <PublicInformation
      title="Your photos, drafts and public menu."
      intro="This page explains Menu Material’s current data handling. Updated September 27, 2026."
      sections={[
        { id: "information", label: "Information we store" },
        { id: "publishing", label: "Publishing & sharing" },
        { id: "guest-visits", label: "Guest menu visits" },
        { id: "processing", label: "Services we use" },
        { id: "payments", label: "Payments" },
        { id: "retention", label: "Saving & retention" },
        { id: "requests", label: "Choices & requests" },
      ]}
    >
      <section>
        <h2 id="information" tabIndex={-1}>
          Information used by Menu Material
        </h2>
        <p>
          Menu Material stores your account email, protected password record,
          restaurant details, uploaded photos, menu files, drafts, generated
          images and usage records. Usage records include creation status,
          approvals, exports and support activity. To slow abuse, such as
          repeated sign-in attempts, it keeps counters keyed by a one-way hash
          of your network address or email; they expire within a day.
        </p>
        <p>
          Photos chosen before signup are kept only in this browser, where they
          survive a reload or a closed tab, until you create an account or sign
          in. They are then saved to your account and removed from the browser.
          If you asked for a photo that can’t be made yet, yours stays in this
          browser until you try again. Photos not saved to an account expire 24
          hours after your last change and are deleted the next time Photo
          Studio opens. To suggest styles before signup, a small copy of the
          photo is sent to OpenAI to see what it shows; Menu Material does not
          store the photo. What it shows (for example “a burger”) is kept for a
          week, by a fingerprint of the photo, so the same photo isn’t sent
          again.
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
        <h2 id="guest-visits" tabIndex={-1}>
          What a guest menu visit records
        </h2>
        <p>
          When a guest opens a published menu, Menu Material records the visit,
          the dishes they scroll to, and taps on its order, call, directions and
          reservation links. Each record notes the menu, the time and, when the
          link or QR code carries one, where the guest found it, such as a table
          QR code or an Instagram bio link. Restaurants see these counts as menu
          insights; they are not proof of purchases. The restaurant’s own visits
          while signed in aren’t counted.
        </p>
        <p>
          A random identifier kept in the guest’s browser tab lets each visit
          count once; it is stored only as part of a one-way hash, with no name,
          email or account. The guest’s network address is used only for the
          abuse counters described above. Visit records are deleted after 90
          days.
        </p>
      </section>
      <section>
        <h2 id="processing" tabIndex={-1}>
          Services we use
        </h2>
        <p>
          <strong>OpenAI</strong> makes images and reads photos, menus and text
          for AI features. When you request AI work, the relevant photos, dish
          details and instructions are sent to OpenAI. Each image is made by a
          direct request, and the finished image is saved to your workspace when
          it arrives; an interrupted request is not resumed or recovered later.
          Other AI features use the details needed for their task.
        </p>
        <p>
          <strong>Cloudflare</strong> stores the database and files, through the
          Sites hosting service that runs the site.
        </p>
        <p>
          <strong>Stripe</strong> handles Pro payments, described below.
        </p>
        <p>
          <strong>Slack or Discord</strong> receives alerts and error reports,
          if Menu Material’s team has connected them. An error report holds the
          error message, with email addresses, passwords and tokens removed, and
          the page or feature where it happened. It never includes photos.
          Errors are also written to the server’s logs, with the restaurant’s ID
          when someone is signed in and, for browser errors, the browser’s name
          and version.
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
          If you subscribe to Pro, Stripe handles checkout and billing. Starting
          checkout sends your account email to Stripe for your customer record.
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
          Photos and drafts are kept until you delete them, so you can return to
          your work. Archiving a draft hides it from the active list; it does
          not delete the draft or its photos. Photos chosen before signup stay
          in the browser for 24 hours after your last change. A sign-in lasts 7
          days and renews while you use it. Guest menu visit records are deleted
          after 90 days. A record of AI usage costs, without your photos or
          text, is kept for accounting. After an account is deleted, a one-way
          hash of its email address is kept for a year, only so the free images
          for new accounts aren’t given to the same email twice. Stripe keeps its own
          records of invoices and payments.
        </p>
        <p>
          You can delete your account in Settings, under Details. Deletion is
          immediate: it permanently removes your restaurant’s workspace,
          including dishes, photos, drafts, menus (published ones too), posts
          and captions, signs you out everywhere and deletes your customer
          record at Stripe, if you have one. Only a one-way hash of your email
          stays, for a year, so a new account with that email starts without
          free images.
          With an active Pro subscription, cancel it first in Plans, under
          Manage billing; you can delete the account once Pro has ended. Copies
          you already downloaded or shared can’t be recalled.
        </p>
        <p>
          The browser uses a sign-in cookie, workspace preferences and a
          menu-session identifier. After you sign in, it also keeps a device
          cookie for a year, so it can still sign in to your account while
          someone else’s repeated attempts are slowing sign-ins to it; a
          password reset or deleting your account revokes it. The browser also
          keeps copies of unsaved work so it can be recovered: menu drafts in
          this browser’s storage, where they remain after the tab is closed, and
          Photo Studio, post and campaign drafts for the current tab only.
          Recovery data is cleared after a successful save. On a shared device,
          sign out and close your browser tab when finished.
        </p>
      </section>
      <section>
        <h2 id="requests" tabIndex={-1}>
          Your choices and requests
        </h2>
        <p>
          You can edit, download and delete your photos, menus and posts in your
          workspace, change your restaurant details in Settings, and delete your
          whole account in Settings, under Details.
        </p>
        {supportEmail ? (
          <p>
            For anything else, such as a copy of the information stored about
            you, a correction, or removing a guest menu or photo that concerns
            you, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. If
            you have an account, write from its email address.
          </p>
        ) : (
          <p>
            If you have an administrator contact, use it for privacy or account
            removal requests. A public support email address is not available
            yet.
          </p>
        )}
        {operator && <p>Menu Material is run by {operator}.</p>}
      </section>
    </PublicInformation>
  );
}

import PublicInformation from "../components/public-information";
export const metadata = {
  title: "The free restaurant pilot · Plateworthy",
  description:
    "What Plateworthy’s early-access pilot includes, how image allowances work, and how to get help.",
};
export default function Pilot() {
  return (
    <PublicInformation
      title="A clear start for your restaurant."
      intro="Plateworthy brings your dish photos, menus and social designs into one restaurant workspace. We’re opening access gradually so we can learn from real restaurant use."
    >
      <section>
        <h2>What’s included</h2>
        <p>
          The pilot is free and does not ask for a credit card. Your invitation
          includes a fixed image allowance, shown in your workspace. Photo
          Studio, Menu Builder and Post Maker share your saved dish library and
          restaurant look.
        </p>
        <p>
          You can keep your original photos, make quick manual adjustments,
          export approved images and social designs, and publish a menu with a
          shareable link and QR code. Plateworthy does not automatically post to
          your social accounts or connect to your ordering system.
        </p>
      </section>
      <section>
        <h2>How the image allowance works</h2>
        <p>
          A new AI image reserves one image from your allowance. Asking AI for
          another version uses another image. A failed output restores its
          allowance; rejecting a completed result does not. Cropping, manual
          touch-ups, menus, downloads and post layouts do not use the image
          allowance.
        </p>
        <p>
          AI captions, photo guidance and menu reading have separate usage
          limits. Daily AI and storage limits can temporarily pause new work. An
          interrupted request is checked before another submission is allowed,
          to avoid creating the same image twice.
        </p>
      </section>
      <section>
        <h2>Joining and future pricing</h2>
        <p>
          Use “Request early access” on the homepage to join the list. Places
          are reviewed manually and an invitation is required to create a
          workspace. A request does not guarantee a place or an immediate
          response. We are not offering paid subscriptions or taking payment
          details during this pilot.
        </p>
        <p>
          Future plans and prices have not been announced. The pilot is a chance
          to help shape the product, not a promise of unlimited free AI
          creation.
        </p>
      </section>
      <section>
        <h2>Help and account access</h2>
        <p>
          During the pilot, use the contact you received with your invitation
          for help, additional allowance, privacy requests or a secure
          password-reset invitation. Automated password-reset emails and a
          public support inbox are not available yet.
        </p>
        <p>
          If an image takes longer than expected, keep its request saved and
          reopen Photo Studio to check it. Avoid starting another copy while
          recovery is in progress.
        </p>
      </section>
      <section>
        <h2>Review your real dish</h2>
        <p>
          AI can change details. Check ingredients, portions, plating and
          packaging against what you actually serve before approving a result.
          Delivery platforms review their own listings; an export is not a
          guarantee of acceptance.
        </p>
        <p>
          <a href="/privacy">Read how photos and account data are handled</a>{" "}
          and <a href="/guidelines">review the usage guidelines</a>.
        </p>
      </section>
    </PublicInformation>
  );
}

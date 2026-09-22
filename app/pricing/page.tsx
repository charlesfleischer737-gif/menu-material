import PublicInformation from "../components/public-information";
import PlanCards from "../components/plan-cards";
import { billingEnabled } from "@/lib/server/billing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Free & Pro plans · Menu Material",
  description:
    "Explore Menu Material plans for restaurant photography. Start with 5 free image generations.",
};
export default function Pricing() {
  const enabled = billingEnabled();
  return (
    <PublicInformation
      title="A little budget. A lot of good-looking food."
      intro={
        enabled
          ? "Start with 5 free images. Keep creating with Pro for $9.99 a month."
          : "Start with 5 free images. Pro is coming soon at $9.99 a month."
      }
    >
      <PlanCards enabled={enabled} />
      <section>
        <h2>Your photos. The same quality on every plan.</h2>
        <p>
          Choose a style and prepare your photo before creating an account. When
          you click Generate image, sign up to receive five free image
          generations. Original photos are kept separately from AI results. All
          plans include Photo Studio, My Dishes, Post Maker and full-quality
          exports.
        </p>
      </section>
      <section>
        <h2>How generations work</h2>
        <p>
          Each generated image uses one generation. An AI revision or another
          version uses another generation. Failed generations are returned to
          their original allowance. Cropping, manual touch-ups, menus, post
          layouts and downloads do not use image generations.
        </p>
        <p>
          The Free allowance is granted once per account and does not renew.{" "}
          {enabled
            ? "Pro includes 100 generations per paid monthly billing period."
            : "When Pro becomes available, it will include 100 generations per paid monthly billing period."}{" "}
          Unused monthly generations do not roll over. Each new allowance
          follows a confirmed renewal payment. Your workspace shows your actual
          balance and any renewal date.
        </p>
      </section>
      <section>
        <h2>
          {enabled
            ? "Simple subscription control"
            : "When Pro becomes available"}
        </h2>
        <p>
          {enabled
            ? "Pro is $9.99 USD per month and renews until cancelled. Manage payments and cancel future renewals from Plans in your workspace."
            : "Pro will cost $9.99 USD per month, with payment and cancellation controls in Plans. Subscriptions are not open yet."}{" "}
          Cancelling a subscription at renewal retains its paid allowance
          through the end of that billing period. Saved photos and designs
          remain available.
        </p>
        <p>
          AI creation can be temporarily limited by service availability, safety
          controls and storage capacity. Always review the result against the
          dish you serve before sharing it.
        </p>
      </section>
      <section>
        <h2>Account access</h2>
        <p>
          Keep your password safe. Automated password-reset emails and a public
          support inbox are not available yet. An administrator can issue a
          secure reset link if you have an existing contact.
        </p>
      </section>
    </PublicInformation>
  );
}

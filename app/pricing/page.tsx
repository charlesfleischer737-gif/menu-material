import PublicInformation from "../components/public-information";
import PlanCards from "../components/plan-cards";
import { billingEnabled } from "@/lib/server/billing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Free & Pro plans · Plateworthy",
  description:
    "Start with 5 free image generations. Plateworthy Pro is $9.99/month for 100 full-quality image generations per month.",
};
export default function Pricing() {
  return (
    <PublicInformation
      title="A little budget. A lot of good-looking food."
      intro="Start with 5 free images. Keep creating with Pro for $9.99 a month."
    >
      <PlanCards enabled={billingEnabled()} />
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
          The Free allowance is granted once per account and does not renew. Pro
          includes 100 generations per paid monthly billing period; unused
          monthly generations do not roll over. Your next allowance arrives
          after your renewal payment is confirmed. The workspace shows your
          remaining balance and renewal date.
        </p>
      </section>
      <section>
        <h2>Simple subscription control</h2>
        <p>
          Pro is $9.99 USD per month and renews until cancelled. Manage payments
          and cancel future renewals from Plans in your workspace. You retain
          your paid allowance until the end of the paid period when you cancel
          at renewal. Your saved photos and designs remain available.
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

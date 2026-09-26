import PublicInformation from "../components/public-information";
import PlanCards from "../components/plan-cards";
import { billingEnabled } from "@/lib/server/billing";
import { pageMetadata } from "../site-metadata";
import { FREE_SIGNUP_IMAGES, PRO_PLAN, PRO_PRICE_LABEL } from "@/lib/plans";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Free & Pro plans · Menu Material",
  description: `Explore Menu Material plans for restaurant photography. Start with ${FREE_SIGNUP_IMAGES} free images.`,
  path: "/pricing",
});
export default function Pricing() {
  const enabled = billingEnabled();
  const questions: [string, string][] = [
    [
      "What uses an image?",
      "Each new photo or AI revision uses one image. Cropping, touch-ups, menus, post layouts and downloads never use one, and images that fail to create are returned.",
    ],
    [
      "Do free images expire?",
      `No. The ${FREE_SIGNUP_IMAGES} free images are a one-time allowance for each account.`,
    ],
    [
      "What’s included for free?",
      "Full-quality photos in every style with no watermark, every download size, one live menu with its QR code, PDF and table card, and posts and Stories in three designs.",
    ],
    [
      "What does Pro add?",
      `${PRO_PLAN.imagesPerPeriod} images every month, your restaurant look on photos, posts and menus, every post and menu design, campaigns, up to 30 live menus, full menu insights, saved looks, inspiration photos, batches, staff photo links, and no “Made with Menu Material” on your guest menus.`,
    ],
    [
      "How does Pro work?",
      enabled
        ? `Pro is ${PRO_PRICE_LABEL} a month for ${PRO_PLAN.imagesPerPeriod} images each billing period. Unused images don’t roll over, and you can cancel future renewals from Plans in your workspace.`
        : `Pro will be ${PRO_PRICE_LABEL} a month for ${PRO_PLAN.imagesPerPeriod} images each billing period, with payment and cancellation in Plans. Subscriptions aren’t open yet.`,
    ],
    [
      "What happens if I cancel?",
      "Pro lasts until the end of the billing period. Your photos, posts, menus and saved looks stay available, and live menus stay live.",
    ],
    [
      "Is the quality the same on every plan?",
      "Yes. Every image and export is full quality on every plan. Always review each image against the dish you serve before sharing it.",
    ],
    [
      "How do I reset my password?",
      "Password-reset emails aren’t available yet. An administrator can send you a secure reset link.",
    ],
  ];
  return (
    <PublicInformation
      title="A little budget. A lot of good-looking food."
      intro={
        enabled
          ? `Start with ${FREE_SIGNUP_IMAGES} free images. Pro keeps your restaurant looking its best, every week, for ${PRO_PRICE_LABEL} a month.`
          : `Start with ${FREE_SIGNUP_IMAGES} free images. Pro is coming soon at ${PRO_PRICE_LABEL} a month.`
      }
    >
      <PlanCards enabled={enabled} />
      <section className="pw-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions</h2>
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </PublicInformation>
  );
}

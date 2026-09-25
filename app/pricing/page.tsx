import PublicInformation from "../components/public-information";
import PlanCards from "../components/plan-cards";
import { billingEnabled } from "@/lib/server/billing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Free & Pro plans · Menu Material",
  description:
    "Explore Menu Material plans for restaurant photography. Start with 5 free images.",
};
export default function Pricing() {
  const enabled = billingEnabled();
  const questions: [string, string][] = [
    [
      "What uses an image?",
      "Each new photo or AI revision uses one image. Cropping, touch-ups, menus, post layouts and downloads are always free, and images that fail to create are returned.",
    ],
    [
      "Do free images expire?",
      "No. The 5 free images are a one-time allowance for each account.",
    ],
    [
      "How does Pro work?",
      enabled
        ? "Pro is $9 a month for 50 images each billing period. Unused images don’t roll over, and you can cancel future renewals from Plans in your workspace."
        : "Pro will be $9 a month for 50 images each billing period, with payment and cancellation in Plans. Subscriptions aren’t open yet.",
    ],
    [
      "What happens if I cancel?",
      "Your paid allowance lasts until the end of the billing period. Saved photos and designs stay available.",
    ],
    [
      "Is the quality the same on every plan?",
      "Yes. Every plan includes Photo Studio, My Dishes, Post Maker and full-quality exports. Always review each image against the dish you serve before sharing it.",
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
          ? "Start with 5 free images. Keep creating with Pro for $9 a month."
          : "Start with 5 free images. Pro is coming soon at $9 a month."
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

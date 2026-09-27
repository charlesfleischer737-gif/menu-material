import type { ReactNode } from "react";

// Each answer says only what the product does and what the privacy page,
// usage guidelines and plan cards say; change them together. How long OpenAI
// keeps data is OpenAI's to say, so that answer links to their page, as the
// privacy page does. Links are plain <a>, as elsewhere on the public site:
// next/link's client navigation throws in the vinext production build.
const questions: [string, ReactNode][] = [
  [
    "Are the photos made with AI?",
    "Yes. Menu Material uses AI to edit a photo of your own dish, with new light, backdrop and styling in the look you choose. AI can change details of the food, so check each result against the dish you serve. With no photo, you can describe a dish instead; that makes an illustration, not a photo of your dish.",
  ],
  [
    "What happens to my original photo?",
    "It’s kept. Each AI edit is saved as a new image, and your original stays in your workspace until you delete it.",
  ],
  [
    "Do I approve every photo?",
    "Yes. A photo goes on your menus and posts only after you choose it, and a new AI image can’t be downloaded until you do.",
  ],
  [
    "Who owns the images?",
    <>
      Menu Material doesn’t claim your photos. The images it makes from them are
      for your restaurant’s menus, delivery listings, website and social posts,
      and you can download them at full quality. Your rights in the original
      photo and each platform’s rules still apply, and an AI result isn’t
      guaranteed to be unique to you. See the{" "}
      <a href="/guidelines#commercial">usage guidelines</a>.
    </>,
  ],
  [
    "Are my photos used to train AI?",
    <>
      Menu Material doesn’t use your photos to train AI. To make images and
      suggest styles, it sends the photo and your instructions to OpenAI. For
      how OpenAI handles that data, see{" "}
      <a
        href="https://developers.openai.com/api/docs/guides/your-data"
        rel="noreferrer"
      >
        OpenAI’s API data controls
      </a>
      .
    </>,
  ],
  [
    "How do I cancel Pro?",
    "If you subscribe, Pro renews monthly until you cancel. Cancel anytime in Plans in your workspace, under Manage billing. Pro stays until the end of the month you’ve paid for, your photos, menus and posts stay in your workspace, and live menus stay live.",
  ],
];

/** Plain answers about the photos and the plan, before anyone signs up. */
export default function HomepageFaq() {
  return (
    <section className="pw-home-faq" id="faq" aria-labelledby="faq-title">
      <div className="pw-section-heading">
        <h2 id="faq-title">Questions, answered.</h2>
        <p>Straight answers about your photos and your plan.</p>
      </div>
      <div className="pw-faq">
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <p className="pw-home-faq-more">
        More about plans on the <a href="/pricing">pricing page</a>, and about
        your data on the <a href="/privacy">privacy page</a>.
      </p>
    </section>
  );
}

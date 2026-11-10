import { inlineParts } from "@/lib/inline-links";
// Plain links on purpose: see site-chrome.tsx.

/** Page copy with its [label](/path) links drawn as links. */
export default function InlineText({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <a key={index} href={part.href}>
            {part.label}
          </a>
        ),
      )}
    </>
  );
}

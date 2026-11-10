import { FREE_SIGNUP_IMAGES } from "./plans";

// The homepage's questions, shown on the page and listed in its structured
// data. Links use [label](/path) (lib/inline-links.ts). The paid plan isn't
// named here: it is sold only while billing is on, and /pricing says which.
export const homeFaqs: { question: string; answer: string }[] = [
  {
    question: "What is Menu Material?",
    answer:
      "Menu Material is an AI food photography studio for restaurants. It turns a phone photo of your real dish into a studio-quality image, then helps you put it on your menu, delivery apps and Instagram.",
  },
  {
    question: "Is the result still my real dish?",
    answer:
      "Yes. Every image starts from your own photo. The light, backdrop and setting change; your plating, ingredients and portions are meant to stay as you serve them. You compare each result with your original before you use it.",
  },
  {
    question: "Where can I use the photos?",
    answer:
      "Anywhere your menu lives. Each photo downloads at the right size for DoorDash, Uber Eats, Toast, your website and Instagram. The [photo size guides](/guides) list what each platform asks for.",
  },
  {
    question: "Do I need a professional camera?",
    answer:
      "No. A recent phone and a window are enough. [How to photograph food with your phone](/guides/phone-food-photography) covers light, angle and framing.",
  },
  {
    question: "How much does it cost?",
    answer: `Every account starts with ${FREE_SIGNUP_IMAGES} free images, with no credit card and no expiry. [Plans and pricing](/pricing) has the rest.`,
  },
];

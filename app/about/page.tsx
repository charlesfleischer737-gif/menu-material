import InlineText from "../components/inline-text";
import PublicInformation from "../components/public-information";
import { ReadNext, StartCard } from "../components/content-page";
import { pageMetadata, pageStructuredData, siteOrigin } from "../site-metadata";
import { libraryStyleCount } from "@/lib/homepage-showcase";
import { jsonLd } from "@/lib/menu-structured-data";
import { FREE_SIGNUP_IMAGES, PRO_PLAN, PRO_PRICE_LABEL } from "@/lib/plans";
import { billingEnabled } from "@/lib/server/billing";
import { config } from "@/lib/server/core";
import { siteContact } from "@/lib/site-contact";
import { siteSummary } from "@/lib/site-links";
import { aboutUpdated } from "@/lib/site-pages";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: see site-chrome.tsx. */

// What Menu Material is, who it is for and who runs it, in plain terms: the
// page a search engine or an AI assistant reads to learn what the site is.
// Whether Pro is on sale, and the operator, are server settings.
export const dynamic = "force-dynamic";
const title = "About Menu Material: AI food photography for restaurants";
const description =
  "Menu Material turns a restaurant’s phone photos into studio-quality images, Instagram posts and QR code menus. What it does, who it’s for and what it costs.";
export const metadata = pageMetadata({ title, description, path: "/about" });

const does = [
  `[AI food photography](/ai-food-photography): ${libraryStyleCount} looks that restyle the light and setting of your own photo.`,
  "[Delivery app photos](/delivery-app-photos): each photo sized and checked for DoorDash, Uber Eats and Toast.",
  "[Instagram posts and Stories](/restaurant-social-media-posts): finished designs, with a caption you can edit.",
  "[QR code menus](/qr-code-menu): a live menu with its own QR code, PDF and table card.",
];
const madeFor = [
  "[Bakeries and pastry shops](/for/bakeries)",
  "[Coffee shops and juice bars](/for/coffee-shops)",
  "[Bars](/for/bars)",
  "[Fine dining rooms](/for/fine-dining)",
  "[Takeout and delivery kitchens](/for/takeout-and-delivery)",
  "Food trucks, diners and neighborhood restaurants of every kind",
];

export default async function About() {
  const { supportEmail, operator } = siteContact(config);
  const pro = billingEnabled()
    ? `Pro is ${PRO_PRICE_LABEL} a month for ${PRO_PLAN.imagesPerPeriod} images each month, with every post and menu design and your restaurant look on all of it.`
    : `Pro is coming soon at ${PRO_PRICE_LABEL} a month for ${PRO_PLAN.imagesPerPeriod} images each month.`;
  const data = pageStructuredData(await siteOrigin(), {
    path: "/about",
    title,
    description,
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
    ],
    updated: aboutUpdated,
  });
  return (
    <PublicInformation
      title="Good food deserves a good photo."
      intro={siteSummary}
      sections={[
        { id: "what", label: "What it does" },
        { id: "who", label: "Who it’s for" },
        { id: "why", label: "Why it exists" },
        { id: "promise", label: "What we promise" },
        { id: "cost", label: "What it costs" },
      ]}
    >
      <section>
        <h2 id="what" tabIndex={-1}>
          What it does
        </h2>
        <ul className="pw-list">
          {does.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 id="who" tabIndex={-1}>
          Who it’s for
        </h2>
        <p>
          Menu Material is made for independent restaurants and small groups
          that don’t have a photographer on call:
        </p>
        <ul className="pw-list">
          {madeFor.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 id="why" tabIndex={-1}>
          Why it exists
        </h2>
        <p>
          Most small restaurants end up choosing between a dim phone photo and
          an AI picture of food they don’t serve. Menu Material is a third
          option: your real dish, photographed by you, in a better light.
        </p>
      </section>
      <section>
        <h2 id="promise" tabIndex={-1}>
          What we promise, and what we don’t
        </h2>
        <p>
          Every image starts from your photo, and you approve it before it’s
          used. Photos are private until you choose to publish them (
          <a href="/privacy">photo privacy</a>). Images are full quality, with
          no watermark.
        </p>
        <p>
          We don’t promise that a delivery app will approve a photo, and we ask
          you to check each result against the dish you serve (
          <a href="/guidelines">usage guidelines</a>). The{" "}
          <a href="/guides">guides</a> list what each platform asks for.
        </p>
      </section>
      <section>
        <h2 id="cost" tabIndex={-1}>
          What it costs
        </h2>
        <p>
          Every account starts with {FREE_SIGNUP_IMAGES} free images, with no
          credit card and no expiry. {pro} See{" "}
          <a href="/pricing">plans and pricing</a>.
        </p>
      </section>
      {(operator || supportEmail) && (
        <section>
          <h2 id="operator" tabIndex={-1}>
            Who runs it
          </h2>
          <p>
            {operator && <>Menu Material is run by {operator}. </>}
            {supportEmail && (
              <>
                Write to <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
              </>
            )}
          </p>
        </section>
      )}
      <ReadNext paths={["/ai-food-photography", "/guides", "/pricing"]} />
      <StartCard />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
      />
    </PublicInformation>
  );
}

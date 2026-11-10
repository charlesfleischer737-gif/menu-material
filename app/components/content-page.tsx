import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import InlineText from "./inline-text";
import PublicInformation from "./public-information";
import { pageMetadata, pageStructuredData, siteOrigin } from "../site-metadata";
import { showcaseStyles } from "@/lib/homepage-showcase";
import { jsonLd } from "@/lib/menu-structured-data";
import {
  photoStyles,
  styleCategories,
  styleThumbnail,
} from "@/lib/photo-styles";
import { FREE_SIGNUP_IMAGES } from "@/lib/plans";
import {
  audienceCollections,
  contentPage,
  longDate,
  pageCard,
  siteTitle,
  type Block,
  type ContentPage,
} from "@/lib/site-pages";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: see site-chrome.tsx. */

// Draws a page from lib/site-pages.ts: its sections, questions, sources and
// the pages to read next, with the structured data search engines read.

/** <title>, description, canonical address and link previews for a page. */
export function contentMetadata(path: string): Metadata {
  const page = contentPage(path);
  if (!page) return {};
  return pageMetadata({
    title: siteTitle(page),
    description: page.description,
    path: page.path,
    ...(page.kind === "guide" ? { article: { modified: page.updated } } : {}),
  });
}

/** The pages above a page, from the homepage down. */
export function breadcrumbsFor(page: ContentPage) {
  const crumbs = [{ href: "/", label: "Home" }];
  if (page.kind === "guide") crumbs.push({ href: "/guides", label: "Guides" });
  if (page.kind === "audience")
    crumbs.push({
      href: "/ai-food-photography",
      label: "AI food photography",
    });
  return crumbs;
}

const audienceByCollection = Object.fromEntries(
  Object.entries(audienceCollections).map(([path, id]) => [id, path]),
);

function Cards({ paths }: { paths: string[] }) {
  const cards = paths.flatMap((path) => pageCard(path) ?? []);
  return (
    <ul className="pw-page-cards">
      {cards.map((card) => (
        <li key={card.path}>
          <a href={card.path}>
            <strong>{card.label}</strong>
            <span>{card.summary}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "text":
      return (
        <>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph}>
              <InlineText text={paragraph} />
            </p>
          ))}
        </>
      );
    case "list":
      return (
        <ul className="pw-list">
          {block.items.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="pw-steps">
          {block.items.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong> <InlineText text={item.text} />
            </li>
          ))}
        </ol>
      );
    case "specs":
      return (
        <table className="pw-specs">
          <tbody>
            {block.rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "styles":
      return (
        <ul className="pw-look-list">
          {photoStyles
            .filter((style) => style.category === block.category)
            .map((style) => (
              <li key={style.id}>
                <img
                  src={styleThumbnail(style.image)}
                  alt={`${style.name}: an example of the look. ${style.cue}.`}
                  width="400"
                  height="400"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>{style.name}</h3>
                  <p>{style.description}</p>
                  {style.bestFor && (
                    <p className="pw-look-use">Best for: {style.bestFor}</p>
                  )}
                </div>
              </li>
            ))}
        </ul>
      );
    case "collections":
      return (
        <ul className="pw-collections">
          {styleCategories.map((category) => {
            const example = photoStyles.find(
              (style) => style.category === category.id,
            );
            const path = audienceByCollection[category.id];
            const body = (
              <>
                {example && (
                  <img
                    src={styleThumbnail(example.image)}
                    alt={`${example.name}, a look from the ${category.name} collection`}
                    width="400"
                    height="400"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <strong>{category.name}</strong>
                <span>{category.use}</span>
              </>
            );
            return (
              <li key={category.id}>
                {path ? <a href={path}>{body}</a> : <div>{body}</div>}
              </li>
            );
          })}
        </ul>
      );
    case "showcase":
      return (
        <ul className="pw-examples">
          {block.ids
            .flatMap(
              (id) => showcaseStyles.find((style) => style.id === id) ?? [],
            )
            .map((style) => (
              <li key={style.id}>
                <figure>
                  <img
                    src={`/homepage/showcase/${style.id}-640.webp`}
                    alt={style.alt}
                    width="640"
                    height="640"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>{style.name}</figcaption>
                </figure>
              </li>
            ))}
        </ul>
      );
    case "cards":
      return <Cards paths={block.paths} />;
  }
}

/** The closing invitation shared by the search pages and /about. */
export function StartCard() {
  return (
    <section className="pw-page-start" aria-labelledby="page-start-title">
      <h2 id="page-start-title">Start with one dish.</h2>
      <p>
        Add a phone photo, choose a look and see the difference. Your first{" "}
        {FREE_SIGNUP_IMAGES} images are free, with no credit card.
      </p>
      <Button size="marketing" asChild>
        <a href="/#studio">
          Try it free
          <ArrowRight size={17} />
        </a>
      </Button>
    </section>
  );
}

/** A page's questions, open to read and listed in its structured data. */
export function Questions({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  return (
    <section className="pw-faq" aria-labelledby="faq-title">
      <h2 id="faq-title">Questions</h2>
      {faqs.map((faq) => (
        <details key={faq.question}>
          <summary>{faq.question}</summary>
          <p>
            <InlineText text={faq.answer} />
          </p>
        </details>
      ))}
    </section>
  );
}

export function ReadNext({ paths }: { paths: string[] }) {
  return (
    <section aria-labelledby="read-next-title">
      <h2 id="read-next-title">Keep reading</h2>
      <Cards paths={paths} />
    </section>
  );
}

export default async function ContentPageView({ path }: { path: string }) {
  const page = contentPage(path);
  if (!page) return null;
  const breadcrumbs = breadcrumbsFor(page);
  const data = pageStructuredData(await siteOrigin(), {
    path: page.path,
    title: page.title,
    description: page.description,
    breadcrumbs: [...breadcrumbs, { href: page.path, label: page.label }],
    updated: page.updated,
    article: page.kind === "guide",
    faqs: page.faqs,
  });
  return (
    <PublicInformation
      title={page.heading}
      intro={<InlineText text={page.intro} />}
      breadcrumbs={breadcrumbs}
      note={
        page.checked
          ? `Last checked against the sources below on ${longDate(page.checked)}.`
          : undefined
      }
    >
      {page.sections.map((section) => (
        <section key={section.id}>
          <h2 id={section.id} tabIndex={-1}>
            {section.title}
          </h2>
          {section.blocks.map((block, index) => (
            <BlockView block={block} key={index} />
          ))}
        </section>
      ))}
      {page.faqs.length > 0 && <Questions faqs={page.faqs} />}
      {page.sources && (
        <section aria-labelledby="sources-title">
          <h2 id="sources-title">Sources</h2>
          <ul className="pw-list">
            {page.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="pw-page-fineprint">
            Platforms change their rules without notice. Confirm the details at
            the source before a large upload.
          </p>
        </section>
      )}
      <ReadNext paths={page.related} />
      <StartCard />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
      />
    </PublicInformation>
  );
}

# Search and discoverability

How the public site is set up to be found, in search engines and in AI assistants, and what to do outside the code. Added November 10, 2026.

## The idea

A new site ranks for specific questions long before it ranks for broad ones. So every public page answers one thing a restaurant owner actually searches for, in its title and in its first sentence, and the pages link to each other. Three kinds of search matter here:

- **Ready to buy**: "AI food photography for restaurants", "free QR code menu". The product pages answer these.
- **For someone like me**: "food photos for bakeries", "cocktail photos for bars". The audience pages answer these, each with the eight looks made for that kind of kitchen.
- **A question on the way**: "DoorDash photo requirements", "Instagram post size". The guides answer these with the numbers up front, a source, and the day they were checked; each ends by showing how Menu Material handles it.

AI assistants (ChatGPT, Claude, Perplexity, Google's AI answers) read the same pages. They quote pages that say plainly what a thing is, answer a question in the first sentence, and give numbers with sources. `/about`, the question lists and `/llms.txt` are written for that.

## The pages

| Page | Search it answers |
|---|---|
| `/` | Menu Material; AI food photography for restaurants |
| `/ai-food-photography` | AI food photography; AI food photo generator for restaurants |
| `/delivery-app-photos` | DoorDash menu photos; Uber Eats menu photos |
| `/restaurant-social-media-posts` | Instagram posts for restaurants |
| `/qr-code-menu` | Free QR code menu for restaurants |
| `/for/bakeries` | Food photos for bakeries |
| `/for/coffee-shops` | Drink photos for coffee shops and juice bars |
| `/for/bars` | Cocktail photos for bars |
| `/for/fine-dining` | Food photography for fine dining |
| `/for/takeout-and-delivery` | Food photos for delivery and ghost kitchens |
| `/guides` | Menu photo sizes (all platforms in one table) |
| `/guides/doordash-photo-requirements` | DoorDash photo requirements, DoorDash photo size |
| `/guides/uber-eats-photo-requirements` | Uber Eats photo requirements, Uber Eats photo size |
| `/guides/toast-menu-photo-requirements` | Toast menu photo size |
| `/guides/google-business-profile-photo-requirements` | Google Business Profile photo size |
| `/guides/instagram-food-photo-sizes` | Instagram post size for food photos |
| `/guides/phone-food-photography` | How to photograph food with your phone |
| `/pricing` | Menu Material pricing |
| `/about` | What is Menu Material |

## Where things live

- `lib/site-pages.ts`: every search page's copy. Numbers come from `lib/plans.ts`, `lib/studio.ts` (export sizes) and `lib/channel-rules.ts` (platform rules), so a page can't disagree with the product. Links are written `[label](/path)`.
- `app/components/content-page.tsx`: draws a page: breadcrumbs, sections, questions, sources, "Keep reading", the closing card and the structured data.
- `app/for/[audience]/page.tsx`, `app/guides/[guide]/page.tsx` and one small file per product page: the routes.
- `app/about/page.tsx`: what Menu Material is, who it's for, what it promises and costs. It shows who runs the site once `SITE_OPERATOR` is set.
- `app/site-metadata.ts`: titles, descriptions, canonical addresses, link previews and schema.org data (`homeStructuredData`, `pageStructuredData`), plus `siteVerification` for the webmaster tools.
- `lib/site-links.ts`: the footer's groups of links, on every page. `lib/home-faqs.ts`: the homepage's questions.
- `app/llms.txt/route.ts` and `lib/llms-text.ts`: the map of the site for AI assistants.
- `app/sitemap.ts`, `app/robots.ts`: every page above is in the sitemap with the day it last changed. All crawlers, including AI crawlers, may read the public site.
- `tests/site-pages.mjs` and `tests/site-metadata.mjs`: titles under 60 characters, descriptions of 110 to 160, every link and photo real, platform numbers equal to the product's, the footer and `/llms.txt` complete.

## Adding a page

1. Check that no existing page already answers the search. One page per question; a second page on the same question competes with the first.
2. Add an entry to `lib/site-pages.ts`. Put the answer in the first sentence of `intro`. Use the product's constants for any number. Give it at least two questions people really ask, and three or four `related` pages.
3. A guide needs a `sources` list and, once you have re-read the source, a `checked` day. An audience page needs its collection in `audienceCollections` and a line in the footer (`lib/site-links.ts`).
4. A new top-level address also needs a small `page.tsx` like `app/qr-code-menu/page.tsx`.
5. Run `npm test`. The sitemap, `/llms.txt` and "Keep reading" cards pick the page up by themselves.

## Keeping guides true

Platforms change their rules without notice, and a guide with a wrong number is worse than no guide. When you re-read a source: update `lib/channel-rules.ts` if the rule changed (the product's own checks read it), then set that guide's `checked` day. The page shows it as "Last checked". The year in a guide's title follows the day it was checked.

Checked on November 10, 2026: DoorDash, Toast, Google Business Profile and Instagram. Uber's help page could not be opened that day, so its guide keeps the September 24, 2026 check from `lib/channel-rules.ts`; an integrator's published table agreed with its numbers.

## Outside the code

These are the owner's to do; none can be done from the repository. Pages go live with the next deploy of the site, and nothing below works until they are.

1. **Google Search Console**: add the site, set `GOOGLE_SITE_VERIFICATION` (or verify by DNS), submit `/sitemap.xml`, and use URL Inspection → Request indexing on the homepage and the six guides.
2. **Bing Webmaster Tools**: the same, with `BING_SITE_VERIFICATION`. Bing's index also feeds ChatGPT search and Copilot.
3. **The live robots.txt**: open `/robots.txt` on the public address and compare it with `app/robots.ts`. Some hosts and CDNs add their own rules that block AI crawlers (Cloudflare's "Block AI bots", for one); if GPTBot, ClaudeBot or PerplexityBot are disallowed there, AI assistants can't read the site. If the domain is on Cloudflare, also turn on Crawler Hints (Caching → Configuration) so Bing hears about new pages at once.
4. **Places that list tools**: a first handful of links matters more than any change on the page. Product Hunt, AI tool directories, restaurant-owner communities and local restaurant associations are the natural ones. Link to the page that fits (a guide, not always the homepage).
5. **Every four weeks**: in Search Console → Performance, sort queries by impressions. A query with impressions and no page of its own is the next page to write.

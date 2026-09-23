# Menu Material public-launch audit

Audit date: September 16, 2026. Site: [Menu Material](https://menu-material-studio.cflash7.chatgpt.site/). Reviewed source: `ded6bc24c8172b46f4fcc25e050d59da0ae8d09a`, matching the latest hosted version, 33.

**Recommendation: retain the design and product foundation, fix launch-critical conversion and reliability gaps, then prove repeat restaurant use before expanding distribution.** Menu Material is a substantial pilot with a coherent photo/menu/social workflow. It is not yet ready for an unrestricted, self-service public launch. A public early-access page with a functioning application flow is a reasonable intermediate release.

The highest-value product direction is **one real dish, one consistent restaurant look, a complete promotion, and measurable customer interest**. The product already contains much of that workflow; its next advantage should be dependable completion and recurring usefulness.

## Scope and confidence

This audit combined source review, the deployed homepage and signup flow, desktop and 390-pixel phone-width inspection, an isolated local workspace, API/export tests, build/type checks, live HTTP checks, and current primary-source references. No production restaurant records were changed, no real image requests were submitted, and no code fixes were deployed. Local browser inspection covered new-owner style selection, upload controls, menu starting options and the empty Post Maker experience; it was not a full end-to-end live-generation test.

Evidence labels used below:

- **Confirmed:** observed in the live site, directly established in source, or reproduced with isolated deterministic fixtures.
- **Validation gate:** must be demonstrated before launch; current evidence does not establish success or failure in production.
- **Opportunity:** a reasoned product hypothesis to test with restaurant owners.

The hosted site is already publicly accessible at the hosting boundary, while restaurant account creation remains invitation-only. No custom domain is attached. The anonymous state endpoint reports `aiConnected: true`; this establishes configured credentials, not provider health. Current documentation records one successful live burger edit in 31 seconds, but also states that the latest generation-prompt changes have not been live-validated. Older setup instructions are stale in places and should not be treated as proof that the service lacks a key.

## What is already strong

- Recognizable food-led branding, clear headline, original/result comparison, interactive promotion demos and consistent visual treatment.
- Three connected tools—Photo Studio, Menu Builder and Post Maker—with a shared dish library and saved restaurant branding.
- 56 photo styles, before/after comparison, original retention, approval/rejection, image versions, targeted revisions and local touch-ups.
- Menu import, multiple print layouts, published menu snapshots, stable links, QR downloads, branded table cards, republish/unpublish and guest-access checks.
- Social templates, feed/Story/carousel output, caption editing and mobile-sharing/download fallbacks.
- Existing batch tools, staff upload links, weekly promotion suggestions and engagement events. These should be improved and surfaced, not rebuilt as supposedly missing features.
- Tenant isolation, private uploads, hashed sessions/invitations, password-reset session revocation, cross-origin write checks, atomic image allowances and idempotent generation requests.
- Meaningful integration and export coverage. The basic engineering foundation is stronger than a visual prototype.

## Ranked roadmap

Ranking weighs launch risk, customer impact, differentiation, effort and dependencies. It is not a forecast of revenue lift. Effort is relative: **S** = a focused change, **M** = a coordinated feature or workflow, **L** = substantial engineering or customer validation. These are not delivery commitments. “Before broad launch” items can proceed in parallel.

| Rank | Recommended work | Why it comes next | Impact | Effort | Timing |
|---|---|---|---|---|---|
| 1 | Complete the public acquisition and account-recovery flow | Every “Get started free” CTA requires an invitation; no access-request path exists. New visitors cannot complete the promise. | Very high | M | Before broad launch |
| 2 | Make generation fair, recoverable and independent of open browsers | Two slow jobs can hold up later work; reliable unattended dispatch requires an independently running worker. | Very high | M–L | Before broad launch |
| 3 | Enforce pause, spend limits and abuse controls at execution time | Pausing a restaurant does not stop queued submissions. Public registration would amplify incomplete cost/storage protections. | Very high | M | Before broad launch |
| 4 | Repair saved-work loading and conflict recovery | Routine network failures and two-window edits can trap users without a working recovery path. | Very high | M | Before broad launch |
| 5 | Validate real food fidelity, current prompts and physical-phone completion | A single successful burger example and fixture tests do not establish the core promise across cuisines and devices. | Very high | L | Before broad launch |
| 6 | Establish operational health, alerting, backups and release gates | Current health endpoint is liveness only; worker presence, restores and external monitoring are unverified. | Very high | M | Before broad launch |
| 7 | Reduce homepage and public-menu loading cost | Hero images plus eagerly loaded demo fonts total about 5.92 MB before other assets; guest menus also over-fetch images. | High | M | Before substantial traffic |
| 8 | Explain the offer and add trust/support information | Visitors cannot readily learn allowances, future pricing, image handling, usage rights, support or who stands behind the product. | High | S–M | Before broad launch |
| 9 | Correct analytics and measure acquisition through repeat use | The Downloads dashboard omits exports from the main new workflows. There is no complete public acquisition funnel. | High | M | Before growth experiments |
| 10 | Complete mobile and accessibility fixes | Mobile homepage hides Log in; dark-menu prices have insufficient contrast; complete keyboard/device checks remain necessary. | High | S–M | Before broad launch |
| 11 | Establish the launch domain and technical SEO | No custom domain, canonical URLs or sitemap; nonexistent menus return HTTP 200. | High | S–M | Before search promotion |
| 12 | Make saved work manageable at real restaurant scale | Latest-100 retrieval across all tools can hide older menus/posts; drafts lack naming, search and archive controls. | High | M | Early launch |
| 13 | Shorten the path to a first useful result | New owners must choose among 56 styles before uploading. Test a smaller guided starting path and a stronger empty state. | High | M | Early launch |
| 14 | Surface one coordinated promotion workflow | Packages, posts and menu tools are split between primary navigation and More tools. Make reuse of one approved dish obvious. | High | M | Early launch |
| 15 | Improve guest menus and daily availability management | Search, category jumps, visible hours and fast sold-out updates would make the menu useful every day. | High | M | Early launch |
| 16 | Build a weekly repeat-use loop | Extend existing weekly suggestions with a plan, saved campaigns, duplication, seasonal prompts and optional reminders. | High | M | After first-success fixes |
| 17 | Add campaign-level attribution and owner-controlled referrals | Show which QR/link or promotion drove menu visits and ordering clicks; use helpful public menus as a discovery channel. | High | M | After analytics repair |
| 18 | Publish focused search/education pages with genuine proof | Current marketing is one page with anchor links. Useful examples and intent-specific pages can attract qualified owners. | Medium–high | M | Alongside pilot learning |
| 19 | Validate packaging and introduce sustainable paid plans | Allowance exhaustion currently leads to manual coordinator contact. Pricing should follow measured cost and repeat value. | High | L | Before scaling a paid offer |
| 20 | Strengthen verified, faithful-food editing as a differentiator | Owner approval exists; add explicit preservation controls and failure feedback informed by the real-dish benchmark. | High | M–L | After fidelity baseline |
| 21 | Add reviewed menu translation and structured dietary information | A credible expansion for tourist areas and diverse guests, provided facts are owner-entered and reviewed. | Medium–high | M–L | Demand-led expansion |
| 22 | Add social scheduling/publishing when distribution friction is proven | File sharing already exists. Direct publishing adds platform permissions, review, token and failure-management work. | Medium–high | L | After retention evidence |
| 23 | Add teams and multiple locations | Move beyond upload-only staff links to roles, approvals and reusable brand/menu settings where customers need them. | Medium–high | L | Expansion tier |
| 24 | Add selected POS/menu-source integrations | Valuable for removing duplicate updates, but only after a stable dish model and customer demand identify the right systems. | Medium | L | Later |

## Confirmed defects and concrete fixes

**Acquisition dead end and hidden mobile login.** The root CTA explicitly opens signup; the form requires an invitation code, and the server limits invitations to ten workspaces including pending invites. This was intentional for the pilot, but conflicts with a public self-service launch. Keep the cap until onboarding and cost controls are ready. Immediately provide “Request early access” with a working capture/confirmation flow, or implement verified trial signup. Add direct mobile Log in, self-service email recovery and a visible support destination. Mobile users can currently find Sign in only after opening the signup modal.

Evidence: `app/page.tsx:124`, `app/components/auth.tsx:123`, `app/components/auth.tsx:172`, `lib/server/api.ts:186`, `app/menu-material.css:637`. Live desktop/signup and phone-width behavior inspected.

**Generation queue fairness.** The global worker selects the two oldest unfinished outputs on every tick. Still-processing responses reset their lease to zero, so the same two can repeatedly occupy the available slots. An isolated three-job reproduction left the third queued after five ticks while the first two received repeated status retrievals. Submitted jobs also lack an overall completion deadline. Separate dispatch from polling, add next-poll times/backoff and fair per-restaurant concurrency, and provide bounded stuck-job recovery. Continue protecting against duplicate provider submissions.

Evidence: `lib/server/generation.ts:450`, `lib/server/generation.ts:456`. Reproduced with no real provider calls. This identifies code behavior, not a measured production incident.

**Pause does not stop pending spend.** Pause is checked when reserving a request, not immediately before dispatch. An isolated test paused the restaurant with a queued image; the next tick still submitted it. Recheck pause atomically at dispatch, distinguish cancelling undispatched work from retrieving paid work already in progress, and implement account/global daily budgets. Cover analysis, captions and menu extraction as well as images.

Evidence: `lib/server/generation.ts:98`, `lib/server/generation.ts:497`, `app/page.tsx:451`.

**Draft loading and conflict recovery.** A failed first draft request only changes a message; `ready` remains false, leaving a status-only screen. Revision conflicts instruct the owner to reopen the draft, but opening the saved-work picker and resuming both first retry the same conflicting save. Add explicit Retry, Keep my changes as a copy, and Load latest actions. Preserve unsaved local work through conflict resolution. Autosave errors should be announced accessibly.

Evidence: `app/components/creation-shared.tsx:76`, `:107`, `:172`, `:217`, `:366`; `lib/server/creation.ts:74`. Source-confirmed failure paths; no production edits attempted.

**Photo-analysis failures are permanently cached.** After a fixture 429, a second attempt returned 409 without retrying the provider. Non-completed cached states are rejected indefinitely. Expire processing leases and allow transient errors to retry with backoff, while retaining successful cached analysis. The user must remain able to proceed manually.

Evidence: `lib/server/photo-analysis.ts:44`, `:138`. Reproduced with fixtures.

**Download reporting misses the main tools.** New photo, menu and post exports emit `export_complete`; the visible Downloads metric counts only `promotion_exported` and `image_downloaded`. Unify event names and definitions, deduplicate outcomes and cover carousel/caption paths. A download or native share is not confirmed social publication.

Evidence: `app/components/photo-studio.tsx:458`, `app/components/menu-builder.tsx:1221`, `app/components/post-sharing.tsx:138`, `lib/server/creation.ts:342`, `app/components/menu-tools.tsx:809`.

**Saved work becomes inaccessible through the picker.** The API returns only the most recent 100 drafts across studio, menu and post. Enough new photo drafts can push an old menu out of the list even though it remains stored. Add kind-specific pagination and lookup by ID. Add readable titles, modified dates, search, favorites, duplicate, archive/restore and safe deletion. Prompt for a useful dish name at an appropriate point instead of accumulating “Untitled dish” records.

Evidence: `lib/server/creation.ts:36`, `app/components/creation-shared.tsx:256`, `app/components/photo-studio.tsx:314`.

**Dark menu prices fail contrast.** The price foreground remains `#5e5e52` on the dark background `#172e24`, approximately 2.20:1. Use an accessible dark-theme text token, such as the existing light menu text color. Add a main landmark to the successful guest menu. Validate keyboard operation, screen-reader feedback, focus, enlarged text and touch targets across all core workflows. Existing crop sliders, reduced-motion support and gallery pause controls are strengths to retain.

Evidence: `app/components/menu-view.tsx:197`, `app/workspace.css:438`, `app/creation.css:2099`. Contrast is calculated from the source colors; a complete assistive-technology audit was not performed. [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Missing menus report success.** A live request to a deliberately nonexistent menu returned HTTP 200 with unavailable-menu content. Return an appropriate 404/410 for missing/unpublished content and distinguish transient service failures. The live robots and sitemap endpoints both returned 404. Missing robots alone does not prevent indexing; the recommendation is to establish an intentional crawl policy and discoverable URL inventory. [Google on soft 404s](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors).

Evidence: `app/m/[slug]/page.tsx:42`; live HTTP checks on September 16.

## Reliability, security and operating readiness

Reliable background execution is a validation gate. The code and current guide require an external persistent worker/scheduler; browser assistance stops when the page is hidden. The audit did not establish whether a healthy hosted scheduler is currently running. Demonstrate that a request submitted just before closing all browsers is dispatched, completed, archived and available on another device. Alert on the oldest queued job and stale worker heartbeat.

The health endpoint currently returns success without checking database, storage or worker health. Separate a cheap liveness endpoint from dependency readiness and track the last successful provider interaction. Add sanitized error reporting, provider request IDs, queue failure/spend alerts, release smoke tests, rollback instructions and a tested database-plus-object-storage restore. External backup, WAF and monitoring settings were not inspected; absence in the repository does not prove absence at the hosting platform.

Login limiting is keyed only by the supplied email, before synchronous password hashing. Add trusted caller/global controls before expensive work and avoid creating an easy account-lockout mechanism. Standard upload limiting occurs after multipart buffering, while import and photo-edit routes lack equivalent total-storage safeguards. Add early request-size limits, decoding limits, rate controls, per-workspace storage quotas and expired-record cleanup. These are code-level readiness findings; no live attack or penetration test was attempted.

Keep bootstrap configuration temporary and verify the hosting contract for trusted identity headers. This is a configuration verification item, not an established authentication bypass.

Relevant evidence: `scripts/job-runner.mjs:1`, `app/page.tsx:85`, `lib/server/api.ts:437`, `:533`, `:579`, `:314`, `:369`, `lib/server/menu-tools.ts:264`, `lib/server/creation.ts:272`, `docs/CORE_EXPERIENCE.md:67`.

## Performance and design improvements

The visual system is coherent enough to keep. Invest in quicker first success, legibility and trustworthy examples before a major redesign.

The two hero files total **3,251,099 bytes**. Below-fold interactive examples immediately mount the production post renderer, which loads five font files totaling **2,664,928 bytes**. Together these are **5,916,027 bytes**, about 5.92 MB, before gallery images or scripts. These are raw asset measurements and source-established loading behavior, not a mobile network transfer or Core Web Vitals measurement.

Use responsive WebP/AVIF sources for the hero, postpone interactive demo initialization until near the viewport, and load only fonts needed by the chosen designs. Keep image dimensions reserved to prevent layout shifts. Isolate marketing code from authenticated editors and admin modules. Current production page code is approximately 363 KB raw/107 KB gzip and shared CSS 328 KB raw/56 KB gzip; image/font optimization is the larger immediate opportunity.

Guest menus emit full dish images without responsive sources or lazy loading. Some layouts hide images only with CSS, which does not avoid downloads. Render only photos actually used by the selected layout and serve sized published derivatives. Public asset requests also rebuild menu authorization/promotion state and use `no-store`. Profile and batch the repeated database work; any caching must preserve unpublish/deletion access revocation. Avoid trading privacy correctness for speed.

Measure mobile field performance when sufficient traffic exists: target LCP at or below 2.5 seconds, INP at or below 200 ms and CLS at or below 0.1 at the 75th percentile. Use lab measurements before traffic exists without presenting them as field results. [Core Web Vitals guidance](https://web.dev/articles/vitals).

Design changes worth testing:

- Show three suggested starting looks, the saved restaurant look and a clear upload path, with the full gallery still available. The 56-style library is an asset; initial choice overload is a hypothesis, not a proven conversion loss.
- Provide favorites/recent looks and stable ordering so returning owners can find a look again.
- Make empty Post Maker and My Dishes screens explain the next useful outcome and offer a clearly labeled sample walkthrough.
- Keep a visible original/result review and precise recovery actions. Replace fixed “20–30 second” expectations with measured ranges and a truthful long-job state.
- Show draft versus published state, outstanding changes, and what republishing will affect.
- Add a fast explicit “sold out until tomorrow” action that does not publish unrelated unfinished edits.
- Keep menu prices, photo approvals, captions and posting instructions easy to read on a busy owner’s phone.

## Positioning, trust and commercial clarity

The broad photo-editor category is competitive. Photoroom already markets food photography, batch processing, brand consistency and channel output; Canva supplies restaurant menus and social design tools. These are vendor capability claims, not independent proof of quality. Menu Material’s opportunity is the restaurant-specific workflow connecting a real dish, verified facts, a coherent promotion and a live menu. [Photoroom food tools](https://www.photoroom.com/ai-product-photography/food), [Canva restaurant designs](https://www.canva.com/collection/restaurant/).

Keep the homepage’s food-first presentation, then make its promise concrete with genuine current-product examples from several food types. Publish owner permission, what was changed, typical completion time, and measured results where available. Clearly identify illustrative AI examples. Do not present competitor uplift statistics or a single successful generation as Menu Material results.

Add compact public pages or an accessible information area for the free allowance, what consumes credits, failure handling, future pricing, account recovery, support, uploaded-photo handling, retention/deletion and commercial-use terms. Obtain appropriate review of the final policies; this audit is not a legal compliance assessment. There is no need to clutter the hero with every detail.

Retain the existing platform-specific delivery export checks and honest acceptance caveat. DoorDash already offers editing tools and has its own photo requirements, so “ready for DoorDash” should describe useful preparation, not guaranteed approval or an automatic integration. [DoorDash upload/editor guidance](https://help.doordash.com/merchants/s/article/DoorDash-Photos-Types).

Validate willingness to pay against measured provider cost per approved/exported image, support time, storage and repeat use. Possible packaging to test: a capped trial, a restaurant plan with monthly credits, optional credit top-ups, and later a team/location tier. Prices require customer and margin evidence; there is no defensible specific price from this audit alone. Build transparent usage and upgrade states before increasing the acquisition cap.

## SEO and distribution

1. Choose a durable Menu Material domain and redirect/canonicalize the current host appropriately. The current `menu-material-studio` host differs from the visible brand.
2. Add canonical URLs, a sitemap for intended public pages, a deliberate robots policy, Search Console and accurate metadata. Keep private workspace, invitation and staff-upload content out of indexing; retain staff noindex behavior.
3. Separate marketing routes from the app as the site expands. Create useful pages for restaurant photo enhancement, delivery listing images, QR/digital menus and social promotion, plus pricing/help. Each should include authentic examples, the real workflow and a working CTA.
4. Avoid mass-producing thin cuisine/city/keyword pages. Publish a small number of specific guides answering actual owner questions, using the product and real pilot outcomes as evidence.
5. Give published menus restaurant-specific sharing previews. Add address, phone, opening hours and accurate local-business structured data only when owner-supplied information supports them; no promised rich-result placement. [Google local-business guidance](https://developers.google.com/search/docs/appearance/structured-data/local-business).
6. Make “Made with Menu Material” an optional, useful referral link and attribute new-owner signups. Do not force intrusive acquisition prompts on restaurant guests.
7. Start distribution with a focused owner cohort and partners such as local restaurant groups or agencies. Test one channel at a time after the funnel works, and compare activated/retained restaurants rather than raw traffic.

## Highest-value feature expansion

**A complete promotion from one approved dish.** Unify existing post, Story, caption, print sign and menu-special outputs into a visible reviewed package. Let an owner update the offer once and regenerate text/layout outputs without paying to recreate the photo. Much of this already exists in promotion tools; the opportunity is consolidation and discovery.

**A useful weekly plan.** Build on existing suggestions with a simple calendar, reusable campaigns, restaurant hours, upcoming occasions and optional reminders. Ask owners to approve facts and publish; avoid automatic invented discounts or availability.

**Menus that help guests decide.** Add sticky section navigation, dish search, photo enlargement, hours/contact/directions, and immediate availability updates. Add owner-confirmed dietary/allergen fields and reviewed translations in a later step. Never infer safety-related food claims from a photo.

**Campaign attribution.** Use per-campaign QR/link identifiers and consent-appropriate attribution to show menu visits and ordering-link clicks. Actual sales attribution requires order data. Establish this distinction in both product copy and reports.

**More faithful photo workflows.** Extend existing approval controls with clear preserve-food/plate/packaging choices, a conservative enhancement option, captured rejection reasons and benchmark-guided warnings. Evaluate on difficult foods and drinks; do not claim automatic verification that ingredients or portions are correct.

**Distribution and collaboration later.** Social scheduling, team approvals, multiple locations and selected POS integrations are credible expansion paths. Prioritize them using observed workflow friction and demand. Avoid a native app, video generation or broad connector catalog before the mobile web experience and retention are proven.

## Launch acceptance and measurement

Before broad acquisition, demonstrate:

- A new owner can sign up or request access, receive a clear response, recover access and reach support without an undocumented coordinator step.
- The current prompt/model combination is benchmarked on at least 20 real, owner-verified dishes spanning difficult textures, drinks, packaging and portion counts. Separate photo-based enhancement from description-only illustration. Test the current one-result flow; older two-result pilot instructions need updating.
- Submitted work completes with every browser closed; slow jobs do not starve another restaurant; pausing blocks new dispatch; failed outputs and uncertain costs are handled correctly.
- Interrupted draft loading, multi-tab conflicts and lost save responses recover without lost work.
- Current iPhone/Safari and Android/Chrome can upload JPEG/PNG/HEIC, review, export, share, publish a menu, scan a QR code and resume after interruption. Desktop phone-width inspection is not a substitute for these device tests.
- Monitoring catches a stopped worker and provider failure; a representative database/object-store restore succeeds; rollback and support ownership are documented.
- Core outcome events are reconciled with actual successful actions; missing/unpublished menus have correct status codes; mobile/accessibility issues are resolved.

Use the existing pilot targets as **proposed acceptance thresholds**, not measured achievements: 80% of participants approve and download a first image within 10 minutes; 70% of dishes yield an acceptable result within two requests; 60% of participating restaurants publish a menu within seven days. Review whether the menu target fits customers whose main need is social or delivery imagery.

The most useful operating dashboard would show:

| Measure | Decision it supports |
|---|---|
| Visitor → access request/signup → first upload | Whether acquisition and onboarding work |
| Time to first approved export, plus failure/rejection reasons | Whether owners reach the promised value |
| Approved/exported outputs per provider dollar, including retries | Whether quality and margins support growth |
| Restaurants exporting or updating a live menu in weeks 2 and 4 | Whether the product becomes a habit |
| Use of the same dish across two or more destinations | Whether the integrated value proposition is working |
| Menu visits and ordering clicks by campaign | Whether promotion creates measurable interest |
| Support minutes, queue age and failed jobs | Whether operations scale |

## Verification results and limits

- Production build: passed, with a large-chunk warning.
- Type checking: passed.
- Main tests: 240 API checks across three suites, 18 post-flow assertions and creative-catalog assertions passed.
- Export suite: 124 checks passed.
- Source-focused lint (`app`, `lib`, `db`): 61 errors and 103 warnings. Full-repository lint: 67 errors and 1,678 warnings, substantially inflated by the bundled PDF worker. Establish a usable baseline, fix meaningful hook/ref/purity/error-handling issues and exclude generated/vendor noise appropriately. These counts are not counts of proven customer-facing defects.
- Tests require Node 24 or later; the default shell’s Node 20 failed the loader. Tests/build were rerun with the bundled supported runtime.
- Live homepage: HTTP 200; page metadata and server-rendered marketing content present.
- Live missing-menu route: HTTP 200, confirmed soft-404 issue.
- Live robots and sitemap: HTTP 404.
- No horizontal overflow in the sampled 390-pixel homepage and empty Post Maker states. This does not certify every editor/result state.
- Actual field Core Web Vitals, comprehensive screen-reader behavior, physical-phone sharing, current-prompt food quality, production load, hosted scheduler health, backup restoration and actual provider invoices were not measured.

**Recommended execution order:** deliver a focused launch-readiness release covering ranks 1–11; validate it with real restaurant owners; then prioritize ranks 12–17 using activation and repeat-use evidence. Run useful SEO content work alongside that learning. Fund larger paid, distribution and multi-location features from demonstrated demand.

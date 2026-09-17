# Photo Studio: style expectations and recent use

Date: September 17, 2026. Local implementation candidate; no production deployment or additional live-image generation.

## Findings

The catalog's photographs sometimes show overhead angles, new plates or other presentation details that are not automatically applied to an owner's photo. Selection deliberately preserves the owner's camera angle, serving dish and explicit component overrides. The detail view previously showed example traits without spelling out that effective configuration.

A separate code review found that selecting a style called the client-side recent-use mutation. This contradicted PS-11.3: the list was recording selection, rather than accepted creation. Earlier implementation notes overstated this behavior. This review corrects the implementation and adds dedicated evidence.

## Delivered behavior

Style details now contain an explicit **Style example** caption and a compact **With your photo** section. It shows Setting, Light, Serving dish / Glass and Camera angle using the same selection rules as the working draft. Deliberate overrides are marked **Your choice**. Custom framing is listed when present. Changed camera angles and retained drink-vessel conflicts receive plain-language explanations. Description-only work uses **For your illustration** and does not claim to preserve an uploaded photo.

For examples photographed from a different angle, the footer explicitly explains that the owner's angle is kept and can be changed in Customize. The primary action remains Use this look. The detail's redundant second title was removed, and its scroll position now resets when opened; the prior reused scroll container could partially hide Back to looks.

The detail also offers a separate favorite toggle. It neither selects the style nor starts creation. Errors appear within the detail with a Reload saved looks action. Returning to the catalog restores the search and the exact originating card's focus.

Recent use is now server-owned:

- A new accepted creation records its preset, restaurant, job, request identifier and acceptance time in the same database transaction as its job and allowance reservation.
- A newly requested cached result records a use without creating another job or reserving another image. Its request identifier is bound to the reused job.
- Replaying the same accepted request returns its original result and retains its original use time. Concurrent retries produce one use receipt.
- A request-identifier collision between different cached/new requests produces one winner. The losing request cannot reserve an image or point that identifier at another job.
- Rejected requests record no use. A use-receipt storage failure rolls back the new job and reservation together.
- The library shows the twelve newest distinct known styles. Favorites and named looks remain editable; recent use is derived from accepted records and cannot be overwritten by client library content.
- Old selection-based recent values, including retired IDs, are ignored. They cannot block loading the current library or be restored by an older client's library update.

“Recent” describes a style used in an accepted creation request, including accepted jobs that later fail. It is not a list of independently approved or successful photographs. Named recipes remain in the separate Restaurant looks group; recency here concerns catalog/legacy preset identity.

## Local browser evidence

The browser used the existing isolated QA restaurant, with the image provider disabled and zero creation jobs.

1. Opened Top-down clarity. The detail showed Follow this look for setting/light, Keep your serving dish and Keep your original angle. Its inner scroll position was zero and Back to looks was visible.
2. Added the style to favorites from the detail. The toggle changed to Saved to favorites with a pressed state. Removed it again. Closing returned focus to Browse all looks and left the QA evening menu selection unchanged.
3. Set Warm wood in Customize, then inspected Top-down clarity. The detail showed Warm wood as Your choice. Applying the look retained the same Warm wood setting in the main summary, while preserving serving dish and angle.
4. Opened Saved after applying that look. Favorites were empty after the toggle cleanup, the existing named looks remained, and no recent-use section appeared. Read-only QA database verification confirmed zero jobs and zero use receipts: selection had not fabricated usage.
5. Returned the draft to its existing QA evening menu default. Searched for Top-down clarity, opened the detail and used browser Back. The exact search remained and keyboard focus returned to Explore Top-down clarity.
6. Checked 320 × 568, 390 × 844, 768 × 1024 and 1440 × 900. No horizontal overflow was observed. Use this look remained inside each viewport. At 320 × 568 it measured 44 px tall, at y=508–552. The content scrolls to expose the complete settings and favorite action.

Temporary favorites and custom-setting changes were returned to the starting QA state. These checks are browser viewport evidence, not real-phone or screen-reader acceptance.

## Automated evidence

`tests/studio-experience.mjs` now verifies effective serving-dish and camera-angle expectations for all 56 catalog styles. Additional cases cover explicit overrides, an implicit value that must not be retained, non-mutating exploration, drink-vessel conflicts, changed angle/framing and description-only copy.

`tests/studio-recents.mjs` is included in the default Studio regression command. Its final run passed **51 API checks**, covering server-owned recency, queued acceptance, rejected allowance, job replay, cached reuse, concurrent retry, competing cached/new request identifiers, rollback on receipt failure, the twelve-style bound, repeatable historical backfill, legacy stored/client recent values and restaurant isolation. The storage-failure test deliberately emits the server's request-error log and asserts the resulting rollback. All provider requests are prohibited by the suite; the one completed output used to exercise reuse is explicitly a local fixture.

The full existing regression command passed during this change. The final Studio suites and type/build checks are recorded in the implementation status. Export/render formulas, AI prompts and configured models were not changed by this review.

## Migration and operational boundary

Migration **0013** adds `studio_look_uses`, with a composite restaurant/request key and an index scoped by restaurant and use time. It backfills accepted jobs from captured preset metadata and historical cached uses from recorded reuse events. Its backfill statements use INSERT OR IGNORE and were tested twice. It does not infer past creation from old selection lists, rewrite images or alter the credit ledger.

The migration was applied only to the isolated local QA database and recorded in its local migration journal. The QA query plan uses the restaurant-scoped index; grouping/sorting still uses temporary structures. Production-scale latency is not established by this check.

Production must apply the migration before running this application version. The table is additive, so reverting the app can retain its data. A subsequent upgrade after an older-app interval must run the idempotent backfill for jobs/reuse events accepted during that interval. The hosted migration/rollback drill remains a release gate; no production execution is claimed here.

Historical use with no captured preset identity cannot be reconstructed reliably and is omitted from the list. A historical cached use that was never recorded cannot be invented. Future accepted requests have durable use receipts independent of optional analytics delivery.

## Remaining acceptance

This supplies local evidence for PS-07 change transparency, PS-10.1–4/6, PS-11.1/3/4 and associated PS-26 navigation behavior. It does not accept the full requirements. Representative source/output examples, a second subject where useful, per-style live qualification, restaurant-owner comprehension, native accessibility/device behavior, production-scale performance and the operational migration drill remain unqualified. The wider measurement and release gates remain open.

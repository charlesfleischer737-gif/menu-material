# Photo Studio measurement — implemented contract and remaining work

September 17, 2026. This describes the local candidate. It does not certify the full PS-29 reporting requirement or the usability study.

## Events and meaning

`lib/studio-events.ts` is the explicit mapping from historical event names to canonical semantics. Each new event stores its canonical name when applicable, schema version 2, and a server-assigned measurement mode. Reporting must read the canonical mapping once; it must not add both a historical signal and its replacement.

| Stored event | Canonical meaning | Boundary |
| --- | --- | --- |
| `studio_opened` | Studio opened | Deduplicated by browser session and saved draft. Signed-in entry only at present. |
| `studio_source_ready` | Usable source attached to Studio | Server event, once per saved draft and source asset. Generic library uploads are excluded. |
| `style_selected`, `look_selected` | Look selected | Default/restored attachment and explicit selections retain their origin. Saved-look selection is not reuse until a job is accepted. |
| `style_search_used` | Search used | Approved scope, category, mood, coarse intent and result count. Search selection also carries its rank. No query text. |
| `customization_applied` | Configuration changed | Only emits when Done changes a control, note category, or crop. Note contents are excluded. |
| `generation_requested` | Job acknowledged | Server only, with source, policy, style and pipeline. Button presses do not qualify. |
| `generation_reused` | Cached output reused | Separate event; no new generation or allowance reservation. |
| `generation_completed`, `generation_failed` | Output reached a terminal state | Deduplicated by output and terminal state. |
| `generation_recovered` | A previously reported failure later completed | Separate from first-attempt success; deduplicated. |
| `image_approved` | Exact asset version approved | One event per asset. Repeated approval preserves the first approval timestamp. |
| `food_error_reported` | Fidelity reported | Original job and reason category; private report text stays in the operational record. |
| `export_prepared` | A file has been prepared | Distinct asset, destination and exact transform; all export surfaces use a common identity. A master ignores unapplied crop settings. |
| `export_download_started` | Browser download initiated | Distinct attempt. Retrying a download creates a new attempt; replaying the same event does not. Photo sets identify each exact included asset. |
| `native_share_complete`, `native_share_cancelled` | Platform reported share outcome | Does not certify recipient delivery or publication. |
| `look_saved` | Named recipe version saved | Server-assigned version. |
| `look_reused` | New accepted creation uses a named look | Server only; the look belongs to the restaurant. Cached jobs remain separate. |
| `handoff_started` | Approved asset carried into another tool | Separate from publication in that tool. |
| `studio_timing` | Foreground time estimate | Phase and milliseconds, as described below. |

Historical generic-upload `source_ready`, `export_complete`, `upload_complete`, `generation_submission`, and `image_completed` have no canonical funnel mapping. In particular, a legacy download click cannot become a prepared-file or received-file event. Existing legacy Insights are not the completed canonical Photo Studio dashboard.

## Saved-source progress report

Administration now includes a collapsed Photo Studio progress report. It defaults to production activity and explicitly separates internal QA. The default window covers source contexts first attached in the previous 30 days; the protected API accepts 7–90 days. Each source context has seven days of follow-up. Completed windows and still-open windows are reported separately, with no percentage until a completed denominator exists.

- The denominator is a saved Studio draft plus its exact source asset. Repeated saves and reattachment do not create new contexts. A replacement source creates its own context. Unchanged legacy drafts are not assigned a fabricated source-ready date.
- `studio_job_linked` connects the saved source to an accepted job without changing job idempotency or the image-cache fingerprint. A cached result or replay of an older logical job is separate from a new creation. Links must fall inside the context's follow-up window and match its measurement mode.
- Output lineage includes the source itself, linked generated outputs, correction outputs, and successive local-edit versions. Approval belongs to the exact asset. A previously approved asset may already satisfy review on reuse; this does not claim a fresh review action. Free edits can reach a useful outcome without any AI generation.
- `studio_export_linked` associates a prepared file with the context where it is used, while the underlying `export_prepared` identity remains deduplicated across repeated uses. The download/share proxy must match the same asset and exact export key, including crop settings. An unrelated source cannot claim that outcome.
- The photo-use proxy is an approved asset with matching prepared-file and download/share initiation, or an initiated handoff of that approved asset. It is not confirmed receipt, publication, or a restaurant-quality assessment. Multiple versions and repeat attempts still count as one outcome for a source context.
- Untagged historical events, generic library uploads, description-only work and unlinked exports are excluded. Best-effort telemetry can undercount activity; missing events are not reconstructed as success. Guest contexts begin when successfully transferred into an account, not at the earlier guest upload.

This first report covers saved single-photo Studio contexts. It does not yet cover anonymous abandonment, every set/library export path, sample-image segmentation in hosted production, financial denominators, or the full PS-29 dashboard. The stage columns are not a strictly descending funnel: reuse and free edits can skip generation.

## Privacy and eligibility

- Client events accept only known kinds and approved fields. Freeform search text, notes, image URLs, dish names, restaurant names, and client-supplied measurement mode are rejected.
- Supplied asset, dish, job, and draft IDs must belong to the signed-in restaurant. Named-look IDs must be in that restaurant's library.
- Prepared export, download, native share, and handoff events require an exact approved, nondeleted asset without an outstanding food correction. A batch-level click alone is insufficient.
- Clients cannot submit server-authoritative source, job-completion, job-request, saved-look reuse, or file-receipt outcomes.
- The local runtime always labels records `internal`, including fixtures and the isolated browser workspace. Hosted internal QA can use the server-side `STUDIO_INTERNAL_QA=true` setting. Clients cannot override it. Ordinary analytics must exclude internal records; untagged historical events are an unknown cohort, not presumed production success.
- No file receipt is inferred or automatically recorded. That remains an observed study outcome or a future explicit owner confirmation.
- Event delivery is best effort. It does not gate creation, completion, approval, or downloads. Browser activity uses keepalive requests for navigation; this does not guarantee receipt. There is not yet a durable analytics outbox or a completeness guarantee.

## Foreground timing

Signed-in Photo Studio records decision, upload, queue, generation and export phases separately. A phase change closes the old interval. Time stops when the Studio is hidden behind another workspace, account settings, authentication, or plans, and when the document is hidden or loses focus.

Decision time includes up to 30 seconds after the most recent pointer, keyboard, or scroll activity, allowing for reading and thinking. Returning after idle does not backfill the idle interval. Visible waiting is recorded separately. Intervals longer than 60 seconds without observation are dropped, so a suspended computer cannot claim hours of observed activity. Reporting must identify these as estimates with potentially missing intervals.

This is not a stopwatch for human effort and does not replace the moderated-study timing definition. Guest preparation, sign-up intervals, cross-account continuity, source-cohort segmentation, and complete wait reconciliation are still required. Full provider latency must come from job/provider timestamps, including time when every browser is closed, not from the foreground timing estimate.

## Evidence

`tests/studio-measurement.mjs` passes 40 API checks plus deterministic assertions covering event identities, private-field rejection, coarse search intent, selection origins, forged outcomes, cross-owner IDs, duplicate approvals, reviewed-export eligibility, retry deduplication, all crop-identity fields, separate late recovery, internal-only fixture labeling, idle/hidden time, suspension gaps, and an unavailable event store.

`tests/studio-progress.mjs` passes 50 API checks plus assertions for source replacement and reattachment, exact seven-day windows, cached/replayed jobs, successive local-edit lineage, exact export matching, internal/production isolation within the query, unrelated outputs, legacy exclusions, administrator access, and the indexed source-window lookup. Migration 0012 adds two event-query indexes; it changes no event data. Both suites are included in the default regression command. These are fixtures and do not prove provider quality or human task completion.

## Remaining PS-29 work

1. Extend stable context coverage to guest activity before sign-up, every batch/library export, and selection undo. Validate behavior across browser recovery and every handoff. Existing saved-source context must continue to preserve generation idempotency and content-cache behavior.
2. Complete the seven-day report with required segments and confirmed receipt collected independently from the current initiation proxy. Validate the saved-source implementation at production scale, including the missing-telemetry rate and timestamp ordering under delayed delivery.
3. Report the specified debit/recredit, accepted-family, fidelity-report, first-result, source-cohort, destination, style/version and returning-restaurant reuse metrics. Do not substitute raw event counts or an approval heuristic for live benchmark usability.
4. Distinguish internal QA, sample imagery, cached output, corrections and recovered jobs in the reporting query, not just in stored metadata. Define treatment of missing/legacy telemetry and delivery failures.
5. Add guest/sign-up timing and validate foreground estimates against observed owner sessions. Continue reporting full wait and elapsed time separately.
6. Exercise alert delivery, ownership and response, including worker absence, queue age, provider/storage failure, duplicate submissions, credit reconciliation and abnormal fidelity reports.

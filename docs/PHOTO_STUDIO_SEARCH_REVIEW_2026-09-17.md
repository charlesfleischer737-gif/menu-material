# Photo Studio search and discovery review

September 17, 2026. Evidence applies to the local working copy, not the public site. This review advances PS-08, PS-09 and related Saved/customization behavior in the [requirements](PHOTO_STUDIO_REQUIREMENTS.md). It does not accept the complete Photo Studio experience.

## Experience delivered

The first path remains photo → three starting looks → Create. The full library is an optional, focused sheet. Its three scopes have explicit search labels: **Search all looks**, **Search occasions**, and **Search saved looks**.

- Everyday words, accents, descriptive synonyms and common one-letter mistakes find catalog treatments. Exact style names rank first. Stable ordering resolves ties.
- Queries such as **keep my plate**, **white plate**, **custom background**, **change lighting**, and **room around the dish** link to existing controls. A shortcut opens the correct section and focuses its heading. Opening it does not choose a preset, alter the draft, generate pixels or spend an image.
- Drink-specific serving-dish shortcuts describe the locked glass setting; they do not offer glass replacement.
- When only a control shortcut matches, the sheet omits unrelated mood/category controls and the reference-photo footer. The useful action stays prominent. Active filters can still be cleared.
- Related matches are identified in the existing card cue rather than adding a stack of badges. A typo-only result set is also described as related in the count.
- **Clear filters** resets mood/category while retaining the query and focusing search. **Clear search** retains the filters. Detail/back retains query, filters, scroll and the exact card trigger.
- An empty Occasions or Saved search offers **Search all looks**. It keeps the query, resets catalog filters and moves only when selected. Editing search within an occasion returns to matching collections without taking focus from the input.
- Saved searches names and captured recipe settings, lighting, serving ware, angle, occasion and base-treatment metadata. Active and archived restaurant looks remain separate. Empty search language no longer implies that existing work was never saved. A completely empty collection also offers browsing.
- Paused catalog entries remain identifiable in Saved, with selection disabled. Named looks with unavailable recipes cannot become a new default; an existing default can still be removed. Organization actions remain available.

Search is local. The only catalog content change is the more specific **Patinated copper counter** trait, consistent with that style's existing generation instructions. No image model, generation prompt, rendering setting, credentials or image charge changed in this work.

## Criterion-level evidence

“Local pass” below refers only to the stated checks. Requirements involving live qualification, real owners or physical devices remain open.

| Criterion | Evidence | Status and limit |
| --- | --- | --- |
| PS-08.1 | Open/close and shortcut/Cancel retained the original, QA evening menu selection and All changes saved status. | Local browser pass for the exercised draft. |
| PS-08.2 | Repeated searches keep the same order; exact names outrank descriptive matches. | Automated pass for the catalog fixture. No random ordering introduced. |
| PS-08.4–5 | Clear filters preserved white marble and focused search. At 320 × 568, warm wood + Warm survived detail/back; focus returned to catalog-image:delivery-daylight at y=228.9 with dialog scrollTop=579.5. | Local browser pass for these paths. Wider navigation matrix remains part of PS-26. |
| PS-08.6; PS-11.5 | All 56 names are searchable. Unavailable choices are retained and disabled in Saved; all-paused occasion results are excluded in a unit check. | Partial. Live style qualification and the complete historical/legacy retirement matrix are not accepted here. |
| PS-09.1–2 | Forty prewritten cases include all nine required golden phrases, subject/setting/light queries, café and multiple misspellings. | Automated pass, based on current descriptive metadata. Owner language validation remains open. |
| PS-09.3 | Empty Saved white marble → Search all looks kept the query and returned Patisserie counter. foodball Sunday found Game day in Occasions. Changing its query to Christmas retained input focus and showed the Christmas collection. Saved warm wood found two existing named recipes. | Local browser pass. Active/archive partitioning is also checked in the pure search suite. |
| PS-09.4; PS-12.2 | keep my plate opened Serving dish with Keep mine selected and keyboard focus on the expanded heading. Cancel retained the draft. Other section routes and drink-specific copy are checked automatically. | Local browser pass for the plate route; automated checks for remaining route mapping. Complete device/keyboard coverage is still open. |
| PS-09.5; PS-10.2 | Related matches use one compact cue; no-result controls retain the selected photo/look. Query text wraps and is bounded to 180 characters. | Implemented and visually reviewed in catalog/shortcut states. Not a full long-text/accessibility certification. |
| PS-09.6 | 40/40 prewritten queries find at least one acceptable item among the first five, or the expected control shortcut. 56/56 exact style-name queries resolve first, including uppercase variants. All fixture target IDs exist. | Automated ranking pass for this fixture; not independent owner acceptance or release qualification of all styles. |
| PS-09.7; PS-27 | A local benchmark runs 50 mixed searches over 200 catalog entries and 100 saved looks. Observed p95 was approximately 5 ms. Tests reject network use. Browser QA used the provider-disabled environment. | Partial. CPU-only observation on this development computer; excludes rendering, network, throttling and physical phone behavior. |
| PS-26 | At 320 × 568, the shortcut action occupied y=493.6–537.6 with no horizontal overflow and no visible control under 44 × 44. At 1440 × 900, page width was 1440 and the dialog's content/scroll width was 1058. | Local viewport check, not an actual-phone, screen-reader or native-zoom pass. |

## Repeatable checks

The new `tests/studio-search.mjs` runs through the default regression command. Its query fixture is `tests/fixtures/studio-search-queries.json`.

Besides the relevance cases, checks cover stable ordering, exact names, mood/category intersection, accents, bounded input, unsupported capability queries, one-letter mistakes, truthful related-match metadata, all-paused occasion exclusion, saved recipe matching and archive partitioning. Search does not mutate catalog entries or saved recipes. A known word such as **wood** cannot become **food** merely because a filtered collection contains no wood treatment. Arbitrary substrings such as **red** within **considered** do not produce a match.

The full application regression command passed after the main search implementation: 89 integration assertions, 89 expansion checks, 67 creation checks, 18 post checks, 56 catalog checks, 83 launch checks, 81 plan checks, 42 workspace checks, and the existing four Studio suites (60 experience, 40 release, 40 measurement, 50 progress). Those provider/payment responses are fixtures. Subsequent compact-copy, drink-language and accessibility refinements were followed by the search suite, type checking and the Sites build. The build retains its pre-existing large-chunk warning.

Search telemetry now uses the visible scope: catalog looks plus a control route in All, matching collections in Occasions, and visible matching entries in Saved. Query text, saved names and recipes are not added to telemetry. This is a narrow correction, not acceptance of the broader PS-29 measurement requirements.

The browser viewport was reset and the reviewed tab returned to the main studio with **All changes saved**. No generation, default change, archive change, production publication or credential change was performed in this review.

## Remaining acceptance work

1. Run the discovery and acceptance tasks with real restaurant owners; retain their failed queries and add a separately reviewed query set rather than tuning only to this fixture.
2. Measure search-to-render on the specified throttled network/CPU configuration and physical midrange phones, including a 200-style/100-saved-look account. The synthetic CPU result does not meet that obligation.
3. Complete VoiceOver/NVDA, native text enlargement/zoom, virtual-keyboard, safe-area and actual iPhone/Android checks.
4. Qualify every released look and its example against real source/output pairs. These four occasions remain collections of existing photographic treatments, not newly qualified decorative themes.
5. Finish unavailable historical/legacy-look recovery coverage and the remaining analytics/rollout requirements in the [implementation status](PHOTO_STUDIO_IMPLEMENTATION_STATUS.md).

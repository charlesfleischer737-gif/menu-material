# Photo Studio loading review

September 17, 2026. Local working-copy evidence for the [Photo Studio requirements](PHOTO_STUDIO_REQUIREMENTS.md). This change improves the startup dependency graph; it does not establish Core Web Vitals, action latency or physical-phone acceptance.

## Changes

Photo Studio remains directly loaded as the primary workspace. My Dishes, Menus, Post Maker, menu tools and campaigns now load their interface modules when opened. Successful loads are retained for revisits; rapid visits share the same pending request. A failed load shows a plain-language explanation and Try again instead of a blank workspace or automatic request loop.

Previously visited workspaces remain mounted using the existing navigation behavior. Seeds and current state continue to reach the selected tool while its module loads. This preserves the original Photo Studio draft when an owner visits another tool and returns.

Loading feedback receives keyboard focus. When a newly opened tool finishes loading its saved draft, focus transfers to its heading if the owner has not moved elsewhere. This accommodates the separate module-loading and saved-draft-loading stages. It does not force focus back from another workspace or an input the owner has already selected.

Photo rendering and export functions now live in `lib/photo-export.ts`. Photo Studio imports those functions directly. Menu and post renderers use the same photo functions without an import cycle through the combined export module. The previous exports remain available through `lib/creation-export.ts` for existing callers. The function bodies and export settings were preserved; this change does not alter image-generation instructions, original files, output sizes, quality settings or allowance behavior.

## Production build comparison

The values below sum unique JavaScript files in the production manifest's **static import graph**, including the page shell. They exclude dynamically loaded tools, CSS, images, fonts, HTTP overhead and execution time. Gzip values are estimates from locally compressing each built file; they are not recorded network transfers.

| Entry path | Before JavaScript | After JavaScript | Before gzip estimate | After gzip estimate |
| --- | ---: | ---: | ---: | ---: |
| Page shell | 616,245 bytes | 617,969 bytes | 196,800 bytes | 200,115 bytes |
| Page + signed-in Photo Studio | 1,076,657 bytes | 869,136 bytes | 332,468 bytes | 273,686 bytes |
| Page + guest Photo Studio | 841,146 bytes | 818,018 bytes | 263,430 bytes | 257,762 bytes |

The signed-in Studio graph is **19.3% smaller before compression and 17.7% smaller under this gzip estimate**. The guest graph is 2.7% smaller before compression. The shell alone increased by 1,724 bytes before compression and 3,315 estimated gzip bytes as chunk boundaries changed. These figures cover the before/after working copies in this review, not the currently published site.

The final manifest has separate module entries for My Dishes, Menus, menu tools and campaigns; their files are absent from the static Studio graph. The post-maker chunk is absent from that graph as well. HEIC conversion, PDF/font embedding and other large optional chunks still exist. The build's large-chunk warning remains; their existence alone does not establish that they load during normal studio entry.

[Machine-readable comparison and final manifest fingerprint](evidence/photo-studio-bundle-2026-09-17.json).

## Validation

- Full application regression command passed, including the existing API, creation, workspace, search and Studio suites. Provider and payment calls were fixtures.
- New deferred-resource checks passed: no load before use, shared pending request, cached revisit, failure isolation, no automatic retry loop, and a successful explicit retry. The helper is included in the default regression command.
- All **128 export checks** passed after the photo-function extraction, including PDFs, post templates, carousel archives, decoded photo dimensions and unchanged master downloads. No live image-generation request was made.
- Type checking and the final Sites production build passed. `git diff --check` passed.
- In the provider-disabled local browser, first-time Menus and My Dishes opening focused their H1 headings after readiness. Returning to Photo Studio focused its heading and retained the original photo, QA evening menu selection and All changes saved state.
- The source-photo adjustment canvas rendered the original pasta photo after the import extraction. Cancel returned without saving a new image version. The studio tab remains open for review.

The initial Post Maker navigation exposed focus falling back to the page body while its saved draft loaded. The shared loader was corrected to wait for the destination heading. The corrected behavior was verified on the equivalent first-time Menus path and My Dishes; an exhaustive slow-network, failure and all-destination browser matrix remains open.

## Acceptance status and next work

This is partial evidence toward PS-27 and a navigation regression check for PS-25/26/30. It is not a pass for the complete performance requirement.

1. Run the production build under the required 4 Mbps down / 1 Mbps up / 150 ms RTT / 4× CPU profile, with cold cache and ten samples per specified action in clean and existing-draft sessions.
2. Measure actual resource requests, LCP, input acknowledgement, Browse/Customize readiness and search-to-render time. Separate startup requests from later, deliberately opened tools.
3. Test a named physical midrange phone for 12-megapixel JPEG/HEIC preparation, cancellation, crop/brightness frame rate, input delay and the 20-minute replacement/comparison stress sequence.
4. Exercise module failure and retry in a real browser, including navigating elsewhere before completion and opening a dialog during loading. The resource fixture is not proof of all browser/network failure modes.
5. Preview rendering was addressed in a subsequent [preview performance and recovery review](PHOTO_STUDIO_PREVIEW_REVIEW_2026-09-17.md): prepared-layer reuse, latest-frame scheduling, request cancellation and retry now have local evidence. Physical-phone performance, memory stress and a more focused adjustment layout remain open.

No production publication, new API credential, charge, default change or release-acceptance claim is part of this review.

# iPhone workflow update

The app keeps the existing evergreen palette, serif display typography, adaptive grouped surfaces, rounded photo cards, native navigation, readable capsule actions and Dynamic Type. Explore Styles lives on Studio's home screen and opens a searchable gallery. Posts has its own tab; the five tabs are Studio, Dishes, Posts, Menus and Account.

## Delivered

- Three-step restaurant setup: existing restaurant name, optional first name and cuisine, role, intended uses, then a first action. Preferences persist on the restaurant and can be edited in Account.
- Style search, favorites, recent looks and a default look for new photos. Pro styles remain subject to the existing generation entitlement checks.
- Protected, account-isolated device drafts for Studio, dish details and posts; cached workspace, menus, styles and images. Sign-out clears the account cache. Image files are capped at 80 MB. Offline work is visibly marked; mutations still require the service.
- Stable dish-creation, photo-upload and render identities. Ambiguous render failures retain the encoded request, survive relaunch and reconcile against the server before retrying. A new request identity is created only for a deliberate new creation.
- Direct dish-to-Studio handoff and replacement photos attached to the same dish. Nonempty names for newly created dishes. Two-line cards, compact list, archive browsing and restoration.
- Price validation rejects negatives, pasted text and ambiguous separators. Dish edits survive availability changes, navigation and revision conflicts. Price sheets dismiss only after a confirmed save; conflicts stay open for review.
- Visible recovery states for configuration, catalog, asset and menu loads. Photo polling pauses after repeated failures and exposes Check Status. Notification copy follows permission state. Activity includes processing, completed and failed work with the available image balance.
- Original/result/compare controls, full-screen photo zoom and the existing complimentary food-correction workflow.
- Spotlight, Special and Offer post layouts, feed and Story sizes, editable words and caption, restaurant name, photo selection, protected device drafts, full-resolution PNG exports and native save/share. Story artwork reserves top and bottom interface space. The app never posts to social accounts automatically.
- Menu creation, dish selection and removal, draft review, explicit publish/republish, restoration of offline menus, guest links and QR sharing. Mobile edits preserve existing menu design, imported entries and variant prices. Updating a main photo changes the dish; Update Menus names the affected menus and requires review/publication to reach guests.
- A Photos share extension saves a photo to a protected app-group inbox. Opening Menu Material offers a dish choice; it asks before replacing an existing Studio draft. The extension does not use unsupported tricks to force-open the host app.
- Entitlement recovery at app startup, unfinished transaction reconciliation, restore errors and accurate purchase messaging. The update screen uses the configured App Store URL, with a website fallback.
- Restricted performance events for startup, upload, completed-result latency, recovery and post export. Events contain timings, outcome and version only; server job, use, correction and publishing events continue to provide outcome data.

## Contrast

Text uses at least WCAG 2.2 AA's 4.5:1 target, including small labels and prompts; essential control boundaries use 3:1. The shared colors are measured in light/dark, normal/Increase Contrast, and base/elevated appearances. Foreground opacity is avoided for informative text. Photo labels and Pro's evergreen background are opaque, so text contrast stays stable.

| Pair | Contrast |
| --- | ---: |
| White on the primary evergreen action | 7.77:1 |
| Secondary text on the light canvas | 6.21:1 |
| Secondary text on a light card | 6.93:1 |
| Secondary text on a dark card | 9.60:1 |
| Disabled action, light / dark | 5.67:1 / 7.55:1 |
| Pro badge | 8.59:1 |

The old dark-mode accent with white text measured 3.20:1. Filled actions and selected chips now use a separate, darker evergreen; the brighter dark-mode accent is reserved for foreground links. The same rules cover toolbars, onboarding, errors, prompts, post artwork, QR cards, share-extension copy and Live Activity text. Native navigation retains system glass with a stronger scroll-edge backdrop, while text-heavy controls, search fields, progress panels and image retry states have opaque surfaces.

`ContrastTests` evaluates the actual resolved colors and their composites. The screenshot suite runs Apple's contrast audit as it visits light/dark screens and scroll positions. Nodes wholly outside the viewport or covered by other controls are audited when scrolled into view, rather than sampling unrelated screen pixels. Some iOS audit versions misclassify opaque SwiftUI text. For a flagged static text element, a conservative pixel verifier can establish the actual 4.5:1 ratio only when the capture contains one foreground on a flat background, including antialiasing. It rejects photographs, gradients, mixed colors and solid low-contrast glyphs; separate tests verify that washed-out and mixed low-contrast text cannot pass. These checks supplement visual review; they are not a certification of every possible system sheet or user photograph.

References: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## Validation

Run `npm run typecheck`, `npm test`, `npm run build`, `npm run test:menus`, `swift test` in `ios/MenuMaterialKit`, and the MenuMaterial Xcode test scheme. The native workspace integration suite covers default/completed onboarding, preference persistence, non-destructive profile updates, menu create retries, stale revisions, imported entries, variant prices, dish ownership and native minimum versions. Recovery tests cover drafts, account isolation, a lost render response across relaunch, invalid prices and export dimensions. UI tests assert onboarding, gallery entry, existing-dish handoff, post editing, menu creation and Activity; missing required controls fail instead of silently skipping screenshots.

All provider operations in automated tests use fixtures. Passing tests do not verify a real image provider, payment, camera or push delivery.

## Release requirements

1. Generate the project with XcodeGen and select the owner's Apple Developer team.
2. Register `group.com.menumaterial.app` for the app and `com.menumaterial.app.PhotoShare` extension. Include the App Group in both signed provisioning profiles. Existing Sign in with Apple, push and Live Activity capabilities also require the owner's configured Apple account.
3. Deploy migrations `0023_ios_native` and `0024_daffy_ulik` and the matching backend. Config and styles must return 200 while signed out.
4. Set `IOS_APP_STORE_URL` to the actual approved App Store listing when it exists. Never use a guessed listing ID.
5. Complete a signed TestFlight pass on an iPhone: first signup/email verification, Apple and Google sign-in, Photos share, camera permissions, interrupted cellular upload, background generation/push, purchase/restore with an App Store sandbox account, and export to Photos/Instagram.
6. Collect representative restaurant photo results and device performance measurements before making speed, fidelity or crash-free claims. Automated fixtures cannot establish those claims.

Post and unsent photo drafts are currently device-local; onboarding/preferences and submitted work are server-backed. Signing out removes local drafts. Full menu design and campaigns remain available on the website.

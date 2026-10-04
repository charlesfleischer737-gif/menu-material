# iPhone workflow update

The app keeps the existing evergreen palette, serif display typography, adaptive grouped surfaces, rounded photo cards, native glass controls and Dynamic Type. Explore Styles lives on Studio's home screen and opens a searchable gallery. Posts has its own tab; the five tabs are Studio, Dishes, Posts, Menus and Account.

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

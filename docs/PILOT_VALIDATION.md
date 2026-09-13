# Pilot validation and release checks

The MVP is implemented for local and hosted testing. A live provider benchmark is still required before recruiting customers into image creation. No actual restaurant dishes or live API results were supplied during implementation.

## Twenty-dish benchmark

Use 20 genuine dishes with owner-confirmed details and permission to send their reference photos to the image provider. Include soups, glossy sauces, grilled meats, rice dishes, salads, sandwiches, fries, pastries, desserts, beverages, mixed plates, dark foods, pale foods, irregular textures, small garnishes, food in packaging, and crowded plates.

For every dish, run both a reference-photo request and a description-only request. Each request produces two options. Permit one revision request. Record the model, prompt, latency, reported usage, estimated cost, approval outcome, download time, rejection reason, and whether the result is materially accurate. Keep the evaluation records separate from production customer assets.

Owners should check ingredients, amounts, portion, plating, texture, color, container, background, and misleading additions. A good-looking image that misrepresents the actual food fails. Compare providers before choosing the production default.

## Device checks

On current Safari/iPhone and Chrome/Android, verify JPEG, PNG, and HEIC uploads near the size limit; interrupted uploads; image review against the original; JPEG and PNG exports; square, portrait, and story crops; caption editing and copying; menu arrangement; preview; publishing; republishing; unpublishing; link copying; and QR download/scanning.

Test slow mobile connections and closing the browser during generation. Verify the background worker archives both completed responses, partial failures restore only failed units, and repeated clicks do not duplicate reservations. Test source deletion while a generation is queued and public asset access after unpublishing or deletion.

## Pilot targets

- 80% approve and download a first image within 10 minutes, including provider time.
- 70% of dishes yield an approved option within two requests; report both input paths separately.
- 60% publish a menu within seven days.
- Record repeat use within 14 days, rejection reasons, provider costs and support minutes per restaurant and approved image.

These are the PRD's proposed validation targets, not measured results. The app stores timestamped events for onboarding, image requests, completion, approval, rejection, downloads, captions and menu publishing. Admin reports expose recent events; a longitudinal pilot report can be derived from the full database after real usage.

## Launch dependencies

1. Add a real server-side OpenAI API key and verify model access and live request schemas.
2. Run a persistent job runner or scheduler with the matching secret.
3. Create the administrator account and send pilot invitations manually.
4. Obtain approval for public hosting access so published customer menus can bypass the platform sign-in gate. The restaurant workspace remains protected by app authentication.
5. Complete the benchmark and device checks above. Set a provider budget and reconcile actual invoices against tracked usage.

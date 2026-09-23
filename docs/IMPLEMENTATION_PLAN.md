# SideDish MVP implementation

Build specification: Restaurant Support MVP PRD v0.2, 12 September 2026. The user's confirmed decisions take precedence over the attached document. The product name is SideDish.

1. Mobile-first dish studio and invitation onboarding.
2. Shared restaurant, dish, asset, caption, job, usage, and menu schema with persistent SQL and private object storage.
3. Two independently tracked background image outputs, photo or description input, revisions, owner approval, image export, and caption editing.
4. Publish immutable menu snapshots with only approved optional images, anonymous customer access, QR downloads, republishing, and unpublishing.
5. Pilot administration, invitation links, allowances, pause controls, support tracking, and cost/quality feedback.
6. Core integration checks and local setup documentation; clearly separate verified behavior from disconnected provider calls.

## Architecture decisions

React and TypeScript with the Sites Vinext starter, Cloudflare D1 (SQLite), and R2 object storage. Records are scoped to one restaurant per account. No billing or ordering modules.

Private source images and normalized working images remain separate from public menu copies. Public menus read a published snapshot rather than live dish rows. Deleting an image immediately removes it from menu delivery, including older published snapshots.

Image requests reserve two allowance units atomically. Each output has a durable status and independent completion. Only completed images consume units; failed outputs release their reservations. Idempotency keys deduplicate repeat submissions. Provider response identifiers are retained to recover progress after refresh. Ambiguous submissions are not automatically reissued.

OpenAI is an initial configurable integration candidate, not a benchmark winner. The 20-dish comparison in the PRD is a release gate and needs real dish references and provider credentials.

## SideDish redesign

- Introduce SideDish across the site identity, page metadata, menus, and downloads. Preserve existing sessions and storage identifiers.
- Give new visitors a focused food-led introduction and interactive photo, caption, and menu examples. Use the existing invitation flow.
- Simplify the authenticated workspace with compact page headings, neutral surfaces, and optional presentation settings.
- Validate and publish to the existing private Site.

Design references reviewed: https://foodshot.ai/ and https://www.trybeautifulfood.com/. The distinct SideDish focus is the connected photo–caption–menu workflow, with restaurant support as the broader promise. No competitor imagery, testimonials, or performance claims are reused.

## Current focus: Menu Material

The user narrowed the positioning to better food photography for menus, delivery apps, and social posts. The Menu Material design and image provenance are recorded in `docs/MENU_MATERIAL_DESIGN.md`; that direction supersedes the SideDish landing-page positioning above. Existing persistent workspace tools remain intact.

# My Dishes, Post Maker, and Menus upgrade

Implemented the September 16 review for these three logged-in workspaces. The homepage and Photo Studio implementation are unchanged.

## Shared workspace

A compact header shows saved work and one completion action. Customer work occupies the main canvas; editing controls stay beside it on desktop and move into a keyboard-accessible sheet on smaller screens. Restaurant colors, typography, approved photography, and the optional saved writing voice carry into new creations.

## My Dishes

- Large library cards with accurate No photo / Needs review / Ready to use states, search, section/status filters, sorting, and explicit selection mode.
- Immediate detail drawer, original and approved versions, preferred main photo, direct post/menu/download reuse, and source-original download.
- Direct dish creation and up to ten photo uploads with names, retained partial progress, and a review queue.
- Editable facts with revision conflict protection; saved-work usage and stale-detail notices; archive/restore and undo, including bulk changes.

## Post Maker

- Large actual-photo preview and three relevant designs, with the full collection secondary.
- New compositions reserve space for readable text, use simple photo contrast/edge heuristics for placement, fit the whole photo by default, adapt feed/Story framing independently, and surface resolution/crop problems. These heuristics are not semantic food segmentation.
- Supporting text stays at least 42 pixels in a 1080-pixel export (14 pixels at 360-pixel display width). Story text respects top and bottom safe space. Long copy is rejected or moved out of the image with an actionable note.
- Carousel available independently of offer type, optional cover/closing, individual slide headlines and framing, and a consistent six-dish limit.
- Saved restaurant voice and factual AI rewrite actions; caption-staleness review after shared details change.
- One proof/export dialog with editable caption, copy, and save/share. Existing post drafts retain the legacy composition until explicitly changed.

## Menus

- Real 390-pixel guest preview beside a collapsible section outline and contextual item/design controls. Reorder dishes and sections with buttons; remove with undo.
- Bistro, Café, Fine dining, and Casual designs, density choices, explicit featured photographs, and the same normalized image frames in the digital menu and PDF.
- Source/extraction comparison for imports, uncertain-field and duplicate flags, per-dish confirmation, and bulk section/price corrections. New imports retain the previous saved creation and replace the working menu only after review.
- Unpublished change summary, explicit publication, stable links/QR codes, and separate print completion. Shared dish edits never silently replace a published snapshot.
- Actual PDF preview, embedded searchable text, page-break/overflow/character checks, image-resolution notes, Letter/A4, and print-shop files with ⅛-inch bleed, crop marks, and correct PDF trim/bleed boxes. Files remain RGB and identify that limitation.
- Search and sticky section navigation for longer guest menus.

## Validation

- Full existing API, creation, plan, navigation, and catalog suites pass.
- Added 42 workspace API checks: main-photo approval/ownership, archive/restore, deleted-photo fallback, saved-work usage, stale facts and revision conflicts, menu framing snapshots, unchanged publication after edits, voice rewriting payloads, uncertain import review/replacement, and tenant boundaries.
- Existing export suite: 128 checks pass.
- Added 48 export cases: ten new compositions across feed/Story, minimum type size and safe areas, long copy/brand names, carousel slides and independent framing, four menu designs across Letter/A4 and home/press profiles, searchable text, trim/bleed boxes, and 60-dish pagination without isolated section headings or text leaving the page.
- Type checking, targeted lint errors, production build, Worker/migration bundle, and local HTTP preview verified.
- Provider requests use isolated fixtures. No live image generation or caption quality assessment, physical phone sharing, or browser interaction tests were performed in this implementation turn. Export artifacts were inspected locally.

Migration `0008` adds preferred-photo, archive, updated-time, and revision fields to dishes without replacing existing data. No credentials or runtime provider settings changed.

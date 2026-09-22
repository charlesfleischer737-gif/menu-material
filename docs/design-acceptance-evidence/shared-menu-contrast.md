**Menu command contrast — September 18**

Candidate `wip-0fd5f118311e`. Actual computed colors in the local Codex In-app Browser, default text size. See [raw states](shared-interface-verification.json), [selected controls](shared-menu-selected-desktop.jpg), [keyboard focus](shared-menu-focus-desktop.jpg), and [phone preview](shared-menu-phone.jpg).

| Selector / state | Foreground | Background | Ratio | Target height |
| --- | --- | --- | ---: | ---: |
| .md-outline-add — default | #174c3c | #ffffff | 9.83:1 | 44px |
| .md-outline-add:hover | #103c2e | #ffffff | 12.30:1 | 44px |
| .md-outline-item.is-selected (including price) | #174c3c | #e5efea | 8.37:1 | 44px |
| .md-text-button — Save to My Dishes | #174c3c | #ffffff | 9.83:1 | 44px |
| .md-text-button.md-danger | #a12d32 | #ffffff | 7.15:1 | 44px |
| .md-design-label | #174c3c | #e4e7e9 | 7.92:1 | 44px |
| .md-proof-toolbar enabled | #202624 | #ffffff | 15.39:1 | 44px |
| .md-proof-toolbar disabled | #59625f | #e4e7e9 | 5.07:1 | 44px |
| .md-fit-control | #202624 | #ffffff | 15.39:1 | 44px |

All recorded command labels and nested labels pass 4.5:1; enabled icons pass 3:1. Disabled controls retain at least 5.06:1 foreground contrast. Enabled zoom commands use white surfaces; disabled page commands use the gray unavailable surface. Selected outline rows add a left bar, border and weight plus aria-pressed. Remove actions use a trash icon and explicit verb. Focus has a 2px ring and 3px offset. Artwork selection overlays are separate from ordinary command targets.

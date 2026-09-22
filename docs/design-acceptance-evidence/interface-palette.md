**Shared interface palette and button context checks**

Source: [token inventory](interface-palette.json). Rendered evidence: [button and palette verification](button-palette-verification.json).

All semantic interface colors are defined once in app/globals.css. Public/portal theme aliases now use the same canvas, ink, muted, surface and error values as the workspace. Success and loading have named roles that reuse the established action/muted/stage colors. Restaurant artwork uses its own explicit color values; its full preservation criterion remains open.

| Role | Foreground | Background | Contrast |
| --- | --- | --- | ---: |
| Primary default | #ffffff | #174c3c | 9.83:1 |
| Primary hover | #ffffff | #103c2e | 12.30:1 |
| Primary pressed — defined, not held/captured | #ffffff | #0b2e23 | 14.69:1 |
| Disabled label | #59625f | #e4e7e9 | 5.07:1 |
| Normal text | #202624 | #ffffff | 15.39:1 |
| Muted text | #59625f | #ffffff | 6.29:1 |
| Selected action/indicator | #174c3c | #e5efea | 8.37:1 |
| Error text | #a12d32 | #fff2f1 | 6.55:1 |
| Warning text | #8a4b08 | #fff4df | 6.23:1 |

The public pricing link and account-dialog button have identical computed 14px/600 typography, 19.6px line height, 8px radius/gap, 10px 16px padding, 48px height and default/hover/focus colors. The workspace Add a photo action shares their primary colors and 48px height. Public standard and marketing buttons measure 44px and 52px; marketing labels intentionally use 16px. Transparent quiet controls and non-highlighted menu items are intentional; filled primary actions are opaque.

Dialog surfaces use white, shared ink/border and 12px corners. Full-screen phone settings retain zero-radius edges; bottom sheets retain only their two top corners. The homepage gallery's previous cream/olive/brown overrides were replaced with the shared colors. Its selected radio has a checkmark, border and native selected semantics. Image-button focus combines an inset green outline with a white inner frame for contrast over the photograph.

This is not a complete button-state certification. Pointer hover and keyboard focus were observed; held pressed-state rendering, all loading variants and 200% text enlargement remain open. No browser zoom or synthetic CSS state was substituted for those checks.

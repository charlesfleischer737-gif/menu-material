import SwiftUI

/// Stone & Evergreen, the site's palette (docs/SITE_COLOR_PLAN.md), with a
/// dark mode built on the evergreen ink. Each color has a light and a dark
/// value in the asset catalog.
enum Palette {
    /// The page: warm stone, or deep evergreen in dark mode.
    static let canvas = Color("Canvas")
    /// Cards, sheets and fields.
    static let surface = Color("Surface")
    /// A small control or well inside a card.
    static let raised = Color("SurfaceRaised")
    static let ink = Color("Ink")
    static let muted = Color("InkMuted")
    static let hairline = Color("Hairline")
    /// Primary actions: evergreen ink on stone, bright green in dark mode.
    static let action = Color("Action")
    static let onAction = Color("OnAction")
    /// Where photos and artwork sit, so they stand out.
    static let stage = Color("Stage")
    static let accent = Color("AccentColor")
    static let warning = Color("Warning")
    static let danger = Color("Danger")
    /// The logo's bright green, used only on dark surfaces.
    static let glow = Color(red: 0.247, green: 0.749, blue: 0.498)
}

enum Metrics {
    static let gutter: CGFloat = 20
    static let cardRadius: CGFloat = 24
    static let controlRadius: CGFloat = 14
    static let buttonHeight: CGFloat = 54
}

extension Font {
    /// Editorial headlines, in the system serif.
    static func display(_ size: CGFloat = 34) -> Font {
        .system(size: size, weight: .semibold, design: .serif)
    }

    static let eyebrow = Font.footnote.weight(.semibold)
}

extension View {
    /// A white card on the stone canvas, with a hairline and a soft shadow.
    func card(padding: CGFloat = 18) -> some View {
        self
            .padding(padding)
            .background(Palette.surface, in: .rect(cornerRadius: Metrics.cardRadius))
            .overlay {
                RoundedRectangle(cornerRadius: Metrics.cardRadius)
                    .strokeBorder(Palette.hairline.opacity(0.6), lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.06), radius: 18, y: 8)
    }

    /// A small uppercase label above a section.
    func eyebrowStyle() -> some View {
        self
            .font(.eyebrow)
            .textCase(.uppercase)
            .tracking(0.8)
            .foregroundStyle(Palette.accent)
    }

    /// The page background, under the safe areas too.
    func canvasBackground() -> some View {
        background(Palette.canvas.ignoresSafeArea())
    }
}

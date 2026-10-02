import SwiftUI
import UIKit

/// The app's colors. Surfaces and text are Apple's system colors, so light
/// mode, dark mode and Increase Contrast all match the rest of iOS; evergreen
/// is the one brand color, used for actions and selection.
enum Palette {
    /// The page behind grouped content.
    static let canvas = Color(uiColor: .systemGroupedBackground)
    /// Cards and rows on the canvas.
    static let surface = Color(uiColor: .secondarySystemGroupedBackground)
    /// A well or placeholder inside a card.
    static let raised = Color(uiColor: .tertiarySystemFill)
    static let ink = Color.primary
    static let muted = Color.secondary
    static let hairline = Color(uiColor: .separator)
    /// Evergreen in light mode, a brighter green in dark mode.
    static let accent = Color("AccentColor")
    /// Where photos sit before they load: dark, so food stands out.
    static let stage = Color("Stage")
    static let warning = Color.orange
    static let danger = Color.red
    /// The logo's bright green, for dark surfaces.
    static let glow = Color(red: 0.247, green: 0.749, blue: 0.498)

    /// Low light in a dark dining room: the Studio's backdrop.
    static let studioMesh: [Color] = [
        Color(red: 0.03, green: 0.09, blue: 0.07), Color(red: 0.06, green: 0.18, blue: 0.13), Color(red: 0.03, green: 0.09, blue: 0.07),
        Color(red: 0.10, green: 0.31, blue: 0.22), Color(red: 0.78, green: 0.50, blue: 0.21), Color(red: 0.06, green: 0.18, blue: 0.13),
        Color(red: 0.03, green: 0.08, blue: 0.06), Color(red: 0.42, green: 0.17, blue: 0.10), Color(red: 0.03, green: 0.08, blue: 0.06),
    ]

    /// Pro: evergreen and gold.
    static let proMesh: [Color] = [
        Color(red: 0.02, green: 0.07, blue: 0.05), Color(red: 0.05, green: 0.20, blue: 0.14), Color(red: 0.02, green: 0.06, blue: 0.05),
        Color(red: 0.07, green: 0.30, blue: 0.20), Color(red: 0.13, green: 0.45, blue: 0.30), Color(red: 0.55, green: 0.41, blue: 0.16),
        Color(red: 0.02, green: 0.05, blue: 0.04), Color(red: 0.05, green: 0.16, blue: 0.11), Color(red: 0.02, green: 0.05, blue: 0.04),
    ]

    /// The light that circles a photo while it is being made.
    static let making: [Color] = [
        Color(red: 1.00, green: 0.64, blue: 0.24),
        Color(red: 1.00, green: 0.38, blue: 0.40),
        Color(red: 0.91, green: 0.31, blue: 0.64),
        Color(red: 0.56, green: 0.42, blue: 0.98),
        Color(red: 0.25, green: 0.75, blue: 0.50),
        Color(red: 1.00, green: 0.64, blue: 0.24),
    ]
}

enum Metrics {
    static let gutter: CGFloat = 20
    static let cardRadius: CGFloat = 26
    static let controlRadius: CGFloat = 16
    static let rowHeight: CGFloat = 52
}

extension Font {
    /// Editorial headlines in New York, Apple's serif, sized with Dynamic Type.
    static func display(_ style: Font.TextStyle = .largeTitle) -> Font {
        .system(style, design: .serif, weight: .bold)
    }
}

extension View {
    /// Grouped content on the canvas, as in Settings.
    func card(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(Palette.surface, in: .rect(cornerRadius: Metrics.cardRadius))
    }

    /// The main action on a screen: Apple's prominent Liquid Glass button.
    /// Give the label `.frame(maxWidth: .infinity)` to fill the width.
    func primaryAction() -> some View {
        self
            .buttonStyle(.glassProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.extraLarge)
    }

    /// A companion to the main action, in clear Liquid Glass.
    func secondaryAction() -> some View {
        self
            .buttonStyle(.glass)
            .buttonBorderShape(.capsule)
            .controlSize(.extraLarge)
    }

    /// Actions pinned to the bottom, with content scrolling under them,
    /// softened by the system's scroll edge effect.
    func bottomBar<Bar: View>(@ViewBuilder _ bar: () -> Bar) -> some View {
        safeAreaBar(edge: .bottom) { bar() }
    }

    /// The page background, under the safe areas too.
    func canvasBackground() -> some View {
        background(Palette.canvas.ignoresSafeArea())
    }
}

import SwiftUI
import UIKit

/// Shared, opaque foregrounds measured against the app's system surfaces.
/// Action fills are separate from link colors: a brighter dark-mode link
/// must never become a background behind white text.
enum Palette {
    /// The page behind grouped content.
    static let canvas = Color(uiColor: .systemGroupedBackground)
    /// Cards and rows on the canvas.
    static let surface = Color(uiColor: .secondarySystemGroupedBackground)
    /// A well or placeholder inside a card.
    static let raised = Color(uiColor: .tertiarySystemFill)
    static let ink = Color.primary
    static let muted = adaptive(0x595962, 0xC2C2C8, highLight: 0x393940, highDark: 0xE4E4E8)
    static let controlBorder = adaptive(0x74747C, 0x96969F, highLight: 0x45454D, highDark: 0xC2C2C8)
    static let hairline = Color(uiColor: .separator)
    /// Evergreen in light mode, a brighter green in dark mode.
    static let accent = Color("AccentColor")
    /// Where photos sit before they load: dark, so food stands out.
    static let stage = Color("Stage")
    static let warning = adaptive(0x805000, 0xFFD18A)
    static let danger = adaptive(0xB4232C, 0xFFA5AA)
    static let actionFill = Color(rgb: 0x175E3C)
    static let onAction = Color.white
    static let darkSurface = Color(rgb: 0x12291F)
    static let onDarkMuted = Color(rgb: 0xDCE9E1)
    static let gold = Color(rgb: 0xE4BD67)
    static let onGold = Color(rgb: 0x30230B)
    static let disabledFill = adaptive(0xE1E1E6, 0x333338)
    static let disabledInk = adaptive(0x55555D, 0xC8C8CF)
    /// The logo's bright green, for dark surfaces.
    static let glow = Color(red: 0.247, green: 0.749, blue: 0.498)

    private static func adaptive(_ light: UInt, _ dark: UInt, highLight: UInt? = nil, highDark: UInt? = nil) -> Color {
        Color(uiColor: UIColor { traits in
            let increased = traits.accessibilityContrast == .high
            let value = traits.userInterfaceStyle == .dark ? (increased ? highDark ?? dark : dark) : (increased ? highLight ?? light : light)
            return UIColor(red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255, blue: CGFloat(value & 255) / 255, alpha: 1)
        })
    }

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

extension Color {
    init(rgb: UInt) {
        self.init(.sRGB, red: Double((rgb >> 16) & 255) / 255, green: Double((rgb >> 8) & 255) / 255, blue: Double(rgb & 255) / 255, opacity: 1)
    }
}

/// Stable capsule surfaces keep labels readable even over a photo or when
/// disabled. Glass remains in system navigation, where iOS manages contrast.
struct ReadableActionStyle: ButtonStyle {
    var prominent = false
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(enabled ? (prominent ? Palette.onAction : Palette.accent) : Palette.disabledInk)
            .tint(enabled ? (prominent ? Palette.onAction : Palette.accent) : Palette.disabledInk)
            .padding(.horizontal, 20)
            .padding(.vertical, 15)
            .frame(minHeight: 54)
            .background(enabled ? (prominent ? Palette.actionFill : Palette.surface) : Palette.disabledFill, in: .capsule)
            .overlay { Capsule().strokeBorder(Palette.controlBorder, lineWidth: 1) }
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
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

    /// The main action on a screen, with a measured white-on-evergreen pair.
    /// Give the label `.frame(maxWidth: .infinity)` to fill the width.
    func primaryAction() -> some View {
        self
            .buttonStyle(ReadableActionStyle(prominent: true))
            .buttonBorderShape(.capsule)
            .controlSize(.extraLarge)
    }

    /// A companion action with a readable, opaque surface.
    func secondaryAction() -> some View {
        self
            .buttonStyle(ReadableActionStyle())
            .buttonBorderShape(.capsule)
            .controlSize(.extraLarge)
    }

    /// Pinned actions have an opaque surface; scrolled text must not show
    /// through the buttons or fade into an unreadable gray layer.
    func bottomBar<Bar: View>(@ViewBuilder _ bar: () -> Bar) -> some View {
        safeAreaInset(edge: .bottom, spacing: 0) {
            bar().background(Palette.canvas)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("pinned-actions")
        }
    }

    /// The page background, under the safe areas too.
    func canvasBackground() -> some View {
        background(Palette.canvas.ignoresSafeArea())
            .scrollEdgeEffectStyle(.hard, for: .all)
    }
}

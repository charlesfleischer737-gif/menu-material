import SwiftUI
import Testing
import UIKit
@testable import MenuMaterial

/// WCAG 2.2 sRGB luminance, measured after compositing translucent colors.
/// Test actual resolved app tokens, including elevated and increased-contrast
/// appearances, rather than duplicating the palette in a test fixture.
@MainActor struct ContrastTests {
    private struct RGB {
        var r: Double; var g: Double; var b: Double; var a: Double = 1
        func over(_ bg: RGB) -> RGB { RGB(r:r*a+bg.r*(1-a), g:g*a+bg.g*(1-a), b:b*a+bg.b*(1-a)) }
        var luminance: Double {
            func linear(_ value: Double) -> Double { value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4) }
            return 0.2126*linear(r) + 0.7152*linear(g) + 0.0722*linear(b)
        }
    }
    private func rgb(_ color: Color, _ traits: UITraitCollection) -> RGB {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).resolvedColor(with: traits).getRed(&r, green:&g, blue:&b, alpha:&a)
        return RGB(r:Double(r),g:Double(g),b:Double(b),a:Double(a))
    }
    private func check(_ foreground: RGB, _ background: RGB, _ name: String, minimum: Double = 4.5) {
        let a = foreground.over(background).luminance, b = background.luminance
        let ratio = (max(a,b)+0.05)/(min(a,b)+0.05)
        #expect(ratio >= minimum, "\(name): \(ratio):1, needs \(minimum):1")
    }
    @Test func textAndControlPairsPassInEveryAppearance() {
        for mode in [UIUserInterfaceStyle.light, .dark] {
            for contrast in [UIAccessibilityContrast.normal, .high] {
                for level in [UIUserInterfaceLevel.base, .elevated] {
                    let traits = UITraitCollection { $0.userInterfaceStyle = mode; $0.accessibilityContrast = contrast; $0.userInterfaceLevel = level }
                    traits.performAsCurrent {
                        let name = "\(mode.rawValue)/\(contrast.rawValue)/\(level.rawValue)"
                        let backgrounds: [(String, Color)] = [("canvas",Palette.canvas),("card",Palette.surface),("system",Color(uiColor:.systemBackground)),("nested",Color(uiColor:.tertiarySystemGroupedBackground))]
                        for (surface,bg) in backgrounds {
                            let background = rgb(bg,traits)
                            for (label,fg) in [("body",Palette.ink),("secondary/prompts",Palette.muted),("link",Palette.accent),("warning",Palette.warning),("error",Palette.danger)] {
                                check(rgb(fg,traits),background,"\(name) \(label) on \(surface)")
                            }
                            check(rgb(Palette.controlBorder,traits),background,"\(name) control boundary on \(surface)",minimum:3)
                            let well = rgb(Palette.raised,traits).over(background)
                            check(rgb(Palette.muted,traits),well,"\(name) placeholder in well")
                        }
                        check(rgb(Palette.onAction,traits),rgb(Palette.actionFill,traits),"\(name) primary action / selected chip / post")
                        check(rgb(Palette.disabledInk,traits),rgb(Palette.disabledFill,traits),"\(name) disabled action")
                        check(rgb(Palette.onGold,traits),rgb(Palette.gold,traits),"\(name) Pro badge")
                        check(rgb(Palette.onDarkMuted,traits),rgb(Palette.darkSurface,traits),"\(name) fixed dark surface")
                        for color in [Color.white,Palette.onDarkMuted,Palette.glow] + (mode == .dark ? [Palette.danger] : []) {
                            check(rgb(color,traits),rgb(Palette.darkSurface,traits),"\(name) Pro surface")
                        }
                        // The brightest QR card corner includes its gold wash.
                        let qr = rgb(Color(red:0.86,green:0.62,blue:0.27).opacity(0.2),traits).over(rgb(Color(red:0.09,green:0.33,blue:0.22),traits))
                        check(rgb(Palette.onDarkMuted,traits),qr,"\(name) QR card labels")
                        check(rgb(Palette.ink,traits),rgb(Palette.accent.opacity(0.14),traits).over(rgb(Palette.surface,traits)),"\(name) status badge")
                    }
                }
            }
        }
    }
}

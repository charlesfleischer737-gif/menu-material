import XCTest
import UIKit

/// Opens every screen of the sample restaurant (the demo mode of Debug
/// builds, App/Demo.swift) and keeps a screenshot of each, in light and dark.
/// CI publishes them to the repository's ios-screenshots branch.
///
/// Missing screens fail the test instead of silently producing an incomplete set.
final class ScreenshotTests: XCTestCase {
    @MainActor
    func testPixelContrastRejectsWashedOutText() {
        func sample(_ ink: UIColor, mixed: Bool = false) -> CGImage {
            UIGraphicsImageRenderer(size: CGSize(width: 220, height: 60)).image { context in
                UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 220, height: 60))
                let font = UIFont.systemFont(ofSize: 22, weight: .semibold)
                ("Readable text" as NSString).draw(at: CGPoint(x: 8, y: 14), withAttributes: [.font: font, .foregroundColor: ink])
                if mixed {
                    ("Gray" as NSString).draw(at: CGPoint(x: 152, y: 14), withAttributes: [.font: font, .foregroundColor: UIColor(white: 0.75, alpha: 1)])
                }
            }.cgImage!
        }
        XCTAssertNotNil(TextPixelContrast.passingRatio(sample(UIColor(white: 0.3, alpha: 1))))
        XCTAssertNil(TextPixelContrast.passingRatio(sample(UIColor(white: 0.75, alpha: 1))))
        XCTAssertNil(TextPixelContrast.passingRatio(sample(.black, mixed: true)))
    }

    @MainActor
    func testPlansContrast() {
        for theme in ["light", "dark"] {
            let app = launch(scene: "", theme: theme)
            if tab(app, "Account"), tapFirst(app, "plan-row") {
                snap("28-plans-contrast", theme)
                app.swipeUp(); app.swipeUp(); snap("29-plans-terms-contrast", theme)
            }
            app.terminate()
        }
    }

    @MainActor
    func testToolbarContrast() {
        for theme in ["light", "dark"] {
            let setup = launch(scene: "onboarding", theme: theme)
            XCTAssertTrue(setup.buttons["Continue"].waitForExistence(timeout: 8))
            setup.buttons["Continue"].tap()
            snap("24-toolbar-back", theme)
            let app = launch(scene: "", theme: theme)
            snap("26-studio-navigation", theme)
            if tapFirst(app, "See all") { snap("25-toolbar-done", theme) }
            app.terminate()
            let creating = launch(scene: "creating", theme: theme)
            snap("27-creating-contrast", theme)
            creating.terminate()
        }
    }

    @MainActor
    func testLightScreens() {
        screens(theme: "light")
    }

    @MainActor
    func testDarkScreens() {
        screens(theme: "dark")
    }

    @MainActor
    private func screens(theme: String) {
        continueAfterFailure = true

        let welcome = launch(scene: "welcome", theme: theme)
        snap("01-welcome", theme)
        welcome.swipeUp()
        if tapFirst(welcome, "Continue with Email") {
            snap("20-sign-in", theme)
            welcome.segmentedControls.buttons["Create Account"].tap()
            snap("21-sign-up", theme)
        }

        launch(scene: "", theme: theme)
        snap("02-studio", theme)

        let composing = launch(scene: "compose", theme: theme)
        snap("03-compose", theme)
        composing.swipeUp()
        snap("03-compose-looks", theme)

        launch(scene: "creating", theme: theme)
        snap("04-creating", theme)

        launch(scene: "result", theme: theme)
        snap("05-result", theme)

        let setup = launch(scene: "onboarding", theme: theme)
        snap("13-onboarding", theme)
        setup.buttons["Continue"].tap()
        snap("14-onboarding-goals", theme)
        setup.buttons["Continue"].tap()
        snap("15-onboarding-start", theme)

        let app = launch(scene: "", theme: theme)
        if tapFirst(app, "See all") {
            snap("16-explore", theme)
            app.buttons["Done"].firstMatch.tap()
        }
        if tab(app, "Posts"), tapFirst(app, "Create a Post") {
            let dish = app.buttons.matching(NSPredicate(format:"label CONTAINS %@", "Ember Smash Burger")).firstMatch
            XCTAssertTrue(dish.waitForExistence(timeout: 8)); dish.tap()
            snap("17-post", theme)
            app.swipeUp(); snap("18-post-fields", theme)
            app.buttons["Done"].firstMatch.tap()
        }
        if tab(app, "Dishes") {
            snap("06-dishes", theme)
            if tapFirst(app, "dish-card") { snap("07-dish", theme) }
        }
        if tab(app, "Menus") {
            snap("08-menus", theme)
            if tapFirst(app, "menu-card") {
                snap("09-menu", theme)
                if tapFirst(app, "share-menu") {
                    snap("10-share", theme)
                    let done = app.buttons["Done"]
                    if done.waitForExistence(timeout: 3) { done.tap() }
                }
            }
        }
        if tab(app, "Account") {
            snap("11-account", theme)
            if tapFirst(app, "plan-row") {
                snap("12-plans", theme)
                app.swipeUp(); app.swipeUp(); snap("19-plans-terms", theme)
            }
        }
        app.terminate()
    }

    @MainActor @discardableResult
    private func launch(scene: String, theme: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["MENU_MATERIAL_DEMO"] = "1"
        app.launchEnvironment["MENU_MATERIAL_DEMO_SCENE"] = scene
        app.launchEnvironment["MENU_MATERIAL_DEMO_DARK"] = theme == "dark" ? "1" : "0"
        app.launch()
        return app
    }

    @MainActor
    private func tab(_ app: XCUIApplication, _ name: String) -> Bool {
        let button = app.tabBars.buttons[name]
        guard button.waitForExistence(timeout: 8) else { XCTFail("Missing tab: \(name)"); return false }
        button.tap()
        return true
    }

    @MainActor
    private func tapFirst(_ app: XCUIApplication, _ identifier: String) -> Bool {
        let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        guard element.waitForExistence(timeout: 8) else { XCTFail("Missing control: \(identifier)"); return false }
        element.tap()
        return true
    }

    /// Waits for photos to load and animations to settle, then keeps the
    /// screen.
    @MainActor
    private func snap(_ name: String, _ theme: String) {
        Thread.sleep(forTimeInterval: 2.5)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "\(name)-\(theme)"
        attachment.lifetime = .keepAlways
        add(attachment)
        // Keep directly inspectable PNGs as well as xcresult attachments.
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("ContrastReview")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: directory.appendingPathComponent("\(name)-\(theme).png"))
        print("CONTRAST_IMAGES \(directory.path)")
        do {
            let app = XCUIApplication()
            try app.performAccessibilityAudit(for: .contrast) { issue in
                if let element = issue.element {
                    print("CONTRAST \(name) \(theme): \(element.label), frame=\(element.frame), hittable=\(element.isHittable), \(issue.detailedDescription)")
                    // XCTest also audits ScrollView children outside the visible
                    // viewport. Those pixels are not on screen; audit them after
                    // scrolling into view, rather than sampling another view.
                    if !app.frame.contains(element.frame) || !element.isHittable { return true }
                    // SwiftUI can report text underneath a navigation or pinned
                    // bar as hittable. The bar's own controls still get audited.
                    if element.elementType == .staticText {
                        let navigation = app.navigationBars.firstMatch
                        if navigation.exists, element.frame.minY < navigation.frame.maxY,
                           !navigation.staticTexts.matching(NSPredicate(format:"label == %@", element.label)).firstMatch.exists { return true }
                        let bars = app.tabBars.allElementsBoundByIndex + app.otherElements.matching(identifier:"pinned-actions").allElementsBoundByIndex
                        for bar in bars where bar.frame.intersects(element.frame) {
                            if !bar.staticTexts.matching(NSPredicate(format:"label == %@", element.label)).firstMatch.exists { return true }
                        }
                    }
                }
                if let element = issue.element, element.elementType == .staticText,
                   let pixels = element.screenshot().image.cgImage,
                   let ratio = TextPixelContrast.passingRatio(pixels) {
                    print("Verified rendered text contrast: \(ratio):1 for \(element.label)")
                    return true
                }
                return false
            }
        } catch {
            XCTFail("Contrast audit failed on \(name) (\(theme)): \(error)")
        }
    }
}

/// Some iOS accessibility-audit versions misclassify text on opaque SwiftUI
/// surfaces. Only accept a fallback when the captured element is demonstrably
/// one foreground over one flat background, including their antialiasing.
/// Photos, gradients, mixed colors and solid low-contrast glyphs stay failures.
private enum TextPixelContrast {
    private struct RGB: Hashable {
        let r: Double, g: Double, b: Double
        init(_ r: UInt8, _ g: UInt8, _ b: UInt8) { self.r = Double(r); self.g = Double(g); self.b = Double(b) }
        func near(_ other: RGB) -> Bool { max(abs(r-other.r), abs(g-other.g), abs(b-other.b)) <= 4 }
        var luminance: Double {
            func linear(_ v: Double) -> Double { let x = v/255; return x <= 0.04045 ? x/12.92 : pow((x+0.055)/1.055,2.4) }
            return 0.2126*linear(r)+0.7152*linear(g)+0.0722*linear(b)
        }
        func contrast(_ other: RGB) -> Double { (max(luminance,other.luminance)+0.05)/(min(luminance,other.luminance)+0.05) }
    }

    static func passingRatio(_ image: CGImage) -> Double? {
        let width = image.width, height = image.height, total = width*height
        guard width > 4, height > 4, total <= 500_000 else { return nil }
        var bytes = [UInt8](repeating: 0, count: total*4)
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let context = CGContext(data: &bytes, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width*4, space: space,
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return nil }
        context.draw(image, in: CGRect(x:0,y:0,width:width,height:height))
        var pixels = [RGB](); pixels.reserveCapacity(total)
        var histogram = [RGB:Int]()
        for i in stride(from: 0, to: bytes.count, by: 4) {
            guard bytes[i+3] == 255 else { return nil }
            let pixel = RGB(bytes[i],bytes[i+1],bytes[i+2])
            pixels.append(pixel); histogram[pixel,default:0] += 1
        }
        guard let background = histogram.max(by: { $0.value < $1.value })?.key,
              let foreground = histogram.filter({ $0.value >= max(4,total/1000) && $0.key.contrast(background) >= 4.5 }).max(by: { $0.key.contrast(background) < $1.key.contrast(background) })?.key else { return nil }
        let backgroundCount = histogram.filter { $0.key.near(background) }.reduce(0) { $0 + $1.value }
        let foregroundCount = histogram.filter { $0.key.near(foreground) }.reduce(0) { $0 + $1.value }
        guard Double(backgroundCount)/Double(total) >= 0.60,
              Double(foregroundCount)/Double(total) >= 0.005 else { return nil }
        let dr = foreground.r-background.r, dg = foreground.g-background.g, db = foreground.b-background.b
        let length = dr*dr+dg*dg+db*db
        for color in histogram.keys {
            let alpha = ((color.r-background.r)*dr+(color.g-background.g)*dg+(color.b-background.b)*db)/length
            guard (-0.025...1.025).contains(alpha),
                  abs(color.r-background.r-alpha*dr) <= 4,
                  abs(color.g-background.g-alpha*dg) <= 4,
                  abs(color.b-background.b-alpha*db) <= 4 else { return nil }
        }
        // An intermediate shade may be an antialiased edge, but must not form
        // the solid interior of a second, washed-out text color. Ignore the
        // two-pixel crop edge, which may contain a neighboring row separator.
        for y in 2..<(height-2) {
            for x in 2..<(width-2) {
                let color = pixels[y*width+x]
                guard !color.near(background), color.contrast(background) < 4.5 else { continue }
                let flat = (-1...1).allSatisfy { dy in (-1...1).allSatisfy { dx in pixels[(y+dy)*width+x+dx].near(color) } }
                if flat { return nil }
            }
        }
        return foreground.contrast(background)
    }
}

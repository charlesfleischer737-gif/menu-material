import XCTest

/// Opens every screen of the sample restaurant (the demo mode of Debug
/// builds, App/Demo.swift) and keeps a screenshot of each, in light and dark.
/// CI publishes them to the repository's ios-screenshots branch.
///
/// Missing screens fail the test instead of silently producing an incomplete set.
final class ScreenshotTests: XCTestCase {
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
                return false
            }
        } catch {
            XCTFail("Contrast audit failed on \(name) (\(theme)): \(error)")
        }
    }
}

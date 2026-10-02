import XCTest

/// Opens every screen of the sample restaurant (the demo mode of Debug
/// builds, App/Demo.swift) and keeps a screenshot of each, in light and dark.
/// CI publishes them to the repository's ios-screenshots branch.
///
/// A screen that can't be reached is skipped rather than failed: these
/// screenshots are for looking at, and the unit tests check behavior.
final class ScreenshotTests: XCTestCase {
    func testLightScreens() {
        screens(theme: "light")
    }

    func testDarkScreens() {
        screens(theme: "dark")
    }

    private func screens(theme: String) {
        continueAfterFailure = true

        launch(scene: "welcome", theme: theme)
        snap("01-welcome", theme)

        launch(scene: "", theme: theme)
        snap("02-studio", theme)

        launch(scene: "compose", theme: theme)
        snap("03-compose", theme)

        launch(scene: "creating", theme: theme)
        snap("04-creating", theme)

        launch(scene: "result", theme: theme)
        snap("05-result", theme)

        let app = launch(scene: "", theme: theme)
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
            if tapFirst(app, "plan-row") { snap("12-plans", theme) }
        }
        app.terminate()
    }

    @discardableResult
    private func launch(scene: String, theme: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchEnvironment["MENU_MATERIAL_DEMO"] = "1"
        app.launchEnvironment["MENU_MATERIAL_DEMO_SCENE"] = scene
        app.launchEnvironment["MENU_MATERIAL_DEMO_DARK"] = theme == "dark" ? "1" : "0"
        app.launch()
        return app
    }

    private func tab(_ app: XCUIApplication, _ name: String) -> Bool {
        let button = app.tabBars.buttons[name]
        guard button.waitForExistence(timeout: 8) else { return false }
        button.tap()
        return true
    }

    private func tapFirst(_ app: XCUIApplication, _ identifier: String) -> Bool {
        let element = app.descendants(matching: .any).matching(identifier: identifier).firstMatch
        guard element.waitForExistence(timeout: 8) else { return false }
        element.tap()
        return true
    }

    /// Waits for photos to load and animations to settle, then keeps the
    /// screen.
    private func snap(_ name: String, _ theme: String) {
        Thread.sleep(forTimeInterval: 2.5)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "\(name)-\(theme)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

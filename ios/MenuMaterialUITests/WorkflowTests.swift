import XCTest

final class WorkflowTests: XCTestCase {
    @MainActor private func app(scene: String = "", dark: Bool = false) -> XCUIApplication {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["MENU_MATERIAL_DEMO"] = "1"
        app.launchEnvironment["MENU_MATERIAL_DEMO_SCENE"] = scene
        app.launchEnvironment["MENU_MATERIAL_DEMO_DARK"] = dark ? "1" : "0"
        app.launch(); return app
    }
    @MainActor private func tap(_ element: XCUIElement) {
        XCTAssertTrue(element.waitForExistence(timeout: 12)); element.tap()
    }
    @MainActor private func snap(_ name: String) {
        Thread.sleep(forTimeInterval: 0.7)
        let file = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); file.name = name; file.lifetime = .keepAlways; add(file)
    }
    @MainActor func testOnboardingCompletesAndOpensStyles() {
        let app = app(scene: "onboarding")
        tap(app.buttons["Continue"]); tap(app.buttons["Better food photos"]); snap("onboarding-goals")
        tap(app.buttons["Continue"]); tap(app.buttons["Explore styles"]); tap(app.buttons["Let’s get started"])
        XCTAssertTrue(app.navigationBars["Explore Styles"].waitForExistence(timeout: 12)); snap("explore")
        tap(app.buttons["Done"].firstMatch)
        XCTAssertTrue(app.tabBars.buttons["Studio"].exists)
    }
    @MainActor func testDishHandsOriginalToStudio() {
        let app = app()
        tap(app.tabBars.buttons["Dishes"])
        tap(app.descendants(matching:.any).matching(identifier:"dish-card").firstMatch)
        app.swipeUp()
        tap(app.buttons["Style photo"])
        XCTAssertTrue(app.textFields["Dish name"].waitForExistence(timeout: 10) || app.staticTexts["Look"].exists)
        snap("dish-to-studio")
    }
    @MainActor func testPostEditorAndMenuCreation() {
        let app = app()
        tap(app.tabBars.buttons["Posts"]); snap("posts")
        tap(app.buttons["Create a Post"])
        tap(app.buttons.matching(NSPredicate(format:"label CONTAINS %@", "Ember Smash Burger")).firstMatch)
        XCTAssertTrue(app.navigationBars["Create Post"].waitForExistence(timeout:10)); snap("post-editor")
        tap(app.buttons["Done"])
        tap(app.tabBars.buttons["Menus"])
        tap(app.buttons["New Menu"])
        XCTAssertTrue(app.navigationBars["New Menu"].waitForExistence(timeout:10)); snap("menu-editor")
    }
    @MainActor func testDarkStudioAndActivity() {
        let app = app(dark:true)
        XCTAssertTrue(app.buttons["Activity"].waitForExistence(timeout:10)); snap("studio-dark")
        tap(app.buttons["Activity"]); XCTAssertTrue(app.navigationBars["Activity"].waitForExistence(timeout:10)); snap("activity-dark")
    }
}

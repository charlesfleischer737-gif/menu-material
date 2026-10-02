import SwiftUI

@main
struct MenuMaterialApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Palette.accent)
                .task {
                    appDelegate.model = model
                    await model.start()
                }
        }
    }
}

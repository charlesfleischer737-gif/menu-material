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
                .preferredColorScheme(demoColorScheme)
                .task {
                    appDelegate.model = model
                    await model.start()
                }
        }
    }

    private var demoColorScheme: ColorScheme? {
        #if DEBUG
        Demo.colorScheme
        #else
        nil
        #endif
    }
}

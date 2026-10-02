import MenuMaterialKit
import SwiftUI

/// Chooses the screen for where the app stands: signing in, the workspace,
/// or a note that it can't go on.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            switch model.phase {
            case .launching:
                LaunchView()
            case .offline:
                OfflineView()
            case .signedOut:
                WelcomeView()
            case .updateRequired:
                UpdateRequiredView()
            case .signedIn:
                MainTabView()
            }
        }
        .animation(.smooth(duration: 0.35), value: model.phase)
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            Tab("Studio", systemImage: "camera.aperture", value: AppModel.Tab.studio) {
                StudioView()
            }
            Tab("Dishes", systemImage: "fork.knife", value: AppModel.Tab.dishes) {
                DishesView()
            }
            Tab("Menus", systemImage: "menucard", value: AppModel.Tab.menus) {
                MenusView()
            }
            Tab("Account", systemImage: "person.crop.circle", value: AppModel.Tab.account) {
                AccountView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}

struct LaunchView: View {
    var body: some View {
        VStack(spacing: 18) {
            BrandMark(height: 34)
                .foregroundStyle(Palette.accent)
            ProgressView()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .canvasBackground()
    }
}

struct OfflineView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        EmptyState(
            symbol: "wifi.slash",
            title: "Can’t reach Menu Material",
            message: "Check your connection. Your work is saved on our side."
        ) {
            Button("Try again") { Task { await model.retryConnection() } }
                .buttonStyle(.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .canvasBackground()
    }
}

struct UpdateRequiredView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        EmptyState(
            symbol: "arrow.down.app",
            title: "Update Menu Material",
            message: "This version is no longer supported. Update the app to keep going; your work is saved."
        ) {
            Button("Open the App Store") {
                openURL(URL(string: "itms-apps://itunes.apple.com/app/menu-material")!)
            }
            .buttonStyle(.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .canvasBackground()
    }
}

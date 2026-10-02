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
                    .transition(.opacity)
            case .updateRequired:
                UpdateRequiredView()
            case .signedIn:
                MainTabView()
                    .transition(.opacity.combined(with: .scale(scale: 1.02)))
            }
        }
        .animation(.smooth(duration: 0.45), value: model.phase)
    }
}

struct MainTabView: View {
    @Environment(AppModel.self) private var model

    private var making: Bool { model.workspace?.jobs.contains(where: \.isActive) ?? false }

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            Tab("Studio", systemImage: "camera.aperture", value: AppModel.Tab.studio) {
                StudioView()
            }
            .badge(making && model.tab != .studio ? Text("1") : nil)
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
        .sensoryFeedback(.selection, trigger: model.tab)
    }
}

struct LaunchView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        BrandMark(height: 44)
            .foregroundStyle(Palette.accent)
            .phaseAnimator([0.94, 1.0]) { mark, scale in
                mark.scaleEffect(reduceMotion ? 1 : scale)
            } animation: { _ in
                .easeInOut(duration: 1.1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .canvasBackground()
    }
}

struct OfflineView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ContentUnavailableView {
            Label("Can’t Reach Menu Material", systemImage: "wifi.slash")
        } description: {
            Text("Check your connection. Your work is saved.")
        } actions: {
            Button("Try Again") { Task { await model.retryConnection() } }
                .primaryAction()
        }
        .canvasBackground()
    }
}

struct UpdateRequiredView: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        ContentUnavailableView {
            Label("Update Menu Material", systemImage: "arrow.down.app")
        } description: {
            Text("This version is no longer supported. Update the app to keep going; your work is saved.")
        } actions: {
            Button("Open the App Store") {
                openURL(URL(string: "itms-apps://itunes.apple.com/app/menu-material")!)
            }
            .primaryAction()
        }
        .canvasBackground()
    }
}

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
    @AppStorage("welcome-tour-seen") private var tourSeen = false

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
        .sheet(isPresented: Binding(
            get: { !tourSeen && !model.isDemo },
            set: { shown in if !shown { tourSeen = true } }
        )) {
            WelcomeTourView()
        }
    }
}

/// Shown once, after the first sign-in: what's where, in the manner of
/// Apple's own welcome screens.
struct WelcomeTourView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 40) {
                VStack(spacing: 16) {
                    BrandMark(height: 46)
                        .foregroundStyle(Palette.accent)
                    Text("Welcome to Menu Material")
                        .font(.display(.largeTitle))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 52)
                VStack(alignment: .leading, spacing: 28) {
                    row("camera.aperture", "Studio", "Photograph a dish and pick a look. Your styled photo is ready in about a minute.")
                    row("fork.knife", "Dishes", "Every photo is saved to its dish, with its price and whether it’s on the menu.")
                    row("menucard", "Menus", "Mark dishes sold out and change prices on your live menus in a tap.")
                    row("bell.badge", "Alerts", "Leave the app while a photo is made. We’ll tell you when it’s ready.")
                }
            }
            .padding(.horizontal, 36)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                dismiss()
            } label: {
                Text("Continue").frame(maxWidth: .infinity)
            }
            .primaryAction()
            .padding(.horizontal, 24)
            .padding(.vertical, 12)
            .background(Color(uiColor: .systemBackground))
        }
        .background(Color(uiColor: .systemBackground))
    }

    private func row(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 18) {
            Image(systemName: symbol)
                .font(.system(size: 28))
                .foregroundStyle(Palette.accent)
                .frame(width: 40)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
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

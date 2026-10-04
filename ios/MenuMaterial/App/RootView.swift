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
    @Environment(\.scenePhase) private var scenePhase

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
            Tab("Posts", systemImage: "rectangle.portrait.on.rectangle.portrait", value: AppModel.Tab.posts) {
                PostsView()
            }
            Tab("Menus", systemImage: "menucard", value: AppModel.Tab.menus) {
                MenusView()
            }
            Tab("Account", systemImage: "person.crop.circle", value: AppModel.Tab.account) {
                AccountView()
            }
        }
        .sensoryFeedback(.selection, trigger: model.tab)
        .sheet(isPresented: Binding(get: { model.sharedPhotoURL != nil && !model.showOnboarding }, set: { if !$0 { model.sharedPhotoURL = nil } })) {
            if let url = model.sharedPhotoURL { SharedPhotoView(url: url) }
        }
        .sheet(isPresented: $model.showOnboarding) { RestaurantOnboardingView() }
        .safeAreaInset(edge: .top, spacing: 0) {
            if let error = model.connectionError {
                HStack(spacing: 10) {
                    Image(systemName: "wifi.slash")
                    Text(model.workspace != nil ? "Showing saved work. Reconnect to update." : error).font(.caption)
                    Spacer()
                    Button("Retry") { Task { await model.start() } }.font(.caption.bold())
                }.padding(10).background(Palette.surface)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.refresh(); await model.importSharedPhoto() } }
            else { model.studio.persist() }
        }
        .task { await model.importSharedPhoto() }

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
        } description: { Group {
            Text(model.connectionError ?? "Check your connection and try again.")
        }.foregroundStyle(Palette.muted) } actions: {
            Button("Try Again") { Task { await model.retryConnection() } }
                .primaryAction()
        }
        .canvasBackground()
    }
}

struct UpdateRequiredView: View {
    @Environment(\.openURL) private var openURL
    @Environment(AppModel.self) private var model

    var body: some View {
        ContentUnavailableView {
            Label("Update Menu Material", systemImage: "arrow.down.app")
        } description: { Group {
            Text("This version is no longer supported. Update the app to keep going; your work is saved.")
        }.foregroundStyle(Palette.muted) } actions: {
            if let link = model.config?.links.appStore, let url = URL(string: link) {
                Button("Open the App Store") { openURL(url) }.primaryAction()
            } else {
                Link("Get the latest version", destination: model.client.server).primaryAction()
            }
        }
        .canvasBackground()
    }
}

import Foundation
import MenuMaterialKit
import Observation
import UIKit
import UserNotifications

/// The app's state: who is signed in, what the server offers, and the
/// restaurant's workspace from `/api/state`.
@Observable
final class AppModel {
    enum Phase: Equatable {
        case launching
        case offline
        case signedOut
        case signedIn
        case updateRequired
    }

    enum Tab: Hashable {
        case studio, dishes, posts, menus, account
    }

    private(set) var phase: Phase = .launching
    private(set) var config: NativeConfig?
    private(set) var workspace: Workspace?
    var connectionError: String?
    var isOffline = false
    var notificationsEnabled = false
    let local = LocalWorkspace()
    let studio = StudioModel()
    var studioIntent: StudioIntent?
    var postDishId: String?
    var sharedPhotoURL: URL?
    func importSharedPhoto() async {
        guard phase == .signedIn, !showOnboarding, sharedPhotoURL == nil else { return }
        sharedPhotoURL = SharedPhotoInbox.next()
    }
    var exploreRequested = false
    var showOnboarding = false
    var profile = RestaurantProfile()
    var tab: Tab = .studio
    /// A photo to open, from a notification.
    var focusedJob: String?
    let client: APIClient
    let store: StoreModel
    let images: ImagePipeline
    private let keychain = KeychainStore(service: "com.menumaterial.app")
    private var pushToken: String?
    /// The server's clock minus this phone's, so waiting times match the
    /// server's however this phone's clock is set.
    private var serverOffset: Double = 0

    init(clientOverride: APIClient? = nil) {
        let info = Bundle.main.infoDictionary ?? [:]
        let server = (info["MenuMaterialServer"] as? String).flatMap { URL(string: $0) }
            ?? URL(string: "https://menumaterial.com")!
        let version = info["CFBundleShortVersionString"] as? String ?? "1.0"
        #if DEBUG
        let demo = Demo.client(version: version)
        #else
        let demo: APIClient? = nil
        #endif
        if let override = clientOverride { client = override }
        else if let demo {
            client = demo
        } else {
            client = APIClient(server: server, appVersion: version)
            client.sessionToken = keychain.string("session")
            client.deviceToken = keychain.string("device")
        }
        local.configure(session: client.sessionToken)
        #if DEBUG
        if Demo.isOn && ProcessInfo.processInfo.environment["MENU_MATERIAL_DEMO_PERSIST"] != "1" {
            local.clear(); local.configure(session: client.sessionToken)
        }
        #endif
        store = StoreModel(client: client)
        images = ImagePipeline(client: client)
        images.local = local
        studio.configure(local)
        profile = local.read("profile.json") ?? RestaurantProfile()
        client.onSignedOut = { [weak self] in self?.forgetSession() }
        client.onUpdateRequired = { [weak self] in self?.phase = .updateRequired }
        store.onChange = { [weak self] in await self?.refresh() }
    }

    /// The sample restaurant of Debug builds (Demo.swift), not a real account.
    var isDemo: Bool {
        #if DEBUG
        Demo.isOn
        #else
        false
        #endif
    }

    /// Now, on the server's clock, in milliseconds.
    var serverNow: Double { Date().timeIntervalSince1970 * 1000 + serverOffset }

    var user: User? { workspace?.user }
    var restaurant: Restaurant? { workspace?.restaurant }
    var billing: BillingSummary? { workspace?.billing }

    func start() async {
        let began = Date()
        defer { recordMetric("startup", since: began, success: phase == .signedIn || phase == .signedOut) }
        store.listenForTransactions()
        connectionError = nil
        if workspace == nil, let cached = local.data("workspace.json") {
            workspace = try? APIClient.decode(Workspace.self, from: cached)
        }
        do {
            let data = try await client.send(client.request(.get, "native/config"))
            config = try APIClient.decode(NativeConfig.self, from: data)
            local.save(data, "config.json")
        } catch {
            connectionError = error.localizedDescription
            if let cached = local.data("config.json") { config = try? APIClient.decode(NativeConfig.self, from: cached) }
            if workspace == nil { phase = .offline; return }
        }
        if let minimum = config?.minimumVersion,
           AppVersion.compare(client.appVersion, minimum) == .orderedAscending {
            phase = .updateRequired; return
        }
        guard client.sessionToken != nil else { phase = .signedOut; return }
        await refresh()
        if phase == .signedIn {
            await resumeNotifications()
            await store.verifyCurrentEntitlements()
        }
    }

    /// Keeps the last readable workspace on a network failure. Mutations still
    /// require the server; an expired session never exposes cached data.
    @discardableResult func refresh() async -> Bool {
        let session = client.sessionToken
        do {
            let data = try await client.send(client.request(.get, "state"))
            guard client.sessionToken == session else { return false }
            let state = try APIClient.decode(Workspace.self, from: data)
            guard state.user != nil else { forgetSession(); return false }
            workspace = state
            local.save(data, "workspace.json")
            if let p = state.restaurant?.nativeProfile {
                profile = p; local.save(p, "profile.json")
                showOnboarding = !p.completed && !isDemo
                #if DEBUG
                if Demo.isOn && Demo.scene == "onboarding" { showOnboarding = !p.completed }
                #endif
            }
            if let serverTime = state.serverTime { serverOffset = serverTime - Date().timeIntervalSince1970 * 1000 }
            connectionError = nil; isOffline = false
            if phase != .updateRequired { phase = .signedIn }
            return true
        } catch {
            guard client.sessionToken == session, session != nil, phase != .updateRequired else { return false }
            connectionError = error.localizedDescription
            isOffline = true
            phase = workspace == nil ? .offline : .signedIn
            return false
        }
    }

    // MARK: Signing in and out

    /// Keeps the tokens a sign-in route returned, then opens the workspace.
    func signedIn(_ reply: AuthReply) async {
        guard let token = reply.token else { return }
        keychain.set(token, for: "session")
        client.sessionToken = token
        if let device = reply.deviceToken {
            keychain.set(device, for: "device")
            client.deviceToken = device
        }
        local.configure(session: token)
        images.clear()
        studio.configure(local)
        profile = local.read("profile.json") ?? RestaurantProfile()
        tab = .studio
        await refresh()
        await resumeNotifications()
        await store.verifyCurrentEntitlements()
    }

    func signOut() async {
        if let pushToken {
            let _: OK? = try? await client.delete("devices/\(pushToken)")
        }
        let _: OK? = try? await client.post("auth/logout")
        forgetSession()
    }

    /// After deleting the account, or when the server ends the session.
    func forgetSession() {
        keychain.set(nil, for: "session")
        client.sessionToken = nil
        local.clear()
        store.resetAccount()
        sharedPhotoURL = nil
        images.clear()
        studio.resetAccount()
        profile = RestaurantProfile()
        showOnboarding = false
        studioIntent = nil
        postDishId = nil
        connectionError = nil
        workspace = nil
        focusedJob = nil
        if phase != .updateRequired { phase = .signedOut }
    }

    func retryConnection() async {
        phase = .launching
        await start()
    }

    // MARK: Notifications

    /// Asks once, after the first photo is on its way, whether to say when
    /// photos are ready.
    func askForNotifications() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        if settings.authorizationStatus == .notDetermined {
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            notificationsEnabled = granted
            if granted { UIApplication.shared.registerForRemoteNotifications() }
        } else if settings.authorizationStatus == .authorized {
            notificationsEnabled = true
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    private func resumeNotifications() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        notificationsEnabled = [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus)
        if notificationsEnabled {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func registerPushToken(_ token: String) async {
        pushToken = token
        guard client.sessionToken != nil else { return }
        let _: OK? = try? await client.post(
            "devices",
            DeviceRegistration(token: token, environment: Self.pushEnvironment)
        )
    }

    /// Development builds get APNs's sandbox; TestFlight and the App Store
    /// get production.
    static var pushEnvironment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    func openJob(_ jobId: String) {
        tab = .studio
        focusedJob = jobId
    }

    /// Performance only: no names, photos, notes or captions are sent.
    func recordMetric(_ name: String, since start: Date, success: Bool = true) {
        guard !isDemo, client.sessionToken != nil else { return }
        struct Metric: Encodable { var name: String; var durationMs: Int; var outcome: String; var version: String }
        let value = Metric(name: name, durationMs: min(3_600_000, max(0, Int(Date().timeIntervalSince(start) * 1000))), outcome: success ? "success" : "failure", version: client.appVersion)
        Task { let _: OK? = try? await client.post("native/metrics", value) }
    }

    func styleDish(_ dish: Dish, newPhoto: Bool = false) {
        studioIntent = StudioIntent(dishId: dish.id, newPhoto: newPhoto)
        tab = .studio
    }
    func makePost(dishId: String?) { postDishId = dishId; tab = .posts }

    func saveProfile(_ value: RestaurantProfile, restaurantName: String? = nil, cuisine: String? = nil) async throws {
        struct Save: Encodable { let profile: RestaurantProfile; let restaurantName: String?; let cuisine: String? }
        let session = client.sessionToken
        let _: OK = try await client.post("native/profile", Save(profile: value, restaurantName: restaurantName, cuisine: cuisine))
        guard client.sessionToken == session, session != nil else { throw CancellationError() }
        profile = value
        local.save(value, "profile.json")
        showOnboarding = !value.completed
        await refresh()
    }

    // MARK: Workspace changes made on this phone

    /// Sold out, or back on. The whole dish is sent, as the server replaces it.
    func setAvailable(_ dish: Dish, _ available: Bool) async throws -> DishSaveResult {
        var save = DishSave(dish: dish)
        save.available = available
        let reply: DishSaveResult = try await client.post("dishes/\(dish.id)", save)
        await refresh()
        return reply
    }

    func update(_ change: (inout Workspace) -> Void) {
        guard var current = workspace else { return }
        change(&current)
        workspace = current
    }
}

struct StudioIntent: Identifiable, Equatable {
    let id = UUID()
    let dishId: String
    var newPhoto = false
}

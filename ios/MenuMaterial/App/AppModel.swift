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
        case studio, dishes, menus, account
    }

    private(set) var phase: Phase = .launching
    private(set) var config: NativeConfig?
    private(set) var workspace: Workspace?
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

    init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let server = (info["MenuMaterialServer"] as? String).flatMap { URL(string: $0) }
            ?? URL(string: "https://menumaterial.com")!
        let version = info["CFBundleShortVersionString"] as? String ?? "1.0"
        client = APIClient(server: server, appVersion: version)
        client.sessionToken = keychain.string("session")
        client.deviceToken = keychain.string("device")
        store = StoreModel(client: client)
        images = ImagePipeline(client: client)
        client.onSignedOut = { [weak self] in self?.forgetSession() }
        client.onUpdateRequired = { [weak self] in self?.phase = .updateRequired }
        store.onChange = { [weak self] in await self?.refresh() }
    }

    /// Now, on the server's clock, in milliseconds.
    var serverNow: Double { Date().timeIntervalSince1970 * 1000 + serverOffset }

    var user: User? { workspace?.user }
    var restaurant: Restaurant? { workspace?.restaurant }
    var billing: BillingSummary? { workspace?.billing }

    func start() async {
        store.listenForTransactions()
        do {
            config = try await client.get("native/config")
        } catch let error as APIError where error.offline {
            phase = .offline
            return
        } catch {}
        if let minimum = config?.minimumVersion,
           AppVersion.compare(client.appVersion, minimum) == .orderedAscending {
            phase = .updateRequired
            return
        }
        guard client.sessionToken != nil else {
            phase = .signedOut
            return
        }
        await refresh()
        if phase == .signedIn { await resumeNotifications() }
    }

    /// Reloads the workspace. Signed out if the session has ended.
    func refresh() async {
        do {
            let state: Workspace = try await client.get("state")
            guard state.user != nil else {
                forgetSession()
                return
            }
            workspace = state
            if let serverTime = state.serverTime {
                serverOffset = serverTime - Date().timeIntervalSince1970 * 1000
            }
            if phase != .updateRequired { phase = .signedIn }
        } catch let error as APIError where error.offline {
            if workspace == nil { phase = .offline }
        } catch {}
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
            if granted { UIApplication.shared.registerForRemoteNotifications() }
        } else if settings.authorizationStatus == .authorized {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    private func resumeNotifications() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
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

    // MARK: Workspace changes made on this phone

    func update(_ change: (inout Workspace) -> Void) {
        guard var current = workspace else { return }
        change(&current)
        workspace = current
    }
}

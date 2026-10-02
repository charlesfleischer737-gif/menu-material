#if DEBUG
import Foundation
import MenuMaterialKit
import SwiftUI
import UIKit

/// A sample restaurant, Olive & Ember, served from ios/DemoFixtures instead
/// of the server: for trying the app without an account, and for the
/// screenshots CI takes of every screen. Debug builds only.
///
/// Launch with MENU_MATERIAL_DEMO=1. MENU_MATERIAL_DEMO_SCENE picks a
/// starting point ("welcome" signed out, or the Studio's "compose",
/// "creating" or "result"), and MENU_MATERIAL_DEMO_DARK=1 forces dark mode.
enum Demo {
    private static var environment: [String: String] { ProcessInfo.processInfo.environment }

    static var isOn: Bool { environment["MENU_MATERIAL_DEMO"] == "1" && root != nil }
    static var scene: String { environment["MENU_MATERIAL_DEMO_SCENE"] ?? "" }
    static var colorScheme: ColorScheme? {
        guard isOn else { return nil }
        return environment["MENU_MATERIAL_DEMO_DARK"] == "1" ? .dark : .light
    }

    static var root: URL? { Bundle.main.url(forResource: "DemoFixtures", withExtension: nil) }

    static func client(version: String) -> APIClient? {
        guard isOn, let root else { return nil }
        let client = APIClient(server: root, appVersion: version, transport: DemoTransport(root: root, scene: scene))
        client.sessionToken = scene == "welcome" ? nil : "demo-session"
        return client
    }
}

/// Answers API requests from the fixtures: `/api/<path>` reads
/// `api/<path>.json`, or the file itself for photos. Anything else, such as
/// an action, simply succeeds.
nonisolated struct DemoTransport: HTTPTransport {
    let root: URL
    let scene: String

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        guard let url = request.url else { throw URLError(.badURL) }
        var path = url.standardizedFileURL.path
        let base = root.standardizedFileURL.path
        if path.hasPrefix(base) { path = String(path.dropFirst(base.count)) }
        path = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        // A moment's wait, so loading states look as they do on a network.
        try? await Task.sleep(for: .milliseconds(120))
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
        return (body(for: path), response)
    }

    private func body(for path: String) -> Data {
        for name in [path + ".json", path + ".webp", path + ".jpg"] {
            guard let data = try? Data(contentsOf: root.appending(path: name)) else { continue }
            guard name.hasSuffix(".json") else { return data }
            let resolved = Self.resolveTimes(data)
            if path == "api/state", scene == "creating" {
                return merged(resolved, with: "scenes/creating.json")
            }
            return resolved
        }
        return Data(#"{"ok":true}"#.utf8)
    }

    /// Adds a scene's rows (a photo being made) to the workspace.
    private func merged(_ state: Data, with scenePath: String) -> Data {
        guard let extra = try? Data(contentsOf: root.appending(path: scenePath)),
              var object = (try? JSONSerialization.jsonObject(with: state)) as? [String: Any],
              let rows = (try? JSONSerialization.jsonObject(with: Self.resolveTimes(extra))) as? [String: Any]
        else { return state }
        for key in ["dishes", "assets", "jobs", "outputs"] {
            object[key] = (rows[key] as? [Any] ?? []) + (object[key] as? [Any] ?? [])
        }
        return (try? JSONSerialization.data(withJSONObject: object)) ?? state
    }

    /// `"@now"` and `"@now-90"` (seconds ago) become times in milliseconds,
    /// so the sample restaurant is always up to date.
    static func resolveTimes(_ data: Data) -> Data {
        let text = String(decoding: data, as: UTF8.self)
        guard let pattern = try? NSRegularExpression(pattern: #""@now(?:-(\d+))?""#) else { return data }
        let now = Date().timeIntervalSince1970 * 1000
        var result = ""
        var last = text.startIndex
        for match in pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let range = Range(match.range, in: text) else { continue }
            result += text[last..<range.lowerBound]
            var ago = 0.0
            if let seconds = Range(match.range(at: 1), in: text) { ago = Double(text[seconds]) ?? 0 }
            result += String(Int(now - ago * 1000))
            last = range.upperBound
        }
        result += text[last...]
        return Data(result.utf8)
    }
}

extension StudioModel {
    /// Sets the Studio up for a screenshot scene.
    func playDemoScene(_ model: AppModel) async {
        switch Demo.scene {
        case "compose":
            guard let data = UIImage(named: "WelcomeBefore")?.jpegData(compressionQuality: 0.9),
                  let prepared = try? await PreparedPhoto.fromLibrary(data) else { return }
            choose(prepared)
            dishName = "Ember Smash Burger"
            lookId = "studio-dark"
        case "result":
            open(jobId: "job-burger", model: model)
        default:
            break
        }
    }
}
#endif

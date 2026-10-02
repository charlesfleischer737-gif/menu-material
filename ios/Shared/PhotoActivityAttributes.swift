import ActivityKit
import Foundation

/// A photo being made, on the Lock Screen and in the Dynamic Island. The app
/// starts it; the server ends it with a push (lib/server/push.ts) whose
/// "content-state" decodes as `ContentState`, so the field names match.
nonisolated struct PhotoActivityAttributes: ActivityAttributes {
    nonisolated struct ContentState: Codable, Hashable, Sendable {
        /// "creating", "ready" or "failed".
        var phase: String
        var assetId: String?
        /// When photos like this usually arrive, in seconds since 1970.
        var expectedAt: Double?
    }

    /// The photo's job, so the app can find this activity again.
    var jobId: String
    var dishName: String
    var lookName: String
    /// When the photo was requested, in seconds since 1970.
    var startedAt: Double
}

import ActivityKit
import Foundation
import MenuMaterialKit

/// The Live Activity for a photo being made: started here, ended by the
/// server's push when the photo is ready, or here if the app sees it first.
enum PhotoActivities {
    static func start(
        jobId: String,
        dishName: String,
        lookName: String,
        expectedSeconds: Double,
        client: APIClient
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let now = Date().timeIntervalSince1970
        let attributes = PhotoActivityAttributes(jobId: jobId, dishName: dishName, lookName: lookName, startedAt: now)
        let state = PhotoActivityAttributes.ContentState(
            phase: "creating",
            assetId: nil,
            expectedAt: now + max(10, expectedSeconds)
        )
        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(20 * 60)),
                pushType: .token
            )
            Task {
                for await token in activity.pushTokenUpdates {
                    let hex = token.map { String(format: "%02x", $0) }.joined()
                    let _: OK? = try? await client.post(
                        "devices/live-activity",
                        LiveActivityRegistration(jobId: jobId, token: hex, environment: AppModel.pushEnvironment)
                    )
                }
            }
        } catch {}
    }

    /// Ends the photo's activity. While the app is open the result is on
    /// screen, so it goes at once; otherwise it stays a few minutes on the
    /// Lock Screen. Runs off the main actor, like ActivityKit's own `end`, so
    /// no activity crosses between actors.
    @concurrent nonisolated static func end(jobId: String, ready: Bool, assetId: String?, seen: Bool) async {
        let state = PhotoActivityAttributes.ContentState(
            phase: ready ? "ready" : "failed",
            assetId: assetId,
            expectedAt: nil
        )
        for activity in Activity<PhotoActivityAttributes>.activities where activity.attributes.jobId == jobId {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: seen ? .immediate : .after(Date().addingTimeInterval(10 * 60))
            )
        }
    }
}

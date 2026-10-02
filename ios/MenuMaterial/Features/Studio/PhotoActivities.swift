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
    ) -> Activity<PhotoActivityAttributes>? {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
        let now = Date().timeIntervalSince1970
        let attributes = PhotoActivityAttributes(dishName: dishName, lookName: lookName, startedAt: now)
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
            return activity
        } catch {
            return nil
        }
    }

    /// Ends it. While the app is open the result is on screen, so it goes
    /// at once; otherwise it stays a few minutes on the Lock Screen.
    static func end(_ activity: Activity<PhotoActivityAttributes>?, ready: Bool, assetId: String?, seen: Bool) async {
        guard let activity else { return }
        let state = PhotoActivityAttributes.ContentState(
            phase: ready ? "ready" : "failed",
            assetId: assetId,
            expectedAt: nil
        )
        await activity.end(
            ActivityContent(state: state, staleDate: nil),
            dismissalPolicy: seen ? .immediate : .after(Date().addingTimeInterval(10 * 60))
        )
    }
}

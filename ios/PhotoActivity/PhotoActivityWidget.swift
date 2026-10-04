import ActivityKit
import SwiftUI
import WidgetKit

@main
struct PhotoActivityBundle: WidgetBundle {
    var body: some Widget {
        PhotoActivityWidget()
    }
}

private let evergreen = Color(red: 0.071, green: 0.129, blue: 0.102)
private let green = Color(red: 0.247, green: 0.749, blue: 0.498)

/// A photo being made, on the Lock Screen and in the Dynamic Island.
struct PhotoActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PhotoActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(evergreen)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "fork.knife.circle.fill")
                        .font(.title)
                        .foregroundStyle(green)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    StatusSymbol(state: context.state)
                        .font(.title2)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.dishName)
                            .foregroundStyle(.white)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.attributes.lookName)
                            .font(.caption)
                            .foregroundStyle(Palette.onDarkMuted)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    PhotoProgress(attributes: context.attributes, state: context.state)
                        .padding(.top, 6)
                }
            } compactLeading: {
                Image(systemName: "fork.knife")
                    .foregroundStyle(green)
            } compactTrailing: {
                CompactStatus(attributes: context.attributes, state: context.state)
            } minimal: {
                StatusSymbol(state: context.state)
            }
            .keylineTint(green)
        }
    }
}

private struct LockScreenView: View {
    let attributes: PhotoActivityAttributes
    let state: PhotoActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                Circle().fill(green.opacity(0.18))
                StatusSymbol(state: state)
                    .font(.title2)
            }
            .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 6) {
                Text(headline)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("\(attributes.dishName) · \(attributes.lookName)")
                    .font(.subheadline)
                    .foregroundStyle(Palette.onDarkMuted)
                    .lineLimit(1)
                PhotoProgress(attributes: attributes, state: state)
            }
        }
        .padding(16)
    }

    private var headline: String {
        switch state.phase {
        case "ready": "Your photo is ready"
        case "failed": "Your photo couldn’t be made"
        default: "Styling your photo"
        }
    }
}

private struct StatusSymbol: View {
    let state: PhotoActivityAttributes.ContentState

    var body: some View {
        switch state.phase {
        case "ready":
            Image(systemName: "checkmark.circle.fill").foregroundStyle(green)
        case "failed":
            Image(systemName: "exclamationmark.circle.fill").foregroundStyle(.orange)
        default:
            Image(systemName: "camera.aperture").foregroundStyle(green)
        }
    }
}

private struct PhotoProgress: View {
    let attributes: PhotoActivityAttributes
    let state: PhotoActivityAttributes.ContentState

    var body: some View {
        if state.phase == "creating", let expected = state.expectedAt, expected > attributes.startedAt {
            ProgressView(
                timerInterval: Date(timeIntervalSince1970: attributes.startedAt)...Date(timeIntervalSince1970: expected),
                countsDown: false
            ) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .tint(green)
        } else if state.phase == "ready" {
            Text("Open Menu Material to review it.")
                .font(.caption)
                .foregroundStyle(Palette.onDarkMuted)
        } else if state.phase == "failed" {
            Text("It wasn’t counted against your images.")
                .font(.caption)
                .foregroundStyle(Palette.onDarkMuted)
        }
    }
}

private struct CompactStatus: View {
    let attributes: PhotoActivityAttributes
    let state: PhotoActivityAttributes.ContentState

    var body: some View {
        if state.phase == "creating", let expected = state.expectedAt, expected > Date().timeIntervalSince1970 {
            Text(timerInterval: Date()...Date(timeIntervalSince1970: expected), countsDown: true)
                .monospacedDigit()
                .font(.caption2.weight(.semibold))
                .foregroundStyle(green)
                .frame(maxWidth: 44)
        } else {
            StatusSymbol(state: state)
        }
    }
}

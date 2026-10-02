import SwiftUI

/// The main action on a screen: a full-width evergreen pill.
struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(Palette.onAction)
            .frame(maxWidth: .infinity, minHeight: Metrics.buttonHeight)
            .padding(.horizontal, 20)
            .background(Palette.action.opacity(isEnabled ? 1 : 0.35), in: .capsule)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.snappy(duration: 0.18), value: configuration.isPressed)
    }
}

/// A quieter companion to the primary action.
struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(Palette.ink)
            .frame(maxWidth: .infinity, minHeight: Metrics.buttonHeight)
            .padding(.horizontal, 20)
            .background(Palette.surface, in: .capsule)
            .overlay(Capsule().strokeBorder(Palette.hairline, lineWidth: 1))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension ButtonStyle where Self == PrimaryButtonStyle {
    static var primary: PrimaryButtonStyle { PrimaryButtonStyle() }
}

extension ButtonStyle where Self == SecondaryButtonStyle {
    static var secondary: SecondaryButtonStyle { SecondaryButtonStyle() }
}

/// The fork, plate and knife.
struct BrandMark: View {
    var height: CGFloat = 28

    var body: some View {
        Image("BrandMark")
            .renderingMode(.template)
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityLabel("Menu Material")
    }
}

/// A short message that something went wrong, with the server's wording.
struct ErrorNote: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.circle.fill")
            .font(.callout)
            .foregroundStyle(Palette.danger)
            .frame(maxWidth: .infinity, alignment: .leading)
            .transition(.opacity.combined(with: .move(edge: .top)))
            .accessibilityAddTraits(.isStaticText)
    }
}

/// A gentle light that sweeps across a photo while it is being made.
struct Shimmer: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content.overlay {
            if !reduceMotion {
                GeometryReader { proxy in
                    LinearGradient(
                        colors: [.clear, .white.opacity(0.28), .clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: proxy.size.width * 0.7)
                    .offset(x: phase * proxy.size.width * 1.6)
                    .blendMode(.plusLighter)
                }
                .allowsHitTesting(false)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.2).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
            }
        }
    }
}

extension View {
    func shimmer() -> some View { modifier(Shimmer()) }
}

/// The original and the styled photo, compared by dragging a divider. A tick
/// marks the middle; VoiceOver adjusts it in steps.
struct BeforeAfterSlider: View {
    let before: Image
    let after: Image
    var beforeLabel = "Original"
    var afterLabel = "Styled"
    @State private var split: CGFloat = 0.5
    @State private var crossedMiddle = 0

    var body: some View {
        GeometryReader { proxy in
            let width = proxy.size.width
            ZStack(alignment: .leading) {
                after
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: proxy.size.height)
                    .clipped()
                before
                    .resizable()
                    .scaledToFill()
                    .frame(width: width, height: proxy.size.height)
                    .clipped()
                    .mask(alignment: .leading) {
                        Rectangle().frame(width: max(0, width * split))
                    }
                Rectangle()
                    .fill(.white)
                    .frame(width: 2)
                    .shadow(color: .black.opacity(0.35), radius: 3)
                    .offset(x: width * split - 1)
                Image(systemName: "chevron.left.chevron.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Palette.ink)
                    .frame(width: 40, height: 40)
                    .glassEffect(.regular.interactive(), in: .circle)
                    .offset(x: width * split - 20)
                labels
            }
            .contentShape(.rect)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let next = min(1, max(0, value.location.x / width))
                        if (split - 0.5) * (next - 0.5) < 0 { crossedMiddle += 1 }
                        split = next
                    }
            )
        }
        .sensoryFeedback(.selection, trigger: crossedMiddle)
        .accessibilityElement()
        .accessibilityLabel("Compare original and styled photo")
        .accessibilityValue("\(Int((split * 100).rounded())) percent original")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: split = min(1, split + 0.1)
            case .decrement: split = max(0, split - 0.1)
            @unknown default: break
            }
        }
    }

    private var labels: some View {
        VStack {
            HStack {
                tag(beforeLabel).opacity(split > 0.12 ? 1 : 0)
                Spacer()
                tag(afterLabel).opacity(split < 0.88 ? 1 : 0)
            }
            Spacer()
        }
        .padding(12)
        .animation(.easeOut(duration: 0.15), value: split > 0.12)
        .animation(.easeOut(duration: 0.15), value: split < 0.88)
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .glassEffect(.regular, in: .capsule)
    }
}

/// A calm empty state: a symbol, a sentence and what to do next.
struct EmptyState<Actions: View>: View {
    let symbol: String
    let title: String
    let message: String
    @ViewBuilder var actions: Actions

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(Palette.accent)
                .padding(.bottom, 4)
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Palette.ink)
            Text(message)
                .font(.callout)
                .foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
            actions.padding(.top, 8)
        }
        .frame(maxWidth: 360)
        .padding(32)
    }
}

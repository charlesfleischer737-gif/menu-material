import SwiftUI

/// An opaque search field with the same measured prompt and text colors as
/// the forms. It stays above the content rather than floating over labels.
private struct SearchField: View {
    @Binding var text: String
    let placeholder: String
    @FocusState private var focused: Bool
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
            TextField(placeholder, text: $text, prompt: Text(placeholder).foregroundStyle(Palette.muted))
                .foregroundStyle(Palette.ink).focused($focused)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .submitLabel(.search).onSubmit { focused = false }
            if !text.isEmpty {
                Button("Clear search", systemImage: "xmark.circle.fill") { text = "" }
                    .labelStyle(.iconOnly).foregroundStyle(Palette.muted)
                    .frame(width: 32, height: 44)
            }
        }
        .padding(.horizontal, 16).frame(minHeight: 48)
        .background(Palette.surface, in: .capsule)
        .overlay { Capsule().strokeBorder(Palette.controlBorder, lineWidth: 1) }
        .padding(.horizontal, Metrics.gutter).padding(.vertical, 10)
        .background(Palette.canvas)
    }
}

extension View {
    func searchField(text: Binding<String>, placeholder: String = "Find a dish") -> some View {
        safeAreaInset(edge: .top, spacing: 0) {
            SearchField(text: text, placeholder: placeholder)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("search-controls")
        }
    }
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
    }
}

/// Where a photo sits: a dark stage, so light and dark photos both stand out.
struct PhotoStage<Content: View>: View {
    var ratio: CGFloat
    var radius: CGFloat = Metrics.cardRadius
    @ViewBuilder var content: Content

    var body: some View {
        // The frame comes from the ratio, so a photo that fills it can't
        // stretch it.
        Color.clear
            .aspectRatio(ratio, contentMode: .fit)
            .frame(maxWidth: .infinity)
            .overlay {
                ZStack {
                    Palette.stage
                    content
                }
            }
            .clipShape(.rect(cornerRadius: radius))
    }
}

/// A square that a photo fills, cropped to fit, as in Photos.
struct SquarePhoto: View {
    let id: String?
    var radius: CGFloat = 0

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                if let id {
                    AssetImage(id: id)
                } else {
                    ZStack {
                        Palette.raised
                        Image(systemName: "fork.knife")
                            .font(.title2)
                            .foregroundStyle(Palette.muted)
                    }
                }
            }
            .clipShape(.rect(cornerRadius: radius))
    }
}

/// Slow, warm light moving behind a hero, like a candle in a dark room.
struct MeshBackdrop: View {
    let colors: [Color]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30, paused: reduceMotion)) { timeline in
            let t = Float(timeline.date.timeIntervalSinceReferenceDate)
            MeshGradient(width: 3, height: 3, points: Self.points(t), colors: colors)
        }
    }

    private static func points(_ t: Float) -> [SIMD2<Float>] {
        let x: Float = 0.5 + 0.16 * sin(t * 0.45)
        let y: Float = 0.5 + 0.12 * cos(t * 0.38)
        let top: Float = 0.5 + 0.10 * sin(t * 0.31)
        let bottom: Float = 0.5 + 0.10 * cos(t * 0.27)
        return [
            SIMD2<Float>(0, 0), SIMD2<Float>(top, 0), SIMD2<Float>(1, 0),
            SIMD2<Float>(0, 0.5), SIMD2<Float>(x, y), SIMD2<Float>(1, 0.5),
            SIMD2<Float>(0, 1), SIMD2<Float>(bottom, 1), SIMD2<Float>(1, 1),
        ]
    }
}

/// Soft light circling a photo while it is being made, in the manner of
/// Apple Intelligence.
struct MakingGlow: ViewModifier {
    var radius: CGFloat = Metrics.cardRadius
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.overlay {
            TimelineView(.animation(paused: reduceMotion)) { timeline in
                let seconds = timeline.date.timeIntervalSinceReferenceDate
                let gradient = AngularGradient(
                    colors: Palette.making,
                    center: .center,
                    angle: .degrees(seconds.truncatingRemainder(dividingBy: 5) / 5 * 360)
                )
                let shape = RoundedRectangle(cornerRadius: radius)
                ZStack {
                    shape.strokeBorder(gradient, lineWidth: 16).blur(radius: 26).opacity(0.75)
                    shape.strokeBorder(gradient, lineWidth: 7).blur(radius: 8)
                    shape.strokeBorder(gradient, lineWidth: 2.5)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
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
                        colors: [.clear, .white.opacity(0.22), .clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .frame(width: proxy.size.width * 0.6)
                    .offset(x: phase * proxy.size.width * 1.6)
                    .blendMode(.plusLighter)
                }
                .allowsHitTesting(false)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: false)) {
                        phase = 1
                    }
                }
            }
        }
    }
}

extension View {
    func shimmer() -> some View { modifier(Shimmer()) }
    func makingGlow(radius: CGFloat = Metrics.cardRadius) -> some View { modifier(MakingGlow(radius: radius)) }

    /// A confirmation that floats up in Liquid Glass, then goes.
    func toast(_ message: Binding<String?>) -> some View { modifier(Toast(message: message)) }
}

/// A short confirmation, such as "Saved to Photos", in a glass capsule.
struct Toast: ViewModifier {
    @Binding var message: String?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let message {
                    Label(message, systemImage: "checkmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .symbolRenderingMode(.hierarchical)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .foregroundStyle(Palette.ink)
                        .background(Palette.surface, in: .capsule)
                        .overlay { Capsule().strokeBorder(Palette.controlBorder, lineWidth: 1) }
                        .padding(.horizontal, Metrics.gutter)
                        .padding(.bottom, 14)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .task(id: message) {
                            try? await Task.sleep(for: .seconds(2.6))
                            withAnimation(.smooth) { self.message = nil }
                        }
                }
            }
            .animation(.smooth(duration: 0.35), value: message)
            .sensoryFeedback(.success, trigger: message) { _, new in new != nil }
    }
}

/// The original and the styled photo, compared by dragging a divider. It
/// opens on the original and sweeps to the middle; a tick marks the middle,
/// and VoiceOver adjusts it in steps.
struct BeforeAfterSlider: View {
    let before: Image
    let after: Image
    var beforeLabel = "Original"
    var afterLabel = "Styled"
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var split: CGFloat = 1
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
                    .shadow(color: .black.opacity(0.3), radius: 3)
                    .offset(x: width * split - 1)
                Image(systemName: "chevron.left.chevron.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(Palette.ink)
                    .frame(width: 44, height: 44)
                    .background(Palette.surface, in: .circle)
                    .overlay { Circle().strokeBorder(Palette.controlBorder, lineWidth: 1) }
                    .offset(x: min(max(0, width * split - 22), width - 44))
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
        .onAppear {
            guard split == 1 else { return }
            if reduceMotion {
                split = 0.5
            } else {
                withAnimation(.smooth(duration: 1.3).delay(0.35)) { split = 0.5 }
            }
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
                tag(beforeLabel).opacity(split > 0.15 ? 1 : 0)
                Spacer()
                tag(afterLabel).opacity(split < 0.85 ? 1 : 0)
            }
            Spacer()
        }
        .padding(12)
        .animation(.easeOut(duration: 0.15), value: split > 0.15)
        .animation(.easeOut(duration: 0.15), value: split < 0.85)
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(Palette.ink)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Palette.surface, in: .capsule)
    }
}

/// "PRO", on looks and features that come with Pro.
struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.caption2.weight(.heavy))
            .tracking(0.6)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(Palette.onGold)
            .background(Palette.gold, in: .capsule)
            .accessibilityLabel("Pro")
    }
}

/// A dot and a word, such as "Live".
struct StatusPill: View {
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(text)
        }
        .font(.footnote.weight(.semibold))
        .foregroundStyle(Palette.ink)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(color.opacity(0.14), in: .capsule)
    }
}

/// A colored accent accompanies a legible symbol on an opaque square.
struct SettingsIcon: View {
    let symbol: String
    let color: Color

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Palette.ink)
            .frame(width: 30, height: 30)
            .background(Palette.surface, in: .rect(cornerRadius: 8))
            .overlay { RoundedRectangle(cornerRadius: 8).strokeBorder(color, lineWidth: 2) }
            .accessibilityHidden(true)
    }
}

/// A row with a Settings icon, a title and an optional value.
struct SettingsRow: View {
    let symbol: String
    let color: Color
    let title: String
    var value: String?
    var external = false

    var body: some View {
        HStack(spacing: 14) {
            SettingsIcon(symbol: symbol, color: color)
            Text(title).foregroundStyle(Palette.ink)
            Spacer(minLength: 8)
            if let value {
                Text(value)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            if external {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Palette.muted)
            }
        }
    }
}

/// The restaurant's initials in a circle, like a contact without a photo.
struct RestaurantAvatar: View {
    let name: String
    var size: CGFloat = 88

    private var initials: String {
        let words = name.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        let letters = words.prefix(2).compactMap(\.first).map { String($0) }
        return letters.joined().uppercased()
    }

    var body: some View {
        Text(initials.isEmpty ? "M" : initials)
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(
                LinearGradient(
                    colors: [Palette.actionFill, Palette.darkSurface],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: .circle
            )
            .accessibilityHidden(true)
    }
}

import AuthenticationServices
import MenuMaterialKit
import SwiftUI

/// The first screen: what Menu Material does, shown on a real example, and
/// the ways in.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var flows = SignInFlows()
    @State private var showEmail = false
    @State private var appeared = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    WelcomeHero()
                        .containerRelativeFrame(.vertical) { height, _ in max(340, height * 0.47) }
                    VStack(alignment: .leading, spacing: 28) {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 8) {
                                BrandMark(height: 20)
                                Text("Menu Material")
                                    .font(.subheadline.weight(.semibold))
                            }
                            .foregroundStyle(Palette.accent)
                            Text("Food photos that sell.")
                                .font(.display(.largeTitle))
                                .foregroundStyle(Palette.ink)
                            Text("Snap any dish with your phone. Menu Material turns it into studio-quality photography for your menu, delivery apps and posts.")
                                .font(.body)
                                .foregroundStyle(Palette.muted)
                        }
                        .fixedSize(horizontal: false, vertical: true)
                        .entrance(appeared, delay: 0.05, reduceMotion: reduceMotion)

                        signInButtons
                            .entrance(appeared, delay: 0.15, reduceMotion: reduceMotion)

                        if let error = flows.error {
                            ErrorNote(message: error)
                        }
                        legal
                            .entrance(appeared, delay: 0.25, reduceMotion: reduceMotion)
                    }
                    .padding(.horizontal, Metrics.gutter + 4)
                    .padding(.top, 8)
                    .padding(.bottom, 32)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .ignoresSafeArea(edges: .top)
            .background(Color(uiColor: .systemBackground).ignoresSafeArea())
            .navigationDestination(isPresented: $showEmail) {
                EmailSignInView()
            }
            .sheet(item: $flows.pending) { pending in
                FinishSignInView(pending: pending, flows: flows)
            }
        }
        .task { await flows.prepareApple(model.client) }
        .onAppear { appeared = true }
    }

    @ViewBuilder
    private var signInButtons: some View {
        VStack(spacing: 12) {
            if model.config?.signIn.apple ?? false {
                SignInWithAppleButton(.continue) { request in
                    request.requestedScopes = [.email]
                    request.nonce = flows.appleNonce
                } onCompletion: { result in
                    Task { await flows.finishApple(result, model: model) }
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 54)
                .clipShape(.capsule)
                .disabled(flows.appleFlow == nil || flows.busy)
                .opacity(flows.appleFlow == nil ? 0.5 : 1)
            }
            if model.config?.signIn.google != nil {
                Button {
                    Task { await flows.signInWithGoogle(model: model, session: webAuthenticationSession) }
                } label: {
                    Label("Continue with Google", systemImage: "g.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .secondaryAction()
                .disabled(flows.busy)
            }
            Button {
                showEmail = true
            } label: {
                Label("Continue with Email", systemImage: "envelope.fill")
                    .frame(maxWidth: .infinity)
            }
            .secondaryAction()
            .disabled(flows.busy)
        }
        .overlay {
            if flows.busy { ProgressView().controlSize(.large) }
        }
    }

    @ViewBuilder
    private var legal: some View {
        if let terms = model.config?.links.terms, let privacy = model.config?.links.privacy,
           let text = try? AttributedString(
               markdown: "By continuing, you agree to the [Terms](\(terms)) and the [Privacy Policy](\(privacy)). Your first five images are free."
           ) {
            Text(text)
                .font(.footnote)
                .foregroundStyle(Palette.muted)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        }
    }
}

private extension View {
    /// Rises into place when the screen first appears.
    func entrance(_ shown: Bool, delay: Double, reduceMotion: Bool) -> some View {
        self
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 18)
            .animation(.smooth(duration: 0.8).delay(delay), value: shown)
    }
}

/// The homepage's example: an ordinary phone photo and its styled version,
/// with the divider drifting between them. Labeled as an example edit.
struct WelcomeHero: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(paused: reduceMotion)) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                let split = reduceMotion ? 0.5 : 0.5 + 0.3 * sin(t * 0.6)
                ZStack(alignment: .leading) {
                    Image("WelcomeAfter")
                        .resizable()
                        .scaledToFill()
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()
                    Image("WelcomeBefore")
                        .resizable()
                        .scaledToFill()
                        .frame(width: proxy.size.width, height: proxy.size.height)
                        .clipped()
                        .mask(alignment: .leading) {
                            Rectangle().frame(width: proxy.size.width * split)
                        }
                    Rectangle()
                        .fill(.white)
                        .frame(width: 2)
                        .shadow(color: .black.opacity(0.35), radius: 4)
                        .offset(x: proxy.size.width * split - 1)
                }
            }
        }
        .overlay(alignment: .top) {
            // Keeps the status bar readable over the photo.
            LinearGradient(colors: [.black.opacity(0.32), .clear], startPoint: .top, endPoint: .bottom)
                .frame(height: 110)
        }
        .overlay(alignment: .bottom) {
            LinearGradient(
                stops: [
                    .init(color: Color(uiColor: .systemBackground).opacity(0), location: 0),
                    .init(color: Color(uiColor: .systemBackground).opacity(0.85), location: 0.7),
                    .init(color: Color(uiColor: .systemBackground), location: 1),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 150)
        }
        .overlay(alignment: .bottomLeading) {
            Text("Example AI edit of a phone photo")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .glassEffect(.regular, in: .capsule)
                .padding(.leading, Metrics.gutter + 4)
                .padding(.bottom, 56)
        }
        .accessibilityElement()
        .accessibilityLabel("An ordinary phone photo of a burger beside the same burger restyled in a studio look. Example AI edit.")
    }
}

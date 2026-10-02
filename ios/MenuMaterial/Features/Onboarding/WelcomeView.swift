import AuthenticationServices
import MenuMaterialKit
import SwiftUI

/// The first screen: what Menu Material does, shown on a real example, and
/// the ways in.
struct WelcomeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @State private var flows = SignInFlows()
    @State private var showEmail = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    WelcomeHero()
                        .frame(height: 400)
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 10) {
                            BrandMark(height: 22)
                                .foregroundStyle(Palette.accent)
                            Text("Make hungry customers choose your food.")
                                .font(.display(34))
                                .foregroundStyle(Palette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Turn phone photos into menu-ready food photography, then put them on your menu and your posts. Your first five images are free.")
                                .font(.body)
                                .foregroundStyle(Palette.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        signInButtons
                        if let error = flows.error {
                            ErrorNote(message: error)
                        }
                        legal
                    }
                    .padding(.horizontal, Metrics.gutter)
                    .padding(.top, 24)
                    .padding(.bottom, 32)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .ignoresSafeArea(edges: .top)
            .canvasBackground()
            .navigationDestination(isPresented: $showEmail) {
                EmailSignInView()
            }
            .sheet(item: $flows.pending) { pending in
                FinishSignInView(pending: pending, flows: flows)
            }
        }
        .task { await flows.prepareApple(model.client) }
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
                .frame(height: Metrics.buttonHeight)
                .clipShape(.capsule)
                .disabled(flows.appleFlow == nil || flows.busy)
                .opacity(flows.appleFlow == nil ? 0.5 : 1)
            }
            if model.config?.signIn.google != nil {
                Button {
                    Task { await flows.signInWithGoogle(model: model, session: webAuthenticationSession) }
                } label: {
                    Label("Continue with Google", systemImage: "g.circle.fill")
                }
                .buttonStyle(.secondary)
                .disabled(flows.busy)
            }
            Button("Continue with email") { showEmail = true }
                .buttonStyle(.secondary)
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
               markdown: "By continuing, you agree to the [Terms](\(terms)) and the [Privacy Policy](\(privacy))."
           ) {
            Text(text)
                .font(.footnote)
                .foregroundStyle(Palette.muted)
        }
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
                let split = reduceMotion ? 0.5 : 0.5 + 0.32 * sin(t * 0.7)
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
                        .shadow(color: .black.opacity(0.4), radius: 4)
                        .offset(x: proxy.size.width * split - 1)
                }
            }
        }
        .overlay(alignment: .bottom) {
            LinearGradient(colors: [.clear, Palette.canvas], startPoint: .top, endPoint: .bottom)
                .frame(height: 120)
        }
        .overlay(alignment: .bottomLeading) {
            Text("Example AI edit of a phone photo")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .glassEffect(.regular, in: .capsule)
                .padding(.leading, Metrics.gutter)
                .padding(.bottom, 20)
        }
        .accessibilityElement()
        .accessibilityLabel("An ordinary phone photo of a burger beside the same burger restyled in a studio look. Example AI edit.")
    }
}

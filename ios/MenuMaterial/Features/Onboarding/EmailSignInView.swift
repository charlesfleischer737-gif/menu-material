import MenuMaterialKit
import SwiftUI

/// Signing in, or creating an account, with an email and password.
struct EmailSignInView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case signIn = "Sign in"
        case create = "Create account"
        var id: Self { self }
    }

    @Environment(AppModel.self) private var model
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var restaurant = ""
    @State private var busy = false
    @State private var error: String?
    @State private var showReset = false
    @FocusState private var focus: Field?

    enum Field { case email, password, restaurant }

    private var ready: Bool {
        email.contains("@") && password.count >= (mode == .create ? 12 : 1)
            && (mode == .signIn || restaurant.trimmingCharacters(in: .whitespaces).count >= 2)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Picker("Account", selection: $mode) {
                    ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                VStack(spacing: 12) {
                    field("Email") {
                        TextField("you@restaurant.com", text: $email)
                            .textContentType(.username)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focus, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                    }
                    field("Password") {
                        SecureField(mode == .create ? "At least 12 characters" : "Your password", text: $password)
                            .textContentType(mode == .create ? .newPassword : .password)
                            .focused($focus, equals: .password)
                            .submitLabel(mode == .create ? .next : .go)
                            .onSubmit {
                                if mode == .create { focus = .restaurant } else { Task { await submit() } }
                            }
                    }
                    if mode == .create {
                        field("Restaurant name") {
                            TextField("Your restaurant", text: $restaurant)
                                .textContentType(.organizationName)
                                .focused($focus, equals: .restaurant)
                                .submitLabel(.go)
                                .onSubmit { Task { await submit() } }
                        }
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }

                if let error { ErrorNote(message: error) }

                Button {
                    Task { await submit() }
                } label: {
                    if busy { ProgressView().tint(Palette.onAction) } else { Text(mode.rawValue) }
                }
                .buttonStyle(.primary)
                .disabled(!ready || busy)

                if mode == .signIn {
                    Button("Forgot password?") { showReset = true }
                        .font(.callout.weight(.medium))
                        .frame(maxWidth: .infinity)
                } else {
                    Text("New accounts get five free images once you confirm your email.")
                        .font(.footnote)
                        .foregroundStyle(Palette.muted)
                }
            }
            .padding(Metrics.gutter)
            .animation(.snappy, value: mode)
        }
        .canvasBackground()
        .navigationTitle(mode == .signIn ? "Welcome back" : "Create your account")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showReset) {
            ResetPasswordView(email: email)
                .presentationDetents([.medium])
        }
        .onAppear { focus = .email }
    }

    private func field<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Palette.muted)
            content()
                .padding(.horizontal, 14)
                .frame(minHeight: 50)
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: Metrics.controlRadius)
                        .strokeBorder(Palette.hairline, lineWidth: 1)
                }
        }
    }

    private func submit() async {
        guard ready, !busy else { return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let reply: AuthReply
            if mode == .signIn {
                reply = try await model.client.post("auth/login", LoginRequest(email: email, password: password))
            } else {
                reply = try await model.client.post(
                    "auth/signup",
                    SignupRequest(
                        email: email,
                        password: password,
                        restaurant: restaurant.trimmingCharacters(in: .whitespaces),
                        timezone: TimeZone.current.identifier
                    )
                )
            }
            await model.signedIn(reply)
        } catch let failure as APIError {
            error = failure.message
        } catch {
            self.error = "That didn’t work. Please try again."
        }
    }
}

/// Requests a reset link by email; the link opens on the website.
struct ResetPasswordView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State var email: String
    @State private var sent = false
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                if sent {
                    Label("Check your email", systemImage: "envelope.badge")
                        .font(.title3.weight(.semibold))
                    Text("If \(email) has an account, a reset link is on its way. It works once, for 30 minutes, and opens on menumaterial.com.")
                        .foregroundStyle(Palette.muted)
                    Button("Done") { dismiss() }.buttonStyle(.primary)
                } else {
                    Text("Enter your account’s email and we’ll send a link to set a new password.")
                        .foregroundStyle(Palette.muted)
                    TextField("you@restaurant.com", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                    if let error { ErrorNote(message: error) }
                    Button("Send reset link") { Task { await send() } }
                        .buttonStyle(.primary)
                        .disabled(!email.contains("@") || busy)
                }
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .navigationTitle("Reset password")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func send() async {
        busy = true
        defer { busy = false }
        do {
            let _: OK = try await model.client.post("auth/forgot-password", EmailRequest(email: email))
            withAnimation { sent = true }
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}

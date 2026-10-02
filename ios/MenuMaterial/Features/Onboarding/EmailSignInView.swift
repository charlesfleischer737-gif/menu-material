import MenuMaterialKit
import SwiftUI

/// Signing in, or creating an account, with an email and password.
struct EmailSignInView: View {
    enum Mode: String, CaseIterable, Identifiable {
        case signIn = "Sign In"
        case create = "Create Account"
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
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(mode == .signIn ? "Welcome back" : "Create your account")
                        .font(.display(.largeTitle))
                        .contentTransition(.opacity)
                    Text(mode == .signIn
                         ? "Sign in with your Menu Material email and password."
                         : "New accounts get five free images once you confirm your email.")
                        .font(.body)
                        .foregroundStyle(Palette.muted)
                        .contentTransition(.opacity)
                }
                .fixedSize(horizontal: false, vertical: true)

                Picker("Account", selection: $mode) {
                    ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)

                VStack(spacing: 0) {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                        .fieldRow()
                    Divider().padding(.leading, 16)
                    SecureField(mode == .create ? "Password (12 or more characters)" : "Password", text: $password)
                        .textContentType(mode == .create ? .newPassword : .password)
                        .focused($focus, equals: .password)
                        .submitLabel(mode == .create ? .next : .go)
                        .onSubmit {
                            if mode == .create { focus = .restaurant } else { Task { await submit() } }
                        }
                        .fieldRow()
                    if mode == .create {
                        Divider().padding(.leading, 16)
                        TextField("Restaurant name", text: $restaurant)
                            .textContentType(.organizationName)
                            .focused($focus, equals: .restaurant)
                            .submitLabel(.go)
                            .onSubmit { Task { await submit() } }
                            .fieldRow()
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }
                }
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))

                if let error { ErrorNote(message: error) }

                Button {
                    Task { await submit() }
                } label: {
                    Group {
                        if busy { ProgressView().tint(.white) } else { Text(mode == .signIn ? "Sign In" : "Create Account") }
                    }
                    .frame(maxWidth: .infinity)
                }
                .primaryAction()
                .disabled(!ready || busy)

                if mode == .signIn {
                    Button("Forgot Password?") { showReset = true }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, Metrics.gutter + 4)
            .padding(.top, 8)
            .padding(.bottom, 32)
            .animation(.snappy, value: mode)
        }
        .scrollDismissesKeyboard(.interactively)
        .canvasBackground()
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showReset) {
            ResetPasswordView(email: email)
                .presentationDetents([.medium])
        }
        .onAppear { focus = .email }
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

extension View {
    /// A text field as a row of a grouped card.
    func fieldRow() -> some View {
        self
            .padding(.horizontal, 16)
            .frame(minHeight: Metrics.rowHeight)
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
            VStack(alignment: .leading, spacing: 18) {
                if sent {
                    Image(systemName: "envelope.badge.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Palette.accent)
                        .symbolRenderingMode(.hierarchical)
                    Text("Check your email")
                        .font(.title2.bold())
                    Text("If \(email) has an account, a reset link is on its way. It works once, for 30 minutes, and opens on menumaterial.com.")
                        .foregroundStyle(Palette.muted)
                    Button {
                        dismiss()
                    } label: {
                        Text("Done").frame(maxWidth: .infinity)
                    }
                    .primaryAction()
                } else {
                    Text("Enter your account’s email and we’ll send a link to set a new password.")
                        .foregroundStyle(Palette.muted)
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .fieldRow()
                        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                    if let error { ErrorNote(message: error) }
                    Button {
                        Task { await send() }
                    } label: {
                        Text("Send Reset Link").frame(maxWidth: .infinity)
                    }
                    .primaryAction()
                    .disabled(!email.contains("@") || busy)
                }
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .navigationTitle("Reset Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }
            }
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

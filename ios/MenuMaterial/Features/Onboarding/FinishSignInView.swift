import MenuMaterialKit
import SwiftUI

/// After a new Apple or Google sign-in: name the restaurant for a new
/// account, or enter the existing account's password to connect it.
struct FinishSignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let pending: SignInFlows.Pending
    let flows: SignInFlows
    @State private var restaurant = ""
    @State private var password = ""

    private var provider: String { pending.provider == .apple ? "Apple" : "Google" }
    private var linking: Bool { pending.step == "link" }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                if linking {
                    Text("You already have a Menu Material account with \(pending.email). Enter its password to sign in with \(provider) from now on.")
                        .foregroundStyle(Palette.muted)
                    SecureField("Your Menu Material password", text: $password)
                        .textContentType(.password)
                        .padding(14)
                        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                } else {
                    Text("What’s your restaurant called? It appears on your menus and posts, and you can change it later.")
                        .foregroundStyle(Palette.muted)
                    TextField("Restaurant name", text: $restaurant)
                        .textContentType(.organizationName)
                        .padding(14)
                        .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                }
                if let error = flows.error { ErrorNote(message: error) }
                Button {
                    Task {
                        await flows.complete(
                            pending,
                            restaurant: linking ? nil : restaurant.trimmingCharacters(in: .whitespaces),
                            password: linking ? password : nil,
                            model: model
                        )
                    }
                } label: {
                    if flows.busy {
                        ProgressView().tint(Palette.onAction)
                    } else {
                        Text(linking ? "Connect and sign in" : "Create my restaurant")
                    }
                }
                .buttonStyle(.primary)
                .disabled(flows.busy || (linking ? password.isEmpty : restaurant.trimmingCharacters(in: .whitespaces).count < 2))
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .navigationTitle(linking ? "Connect your account" : "Welcome to Menu Material")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { flows.pending = nil }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(flows.busy)
    }
}

/// New password accounts confirm their email before their free images
/// arrive. Apple and Google accounts never see this.
struct VerifyEmailView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var sentTo: String?
    @State private var resendAfter = 0
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text(sentTo.map { "We sent a six-digit code to \($0). It works for 15 minutes." }
                     ?? "Confirm your email to unlock your five free images. Your photo and look are saved.")
                    .foregroundStyle(Palette.muted)
                TextField("123456", text: $code)
                    .textContentType(.oneTimeCode)
                    .keyboardType(.numberPad)
                    .font(.system(size: 30, weight: .semibold, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding(14)
                    .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))
                    .focused($focused)
                    .onChange(of: code) { _, value in
                        code = String(value.filter(\.isNumber).prefix(6))
                        if code.count == 6 { Task { await confirm() } }
                    }
                if let error { ErrorNote(message: error) }
                Button {
                    Task { await confirm() }
                } label: {
                    if busy { ProgressView().tint(Palette.onAction) } else { Text("Confirm email") }
                }
                .buttonStyle(.primary)
                .disabled(code.count != 6 || busy)
                Button(resendAfter > 0 ? "Send a new code in \(resendAfter) s" : "Send a new code") {
                    Task { await send() }
                }
                .disabled(resendAfter > 0 || busy)
                .frame(maxWidth: .infinity)
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .navigationTitle("Confirm your email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Later", role: .cancel) { dismiss() }
                }
            }
        }
        .task {
            await send()
            focused = true
        }
        .task(id: resendAfter) {
            guard resendAfter > 0 else { return }
            try? await Task.sleep(for: .seconds(1))
            resendAfter -= 1
        }
    }

    private func send() async {
        busy = true
        defer { busy = false }
        do {
            let reply: EmailVerification = try await model.client.post("auth/email-verification/send")
            if !reply.required {
                await model.refresh()
                dismiss()
                return
            }
            sentTo = reply.email
            resendAfter = reply.resendAfter ?? 60
            error = nil
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }

    private func confirm() async {
        guard code.count == 6, !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let _: EmailVerification = try await model.client.post("auth/email-verification/confirm", CodeRequest(code: code))
            await model.refresh()
            dismiss()
        } catch let failure as APIError {
            error = failure.message
            code = ""
        } catch {}
    }
}

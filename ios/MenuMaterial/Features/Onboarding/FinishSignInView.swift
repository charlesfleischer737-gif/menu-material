import MenuMaterialKit
import SwiftUI

/// After a new Apple or Google sign-in: name the restaurant for a new
/// account, or enter the existing account's password to connect it.
struct FinishSignInView: View {
    @Environment(AppModel.self) private var model
    let pending: SignInFlows.Pending
    let flows: SignInFlows
    @State private var restaurant = ""
    @State private var password = ""
    @FocusState private var focused: Bool

    private var provider: String { pending.provider == .apple ? "Apple" : "Google" }
    private var linking: Bool { pending.step == "link" }
    private var ready: Bool {
        linking ? !password.isEmpty : restaurant.trimmingCharacters(in: .whitespaces).count >= 2
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Image(systemName: linking ? "person.crop.circle.badge.checkmark" : "storefront")
                    .font(.system(size: 40))
                    .foregroundStyle(Palette.accent)
                    .symbolRenderingMode(.hierarchical)
                VStack(alignment: .leading, spacing: 8) {
                    Text(linking ? "Connect your account" : "Name your restaurant")
                        .font(.title.bold())
                    Text(linking
                         ? "You already have a Menu Material account with \(pending.email). Enter its password to sign in with \(provider) from now on."
                         : "It appears on your menus and posts. You can change it later.")
                        .foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Group {
                    if linking {
                        SecureField("Menu Material password", text: $password, prompt: Text("Menu Material password").foregroundStyle(Palette.muted))
                            .textContentType(.password)
                    } else {
                        TextField("Restaurant name", text: $restaurant, prompt: Text("Restaurant name").foregroundStyle(Palette.muted))
                            .textContentType(.organizationName)
                            .textInputAutocapitalization(.words)
                    }
                }
                .focused($focused)
                .submitLabel(.go)
                .onSubmit { Task { await finish() } }
                .fieldRow()
                .background(Palette.surface, in: .rect(cornerRadius: Metrics.controlRadius))

                if let error = flows.error { ErrorNote(message: error) }
                Button {
                    Task { await finish() }
                } label: {
                    Group {
                        if flows.busy {
                            ProgressView()
                        } else {
                            Text(linking ? "Connect and Sign In" : "Create My Restaurant")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .primaryAction()
                .disabled(flows.busy || !ready)
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { flows.pending = nil }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
            }
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled(flows.busy)
        .onAppear { focused = true }
    }

    private func finish() async {
        guard ready, !flows.busy else { return }
        await flows.complete(
            pending,
            restaurant: linking ? nil : restaurant.trimmingCharacters(in: .whitespaces),
            password: linking ? password : nil,
            model: model
        )
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
            VStack(spacing: 22) {
                Image(systemName: "envelope.open.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(Palette.accent)
                    .symbolRenderingMode(.hierarchical)
                    .padding(.top, 8)
                VStack(spacing: 8) {
                    Text("Confirm your email")
                        .font(.title.bold())
                    Text(sentTo.map { "Enter the six-digit code we sent to \($0). It works for 15 minutes." }
                         ?? "Confirm your email to unlock your five free images. Your photo and look are saved.")
                        .foregroundStyle(Palette.muted)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                CodeField(code: $code, focused: $focused)
                    .onChange(of: code) { _, value in
                        code = String(value.filter(\.isNumber).prefix(6))
                        if code.count == 6 { Task { await confirm() } }
                    }
                if let error { ErrorNote(message: error) }
                Button {
                    Task { await confirm() }
                } label: {
                    Group {
                        if busy { ProgressView() } else { Text("Confirm Email") }
                    }
                    .frame(maxWidth: .infinity)
                }
                .primaryAction()
                .disabled(code.count != 6 || busy)
                Button(resendAfter > 0 ? "Send a New Code in \(resendAfter)s" : "Send a New Code") {
                    Task { await send() }
                }
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .disabled(resendAfter > 0 || busy)
                Spacer()
            }
            .padding(Metrics.gutter)
            .canvasBackground()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Later", role: .cancel) { dismiss() }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
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

/// Six boxes for a one-time code, filled from one hidden field so the
/// keyboard's code suggestion fills them all.
private struct CodeField: View {
    @Binding var code: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        ZStack {
            TextField("", text: $code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .focused(focused)
                .foregroundStyle(.clear)
                .tint(.clear)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityLabel("Six-digit code")
            HStack(spacing: 10) {
                ForEach(0..<6, id: \.self) { index in
                    let digit = digit(at: index)
                    Text(digit ?? "")
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .frame(maxWidth: .infinity, minHeight: 58)
                        .background(Palette.surface, in: .rect(cornerRadius: 14))
                        .overlay {
                            RoundedRectangle(cornerRadius: 14)
                                .strokeBorder(index == code.count ? Palette.accent : .clear, lineWidth: 2)
                        }
                        .contentTransition(.numericText())
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .frame(height: 58)
        .animation(.snappy, value: code)
    }

    private func digit(at index: Int) -> String? {
        guard index < code.count else { return nil }
        return String(code[code.index(code.startIndex, offsetBy: index)])
    }
}

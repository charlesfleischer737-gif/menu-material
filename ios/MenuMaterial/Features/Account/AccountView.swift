import MenuMaterialKit
import SwiftUI
import UserNotifications

/// The restaurant, its plan, notifications, help, and leaving.
struct AccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var showPlans = false
    @State private var showRename = false
    @State private var showDelete = false
    @State private var confirmSignOut = false
    @State private var notifications: UNAuthorizationStatus = .notDetermined

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.restaurant?.name ?? "Your restaurant")
                            .font(.display(26))
                            .foregroundStyle(Palette.ink)
                        Text(model.user?.email ?? "")
                            .font(.callout)
                            .foregroundStyle(Palette.muted)
                    }
                    .padding(.vertical, 6)
                    Button("Rename restaurant") { showRename = true }
                }

                Section("Plan") {
                    Button {
                        showPlans = true
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(model.billing?.isPro == true ? "Pro" : "Free")
                                    .font(.headline)
                                    .foregroundStyle(Palette.ink)
                                Text("\(model.workspace?.remaining ?? 0) images left")
                                    .font(.footnote)
                                    .foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Text(model.billing?.isPro == true ? "Manage" : "See Pro")
                                .font(.callout.weight(.semibold))
                        }
                    }
                }

                Section {
                    switch notifications {
                    case .authorized, .provisional, .ephemeral:
                        Label("On: we’ll tell you when photos are ready", systemImage: "bell.badge")
                    case .denied:
                        Button {
                            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                        } label: {
                            Label("Off. Turn them on in Settings", systemImage: "bell.slash")
                        }
                    default:
                        Button {
                            Task {
                                await model.askForNotifications()
                                await readNotifications()
                            }
                        } label: {
                            Label("Tell me when photos are ready", systemImage: "bell")
                        }
                    }
                } header: {
                    Text("Notifications")
                }

                Section("More on the web") {
                    Link(destination: model.client.server) {
                        Label("Menu Builder, Post Maker and campaigns", systemImage: "safari")
                    }
                }

                Section("Help") {
                    if let support = model.config?.links.support.flatMap { URL(string: $0) } {
                        Link(destination: support) { Label("Contact support", systemImage: "envelope") }
                    }
                    if let terms = model.config?.links.terms.flatMap { URL(string: $0) } {
                        Link(destination: terms) { Label("Terms", systemImage: "doc.text") }
                    }
                    if let privacy = model.config?.links.privacy.flatMap { URL(string: $0) } {
                        Link(destination: privacy) { Label("Privacy Policy", systemImage: "hand.raised") }
                    }
                    NavigationLink {
                        AboutView()
                    } label: {
                        Label("About", systemImage: "info.circle")
                    }
                }

                Section {
                    Button("Sign out") { confirmSignOut = true }
                    Button("Delete account", role: .destructive) { showDelete = true }
                }
            }
            .scrollContentBackground(.hidden)
            .canvasBackground()
            .navigationTitle("Account")
            .sheet(isPresented: $showPlans) { PlansView() }
            .sheet(isPresented: $showRename) { RenameRestaurantView() }
            .sheet(isPresented: $showDelete) { DeleteAccountView() }
            .confirmationDialog("Sign out of Menu Material?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await model.signOut() } }
            }
            .task { await readNotifications() }
        }
    }

    private func readNotifications() async {
        notifications = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }
}

private struct RenameRestaurantView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Restaurant name", text: $name)
                    .textInputAutocapitalization(.words)
                Section {
                    Text("Live menus keep their current name until you publish them again on menumaterial.com.")
                        .font(.footnote)
                        .foregroundStyle(Palette.muted)
                }
                if let error { Text(error).foregroundStyle(Palette.danger) }
            }
            .navigationTitle("Rename restaurant")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
        }
        .presentationDetents([.medium])
        .onAppear { name = model.restaurant?.name ?? "" }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        do {
            let _: OK = try await model.client.post(
                "restaurant/name",
                RenameRequest(name: name.trimmingCharacters(in: .whitespaces))
            )
            await model.refresh()
            dismiss()
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}

/// Deleting the account in the app, as App Review requires. Accounts made
/// with Apple or Google have no password, so their email confirms instead.
struct DeleteAccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var email = ""
    @State private var confirm = ""
    @State private var busy = false
    @State private var error: String?
    @State private var manageSubscription = false

    private var usesPassword: Bool { model.workspace?.signIn?.password ?? true }
    private var ready: Bool {
        confirm.trimmingCharacters(in: .whitespaces).uppercased() == "DELETE"
            && (usesPassword ? !password.isEmpty : email.contains("@"))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("This permanently deletes your restaurant and everything in it: dishes, photos, menus, specials and posts. Your public menu pages stop working and you’re signed out everywhere. It can’t be undone.")
                        .font(.callout)
                }
                if model.billing?.provider == "app_store", model.billing?.cancelAtPeriodEnd == false {
                    Section {
                        Text("Your Pro subscription renews through the App Store. Turn it off first; Apple keeps billing until you do.")
                            .font(.callout)
                        Button("Manage subscription") { manageSubscription = true }
                    }
                }
                Section {
                    if usesPassword {
                        SecureField("Password", text: $password)
                            .textContentType(.password)
                    } else {
                        TextField("Your account’s email", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    TextField("Type DELETE to confirm", text: $confirm)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
                if let error {
                    Section { Text(error).foregroundStyle(Palette.danger) }
                }
                Section {
                    Button(role: .destructive) {
                        Task { await delete() }
                    } label: {
                        if busy { ProgressView() } else { Text("Delete account permanently") }
                    }
                    .disabled(!ready || busy)
                }
            }
            .navigationTitle("Delete account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", role: .cancel) { dismiss() } }
            }
            .manageSubscriptionsSheet(isPresented: $manageSubscription)
        }
    }

    private func delete() async {
        busy = true
        defer { busy = false }
        error = nil
        do {
            let request = usesPassword ? DeleteAccountRequest(password: password) : DeleteAccountRequest(email: email)
            let _: OK = try await model.client.post("account/delete", request)
            dismiss()
            model.forgetSession()
        } catch let failure as APIError {
            error = failure.message
        } catch {}
    }
}

private struct AboutView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            Section {
                LabeledContent("Version", value: model.client.appVersion)
            }
            Section("Credits") {
                Text("The welcome example is an AI edit of “Burger” by cyclonebill on Wikimedia Commons, shared under CC BY-SA 2.0, as is the edit.")
                    .font(.footnote)
                Link("CC BY-SA 2.0", destination: URL(string: "https://creativecommons.org/licenses/by-sa/2.0/")!)
                    .font(.footnote)
            }
        }
        .scrollContentBackground(.hidden)
        .canvasBackground()
        .navigationTitle("About")
    }
}

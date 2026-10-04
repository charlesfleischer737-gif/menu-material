import MenuMaterialKit
import SwiftUI
import UserNotifications

/// The restaurant, its plan, notifications, help, and leaving, laid out
/// like Settings.
struct AccountView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var showPlans = false
    @State private var showRename = false
    @State private var showPreferences = false
    @State private var showDelete = false
    @State private var confirmSignOut = false
    @State private var notifications: UNAuthorizationStatus = .notDetermined

    private var isPro: Bool { model.billing?.isPro == true }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    profile
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                Section {
                    Button {
                        showPlans = true
                    } label: {
                        planRow
                    }
                    .accessibilityIdentifier("plan-row")
                }

                Section {
                    Button {
                        showRename = true
                    } label: {
                        SettingsRow(symbol: "storefront.fill", color: .indigo, title: "Restaurant Name", value: model.restaurant?.name)
                    }
                    Button { showPreferences = true } label: {
                        SettingsRow(symbol: "slider.horizontal.3", color: Palette.accent, title: "Restaurant Preferences")
                    }
                    NavigationLink { ExploreStylesView(studio: model.studio) } label: {
                        SettingsRow(symbol: "paintpalette.fill", color: Palette.accent, title: "Restaurant Look")
                    }
                    notificationsRow
                }

                Section {
                    Link(destination: model.client.server) {
                        SettingsRow(symbol: "safari.fill", color: .blue, title: "Menu Builder and Post Maker", external: true)
                    }
                } header: { Group {
                    Text("On the Web")
                }.foregroundStyle(Palette.muted) } footer: { Group {
                    Text("Design menus, posts and campaigns on menumaterial.com with the same account.")
                }.foregroundStyle(Palette.muted) }

                Section {
                    if let support = model.config?.links.support.flatMap({ URL(string: $0) }) {
                        Link(destination: support) {
                            SettingsRow(symbol: "envelope.fill", color: .green, title: "Contact Support", external: true)
                        }
                    }
                    if let terms = model.config?.links.terms.flatMap({ URL(string: $0) }) {
                        Link(destination: terms) {
                            SettingsRow(symbol: "doc.text.fill", color: .gray, title: "Terms", external: true)
                        }
                    }
                    if let privacy = model.config?.links.privacy.flatMap({ URL(string: $0) }) {
                        Link(destination: privacy) {
                            SettingsRow(symbol: "hand.raised.fill", color: .blue, title: "Privacy Policy", external: true)
                        }
                    }
                    NavigationLink {
                        AboutView()
                    } label: {
                        SettingsRow(symbol: "info", color: .gray, title: "About")
                    }
                }

                Section {
                    Button("Sign Out") { confirmSignOut = true }
                        .frame(maxWidth: .infinity)
                }
                Section {
                    Button("Delete Account", role: .destructive) { showDelete = true }.foregroundStyle(Palette.danger)
                        .frame(maxWidth: .infinity)
                } footer: { Group {
                    Text("Deletes your restaurant, dishes, photos and menus for good.")
                        .frame(maxWidth: .infinity)
                }.foregroundStyle(Palette.muted) }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Account")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showPlans) { PlansView() }
            .sheet(isPresented: $showPreferences) { RestaurantOnboardingView(editing: true) }
            .sheet(isPresented: $showRename) { RenameRestaurantView() }
            .sheet(isPresented: $showDelete) { DeleteAccountView() }
            .confirmationDialog("Sign out of Menu Material?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) { Task { await model.signOut() } }
            } message: {
                Text("Submitted photos and restaurant data stay in your account. Unsent photo drafts, dish edits and post drafts saved only on this device will be removed.")
            }
            .task { await readNotifications() }
        }
    }

    private var profile: some View {
        VStack(spacing: 10) {
            RestaurantAvatar(name: model.restaurant?.name ?? "Menu Material")
            VStack(spacing: 3) {
                Text(model.restaurant?.name ?? "Your restaurant")
                    .font(.title2.bold())
                    .foregroundStyle(Palette.ink)
                Text(model.user?.email ?? "")
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var planRow: some View {
        HStack(spacing: 14) {
            Image(systemName: "sparkles")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(
                    LinearGradient(
                        colors: [Palette.actionFill, Palette.darkSurface],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    in: .rect(cornerRadius: 11)
                )
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(isPro ? "Menu Material Pro" : "Free Plan")
                        .font(.headline)
                        .foregroundStyle(Palette.ink)
                    if isPro { ProBadge() }
                }
                Text("\(model.workspace?.remaining ?? 0) images left")
                    .font(.subheadline)
                    .foregroundStyle(Palette.muted)
            }
            Spacer()
            Text(isPro ? "Manage" : "Upgrade")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.accent)
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var notificationsRow: some View {
        switch notifications {
        case .authorized, .provisional, .ephemeral:
            SettingsRow(symbol: "bell.badge.fill", color: .red, title: "Photo Ready Alerts", value: "On")
        case .denied:
            Button {
                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            } label: {
                SettingsRow(symbol: "bell.slash.fill", color: .red, title: "Photo Ready Alerts", value: "Off")
            }
        default:
            Button {
                Task {
                    await model.askForNotifications()
                    await readNotifications()
                }
            } label: {
                SettingsRow(symbol: "bell.badge.fill", color: .red, title: "Photo Ready Alerts", value: "Turn On")
            }
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
                Section {
                    TextField("Restaurant name", text: $name, prompt: Text("Restaurant name").foregroundStyle(Palette.muted))
                        .textInputAutocapitalization(.words)
                } footer: { Group {
                    Text("Live menus keep their current name until you publish them again on menumaterial.com.")
                }.foregroundStyle(Palette.muted) }
                if let error { Section { Text(error).foregroundStyle(Palette.danger) } }
            }
            .navigationTitle("Restaurant Name")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
                ToolbarItem(placement: .confirmationAction) { Group {
                    Button("Save", systemImage: "checkmark") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).count < 2)
                }.buttonStyle(.plain).tint(Palette.accent) }.sharedBackgroundVisibility(.hidden)
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
                    VStack(alignment: .leading, spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title)
                            .foregroundStyle(Palette.danger)
                        Text("This permanently deletes your restaurant and everything in it: dishes, photos, menus, specials and posts. Your public menu pages stop working and you’re signed out everywhere. It can’t be undone.")
                            .font(.callout)
                    }
                    .padding(.vertical, 4)
                }
                if model.billing?.provider == "app_store", model.billing?.cancelAtPeriodEnd == false {
                    Section {
                        Text("Your Pro subscription renews through the App Store. Turn it off first; Apple keeps billing until you do.")
                            .font(.callout)
                        Button("Manage Subscription") { manageSubscription = true }
                    }
                }
                Section {
                    if usesPassword {
                        SecureField("Password", text: $password, prompt: Text("Password").foregroundStyle(Palette.muted))
                            .textContentType(.password)
                    } else {
                        TextField("Your account’s email", text: $email, prompt: Text("Your account’s email").foregroundStyle(Palette.muted))
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    TextField("Type DELETE to confirm", text: $confirm, prompt: Text("Type DELETE to confirm").foregroundStyle(Palette.muted))
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
                        if busy { ProgressView() } else { Text("Delete Account Permanently") }
                    }
                    .frame(maxWidth: .infinity)
                    .disabled(!ready || busy)
                }
            }
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Cancel", systemImage: "xmark", role: .cancel) { dismiss() }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
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
                VStack(spacing: 12) {
                    Image("BrandMark")
                        .renderingMode(.template)
                        .resizable()
                        .scaledToFit()
                        .frame(height: 40)
                        .foregroundStyle(Palette.accent)
                    Text("Menu Material")
                        .font(.title3.bold())
                    Text("Version \(model.client.appVersion)")
                        .font(.subheadline)
                        .foregroundStyle(Palette.muted)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .listRowBackground(Color.clear)
            }
            Section {
                Text("The welcome example is an AI edit of “Burger” by cyclonebill on Wikimedia Commons, shared under CC BY-SA 2.0, as is the edit.")
                    .font(.footnote)
                Link("CC BY-SA 2.0", destination: URL(string: "https://creativecommons.org/licenses/by-sa/2.0/")!)
                    .font(.footnote)
            } header: { Text("Credits").foregroundStyle(Palette.muted) }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("About")
    }
}

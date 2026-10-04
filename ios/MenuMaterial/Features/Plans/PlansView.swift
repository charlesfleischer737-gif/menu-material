import MenuMaterialKit
import StoreKit
import SwiftUI

/// Menu Material Pro, bought with the App Store. The purchase names the
/// restaurant (appAccountToken) and is confirmed by the server with Apple
/// before Pro unlocks.
struct PlansView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.purchase) private var purchase
    @State private var buying = false
    @State private var restoring = false
    @State private var message: String?
    @State private var error: String?
    @State private var manage = false
    @State private var celebrate = 0

    private var store: StoreModel { model.store }
    private var billing: BillingSummary? { model.billing }
    private var isPro: Bool { billing?.features?.unlocked == true && billing?.features?.source != "free" }
    private var images: Int { model.config?.billing.imagesPerPeriod ?? 50 }
    private var price: String { store.product?.displayPrice ?? model.config?.billing.priceLabel ?? "$9" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 34) {
                    hero
                    features
                    if isPro { current }
                    if let message {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .font(.callout.weight(.medium))
                            .foregroundStyle(Palette.glow)
                            .multilineTextAlignment(.center)
                    }
                    if let error { ErrorNote(message: error) }
                    legal
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
            .scrollIndicators(.hidden)
            .bottomBar {
                if !isPro { buy }
            }
            .background(Palette.darkSurface.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Group {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }.buttonStyle(.plain).tint(Palette.ink) }.sharedBackgroundVisibility(.hidden)
            }
            .manageSubscriptionsSheet(isPresented: $manage)
            .sensoryFeedback(.success, trigger: celebrate)
            .task {
                if let productId = model.config?.billing.productId {
                    await store.load(productId: productId)
                }
            }
        }
        .preferredColorScheme(.dark)
        .environment(\.colorScheme, .dark)
        .tint(Palette.glow)
    }

    private var hero: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(Palette.glow.opacity(0.18))
                    .frame(width: 104, height: 104)
                    .blur(radius: 18)
                BrandMark(height: 46)
                    .foregroundStyle(.white)
                    .frame(width: 88, height: 88)
                    .glassEffect(.regular.tint(Palette.glow.opacity(0.25)), in: .circle)
            }
            VStack(spacing: 10) {
                HStack(spacing: 8) {
                    Text("Menu Material")
                        .font(.display(.largeTitle))
                    ProBadge()
                }
                .foregroundStyle(.white)
                Text("Studio-quality food photography every week, and everything that makes your restaurant look its best.")
                    .font(.body)
                    .foregroundStyle(Palette.onDarkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let billing {
                Text(billing.isPro
                     ? "\(billing.remaining) of \(billing.allowance) Pro images left this month"
                     : "\(billing.remaining) free images left")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Palette.onDarkMuted)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Palette.darkSurface, in: .capsule)
            }
        }
        .padding(.top, 8)
    }

    private var features: some View {
        VStack(alignment: .leading, spacing: 22) {
            feature("sparkles", .orange, "\(images) new images every month", "Full quality, in every look and size.")
            feature("wand.and.stars", .pink, "Food Fantasy looks", "Exaggerated food art that stops the scroll.")
            feature("paintpalette.fill", .purple, "Your look on everything", "Your colors, fonts and photo style on new photos, menus and posts.")
            feature("menucard.fill", .blue, "Every menu and post design", "Up to 30 live menus, with a photo for every dish.")
            feature("chart.bar.fill", .teal, "Full menu insights", "Orders, calls and directions taps, by menu and QR code.")
            feature("checkmark.seal.fill", .green, "No “Made with Menu Material”", "Your guest menus are all yours.")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func feature(_ symbol: String, _ color: Color, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 40, height: 40)
                .background(Palette.darkSurface, in: .rect(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(Palette.onDarkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// The price and the subscribe button, pinned to the bottom.
    @ViewBuilder
    private var buy: some View {
        VStack(spacing: 12) {
            if let reason = store.state?.blockedReason {
                Text(reason)
                    .font(.callout)
                    .foregroundStyle(Palette.onDarkMuted)
                    .multilineTextAlignment(.center)
            } else if let product = store.product {
                subscribeButton { Task { await subscribe(product) } }
                    .disabled(buying || store.state?.canPurchase == false)
            } else if model.isDemo {
                // The sample restaurant has no App Store product to buy.
                subscribeButton {}
            } else if store.productUnavailable || model.config?.billing.appStore == false {
                Text(model.config?.billing.appStore == false ? "Pro in the app is coming soon. Your free account is ready to use." : "The subscription couldn’t load. You can keep using your account and try again.")
                    .font(.callout)
                    .foregroundStyle(Palette.onDarkMuted)
                    .multilineTextAlignment(.center)
            } else {
                ProgressView().frame(height: 52)
            }
            if let loadError = store.error {
                Text(loadError).font(.footnote).foregroundStyle(.white)
                Button("Retry Plans") { Task { if let id = model.config?.billing.productId { await store.load(productId: id) } } }.font(.footnote.bold())
            }
            Button {
                Task { await restore() }
            } label: {
                if restoring { ProgressView() } else { Text("Restore Purchases") }
            }
            .font(.footnote.weight(.semibold))
            .foregroundStyle(Palette.onDarkMuted)
            .disabled(restoring)
        }
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 6)
        .background(Palette.darkSurface)
    }

    private func subscribeButton(_ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                if buying {
                    ProgressView()
                } else {
                    Text("Subscribe for \(price)/month")
                        .font(.headline)
                    Text("Cancel anytime")
                        .font(.caption)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .primaryAction()
        .tint(Palette.accent)
    }

    @ViewBuilder
    private var current: some View {
        VStack(spacing: 10) {
            Label("You’re on Pro", systemImage: "checkmark.seal.fill")
                .font(.headline)
                .foregroundStyle(Palette.glow)
            if let renewal = billing?.renewalDate {
                Text("\(billing?.cancelAtPeriodEnd == true ? "Ends" : "Images renew") \(renewal.formatted(date: .abbreviated, time: .omitted)).")
                    .font(.callout)
                    .foregroundStyle(Palette.onDarkMuted)
            }
            if billing?.provider == "app_store" {
                Button("Manage Subscription") { manage = true }
                    .secondaryAction()
            } else if billing?.provider == "stripe" {
                Text("Billed on menumaterial.com. Manage it there, under Plans.")
                    .font(.callout)
                    .foregroundStyle(Palette.onDarkMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Palette.darkSurface, in: .rect(cornerRadius: Metrics.cardRadius))
    }

    @ViewBuilder
    private var legal: some View {
        VStack(spacing: 10) {
            Text("Pro is \(price) a month for \(images) images each month, and renews automatically until you cancel. Payment is charged to your Apple Account. Cancel anytime in Settings, under your name, then Subscriptions, at least 24 hours before it renews. Unused images don’t roll over.")
                .multilineTextAlignment(.center)
            HStack(spacing: 18) {
                if let terms = URL(string: model.config?.links.terms ?? "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/") {
                    Link("Terms of Use", destination: terms)
                }
                if let privacy = model.config?.links.privacy.flatMap({ URL(string: $0) }) {
                    Link("Privacy Policy", destination: privacy)
                }
            }
            .font(.caption.weight(.semibold))
        }
        .font(.caption)
        .foregroundStyle(Palette.onDarkMuted)
    }

    private func subscribe(_ product: Product) async {
        guard let state = store.state, let token = UUID(uuidString: state.appAccountToken) else {
            error = "Plans couldn’t load. Close this and try again."
            return
        }
        buying = true
        defer { buying = false }
        error = nil
        do {
            let result = try await purchase(product, options: [.appAccountToken(token)])
            switch result {
            case .success(let verification):
                if await store.deliver(verification) {
                    celebrate += 1
                    message = "Welcome to Pro. Your \(images) images are ready."
                } else {
                    message = "Your purchase is awaiting confirmation. Use Restore Purchases to check again."
                }
            case .pending:
                message = "Your purchase is waiting for approval. Pro unlocks as soon as it’s approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = "The purchase could not be confirmed. Check your App Store subscriptions before trying again."
        }
    }

    private func restore() async {
        restoring = true
        defer { restoring = false }
        error = nil
        do {
            try await store.restore()
            await model.refresh()
            message = isPro ? "Pro restored." : "No Pro subscription was found for this Apple Account."
        } catch {
            self.error = error.localizedDescription
        }
    }
}

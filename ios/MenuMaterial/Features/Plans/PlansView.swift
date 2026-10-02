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

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    hero
                    features
                    if isPro { current } else { buy }
                    if let message {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Palette.accent)
                    }
                    if let error { ErrorNote(message: error) }
                    legal
                }
                .padding(Metrics.gutter)
            }
            .canvasBackground()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .manageSubscriptionsSheet(isPresented: $manage)
            .sensoryFeedback(.success, trigger: celebrate)
            .task {
                if let productId = model.config?.billing.productId {
                    await store.load(productId: productId)
                }
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                BrandMark(height: 18)
                ProBadge()
            }
            .foregroundStyle(Palette.accent)
            Text("Keep your restaurant looking its best, every week.")
                .font(.display(32))
                .foregroundStyle(Palette.ink)
                .fixedSize(horizontal: false, vertical: true)
            if let billing {
                Text(billing.isPro
                     ? "\(billing.remaining) of \(billing.allowance) Pro images left this month."
                     : "\(billing.remaining) free images left.")
                    .font(.callout)
                    .foregroundStyle(Palette.muted)
            }
        }
    }

    private var features: some View {
        VStack(alignment: .leading, spacing: 14) {
            feature("sparkles", "\(images) new images every month", "Full quality, every look and size.")
            feature("wand.and.stars", "Food Fantasy looks", "Exaggerated food art that stops the scroll.")
            feature("paintpalette", "Your restaurant look on everything", "Colors, fonts and photo style on new photos, menus and posts.")
            feature("menucard", "Every menu and post design", "Up to 30 live menus, with a photo for every dish.")
            feature("chart.bar", "Full menu insights", "Orders, calls and directions taps, by menu and QR code.")
            feature("checkmark.seal", "No “Made with Menu Material” credit", "Your guest menus are all yours.")
        }
        .card()
    }

    private func feature(_ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(Palette.accent)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Palette.ink)
                Text(detail).font(.footnote).foregroundStyle(Palette.muted)
            }
        }
    }

    @ViewBuilder
    private var buy: some View {
        VStack(spacing: 12) {
            if let reason = store.state?.blockedReason {
                Text(reason)
                    .font(.callout)
                    .foregroundStyle(Palette.muted)
            } else if let product = store.product {
                Button {
                    Task { await subscribe(product) }
                } label: {
                    if buying {
                        ProgressView().tint(Palette.onAction)
                    } else {
                        Text("Get Pro for \(product.displayPrice) a month")
                    }
                }
                .buttonStyle(.primary)
                .disabled(buying || store.state?.canPurchase == false)
            } else if store.productUnavailable || model.config?.billing.appStore == false {
                Text("Pro in the app is coming soon. Your free account is ready to use.")
                    .font(.callout)
                    .foregroundStyle(Palette.muted)
            } else {
                ProgressView()
            }
            Button {
                Task { await restore() }
            } label: {
                if restoring { ProgressView() } else { Text("Restore purchases") }
            }
            .font(.callout.weight(.medium))
            .disabled(restoring)
        }
    }

    @ViewBuilder
    private var current: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("You’re on Pro", systemImage: "checkmark.seal.fill")
                .font(.headline)
                .foregroundStyle(Palette.accent)
            if let renewal = billing?.renewalDate {
                Text("\(billing?.cancelAtPeriodEnd == true ? "Ends" : "Images renew") \(renewal.formatted(date: .abbreviated, time: .omitted)).")
                    .font(.callout)
                    .foregroundStyle(Palette.muted)
            }
            if billing?.provider == "app_store" {
                Button("Manage subscription") { manage = true }
                    .buttonStyle(.secondary)
            } else if billing?.provider == "stripe" {
                Text("Billed on menumaterial.com. Manage it there, under Plans.")
                    .font(.callout)
                    .foregroundStyle(Palette.muted)
            }
        }
        .card()
    }

    @ViewBuilder
    private var legal: some View {
        let price = store.product?.displayPrice ?? model.config?.billing.priceLabel ?? "$9"
        VStack(alignment: .leading, spacing: 8) {
            Text("Pro is \(price) a month for \(images) images each month, and renews automatically until you cancel. Payment is charged to your Apple Account. Cancel anytime in Settings, under your name, then Subscriptions, at least 24 hours before it renews. Unused images don’t roll over.")
            HStack(spacing: 16) {
                if let terms = URL(string: model.config?.links.terms ?? "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/") {
                    Link("Terms of Use", destination: terms)
                }
                if let privacy = model.config?.links.privacy.flatMap({ URL(string: $0) }) {
                    Link("Privacy Policy", destination: privacy)
                }
            }
            .font(.footnote.weight(.medium))
        }
        .font(.footnote)
        .foregroundStyle(Palette.muted)
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
                    message = "Your purchase went through. Pro can take a minute to appear; pull to refresh or reopen Plans."
                }
            case .pending:
                message = "Your purchase is waiting for approval. Pro unlocks as soon as it’s approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = "The App Store couldn’t complete the purchase. You haven’t been charged."
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
            self.error = "The App Store couldn’t restore purchases. Try again in a moment."
        }
    }
}

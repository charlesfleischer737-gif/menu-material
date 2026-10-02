import Foundation
import MenuMaterialKit
import Observation
import StoreKit

/// Pro through the App Store. Each purchase names the restaurant as its
/// appAccountToken; the server confirms it with Apple before anything
/// unlocks (lib/server/app-store.ts), and only then is the transaction
/// finished.
@Observable
final class StoreModel {
    private(set) var product: Product?
    private(set) var state: AppStoreState?
    private(set) var productUnavailable = false
    /// Called after a purchase is confirmed, so the workspace shows Pro.
    var onChange: (() async -> Void)?
    private let client: APIClient
    private var updates: Task<Void, Never>?

    init(client: APIClient) {
        self.client = client
    }

    func load(productId: String) async {
        if product?.id != productId {
            product = try? await Product.products(for: [productId]).first
            productUnavailable = product == nil
        }
        state = try? await client.get("billing/app-store")
    }

    /// Purchases and renewals that arrive outside a purchase sheet: Ask to
    /// Buy approvals, renewals while the app was closed, other devices.
    func listenForTransactions() {
        guard updates == nil else { return }
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.deliver(result)
            }
        }
    }

    /// Confirms a transaction with the server, then finishes it. A
    /// transaction the server can't use (another account's, or unknown to
    /// Apple's server yet) is left for StoreKit to deliver again, except one
    /// that belongs to another restaurant, which will never be this one's.
    @discardableResult
    func deliver(_ result: VerificationResult<Transaction>) async -> Bool {
        guard case .verified(let transaction) = result,
              transaction.productType == .autoRenewable,
              client.sessionToken != nil else { return false }
        do {
            state = try await client.post(
                "billing/app-store/verify",
                TransactionRequest(transactionId: String(transaction.id))
            )
            await transaction.finish()
            await onChange?()
            return true
        } catch let error as APIError where error.status == 409 {
            await transaction.finish()
            return false
        } catch {
            return false
        }
    }

    /// Restore purchases: ask the App Store for this Apple Account's
    /// subscriptions and confirm each with the server.
    func restore() async throws {
        try await AppStore.sync()
        await verifyCurrentEntitlements()
        state = try? await client.get("billing/app-store")
    }

    func verifyCurrentEntitlements() async {
        for await result in Transaction.currentEntitlements {
            await deliver(result)
        }
    }
}

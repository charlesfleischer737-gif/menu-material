import Foundation

/// `GET /api/native/config`: what the server offers before anyone signs in.
public struct NativeConfig: Decodable, Sendable, Equatable {
    public struct SignIn: Decodable, Sendable, Equatable {
        public let apple: Bool
        /// The Google iOS client ID, when Google sign-in is on.
        public let google: String?
    }

    public struct Billing: Decodable, Sendable, Equatable {
        public let appStore: Bool
        public let productId: String
        public let priceLabel: String
        public let imagesPerPeriod: Int
    }

    public struct Links: Decodable, Sendable, Equatable {
        public let support: String?
        public let terms: String?
        public let privacy: String?
    }

    public let minimumVersion: String?
    public let signIn: SignIn
    public let billing: Billing
    public let links: Links
}

/// What a sign-in route answers: the app's tokens, or the next step for a
/// new Apple or Google sign-in ("signup" asks for the restaurant's name,
/// "link" for the existing account's password).
public struct AuthReply: Decodable, Sendable, Equatable {
    public let token: String?
    public let deviceToken: String?
    public let step: String?
    public let email: String?

    public var signedIn: Bool { token != nil }
}

/// `POST /api/auth/apple/start` and `/api/auth/google/start`.
public struct AuthFlowStart: Decodable, Sendable, Equatable {
    public let nonce: String
    public let flow: String
    /// Google only: the client the app signs in with.
    public let clientId: String?
}

public struct EmailVerification: Decodable, Sendable, Equatable {
    public let required: Bool
    public let email: String?
    public let verifiedAt: Double?
    public let sent: Bool?
    public let resendAfter: Int?
}

public struct SignInMethods: Decodable, Sendable, Equatable {
    public let password: Bool
    public let google: Bool
    public let apple: Bool
}

public struct User: Decodable, Sendable, Equatable {
    public let id: String
    public let email: String
    public let role: String?
}

/// Pro features, separate from Pro images (lib/server/entitlements.ts).
public struct FeatureAccess: Decodable, Sendable, Equatable {
    public let pro: Bool
    /// "paid", "renewing", "grace", "comp" or "free".
    public let source: String?
    public let unlocked: Bool
}

/// The restaurant's plan and image balance (`billingSummary`).
public struct BillingSummary: Decodable, Sendable, Equatable {
    /// "free" or "pro".
    public let plan: String
    public let allowance: Int
    public let remaining: Int
    /// When this paid period's images renew, in milliseconds since 1970.
    public let renewsAt: Double?
    /// Whether Stripe billing is on, for the web.
    public let enabled: Bool?
    public let status: String?
    /// "app_store", "stripe" or nil.
    public let provider: String?
    public let cancelAtPeriodEnd: Bool?
    public let features: FeatureAccess?

    public var isPro: Bool { plan == "pro" }
    public var renewalDate: Date? { renewsAt.map { Date(timeIntervalSince1970: $0 / 1000) } }
}

/// `GET /api/billing/app-store`: buying Pro in the app.
public struct AppStoreState: Decodable, Sendable, Equatable {
    public struct Subscription: Decodable, Sendable, Equatable {
        public let status: String
        public let autoRenew: Bool
        public let expiresAt: Double?
        public let environment: String?
    }

    public let enabled: Bool
    public let productId: String
    /// The restaurant's ID, passed to StoreKit as the purchase's appAccountToken.
    public let appAccountToken: String
    public let canPurchase: Bool
    public let blockedReason: String?
    public let subscription: Subscription?
    public let billing: BillingSummary
}

// Request bodies.

public struct LoginRequest: Encodable, Sendable {
    public let email: String
    public let password: String
    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

public struct SignupRequest: Encodable, Sendable {
    public let email: String
    public let password: String
    public let restaurant: String
    public let timezone: String
    public init(email: String, password: String, restaurant: String, timezone: String) {
        self.email = email
        self.password = password
        self.restaurant = restaurant
        self.timezone = timezone
    }
}

public struct AppleCredentialRequest: Encodable, Sendable {
    public let identityToken: String
    public let authorizationCode: String?
    public init(identityToken: String, authorizationCode: String?) {
        self.identityToken = identityToken
        self.authorizationCode = authorizationCode
    }
}

public struct GoogleCredentialRequest: Encodable, Sendable {
    public let credential: String
    public init(credential: String) { self.credential = credential }
}

/// Finishing an Apple or Google sign-in: a new restaurant's name, or the
/// existing account's password.
public struct CompleteSignInRequest: Encodable, Sendable {
    public let restaurant: String?
    public let password: String?
    public let timezone: String
    public init(restaurant: String? = nil, password: String? = nil, timezone: String) {
        self.restaurant = restaurant
        self.password = password
        self.timezone = timezone
    }
}

public struct EmailRequest: Encodable, Sendable {
    public let email: String
    public init(email: String) { self.email = email }
}

public struct CodeRequest: Encodable, Sendable {
    public let code: String
    public init(code: String) { self.code = code }
}

public struct DeleteAccountRequest: Encodable, Sendable {
    public let confirm = "DELETE"
    public let password: String?
    public let email: String?
    public init(password: String? = nil, email: String? = nil) {
        self.password = password
        self.email = email
    }
}

public struct TransactionRequest: Encodable, Sendable {
    public let transactionId: String
    public init(transactionId: String) { self.transactionId = transactionId }
}

public struct DeviceRegistration: Encodable, Sendable {
    public let token: String
    public let environment: String
    public init(token: String, environment: String) {
        self.token = token
        self.environment = environment
    }
}

public struct LiveActivityRegistration: Encodable, Sendable {
    public let jobId: String
    public let token: String
    public let environment: String
    public init(jobId: String, token: String, environment: String) {
        self.jobId = jobId
        self.token = token
        self.environment = environment
    }
}

public struct RenameRequest: Encodable, Sendable {
    public let name: String
    public init(name: String) { self.name = name }
}

/// Google's token endpoint answer; only the ID token is used.
public struct GoogleTokenReply: Decodable, Sendable {
    public let idToken: String?

    enum CodingKeys: String, CodingKey {
        case idToken = "id_token"
    }
}

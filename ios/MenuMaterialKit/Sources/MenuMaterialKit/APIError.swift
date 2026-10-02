import Foundation

/// What went wrong with a request: the server's own message, or that it
/// couldn't be reached. Messages are written for people and shown as they are.
public struct APIError: Error, LocalizedError, Equatable, Sendable {
    /// The HTTP status, or 0 when the server couldn't be reached.
    public let status: Int
    public let message: String
    /// A machine-readable kind, such as "pro_required" or "update_required".
    public let code: String?
    /// For "pro_required": the Pro feature that was asked for.
    public let feature: String?

    public init(status: Int, message: String, code: String? = nil, feature: String? = nil) {
        self.status = status
        self.message = message
        self.code = code
        self.feature = feature
    }

    public var errorDescription: String? { message }

    /// A newer app is needed (the server's IOS_MIN_VERSION).
    public var updateRequired: Bool { code == "update_required" || status == 426 }
    /// The request needs Pro; `feature` names which part.
    public var proRequired: Bool { code == "pro_required" }
    /// New password accounts confirm their email before making images.
    public var emailVerificationRequired: Bool { code == "email_verification_required" }
    /// The session ended; sign in again.
    public var signedOut: Bool { status == 401 }
    public var offline: Bool { status == 0 }

    public static let offlineError = APIError(
        status: 0,
        message: "Menu Material can’t be reached. Check your connection and try again."
    )

    /// The server's JSON error body: `{ "error": "…", "code": "…", "feature": "…" }`.
    public static func from(status: Int, data: Data) -> APIError {
        struct Body: Decodable {
            let error: String?
            let code: String?
            let feature: String?
        }
        let body = try? JSONDecoder().decode(Body.self, from: data)
        let fallback = status >= 500
            ? "Something went wrong on our side. Your work is saved; please try again."
            : "That didn’t work. Please try again."
        return APIError(
            status: status,
            message: body?.error ?? fallback,
            code: body?.code,
            feature: body?.feature
        )
    }
}

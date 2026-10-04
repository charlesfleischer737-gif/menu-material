import Foundation
#if canImport(Security)
import Security
#endif

/// A multipart/form-data body, as the photo upload route reads it.
public struct MultipartForm: Sendable {
    public let boundary: String
    private var body = Data()

    public init(boundary: String = "MenuMaterial-\(UUID().uuidString)") {
        self.boundary = boundary
    }

    public var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    public mutating func add(_ name: String, _ value: String) {
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".utf8))
        body.append(Data("\(value)\r\n".utf8))
    }

    public mutating func add(_ name: String, filename: String, contentType: String, data: Data) {
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".utf8))
        body.append(Data("Content-Type: \(contentType)\r\n\r\n".utf8))
        body.append(data)
        body.append(Data("\r\n".utf8))
    }

    public func encoded() -> Data {
        var data = body
        data.append(Data("--\(boundary)--\r\n".utf8))
        return data
    }
}

/// Dotted versions such as "1.2" and "1.10.0", compared number by number,
/// as the server compares them.
public enum AppVersion {
    public static func compare(_ a: String, _ b: String) -> ComparisonResult {
        let left = a.split(separator: ".").map { Int($0) ?? 0 }
        let right = b.split(separator: ".").map { Int($0) ?? 0 }
        for index in 0..<max(left.count, right.count) {
            let l = index < left.count ? left[index] : 0
            let r = index < right.count ? right[index] : 0
            if l != r { return l < r ? .orderedAscending : .orderedDescending }
        }
        return .orderedSame
    }
}

/// Menu prices are stored as integer hundredths of the menu's currency.
public enum Money {
    public static func format(hundredths: Int, currency: String, locale: Locale = .current) -> String {
        let amount = Decimal(hundredths) / 100
        return amount.formatted(.currency(code: currency.isEmpty ? "USD" : currency).locale(locale))
    }

    /// Reads what someone typed, such as "12.5" or "12,50", as hundredths.
    public static func hundredths(from text: String) -> Int? {
        let cleaned = text
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: #"^[\$€£¥]\s*"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: ",", with: ".")
        guard cleaned.range(of: #"^[0-9]+(?:\.[0-9]{1,2})?$"#, options: .regularExpression) != nil,
              let value = Decimal(string: cleaned) else { return nil }
        var scaled = value * 100
        var rounded = Decimal()
        NSDecimalRound(&rounded, &scaled, 0, .plain)
        let number = NSDecimalNumber(decimal: rounded)
        guard number.doubleValue >= 0, number.doubleValue < 100_000_000 else { return nil }
        return number.intValue
    }
}

/// The photo progress bar, as the web draws it (lib/creation-progress.ts):
/// an image call reports no progress, so the bar follows elapsed time
/// against how long recent images took. It fills evenly to 90% at that
/// time, then slows, and never completes on its own.
public struct RenderProgress: Equatable, Sendable {
    public let value: Double
    public let stage: String
    /// "About 30 seconds left", "Almost done", "Taking longer than usual", or "".
    public let time: String
    /// Waiting to start past ten seconds, or past the usual render time.
    public let late: Bool

    private static let started = 0.05, onTime = 0.9, ceiling = 0.98

    /// - Parameters:
    ///   - queuedFor: milliseconds since the image was requested.
    ///   - sentFor: milliseconds since it was sent for creation, or nil while it waits.
    ///   - typical: how long recent images like it took, in milliseconds.
    public init(queuedFor: Double, sentFor: Double?, typical: Double = 45000) {
        guard let sentFor else {
            let waited = max(0, queuedFor)
            value = Self.started * min(1, waited / 3000)
            stage = waited > 10000 ? "Waiting for the studio" : "Getting started"
            time = ""
            late = waited > 10000
            return
        }
        let elapsed = max(0, sentFor)
        let share = elapsed / max(1, typical)
        let left = typical - elapsed
        value = share <= 1
            ? Self.started + (Self.onTime - Self.started) * share
            : Self.onTime + (Self.ceiling - Self.onTime) * (1 - exp(-(share - 1) * 1.5))
        stage = "Creating your photo"
        time = left <= 0 ? "Taking longer than usual" : left <= 5000 ? "Almost done" : "About \(Self.duration(left)) left"
        late = left <= 0
    }

    /// To the nearest five seconds.
    static func duration(_ ms: Double) -> String {
        let seconds = Int((ms / 5000).rounded()) * 5
        if seconds < 60 { return "\(seconds) seconds" }
        if seconds < 90 { return "a minute" }
        return "\(Int((Double(seconds) / 60).rounded())) minutes"
    }
}

#if canImport(Security)
/// Small secrets (the session and device tokens) in the Keychain, readable
/// only on this device after it is first unlocked.
public struct KeychainStore: Sendable {
    public let service: String

    public init(service: String) {
        self.service = service
    }

    public func string(_ account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func set(_ value: String?, for account: String) {
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(match as CFDictionary)
        guard let value else { return }
        var item = match
        item[kSecValueData as String] = Data(value.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }
}
#endif

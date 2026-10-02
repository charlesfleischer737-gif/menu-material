import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case delete = "DELETE"
}

/// Sends requests. URLSession in the app; a stub in tests.
public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, URLResponse)
}

public struct URLSessionTransport: HTTPTransport {
    public let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        try await session.data(for: request)
    }
}

/// The app's connection to the Menu Material API. Every request names the
/// app and its version (the server turns away versions it no longer
/// supports) and carries the session in the Authorization header. Sign-in
/// routes also get the device token, so this phone's sign-ins aren't slowed.
@MainActor
public final class APIClient {
    public let server: URL
    public let appVersion: String
    public var sessionToken: String?
    public var deviceToken: String?
    /// The session ended on the server: sign in again.
    public var onSignedOut: (() -> Void)?
    /// The server needs a newer app.
    public var onUpdateRequired: (() -> Void)?
    private let transport: any HTTPTransport

    public init(server: URL, appVersion: String, transport: any HTTPTransport = URLSessionTransport()) {
        self.server = server
        self.appVersion = appVersion
        self.transport = transport
    }

    /// A request to `/api/<path>`.
    public func request(
        _ method: HTTPMethod,
        _ path: String,
        query: [URLQueryItem] = [],
        body: Data? = nil,
        contentType: String = "application/json",
        flow: String? = nil
    ) -> URLRequest {
        var components = URLComponents(
            url: server.appending(path: "api/" + path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { components.queryItems = query }
        var request = URLRequest(url: components.url!)
        request.httpMethod = method.rawValue
        request.timeoutInterval = 60
        request.setValue("ios", forHTTPHeaderField: "X-Menu-Material-Client")
        request.setValue(appVersion, forHTTPHeaderField: "X-Menu-Material-Version")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let sessionToken {
            request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        }
        if path.hasPrefix("auth/"), let deviceToken {
            request.setValue(deviceToken, forHTTPHeaderField: "X-Menu-Material-Device")
        }
        if let flow {
            request.setValue(flow, forHTTPHeaderField: "X-Menu-Material-Auth-Flow")
        }
        if let body {
            request.httpBody = body
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    /// Sends a request and returns its body, or throws the server's error.
    public func send(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await transport.send(request)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw APIError.offlineError
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let error = APIError.from(status: status, data: data)
            if error.updateRequired {
                onUpdateRequired?()
            } else if error.signedOut, sessionToken != nil,
                      !(request.url?.path.contains("/api/auth/") ?? false) {
                onSignedOut?()
            }
            throw error
        }
        return data
    }

    public func get<T: Decodable>(
        _ path: String,
        query: [URLQueryItem] = [],
        as type: T.Type = T.self
    ) async throws -> T {
        try Self.decode(T.self, from: await send(request(.get, path, query: query)))
    }

    public func post<T: Decodable, Body: Encodable>(
        _ path: String,
        _ body: Body,
        flow: String? = nil,
        timeout: TimeInterval? = nil,
        as type: T.Type = T.self
    ) async throws -> T {
        let data = try JSONEncoder().encode(body)
        var post = request(.post, path, body: data, flow: flow)
        if let timeout { post.timeoutInterval = timeout }
        return try Self.decode(T.self, from: await send(post))
    }

    /// A POST with an empty JSON object, as the server's actions expect.
    public func post<T: Decodable>(
        _ path: String,
        flow: String? = nil,
        timeout: TimeInterval? = nil,
        as type: T.Type = T.self
    ) async throws -> T {
        try await post(path, EmptyBody(), flow: flow, timeout: timeout, as: T.self)
    }

    public func delete<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        try Self.decode(T.self, from: await send(request(.delete, path)))
    }

    public func upload<T: Decodable>(
        _ path: String,
        form: MultipartForm,
        as type: T.Type = T.self
    ) async throws -> T {
        var upload = request(.post, path, body: form.encoded(), contentType: form.contentType)
        upload.timeoutInterval = 120
        return try Self.decode(T.self, from: await send(upload))
    }

    /// The bytes of a private file, such as a photo: `/api/assets/<id>`.
    public func data(_ path: String, query: [URLQueryItem] = []) async throws -> Data {
        var download = request(.get, path, query: query)
        download.setValue("image/*", forHTTPHeaderField: "Accept")
        return try await send(download)
    }

    /// A public file the site serves, such as a style preview.
    public func publicURL(_ path: String) -> URL {
        server.appending(path: path.hasPrefix("/") ? String(path.dropFirst()) : path)
    }

    public static func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try JSONCoding.decoder().decode(T.self, from: data)
        } catch {
            throw APIError(
                status: 200,
                message: "Menu Material sent something this version of the app doesn’t understand. Update the app, or try again.",
                code: "decoding_failed"
            )
        }
    }
}

public struct EmptyBody: Codable, Sendable {
    public init() {}
}

/// `{ "ok": true }` and other answers whose body the app doesn't need.
public struct OK: Decodable, Sendable {
    public let ok: Bool?
}

public enum JSONCoding {
    /// The API mixes snake_case database columns with camelCase fields;
    /// converting from snake case reads both into Swift's camelCase names.
    public static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }
}

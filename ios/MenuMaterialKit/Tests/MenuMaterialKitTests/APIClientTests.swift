import Foundation
import Testing
@testable import MenuMaterialKit

/// Answers requests from a closure and remembers them.
final class StubTransport: HTTPTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var recorded: [URLRequest] = []
    private let answer: @Sendable (URLRequest) -> (Int, String)

    init(_ answer: @escaping @Sendable (URLRequest) -> (Int, String)) {
        self.answer = answer
    }

    var requests: [URLRequest] {
        lock.withLock { recorded }
    }

    func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        lock.withLock { recorded.append(request) }
        let (status, body) = answer(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        return (Data(body.utf8), response)
    }
}

@MainActor
struct APIClientTests {
    let server = URL(string: "https://menumaterial.example")!

    @Test func namesTheAppOnEveryRequest() {
        let client = APIClient(server: server, appVersion: "1.2.0")
        client.sessionToken = String(repeating: "a", count: 43)
        client.deviceToken = String(repeating: "d", count: 43)
        let state = client.request(.get, "state")
        #expect(state.url?.absoluteString == "https://menumaterial.example/api/state")
        #expect(state.value(forHTTPHeaderField: "X-Menu-Material-Client") == "ios")
        #expect(state.value(forHTTPHeaderField: "X-Menu-Material-Version") == "1.2.0")
        #expect(state.value(forHTTPHeaderField: "Authorization") == "Bearer \(String(repeating: "a", count: 43))")
        #expect(state.value(forHTTPHeaderField: "Origin") == nil)
        // The device token goes only to sign-in routes.
        #expect(state.value(forHTTPHeaderField: "X-Menu-Material-Device") == nil)
        let login = client.request(.post, "auth/login", body: Data("{}".utf8), flow: "flow-token")
        #expect(login.value(forHTTPHeaderField: "X-Menu-Material-Device") == String(repeating: "d", count: 43))
        #expect(login.value(forHTTPHeaderField: "X-Menu-Material-Auth-Flow") == "flow-token")
        #expect(login.value(forHTTPHeaderField: "Content-Type") == "application/json")
        let asset = client.request(.get, "assets/abc", query: [URLQueryItem(name: "original", value: "1")])
        #expect(asset.url?.absoluteString == "https://menumaterial.example/api/assets/abc?original=1")
        #expect(client.publicURL("/studio/styles/thumbs/menu-stone.webp").absoluteString
            == "https://menumaterial.example/studio/styles/thumbs/menu-stone.webp")
    }

    @Test func readsTheServersErrors() async {
        let transport = StubTransport { request in
            if request.url!.path.hasSuffix("/jobs") {
                return (402, #"{"error":"Food Fantasy creative styles are part of Pro.","code":"pro_required","feature":"foodFantasy"}"#)
            }
            return (500, "not json")
        }
        let client = APIClient(server: server, appVersion: "1.0", transport: transport)
        await #expect(throws: APIError(status: 402, message: "Food Fantasy creative styles are part of Pro.", code: "pro_required", feature: "foodFantasy")) {
            let _: OK = try await client.post("jobs")
        }
        do {
            let _: OK = try await client.get("state")
            Issue.record("Expected an error")
        } catch let error as APIError {
            #expect(error.status == 500)
            #expect(error.message.contains("Your work is saved"))
        } catch {
            Issue.record("Unexpected \(error)")
        }
    }

    @Test func endedSessionsAndOldVersionsAreReported() async {
        let transport = StubTransport { request in
            switch request.url!.path {
            case "/api/state": (401, #"{"error":"Sign in to your restaurant workspace."}"#)
            case "/api/auth/login": (401, #"{"error":"Email or password is incorrect."}"#)
            default: (426, #"{"error":"Update the app.","code":"update_required"}"#)
            }
        }
        let client = APIClient(server: server, appVersion: "0.9", transport: transport)
        client.sessionToken = String(repeating: "a", count: 43)
        var signedOut = 0
        var updates = 0
        client.onSignedOut = { signedOut += 1 }
        client.onUpdateRequired = { updates += 1 }
        let _: OK? = try? await client.get("state")
        #expect(signedOut == 1)
        // A wrong password isn't an ended session.
        let _: OK? = try? await client.post("auth/login", LoginRequest(email: "a@b.c", password: "x"))
        #expect(signedOut == 1)
        let _: OK? = try? await client.get("menus")
        #expect(updates == 1)
    }

    @Test func offlineReadsAsOffline() async {
        struct Failing: HTTPTransport {
            func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
                throw URLError(.notConnectedToInternet)
            }
        }
        let client = APIClient(server: server, appVersion: "1.0", transport: Failing())
        await #expect(throws: APIError.offlineError) {
            let _: OK = try await client.get("state")
        }
    }

    @Test func multipartCarriesFilesWithNames() {
        var form = MultipartForm(boundary: "B")
        form.add("file", filename: "photo.heic", contentType: "image/heic", data: Data([1, 2]))
        form.add("dishId", "dish-1")
        let body = String(decoding: form.encoded(), as: UTF8.self)
        #expect(form.contentType == "multipart/form-data; boundary=B")
        #expect(body.contains("Content-Disposition: form-data; name=\"file\"; filename=\"photo.heic\"\r\nContent-Type: image/heic\r\n\r\n"))
        #expect(body.contains("name=\"dishId\"\r\n\r\ndish-1\r\n"))
        #expect(body.hasSuffix("--B--\r\n"))
    }
}

struct SupportTests {
    @Test func comparesVersionsLikeTheServer() {
        #expect(AppVersion.compare("1.10", "1.9") == .orderedDescending)
        #expect(AppVersion.compare("1.2", "1.2.0") == .orderedSame)
        #expect(AppVersion.compare("1.1.9", "1.2") == .orderedAscending)
    }

    @Test func readsPrices() {
        #expect(Money.hundredths(from: "12.5") == 1250)
        #expect(Money.hundredths(from: "12,50") == 1250)
        #expect(Money.hundredths(from: " $9 ") == 900)
        #expect(Money.hundredths(from: "1.2.3") == nil)
        #expect(Money.hundredths(from: "") == nil)
        #expect(Money.format(hundredths: 1250, currency: "USD", locale: Locale(identifier: "en_US")) == "$12.50")
    }

    /// The same numbers lib/creation-progress.ts gives.
    @Test func progressMatchesTheWeb() {
        let starting = RenderProgress(queuedFor: 1500, sentFor: nil)
        #expect(abs(starting.value - 0.025) < 0.0001)
        #expect(starting.stage == "Getting started")
        #expect(starting.time.isEmpty)
        let waiting = RenderProgress(queuedFor: 12000, sentFor: nil)
        #expect(waiting.stage == "Waiting for the studio")
        #expect(waiting.late)
        let halfway = RenderProgress(queuedFor: 30000, sentFor: 22500, typical: 45000)
        #expect(abs(halfway.value - 0.475) < 0.0001)
        #expect(halfway.time == "About 25 seconds left")
        #expect(RenderProgress(queuedFor: 0, sentFor: 42000, typical: 45000).time == "Almost done")
        #expect(RenderProgress(queuedFor: 0, sentFor: 0, typical: 120000).time == "About 2 minutes left")
        #expect(RenderProgress(queuedFor: 0, sentFor: 0, typical: 70000).time == "About a minute left")
        let late = RenderProgress(queuedFor: 0, sentFor: 90000, typical: 45000)
        #expect(late.time == "Taking longer than usual")
        #expect(late.value > 0.9 && late.value < 0.98)
    }
}

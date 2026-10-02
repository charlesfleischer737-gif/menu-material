import AuthenticationServices
import CryptoKit
import Foundation
import MenuMaterialKit
import Observation
import Security
import SwiftUI

/// Sign in with Apple and Google for the app. Each starts a short-lived flow
/// on the server that carries a nonce (lib/server/apple-auth.ts and
/// google-auth.ts), so a token can only be used once, here.
@Observable
final class SignInFlows {
    /// The next step for a new Apple or Google sign-in.
    struct Pending: Identifiable, Equatable {
        enum Provider { case apple, google }
        let provider: Provider
        let flow: String
        let email: String
        /// "signup" asks for the restaurant's name; "link" for the password.
        let step: String
        var id: String { flow }
    }

    private(set) var appleFlow: AuthFlowStart?
    private var appleFlowStarted = Date.distantPast
    var pending: Pending?
    var error: String?
    var busy = false

    /// Fetched ahead of the button tap, because Sign in with Apple needs its
    /// nonce at once. Flows last ten minutes on the server.
    func prepareApple(_ client: APIClient) async {
        guard appleFlow == nil || Date().timeIntervalSince(appleFlowStarted) > 8 * 60 else { return }
        do {
            appleFlow = try await client.post("auth/apple/start")
            appleFlowStarted = Date()
        } catch {
            appleFlow = nil
        }
    }

    /// The nonce Apple signs: SHA-256 of the server's nonce, as hex.
    var appleNonce: String? {
        appleFlow.map { Self.sha256($0.nonce) }
    }

    func finishApple(
        _ result: Result<ASAuthorization, any Error>,
        model: AppModel
    ) async {
        guard let flow = appleFlow else { return }
        appleFlow = nil
        defer { Task { await self.prepareApple(model.client) } }
        switch result {
        case .failure(let failure):
            if (failure as? ASAuthorizationError)?.code != .canceled {
                error = "Sign in with Apple didn’t finish. Please try again."
            }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8) else {
                error = "Sign in with Apple didn’t finish. Please try again."
                return
            }
            let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            await run(model) {
                let reply: AuthReply = try await model.client.post(
                    "auth/apple/credential",
                    AppleCredentialRequest(identityToken: identityToken, authorizationCode: code),
                    flow: flow.flow
                )
                await self.handle(reply, provider: .apple, flow: flow.flow, model: model)
            }
        }
    }

    /// Google, through the system's web sign-in sheet with PKCE: the code
    /// comes back to the app's reversed client ID and is exchanged for an ID
    /// token, which carries the server's nonce.
    func signInWithGoogle(model: AppModel, session: WebAuthenticationSession) async {
        await run(model) {
            let flow: AuthFlowStart = try await model.client.post("auth/google/start")
            guard let clientId = flow.clientId,
                  let prefix = clientId.split(separator: ".").first else {
                throw APIError(status: 503, message: "Google sign-in isn’t available yet. Please use email and password.")
            }
            let scheme = "com.googleusercontent.apps.\(prefix)"
            let redirect = "\(scheme):/oauth2redirect"
            let verifier = Self.randomString()
            let state = Self.randomString()
            var components = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
            components.queryItems = [
                URLQueryItem(name: "client_id", value: clientId),
                URLQueryItem(name: "redirect_uri", value: redirect),
                URLQueryItem(name: "response_type", value: "code"),
                URLQueryItem(name: "scope", value: "openid email profile"),
                URLQueryItem(name: "nonce", value: flow.nonce),
                URLQueryItem(name: "state", value: state),
                URLQueryItem(name: "code_challenge", value: Self.challenge(verifier)),
                URLQueryItem(name: "code_challenge_method", value: "S256"),
                URLQueryItem(name: "prompt", value: "select_account"),
            ]
            let callback: URL
            do {
                callback = try await session.authenticate(using: components.url!, callbackURLScheme: scheme)
            } catch {
                return
            }
            let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            guard items.first(where: { $0.name == "state" })?.value == state,
                  let code = items.first(where: { $0.name == "code" })?.value else {
                throw APIError(status: 401, message: "Google sign-in didn’t finish. Please try again.")
            }
            let idToken = try await Self.exchange(code: code, clientId: clientId, redirect: redirect, verifier: verifier)
            let reply: AuthReply = try await model.client.post(
                "auth/google/credential",
                GoogleCredentialRequest(credential: idToken),
                flow: flow.flow
            )
            await self.handle(reply, provider: .google, flow: flow.flow, model: model)
        }
    }

    /// The restaurant's name for a new account, or the existing password.
    func complete(_ pending: Pending, restaurant: String? = nil, password: String? = nil, model: AppModel) async {
        await run(model) {
            let path = pending.provider == .apple ? "auth/apple/complete" : "auth/google/complete"
            let reply: AuthReply = try await model.client.post(
                path,
                CompleteSignInRequest(
                    restaurant: restaurant,
                    password: password,
                    timezone: TimeZone.current.identifier
                ),
                flow: pending.flow
            )
            if reply.signedIn {
                self.pending = nil
                await model.signedIn(reply)
            }
        }
    }

    private func handle(_ reply: AuthReply, provider: Pending.Provider, flow: String, model: AppModel) async {
        if reply.signedIn {
            await model.signedIn(reply)
        } else if let step = reply.step, let email = reply.email {
            pending = Pending(provider: provider, flow: flow, email: email, step: step)
        }
    }

    private func run(_ model: AppModel, _ work: () async throws -> Void) async {
        busy = true
        error = nil
        defer { busy = false }
        do {
            try await work()
        } catch let failure as APIError {
            error = failure.message
        } catch is CancellationError {
        } catch {
            self.error = "That didn’t work. Please try again."
        }
    }

    private static func exchange(code: String, clientId: String, redirect: String, verifier: String) async throws -> String {
        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "code_verifier", value: verifier),
            URLQueryItem(name: "grant_type", value: "authorization_code"),
            URLQueryItem(name: "redirect_uri", value: redirect),
        ]
        request.httpBody = Data((form.percentEncodedQuery ?? "").utf8)
        let (data, _) = try await URLSession.shared.data(for: request)
        guard let token = try? JSONDecoder().decode(GoogleTokenReply.self, from: data).idToken else {
            throw APIError(status: 401, message: "Google sign-in didn’t finish. Please try again.")
        }
        return token
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func challenge(_ verifier: String) -> String {
        Data(SHA256.hash(data: Data(verifier.utf8)))
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func randomString() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

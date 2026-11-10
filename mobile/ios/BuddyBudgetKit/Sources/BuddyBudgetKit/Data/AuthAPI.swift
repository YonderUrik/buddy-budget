import Foundation

/// Native sign-in with the emailed 6-digit code (better-auth `emailOTP`, spec: api/auth.md §3.1) and sign-out (§3.4).
/// Same name and methods as `AuthApi` on Android.
public struct AuthAPI: Sendable {
    let client: APIClient
    public init(client: APIClient) { self.client = client }

    /// Code validity and resend cooldown shown in the UI (auth.md §3.1; web `MAGIC_LINK_RESEND_COOLDOWN_SECONDS`).
    public static let codeValidityMinutes = 10
    public static let resendCooldownSeconds = 30
    public static let codeLength = 6

    struct SendBody: Encodable {
        let email: String
        let type = "sign-in"
    }

    struct VerifyBody: Encodable {
        let email: String
        let otp: String
    }

    struct VerifyResponse: Decodable {
        let token: String?
    }

    /// `POST /api/auth/email-otp/send-verification-otp`: always `{success:true}`, also for unknown addresses.
    public func sendCode(email: String) async throws {
        try await client.sendNoContent("api/auth/email-otp/send-verification-otp", method: "POST",
                                       body: SendBody(email: email))
    }

    /// `POST /api/auth/sign-in/email-otp`; stores the signed `set-auth-token` header verbatim (fallback `body.token`)
    /// in the session store and returns it. Errors: `INVALID_OTP`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`, 429.
    @discardableResult
    public func verifyCode(email: String, code: String) async throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let response = try await client.send("api/auth/sign-in/email-otp", method: "POST",
                                             body: try encoder.encode(VerifyBody(email: email, otp: code)))
        let header = response.header("set-auth-token")?.trimmingCharacters(in: .whitespaces)
        let bodyToken = try? JSONDecoder().decode(VerifyResponse.self, from: response.data).token
        guard let token = (header?.isEmpty == false ? header : nil) ?? bodyToken, !token.isEmpty else {
            throw APIError.decoding("sign-in response without token")
        }
        client.session.saveToken(token)
        return token
    }

    /// `POST /api/auth/sign-out` (best effort), then wipes the local token.
    public func signOut() async {
        _ = try? await client.send("api/auth/sign-out", method: "POST", body: Data("{}".utf8))
        client.session.clear()
    }
}

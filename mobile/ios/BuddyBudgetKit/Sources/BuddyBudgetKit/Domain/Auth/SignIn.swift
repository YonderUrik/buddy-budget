import Foundation

/// Input rules and error mapping of the email-code sign-in (AUTH-003, AUTH-007, api/auth.md §3.1).
/// Same names on Android (`SignIn`).
public enum SignIn {
    /// AUTH-003: a syntactically valid address (same rule as the browser's `type=email`: local@domain with a dot-free
    /// or dotted domain, no spaces).
    public static func isValidEmail(_ raw: String) -> Bool {
        let email = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    /// Normalized email sent to the server (trimmed, lowercased).
    public static func normalizeEmail(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// Keeps only digits, at most `AuthAPI.codeLength` (pasted "482 913" or "Code: 482913" still work).
    public static func sanitizeCode(_ raw: String) -> String {
        String(raw.filter(\.isASCII).filter(\.isNumber).prefix(AuthAPI.codeLength))
    }

    public static func isCompleteCode(_ code: String) -> Bool {
        code.count == AuthAPI.codeLength && code.allSatisfy(\.isNumber)
    }

    /// What went wrong, as the Italian source of the message to show.
    public enum Failure: Equatable, Sendable {
        case invalidEmail
        case rateLimited
        case sendFailed
        case network
        case wrongCode
        case codeExpired
        case codeBurnt
        case generic

        public var message: String {
            switch self {
            case .invalidEmail: "Inserisci un indirizzo email valido."
            case .rateLimited: "Troppi tentativi ravvicinati. Riprova tra qualche minuto."
            case .sendFailed: "Non siamo riusciti a inviare il codice. Controlla l'indirizzo e riprova."
            case .network: "Connessione non riuscita. Controlla la rete e riprova."
            case .wrongCode: "Il codice non è corretto. Controlla e riprova."
            case .codeExpired: "Il codice è scaduto. Fatti mandare un nuovo codice."
            case .codeBurnt: "Troppi tentativi sbagliati: questo codice non vale più. Fatti mandare un nuovo codice."
            case .generic: "Qualcosa è andato storto. Riprova."
            }
        }

        /// The code can't be used any more: the field is cleared and only «send a new code» helps.
        public var needsNewCode: Bool { self == .codeExpired || self == .codeBurnt }
    }

    /// AUTH-007: errors of `send-verification-otp`.
    public static func sendFailure(_ error: Error) -> Failure {
        guard let api = error as? APIError else { return .generic }
        switch api {
        case .transport: return .network
        case .http(let body) where body.status == 429: return .rateLimited
        default: return .sendFailed
        }
    }

    /// Errors of `sign-in/email-otp` (`INVALID_OTP` / `OTP_EXPIRED` / `TOO_MANY_ATTEMPTS` / 429).
    public static func verifyFailure(_ error: Error) -> Failure {
        guard let api = error as? APIError else { return .generic }
        switch api {
        case .transport: return .network
        case .http(let body):
            if body.status == 429 { return .rateLimited }
            switch body.code {
            case .invalidOTP: return .wrongCode
            case .otpExpired: return .codeExpired
            case .tooManyAttempts: return .codeBurnt
            default: return body.status == 400 ? .wrongCode : .generic
            }
        default: return .generic
        }
    }
}

/// Live countdown of «Invia di nuovo tra {0}s» (AUTH-005): seconds left from the moment the code was sent.
public struct ResendCooldown: Equatable, Sendable {
    public let sentAt: Date
    public let seconds: Int

    public init(sentAt: Date, seconds: Int = AuthAPI.resendCooldownSeconds) {
        self.sentAt = sentAt
        self.seconds = seconds
    }

    public func remaining(at now: Date) -> Int {
        let elapsed = now.timeIntervalSince(sentAt)
        return max(0, Int((Double(seconds) - elapsed).rounded(.up)))
    }
}

/// «Rientra in BuddyBudget» (AUTH-059, web #398 `lib/auth/returning-user.ts`): the account remembered on this device
/// after a sign-in, offered again on the login screen. Device storage only, never sent anywhere. Same names on Android.
public enum ReturningUser {
    /// Device-storage key of the remembered email.
    public static let key = "bb.returning-user"

    private static let visibleLocalChars = 3
    private static let maskDots = "\u{2022}\u{2022}\u{2022}"

    /// A stored value is usable only if it looks like an email.
    public static func parse(_ raw: String?) -> String? {
        guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), value.contains("@") else { return nil }
        return value
    }

    /// `dan•••@gmail.com`: most of the local part hidden for a shared screen.
    public static func mask(_ email: String) -> String {
        guard let at = email.lastIndex(of: "@"), at > email.startIndex else { return email }
        let local = email[..<at]
        let visible = local.prefix(min(visibleLocalChars, max(1, local.count - 1)))
        return "\(visible)\(maskDots)\(email[at...])"
    }
}

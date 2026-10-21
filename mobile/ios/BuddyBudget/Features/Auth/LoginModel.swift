import BuddyBudgetKit
import Foundation
import Observation

/// State of the email-code sign-in (AUTH-001…009, api/auth.md §3.1). Same fields as `LoginModel` on Android.
@MainActor @Observable
final class LoginModel {
    enum Step: Equatable { case email, code }

    var email: String
    var code = ""
    private(set) var step: Step = .email
    private(set) var sending = false
    private(set) var verifying = false
    private(set) var failure: SignIn.Failure?
    private(set) var cooldown: ResendCooldown?
    /// Ticks every second while a cooldown runs (AUTH-005 live countdown).
    private(set) var now = Date()

    @ObservationIgnored private let auth: AuthAPI
    @ObservationIgnored private let onSignedIn: (String) async -> Void
    @ObservationIgnored private var ticker: Task<Void, Never>?

    init(auth: AuthAPI, email: String = "", onSignedIn: @escaping (String) async -> Void) {
        self.auth = auth
        self.email = email
        self.onSignedIn = onSignedIn
    }

    var busy: Bool { sending || verifying }
    var resendRemaining: Int { cooldown?.remaining(at: now) ?? 0 }
    var normalizedEmail: String { SignIn.normalizeEmail(email) }

    /// AUTH-003 → AUTH-004: validate, request the code, move to the code step only once the server confirmed.
    func sendCode() async {
        guard !busy else { return }
        guard SignIn.isValidEmail(email) else {
            failure = .invalidEmail
            return
        }
        sending = true
        failure = nil
        defer { sending = false }
        do {
            try await auth.sendCode(email: normalizedEmail)
            code = ""
            step = .code
            startCooldown()
        } catch {
            failure = SignIn.sendFailure(error)
        }
    }

    /// AUTH-005: «Invia di nuovo il codice» after the cooldown.
    func resend() async {
        guard resendRemaining == 0, !busy else { return }
        sending = true
        failure = nil
        defer { sending = false }
        do {
            try await auth.sendCode(email: normalizedEmail)
            code = ""
            startCooldown()
        } catch {
            failure = SignIn.sendFailure(error)
        }
    }

    func updateCode(_ raw: String) {
        let clean = SignIn.sanitizeCode(raw)
        if clean != code { code = clean }
        if failure == .wrongCode { failure = nil }
        if SignIn.isCompleteCode(clean), !verifying { Task { await verify() } }
    }

    /// `POST /api/auth/sign-in/email-otp`; on success the session takes over (bootstrap → gate).
    func verify() async {
        guard SignIn.isCompleteCode(code), !verifying else { return }
        verifying = true
        failure = nil
        do {
            try await auth.verifyCode(email: normalizedEmail, code: code)
            ticker?.cancel()
            await onSignedIn(normalizedEmail)
        } catch {
            let failure = SignIn.verifyFailure(error)
            self.failure = failure
            code = ""
        }
        verifying = false
    }

    /// AUTH-006: back to the form, email kept.
    func useAnotherEmail() {
        step = .email
        failure = nil
        code = ""
    }

    #if DEBUG
    /// DEBUG `-BBCode <code>`: jump to the code step (code sent by a previous `-BBAutoSend` launch) and verify.
    func debugEnterCode(_ raw: String) {
        step = .code
        startCooldown()
        updateCode(raw)
    }
    #endif

    private func startCooldown() {
        cooldown = ResendCooldown(sentAt: Date())
        now = Date()
        ticker?.cancel()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self else { return }
                self.now = Date()
                if self.resendRemaining == 0 { return }
            }
        }
    }
}

import Foundation

/// Where the bearer session token lives (spec: api/auth.md §2, §3.5). The token is stored **verbatim** as received in
/// the `set-auth-token` header (signed `<token>.<base64 signature>`, may contain `+ / =`).
///
/// The interface lives here; the persistent adapter is in the app (iOS: `KeychainSessionStore`, Android:
/// `KeystoreSessionStore`). Same name and methods as `SessionStore` on Android.
public protocol SessionStore: AnyObject, Sendable {
    func readToken() -> String?
    func saveToken(_ token: String)
    func clear()
}

/// In-memory store for tests and previews.
public final class InMemorySessionStore: SessionStore, @unchecked Sendable {
    private let lock = NSLock()
    private var token: String?

    public init(token: String? = nil) { self.token = token }

    public func readToken() -> String? { lock.withLock { token } }
    public func saveToken(_ token: String) { lock.withLock { self.token = token } }
    public func clear() { lock.withLock { token = nil } }
}

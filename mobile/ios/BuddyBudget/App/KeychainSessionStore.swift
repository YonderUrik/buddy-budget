import BuddyBudgetKit
import Foundation
import Security

/// Bearer token in the Keychain (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, never synced or backed up;
/// spec: api/auth.md §2). Twin of `KeystoreSessionStore` on Android.
final class KeychainSessionStore: SessionStore, @unchecked Sendable {
    private let service: String
    private let account = "session-token"
    private let lock = NSLock()
    private var cached: String??

    init(service: String = (Bundle.main.bundleIdentifier ?? "io.buddybudget.app") + ".session") {
        self.service = service
    }

    func readToken() -> String? {
        lock.withLock {
            if let cached { return cached }
            var query = baseQuery
            query[kSecReturnData as String] = true
            query[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &item)
            var token = status == errSecSuccess ? (item as? Data).flatMap { String(data: $0, encoding: .utf8) } : nil
            #if targetEnvironment(simulator) && DEBUG
            if token == nil { token = UserDefaults.standard.string(forKey: Self.simulatorFallbackKey) }
            #endif
            cached = .some(token)
            return token
        }
    }

    func saveToken(_ token: String) {
        lock.withLock {
            SecItemDelete(baseQuery as CFDictionary)
            var attributes = baseQuery
            attributes[kSecValueData as String] = Data(token.utf8)
            attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let status = SecItemAdd(attributes as CFDictionary, nil)
            #if targetEnvironment(simulator) && DEBUG
            // Unsigned simulator builds (CODE_SIGNING_ALLOWED=NO) have no keychain entitlement: keep the token in
            // UserDefaults so a relaunch stays signed in. Never compiled into device or release builds.
            if status != errSecSuccess { UserDefaults.standard.set(token, forKey: Self.simulatorFallbackKey) }
            #endif
            _ = status
            cached = .some(token)
        }
    }

    func clear() {
        lock.withLock {
            SecItemDelete(baseQuery as CFDictionary)
            #if targetEnvironment(simulator) && DEBUG
            UserDefaults.standard.removeObject(forKey: Self.simulatorFallbackKey)
            #endif
            cached = .some(nil)
        }
    }

    private static let simulatorFallbackKey = "debug.simulator.session-token"

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}

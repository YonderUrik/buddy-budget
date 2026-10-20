import Foundation

/// Stored status of a bank connection.
public enum ConnectionStatus: String, Sendable {
    case pending, linked, expired, error
}

/// `pending`: not completed yet; `expiring`: works but expires soon; `expired`/`error`: renew now.
public enum ConnectionHealthState: String, Sendable {
    case ok, expiring, expired, error, pending
}

public struct ConnectionHealthResult: Hashable, Sendable {
    public let state: ConnectionHealthState
    /// Days to the consent end, rounded up (only `ok` / `expiring` with a known date).
    public let daysLeft: Int?
}

/// Bank-connection health (`lib/gocardless/connection-health.ts`).
public enum ConnectionHealth {
    public static let consentValidDays = 90
    public static let consentExpiryWarningDays = 7
    static let dayMs = 24.0 * 60 * 60 * 1000

    public static func computeConnectionHealth(status: ConnectionStatus, consentExpiresAt: Date?, now: Date) -> ConnectionHealthResult {
        switch status {
        case .error: return ConnectionHealthResult(state: .error, daysLeft: nil)
        case .pending: return ConnectionHealthResult(state: .pending, daysLeft: nil)
        case .expired: return ConnectionHealthResult(state: .expired, daysLeft: nil)
        case .linked: break
        }
        guard let expires = consentExpiresAt else { return ConnectionHealthResult(state: .ok, daysLeft: nil) }
        // `getTime()` is integral milliseconds.
        let remainingMs = epochMs(expires) - epochMs(now)
        if remainingMs <= 0 { return ConnectionHealthResult(state: .expired, daysLeft: nil) }
        let daysLeft = Int((remainingMs / dayMs).rounded(.up))
        return ConnectionHealthResult(state: daysLeft <= consentExpiryWarningDays ? .expiring : .ok, daysLeft: daysLeft)
    }

    /// True when "Rinnova" should be offered (also while the connection still works).
    public static func needsRenewal(_ state: ConnectionHealthState) -> Bool {
        state == .expiring || state == .expired || state == .error
    }

    /// Consent expiry for a connection completed `now`.
    public static func consentExpiryFrom(_ now: Date) -> Date {
        Date(timeIntervalSince1970: (epochMs(now) + Double(consentValidDays) * dayMs) / 1000)
    }

    static func epochMs(_ date: Date) -> Double { (date.timeIntervalSince1970 * 1000).rounded(.down) }
}

import Foundation

/// What a history chart says while imported data is on its way into it (OV-044, TX-076, web #447
/// `lib/net-worth/refresh-status.ts`). Pure rules; the apps feed them the import/sync state and the chart's load times.
/// Same names on Android (`ChartRefresh`).
public enum ChartRefresh {
    /// `importing`: a file import or bank sync is running; `updating`: it finished and the chart is reloading.
    public enum State: Equatable, Sendable {
        case importing, updating

        public var message: String {
            switch self {
            case .importing: "Sto aggiungendo i nuovi movimenti: il grafico si aggiorna da solo appena finisco."
            case .updating: "Aggiorno il grafico con i nuovi movimenti…"
            }
        }
    }

    /// A finished import whose chart never reloads stops counting after this long (seconds).
    public static let pendingMaxAge: TimeInterval = 120

    /// `importing`: an import or sync of the user is running; `pendingSince`: when one last finished, until the chart has
    /// newer data; `dataUpdatedAt`: when the chart's data was last received (distant past before the first load).
    public static func state(importing: Bool, pendingSince: Date?, dataUpdatedAt: Date, isFetching: Bool) -> State? {
        if importing { return .importing }
        if let pendingSince, isFetching || dataUpdatedAt < pendingSince { return .updating }
        return nil
    }

    /// True once the chart holds data received after the import finished: the pending mark can go.
    public static func isSettled(pendingSince: Date?, dataUpdatedAt: Date, isFetching: Bool) -> Bool {
        guard let pendingSince else { return false }
        return !isFetching && dataUpdatedAt >= pendingSince
    }

    /// A pending mark older than `pendingMaxAge` is dropped (the chart was never reloaded).
    public static func freshPending(_ pendingSince: Date?, now: Date) -> Date? {
        guard let pendingSince, now.timeIntervalSince(pendingSince) < pendingMaxAge else { return nil }
        return pendingSince
    }
}

import Foundation

// Manual sync availability, start errors and background-job texts (ACC-036, 044, 046…050;
// web `account-status.ts`, `sync-messages.ts`, `describe-account-progress.ts`, `lib/sync-jobs/view.ts`).

/// `HH:mm` of an ISO instant in the device time zone.
public enum SyncClock {
    public static func parse(_ iso: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: iso) { return date }
        return ISO8601DateFormatter().date(from: iso)
    }

    public static func time(_ iso: String, locale: BBLocale, timeZone: TimeZone) -> String? {
        guard let date = parse(iso) else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        return BBFormat.formatTime(hour: parts.hour ?? 0, minute: parts.minute ?? 0, locale: locale)
    }
}

public enum SyncAvailability {
    /// Syncs per account per rolling 24 h (shared by manual and automatic syncs).
    public static let dailyLimit = 4

    /// The sentence next to «Sincronizza ora» (ACC-036).
    public static func sentence(health: AccountHealth?, syncing: Bool, locale: BBLocale, timeZone: TimeZone) -> AccountsText {
        if syncing || health?.syncing == true { return AccountsText("Sincronizzazione in corso.") }
        if health?.needsRenewal == true { return AccountsText("Riconnetti la banca per sincronizzare.") }
        guard let health else { return AccountsText("Informazioni di sincronizzazione non disponibili.") }
        if health.eligible { return AccountsText("Puoi sincronizzare adesso.") }
        guard let next = health.nextEligibleAt, let time = SyncClock.time(next, locale: locale, timeZone: timeZone) else {
            return AccountsText("Sincronizzazione non disponibile.")
        }
        if health.syncsRemainingToday == 0 {
            return AccountsText("Hai raggiunto il limite di {0} sincronizzazioni al giorno. Prossima alle {1}.",
                                ["0": String(dailyLimit), "1": time])
        }
        return AccountsText("Prossima sincronizzazione disponibile alle {0}.", ["0": time])
    }

    /// ACC-037: «Sincronizza ora» is enabled only when eligible, idle and not waiting for a renewal.
    public static func canSync(health: AccountHealth?, syncing: Bool, starting: Bool) -> Bool {
        guard let health else { return false }
        return health.eligible && !health.needsRenewal && !syncing && !health.syncing && !starting
    }
}

public enum SyncStartError {
    /// Toast for a failed `POST …/accounts/{id}/sync` (ACC-044). `nextEligibleAt` from the 429 body or the account.
    public static func message(status: Int?, nextEligibleAt: String?, locale: BBLocale, timeZone: TimeZone) -> AccountsText {
        switch status {
        case 429:
            if let next = nextEligibleAt, let time = SyncClock.time(next, locale: locale, timeZone: timeZone) {
                return AccountsText("Hai raggiunto il limite giornaliero di sync. Prossimo disponibile alle {0}.", ["0": time])
            }
            return AccountsText("Sync non disponibile al momento. Riprova più tardi.")
        case 409: return AccountsText("Sincronizzazione già in corso per questo conto.")
        case 503: return AccountsText("Servizio di sincronizzazione temporaneamente non disponibile. Riprova tra poco.")
        case 404: return AccountsText("Conto non trovato o non collegato")
        default: return AccountsText("Impossibile completare la sincronizzazione. Riprova più tardi.")
        }
    }
}

// MARK: - Jobs

public enum SyncBar: Equatable, Sendable {
    case none
    case indeterminate
    case determinate(value: Double, max: Double)
}

public enum SyncTone: Sendable { case normal, success, error }

public struct SyncAccountProgress: Equatable, Sendable {
    public let text: AccountsText
    public let bar: SyncBar
    public let tone: SyncTone
    /// Balance, download or save in progress (text shimmers on the web).
    public let working: Bool
}

public enum SyncJobs {
    public static let pollInterval: TimeInterval = 1

    /// ACC-046: poll only while some job runs.
    public static func shouldPoll(_ jobs: [SyncJob]) -> Bool { jobs.contains { $0.status == .running && !$0.interrupted } }

    /// `isAccountSyncing`.
    public static func isSyncing(_ jobs: [SyncJob], accountId: String) -> Bool {
        jobs.contains { job in
            job.status == .running && !job.interrupted && job.accounts.contains { $0.accountId == accountId && !$0.phase.isFinal }
        }
    }

    /// Ids of running jobs, to compare two polls.
    public static func runningIds(_ jobs: [SyncJob]) -> Set<String> {
        Set(jobs.filter { $0.status == .running && !$0.interrupted }.map(\.id))
    }

    /// ACC-051: a job that was running is no longer running → refresh the data.
    public static func finishedSince(previous: Set<String>, current: [SyncJob]) -> Bool {
        let now = runningIds(current)
        return previous.contains { !now.contains($0) }
    }

    /// Movements left to categorize by a finished job (ACC-050 `Categorizza`).
    public static func uncategorized(_ job: SyncJob) -> Int { job.accounts.reduce(0) { $0 + $1.uncategorized } }

    public static func isFinished(_ job: SyncJob) -> Bool { job.status != .running || job.interrupted }

    public static func hasErrors(_ job: SyncJob) -> Bool {
        job.status == .failed || job.interrupted || job.accounts.contains { $0.phase == .error }
    }

    /// Ring/overall bar: determinate only when every active account knows its total.
    public static func overallProgress(_ job: SyncJob) -> SyncBar {
        guard job.status == .running else { return .determinate(value: 1, max: 1) }
        var processed = 0, total = 0
        for account in job.accounts {
            guard let t = account.total else {
                if account.phase.isFinal { continue }
                return .indeterminate
            }
            processed += account.processed
            total += t
        }
        return total == 0 ? .indeterminate : .determinate(value: Double(processed), max: Double(total))
    }

    /// Job title (ACC-047).
    public static func title(_ job: SyncJob) -> AccountsText {
        if job.interrupted { return AccountsText("Sincronizzazione interrotta") }
        switch job.status {
        case .done: return AccountsText("Sincronizzazione completata")
        case .failed: return AccountsText("Sincronizzazione non riuscita")
        case .running:
            let n = job.accounts.count
            return AccountsText(n == 1 ? "Sincronizzazione in corso · {0} conto" : "Sincronizzazione in corso · {0} conti", ["0": String(n)])
        }
    }

    /// Phase text, bar and tone of one account (ACC-047 / ACC-048).
    public static func describe(_ account: SyncJobAccount, interrupted: Bool) -> SyncAccountProgress {
        switch account.phase {
        case .queued:
            return SyncAccountProgress(text: AccountsText("In attesa"), bar: .none, tone: .normal, working: false)
        case .balance:
            return SyncAccountProgress(text: AccountsText("Aggiorno il saldo…"), bar: .indeterminate, tone: .normal, working: !interrupted)
        case .fetching:
            return SyncAccountProgress(text: AccountsText("Scarico i movimenti dalla banca…"), bar: .indeterminate, tone: .normal,
                                       working: !interrupted)
        case .saving:
            let total = account.total ?? 0
            let source = total == 1 ? "Importati {0} di {1} movimento" : "Importati {0} di {1} movimenti"
            return SyncAccountProgress(text: AccountsText(source, ["0": String(account.processed), "1": String(total)]),
                                       bar: .determinate(value: Double(account.processed), max: Double(max(total, 1))),
                                       tone: .normal, working: !interrupted)
        case .done:
            return SyncAccountProgress(text: summary(inserted: account.inserted, categorized: account.categorized,
                                                     uncategorized: account.uncategorized),
                                       bar: .determinate(value: 1, max: 1), tone: .success, working: false)
        case .limited:
            return SyncAccountProgress(text: AccountsText("La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi."),
                                       bar: .none, tone: .error, working: false)
        case .expired:
            return SyncAccountProgress(text: AccountsText("Sessione con la banca scaduta. Riconnetti il conto per sincronizzare."),
                                       bar: .none, tone: .error, working: false)
        case .error:
            if account.errorReason == "already-running" {
                return SyncAccountProgress(text: AccountsText("Sincronizzazione già in corso per questo conto."), bar: .none,
                                           tone: .error, working: false)
            }
            let source = interrupted
                ? "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì."
                : "Sincronizzazione non riuscita. Riprova più tardi."
            return SyncAccountProgress(text: AccountsText(source), bar: .none, tone: .error, working: false)
        }
    }

    /// `buildSyncSummaryMessage`.
    public static func summary(inserted: Int, categorized: Int, uncategorized: Int) -> AccountsText {
        if inserted == 0 { return AccountsText("Nessuna nuova transazione trovata. Saldo aggiornato.") }
        var parts: [AccountsText] = []
        if categorized > 0 {
            parts.append(AccountsText(categorized == 1 ? "{0} categorizzata da sola" : "{0} categorizzate da sole", ["0": String(categorized)]))
        }
        if uncategorized > 0 { parts.append(AccountsText("{0} da decidere", ["0": String(uncategorized)])) }
        let one = inserted == 1
        if parts.isEmpty {
            return AccountsText(one ? "{0} nuova transazione. Saldo aggiornato." : "{0} nuove transazioni. Saldo aggiornato.",
                                ["0": String(inserted)])
        }
        return AccountsText(one ? "{0} nuova transazione ({1}). Saldo aggiornato." : "{0} nuove transazioni ({1}). Saldo aggiornato.",
                            ["0": String(inserted)], lists: ["1": parts])
    }
}

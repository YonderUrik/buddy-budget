import Foundation

/// «Dall'ultima visita» (SHELL-058…059, web #457 `components/domain/welcome/welcome-lines.ts`): the toast lines and the
/// action. Italian catalog sources; `tr` translates with `{0}` values, `join` joins labels as the language does
/// («a, b e c»). Same names on Android (`WelcomeText`).
public enum WelcomeText {
    /// How often the open app sends a heartbeat while in the foreground (seconds).
    public static let heartbeatSeconds: UInt64 = 5 * 60
    /// Heartbeats closer than this are not sent.
    public static let throttle: TimeInterval = 60
    /// Long enough to read the sentence, short enough not to sit on the screen.
    public static let toastSeconds: TimeInterval = 10

    public struct Line: Equatable, Sendable {
        public let kind: String
        public let figure: Int
        public let title: String
        public let path: String
        public let action: String?
    }

    public struct Content: Equatable, Sendable {
        public let lines: [String]
        public let actionLabel: String
        public let actionPath: String
        public let actionKind: String
    }

    /// Where each line leads (in-app paths).
    public static func path(_ item: WelcomeItem) -> String {
        switch item.kind {
        case "movements": return "/liquidita"
        case "price_alerts": return "/investimenti/titoli"
        case "price_rises", "subscriptions": return "/liquidita/abbonamenti"
        case "to_decide": return "/categorizza"
        case "import_review": return "/importazioni" + (item.jobId.map { "?job=\($0)" } ?? "")
        default: return "/panoramica"
        }
    }

    public static func happenedLine(_ item: WelcomeItem, tr: CategorizationText.Translate) -> Line? {
        let one = item.count == 1
        let title: String
        switch item.kind {
        case "movements": title = one ? "movimento nuovo" : "movimenti nuovi"
        case "price_alerts": title = one ? "avviso di prezzo scattato" : "avvisi di prezzo scattati"
        case "price_rises": title = one ? "abbonamento costa di più" : "abbonamenti costano di più"
        default: return nil
        }
        return Line(kind: item.kind, figure: item.count, title: tr(title, [:]), path: path(item), action: nil)
    }

    public static func waitingLine(_ item: WelcomeItem, tr: CategorizationText.Translate) -> Line? {
        let one = item.count == 1
        let title: String
        let action: String
        switch item.kind {
        case "to_decide": (title, action) = (one ? "movimento senza categoria" : "movimenti senza categoria", "Decidi")
        case "subscriptions": (title, action) = (one ? "abbonamento da confermare" : "abbonamenti da confermare", "Controlla")
        case "import_review": (title, action) = ("import da controllare", "Apri")
        default: return nil
        }
        return Line(kind: item.kind, figure: item.count, title: tr(title, [:]), path: path(item), action: tr(action, [:]))
    }

    /// One line per group («Mentre eri via: …», «Da sistemare: …»), with the action of the first thing that waits, or
    /// «Vedi» on the first thing that happened. Nil when there is nothing to say.
    public static func content(_ summary: WelcomeSummary, tr: CategorizationText.Translate, join: ([String]) -> String) -> Content? {
        let happened = summary.happened.compactMap { happenedLine($0, tr: tr) }
        let waiting = summary.waiting.compactMap { waitingLine($0, tr: tr) }
        guard let first = waiting.first ?? happened.first else { return nil }
        // The count never ends a line apart from its words.
        func label(_ lines: [Line]) -> String { join(lines.map { "\($0.figure)\u{00A0}\($0.title)" }) }
        var lines: [String] = []
        if !happened.isEmpty { lines.append(tr("Mentre eri via: {0}", ["0": label(happened)])) }
        if !waiting.isEmpty { lines.append(tr("Da sistemare: {0}", ["0": label(waiting)])) }
        return Content(lines: lines, actionLabel: first.action ?? tr("Vedi", [:]), actionPath: first.path, actionKind: first.kind)
    }
}

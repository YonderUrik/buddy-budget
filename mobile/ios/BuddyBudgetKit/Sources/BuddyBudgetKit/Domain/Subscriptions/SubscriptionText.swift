import Foundation

/// A piece of a sentence with its emphasis, so whole-sentence catalog keys can still bold the name or the amounts.
public struct SubscriptionTextRun: Equatable, Sendable {
    public enum Style: Equatable, Sendable {
        case plain
        /// font-semibold (a name).
        case strong
        /// font-mono semibold tabular, foreground (an amount).
        case amount
    }

    public let text: String
    public let style: Style

    public init(_ text: String, _ style: Style = .plain) {
        self.text = text
        self.style = style
    }
}

/// Hero line 2 (SUB-005): `Prossimo addebito: **name** {when}` and, with more than one charge in the window,
/// the muted `· nei prossimi 30 giorni {n} addebiti, {sum}`.
public struct SubscriptionNextChargeLine: Equatable, Sendable {
    public let main: [SubscriptionTextRun]
    public let window: String?
}

/// Subscription phrasing (web `subscriptions-format.ts` + the overview hero), bound to one language.
/// `translate` maps an Italian catalog key to its template in the app language (`L10n.lookup(italian:)` on iOS,
/// `LocalStrings.lookup` on Android; identity in tests). Same API as `SubscriptionText` on Android.
public struct SubscriptionText {
    public let locale: BBLocale
    private let translate: (String) -> String

    public init(locale: BBLocale, translate: @escaping (String) -> String) {
        self.locale = locale
        self.translate = translate
    }

    private var italian: Bool { locale == .itIT }

    private func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    private func money(_ value: Double, _ currency: String, masked: Bool, digits: Int = 2) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: digits, masked: masked)
    }

    // MARK: Cadence

    /// Italian catalog key of a cadence label (`CADENCE_LABELS`).
    public static func cadenceKey(_ cadence: SubscriptionCadence) -> String {
        switch cadence {
        case .settimanale: return "ogni settimana"
        case .mensile: return "ogni mese"
        case .trimestrale: return "ogni 3 mesi"
        case .semestrale: return "ogni 6 mesi"
        case .annuale: return "ogni anno"
        }
    }

    /// `ogni mese`, or `cadenza da definire` when unknown.
    public func cadenceLabel(_ cadence: SubscriptionCadence?) -> String {
        guard let cadence else { return tr("cadenza da definire") }
        return tr(Self.cadenceKey(cadence))
    }

    /// Select option: the label capitalized (`Ogni mese`).
    public func cadenceOption(_ cadence: SubscriptionCadence) -> String {
        BBFormat.capitalize(tr(Self.cadenceKey(cadence)))
    }

    // MARK: Dates (SUB-006)

    /// «il 12 nov» / «l'8 nov» (Italian elides the article before 8 and 11); other languages use `il {0}`.
    public func onDate(_ date: String, withYear: Bool = false) -> String {
        let formatted = withYear ? BBFormat.formatDateWithYear(date, locale: locale) : BBFormat.formatShortDate(date, locale: locale)
        if italian {
            let day = CalendarDate(iso: date)?.day ?? 0
            return (day == 8 || day == 11 ? "l'" : "il ") + formatted
        }
        return tr("il {0}", ["0": formatted])
    }

    /// «dal 12 nov» / «dall'8 nov».
    public func fromDate(_ date: String, withYear: Bool = false) -> String {
        let formatted = withYear ? BBFormat.formatDateWithYear(date, locale: locale) : BBFormat.formatShortDate(date, locale: locale)
        if italian {
            let day = CalendarDate(iso: date)?.day ?? 0
            return (day == 8 || day == 11 ? "dall'" : "dal ") + formatted
        }
        return tr("dal {0}", ["0": formatted])
    }

    /// `oggi`, `domani`, `tra {n} giorni` (2–14), else the short date (with the year beyond 300 days).
    public func whenPhrase(today: String, date: String) -> String {
        let days = SubscriptionsView.daysBetween(today, date)
        if days == 0 { return tr("oggi") }
        if days == 1 { return tr("domani") }
        if days > 1 && days <= 14 { return tr("tra {0} giorni", ["0": String(days)]) }
        return onDate(date, withYear: days > SubscriptionsView.yearAwayDays)
    }

    // MARK: Rows and detail (SUB-014, SUB-016)

    /// Row/detail hint line (`itemHint`).
    public func hint(_ item: SubscriptionItem, today: String) -> String {
        let cadence = cadenceLabel(item.cadence)
        if item.decision == .terminato || item.decision == .escluso {
            guard let last = item.lastDate else { return cadence }
            return tr("{0} · ultimo addebito {1}", ["0": cadence, "1": onDate(last)])
        }
        if item.activity == .fermo {
            guard let last = item.lastDate else { return tr("{0} · non lo vediamo più tra i movimenti", ["0": cadence]) }
            return tr("Ultimo addebito {0}, atteso {1}", ["0": onDate(last), "1": onDate(item.nextDate ?? last)])
        }
        guard let next = item.nextDate else { return cadence }
        let overdue = SubscriptionsView.daysBetween(today, next) < 0
        return "\(cadence) · \(overdue ? tr("atteso") : tr("prossimo")) \(whenPhrase(today: today, date: next))"
    }

    /// `era {old price}` under the amount after a rise.
    public func previousPrice(_ change: SubscriptionPriceChange, currency: String, masked: Bool) -> String {
        "\(tr("era")) \(money(change.from, currency, masked: masked))"
    }

    /// `{monthly}/mese` under the amount for non-monthly cadences.
    public func monthlySuffix(_ monthly: Double, currency: String, masked: Bool) -> String {
        money(monthly, currency, masked: masked) + tr("/mese")
    }

    /// Detail: `Pesa {monthly} al mese` (whole-sentence key).
    public func monthlyWeight(_ monthly: Double, currency: String, masked: Bool) -> String {
        tr("Pesa {0} al mese", ["0": money(monthly, currency, masked: masked)])
    }

    /// `Aumenti di prezzo` row hint: `Da {from} a {to} {dal d MMM}`.
    public func priceRiseHint(_ change: SubscriptionPriceChange, currency: String, masked: Bool) -> String {
        tr("Da {0} a {1} {2}", ["0": money(change.from, currency, masked: masked), "1": money(change.to, currency, masked: masked),
                                "2": fromDate(change.since)])
    }

    /// `+{difference}` in red.
    public func priceRiseDelta(_ change: SubscriptionPriceChange, currency: String, masked: Bool) -> String {
        "+" + money(JSNumber.round2(change.to - change.from), currency, masked: masked)
    }

    /// One `Perché lo vediamo qui` bullet (`reasonSentence`); nil for a reason this version does not know.
    public func reason(_ reason: SubscriptionReason, currency: String, masked: Bool) -> String? {
        switch reason {
        case .count(let count):
            return tr("{0} addebiti dello stesso esercente", ["0": String(count)])
        case .cadence(let cadence, let skipped):
            return tr("Tornano {0}{1}", ["0": tr(Self.cadenceKey(cadence)),
                                         "1": skipped ? tr(" (un addebito è saltato, lo abbiamo perdonato)") : ""])
        case .amount(let constant):
            return constant ? tr("Importo sempre uguale") : tr("Importo quasi sempre uguale (differenze minime)")
        case .priceChange(let from, let to, let since):
            return tr("Il prezzo è passato da {0} a {1} {2}", ["0": money(from, currency, masked: masked),
                                                                "1": money(to, currency, masked: masked),
                                                                "2": fromDate(since, withYear: true)])
        case .day(let day):
            return tr("Sempre intorno al giorno {0} del mese", ["0": String(day)])
        case .unknown:
            return nil
        }
    }

    // MARK: Hero (SUB-002…005)

    /// Hero line 1: yearly total and count (or the confirm prompt), plus the pending sentence.
    public func heroSummary(_ totals: SubscriptionTotals, currency: String, masked: Bool) -> [SubscriptionTextRun] {
        var runs: [SubscriptionTextRun] = []
        if totals.count > 0 {
            let key = totals.count == 1 ? "{0} all'anno, in {1} abbonamento confermato."
                : "{0} all'anno, in {1} abbonamenti confermati."
            runs += Self.runs(translate(key), ["0": SubscriptionTextRun(money(totals.yearly, currency, masked: masked, digits: 0), .amount),
                                               "1": SubscriptionTextRun(String(totals.count))])
        } else {
            runs.append(SubscriptionTextRun(tr("Conferma quelli che riconosci qui sotto e li sommiamo.")))
        }
        if totals.pendingCount > 0 {
            runs.append(SubscriptionTextRun(" "))
            runs += Self.runs(translate("Altri {0} da confermare valgono circa {1} al mese."),
                              ["0": SubscriptionTextRun(String(totals.pendingCount)),
                               "1": SubscriptionTextRun(money(totals.pendingMonthly, currency, masked: masked, digits: 0), .amount)])
        }
        return Self.merged(runs)
    }

    /// Hero line 2 (bell), nil when nothing confirmed is due within 30 days.
    public func nextChargeLine(_ next: SubscriptionNextCharge?, today: String, currency: String,
                               masked: Bool) -> SubscriptionNextChargeLine? {
        guard let next else { return nil }
        let main = Self.runs(translate("Prossimo addebito: {0} {1}"),
                             ["0": SubscriptionTextRun(next.item.name, .strong),
                              "1": SubscriptionTextRun(whenPhrase(today: today, date: next.date))])
        let window = next.count > 1
            ? tr("· nei prossimi 30 giorni {0} addebiti, {1}",
                 ["0": String(next.count), "1": money(next.total, currency, masked: masked, digits: 0)])
            : nil
        return SubscriptionNextChargeLine(main: Self.merged(main), window: window)
    }

    /// Splits a template at `{name}` placeholders, substituting styled runs; unknown placeholders stay as text.
    static func runs(_ template: String, _ values: [String: SubscriptionTextRun]) -> [SubscriptionTextRun] {
        var out: [SubscriptionTextRun] = []
        var plain = ""
        var rest = Substring(template)
        while let open = rest.firstIndex(of: "{") {
            plain += rest[..<open]
            let afterOpen = rest.index(after: open)
            guard let close = rest[afterOpen...].firstIndex(of: "}"),
                  let value = values[String(rest[afterOpen..<close])] else {
                plain += "{"
                rest = rest[afterOpen...]
                continue
            }
            if !plain.isEmpty { out.append(SubscriptionTextRun(plain)) }
            plain = ""
            out.append(value)
            rest = rest[rest.index(after: close)...]
        }
        plain += rest
        if !plain.isEmpty { out.append(SubscriptionTextRun(plain)) }
        return out
    }

    /// Joins adjacent runs with the same style.
    static func merged(_ runs: [SubscriptionTextRun]) -> [SubscriptionTextRun] {
        var out: [SubscriptionTextRun] = []
        for run in runs where !run.text.isEmpty {
            if let last = out.last, last.style == run.style {
                out[out.count - 1] = SubscriptionTextRun(last.text + run.text, run.style)
            } else {
                out.append(run)
            }
        }
        return out
    }
}

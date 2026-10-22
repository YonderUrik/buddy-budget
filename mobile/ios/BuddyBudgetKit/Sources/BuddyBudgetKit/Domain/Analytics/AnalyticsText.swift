import Foundation

// Analitiche phrasing (web components/domain/analytics/{analytics-format,period-text,plain-answers,return-source,
// scenario-headline,scenario-controls,cashflow-source-note}.ts), bound to one language. `translate` maps an Italian
// catalog key to its template in the app language (identity in tests). Same API on Android (`AnalyticsText.kt`).
//
// Mobile translates the sentences the web builds with hard-coded Italian (open question 3 of 11-analytics) and fills the
// `{0}` of the metric sub-labels the web leaves unfilled (decision 0003: implement the correct behaviour).

/// A piece of a sentence: plain text or a glossary term (underlined, tap = definition, ANA-032).
public enum AnalyticsTextPart: Hashable, Sendable {
    case text(String)
    case term(id: String, text: String)

    public var string: String {
        switch self {
        case .text(let s): s
        case .term(_, let s): s
        }
    }
}

/// The four questions (`ANALYTICS_QUESTIONS`), in reading order. Tab label, title, «Per esperti» hint, icon.
public enum AnalyticsQuestion: String, CaseIterable, Sendable {
    case doveSono = "dove-sono"
    case quando
    case reggera
    case costi

    public var label: String {
        switch self {
        case .doveSono: "Strada fatta"
        case .quando: "Arrivo"
        case .reggera: "Regge"
        case .costi: "Costi"
        }
    }

    public var title: String {
        switch self {
        case .doveSono: "Quanta strada ho fatto?"
        case .quando: "Quando posso smettere di lavorare?"
        case .reggera: "Il patrimonio reggerà nel tempo?"
        case .costi: "Quanto mi costa tenere il portafoglio?"
        }
    }

    public var iconKey: String {
        switch self {
        case .doveSono: "trending-up"
        case .quando: "calendar-clock"
        case .reggera: "shield-check"
        case .costi: "percent"
        }
    }

    /// ANA-035: legacy sub-routes and anchors (`/analitiche/costi` → `#costi`, `/crescita` → `#dove-sono`,
    /// `/prelievi|rischio|simulazione` → `#reggera`) select the matching question.
    public init?(path: String) {
        let clean = String(path.split(separator: "?").first ?? "")
        let hash = clean.split(separator: "#").dropFirst().first.map(String.init)
        if let hash, let q = AnalyticsQuestion(rawValue: hash) {
            self = q
            return
        }
        let base = String(clean.split(separator: "#").first ?? "")
        switch base {
        case "/analitiche/costi": self = .costi
        case "/analitiche/crescita": self = .doveSono
        case "/analitiche/prelievi", "/analitiche/rischio", "/analitiche/simulazione": self = .reggera
        default: return nil
        }
    }
}

/// One of the four answer tiles (ANA-020).
public struct AnalyticsAnswerTile: Hashable, Sendable {
    public let question: AnalyticsQuestion
    public let value: String
    public let note: String
    /// The value is still being computed (Monte Carlo of «Regge»): show a placeholder, not the empty state.
    public var loading = false

    public init(question: AnalyticsQuestion, value: String, note: String, loading: Bool = false) {
        self.question = question
        self.value = value
        self.note = note
        self.loading = loading
    }
}

/// «Puoi smettere di lavorare intorno al» headline (ANA-009, ANA-010).
public struct AnalyticsHeadline: Hashable, Sendable {
    public let lead: String
    public let big: String
    /// Smaller line under the big figure (missing-spending hint, or `tra {n anni}`).
    public let sub: String?
    /// `{n anni} prima|dopo delle ipotesi salvate`; `positive` = earlier.
    public let comparison: String?
    public let positive: Bool
    /// True when spending is unknown (the big line is a sentence, not a year).
    public let missing: Bool
}

/// Verdict on a success probability (`successVerdict`).
public struct AnalyticsVerdict: Hashable, Sendable {
    public enum Tone: String, Sendable { case pos, neg, `default` }
    public let text: String
    public let tone: Tone
}

/// «Il patrimonio reggerà?» in words (`lastingAnswer`).
public struct AnalyticsLastingAnswer: Hashable, Sendable {
    public struct Rule: Hashable, Sendable {
        public let rule: WithdrawalRule
        public let label: String
        public let success: Double
    }

    public let headline: String
    public let verdict: AnalyticsVerdict
    public let success: Double
    public let rules: [Rule]
    /// Rule with a better success rate than the chosen one, if any.
    public let better: Rule?
}

public struct AnalyticsText {
    public let locale: BBLocale
    public let masked: Bool
    private let translate: (String) -> String

    public init(locale: BBLocale, masked: Bool = false, translate: @escaping (String) -> String) {
        self.locale = locale
        self.masked = masked
        self.translate = translate
    }

    public func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    // MARK: Formats (`localizedAnalyticsFormats`)

    /// Currency without decimals («97.534 €»), masked in privacy mode.
    public func money(_ value: Double, _ currency: String) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: 0, masked: masked)
    }

    /// Percent with exactly `digits` decimals («3,5%»).
    public func pct(_ value: Double, _ digits: Int = 1) -> String { BBFormat.formatPct(value, digits: digits, locale: locale) }

    /// Plain number with exactly `digits` decimals («1,91»).
    public func num(_ value: Double, _ digits: Int = 2) -> String { BBFormat.formatRatio(value, digits: digits, locale: locale) }

    /// «12,3 anni», «già raggiunto» at 0, «oltre 80 anni» when nil.
    public func formatYears(_ years: Double?) -> String {
        guard let years else { return tr("oltre 80 anni") }
        if years == 0 { return tr("già raggiunto") }
        return tr("{0} anni", ["0": BBFormat.formatNumber(years, minimumFractionDigits: 0, maximumFractionDigits: 1, locale: locale)])
    }

    /// «ott 2025» from `YYYY-MM-DD` or `YYYY-MM` (first "." removed).
    public func monthText(_ key: String) -> String {
        let y = Int(key.prefix(4)) ?? 2000, m = Int(key.dropFirst(5).prefix(2)) ?? 1
        let text = BBFormat.formatDate(CalendarDate(year: y, month: m, day: 1), .MMMy, locale: locale)
        guard let dot = text.firstIndex(of: ".") else { return text }
        var out = text
        out.remove(at: dot)
        return out
    }

    /// «ott 2025 – set 2026».
    public func rangeText(_ fromKey: String, _ toKey: String) -> String { "\(monthText(fromKey)) – \(monthText(toKey))" }

    /// «negli ultimi 12 mesi» / «da gen 2024 a dic 2025».
    public func periodPhrase(_ period: DataPeriod, fromKey: String, toKey: String) -> String {
        switch period {
        case .ultimi(let months): tr("negli ultimi {0} mesi", ["0": String(months)])
        case .personalizzato: tr("da {0} a {1}", ["0": monthText(fromKey), "1": monthText(toKey)])
        }
    }

    /// «gen 26» (growth bars: `{month short, year 2-digit}`, "." removed).
    public func shortMonth(_ key: String) -> String {
        let y = Int(key.prefix(4)) ?? 2000, m = Int(key.dropFirst(5).prefix(2)) ?? 1
        let text = BBFormat.formatDate(CalendarDate(year: y, month: m, day: 1), .MMMyy, locale: locale)
        guard let dot = text.firstIndex(of: ".") else { return text }
        var out = text
        out.remove(at: dot)
        return out
    }

    /// Signed percent of the sensitivity rows/columns («+10%», «−20%», «0%»).
    public func signedPct(_ value: Double) -> String {
        (value > 0 ? "+" : value < 0 ? BBFormat.minusSign : "") + pct(abs(value), 0)
    }

    // MARK: Headline and deltas

    /// ANA-009 / ANA-010 (`ScenarioHeadline`).
    public func headline(plan: FirePlan, baseline: FirePlan, todayYear: Int) -> AnalyticsHeadline {
        if plan.target == nil {
            return AnalyticsHeadline(lead: tr("Quando puoi smettere di lavorare"), big: tr("Mi serve la tua spesa annua"),
                                     sub: tr("Registra almeno 3 mesi di movimenti oppure scrivila in «Tutte le ipotesi»."),
                                     comparison: nil, positive: false, missing: true)
        }
        let years = plan.yearsToFire
        let big: String
        if let years {
            big = years == 0 ? tr("Già oggi") : String(todayYear + Int(years.rounded(.up)))
        } else {
            big = tr("Oltre 80 anni")
        }
        var comparison: String?
        var positive = false
        if let y = years, let b = baseline.yearsToFire, abs(b - y) >= 0.05 {
            let diff = b - y
            positive = diff > 0
            comparison = tr(diff > 0 ? "{0} prima delle ipotesi salvate" : "{0} dopo delle ipotesi salvate", ["0": formatYears(abs(diff))])
        }
        return AnalyticsHeadline(
            lead: years == 0 ? tr("Hai già raggiunto il numero FIRE") : tr("Puoi smettere di lavorare intorno al"),
            big: big, sub: (years ?? 0) > 0 ? tr("tra {0}", ["0": formatYears(years)]) : nil,
            comparison: comparison, positive: positive, missing: false
        )
    }

    /// ANA-015 (`deltaText`): years earlier/later than the saved plan; nil when negligible.
    public func deltaText(base: Double?, next: Double?) -> String? {
        guard let base, let next else { return next == nil && base != nil ? tr("il traguardo supera gli 80 anni") : nil }
        let diff = base - next
        if abs(diff) < 0.05 { return nil }
        return tr(diff > 0 ? "{0} prima" : "{0} dopo", ["0": formatYears(abs(diff))])
    }

    // MARK: Tiles (ANA-020)

    public func tiles(plan: FirePlan, scenario: Bool, todayYear: Int, lasting: AnalyticsLastingAnswer?, retirementYears: Double,
                      costs: CostSummary, currency: String, simulating: Bool = false) -> [AnalyticsAnswerTile] {
        AnalyticsQuestion.allCases.map { q in
            switch q {
            case .doveSono:
                return AnalyticsAnswerTile(
                    question: q, value: plan.progress.map { pct(min($0, 9.99), 0) } ?? "—",
                    note: plan.target.map { tr("{0} su {1}", ["0": money(plan.wealth, currency), "1": money($0, currency)]) } ?? money(plan.wealth, currency)
                )
            case .quando:
                let value: String
                if let years = plan.yearsToFire { value = years == 0 ? tr("Già qui") : String(todayYear + Int(years.rounded(.up))) } else { value = "—" }
                return AnalyticsAnswerTile(question: q, value: value, note: scenario ? tr("con i valori dei cursori") : tr("ai ritmi attuali"))
            case .reggera:
                if lasting == nil, simulating { return AnalyticsAnswerTile(question: q, value: "", note: "", loading: true) }
                return AnalyticsAnswerTile(
                    question: q, value: lasting.map { pct($0.success, 0) } ?? "—",
                    note: lasting != nil ? tr("su {0} anni, smettendo oggi", ["0": AnalyticsRules.intText(retirementYears)]) : tr("serve la spesa annua")
                )
            case .costi:
                return AnalyticsAnswerTile(
                    question: q, value: costs.totalValue > 0 ? money(costs.annualCost, currency) : "—",
                    note: costs.annualPct.map { tr("{0} l'anno", ["0": pct($0, 2)]) } ?? tr("costo annuo")
                )
            }
        }
    }

    // MARK: Plain answers (`plain-answers.ts`)

    public func successVerdict(_ success: Double) -> AnalyticsVerdict {
        if success >= 0.9 { return AnalyticsVerdict(text: tr("Solida: regge nella grande maggioranza degli scenari"), tone: .pos) }
        if success >= 0.75 { return AnalyticsVerdict(text: tr("Discreta: nei casi sfortunati servirebbe tagliare le spese"), tone: .default) }
        return AnalyticsVerdict(text: tr("Fragile: in troppi scenari il patrimonio finisce prima"), tone: .neg)
    }

    /// Question 1: where you are and where recent growth came from.
    public func journeySentences(plan: FirePlan, split: FireGrowthSplit?, currency: String, withdrawalRate: Double?) -> [String] {
        var out: [String] = []
        if let target = plan.target {
            out.append(tr("Hai {0} su {1} necessari: {2} del percorso.",
                          ["0": money(plan.wealth, currency), "1": money(target, currency), "2": pct(min(plan.progress ?? 0, 9.99), 0)]))
        } else {
            out.append(tr("Hai {0}. Per sapere quanto ti serve indica la spesa annua nelle ipotesi.", ["0": money(plan.wealth, currency)]))
        }
        if plan.target != nil, let spending = plan.spending, let withdrawalRate {
            out.append(tr("Il numero FIRE è la tua spesa annua ({0}) divisa per il tasso di prelievo ({1}).",
                          ["0": money(spending, currency), "1": pct(withdrawalRate)]))
        }
        if let split, split.rows.count >= 2 {
            if let share = split.savingsShare {
                out.append(tr("Negli ultimi 12 mesi il patrimonio è cresciuto di {0}: {1} grazie al tuo risparmio, il resto dal mercato.",
                              ["0": money(split.totalDelta, currency), "1": pct(share, 0)]))
            } else {
                out.append(tr("Negli ultimi 12 mesi il patrimonio è variato di {0}.", ["0": money(split.totalDelta, currency)]))
            }
        }
        return out
    }

    /// Question 2 sentence above the chart: «Con {risparmio} risparmiati l'anno e un rendimento reale del {x}%, in euro di oggi.»
    public func timelineSentence(savings: Double?, expectedReturn: Double, currency: String, baseline: Bool) -> [AnalyticsTextPart] {
        var parts: [AnalyticsTextPart] = [
            .text(tr("Con") + " " + money(savings ?? 0, currency) + " " + tr("risparmiati l'anno e un") + " "),
            .term(id: "rendimento-reale", text: tr("rendimento reale")),
            .text(" " + tr("del") + " " + BBFormat.formatRatio(expectedReturn * 100, digits: 1, locale: locale) + tr("%, in") + " "),
            .term(id: "euro-di-oggi", text: tr("euro di oggi")),
            .text("."),
        ]
        if baseline { parts.append(.text(tr(" La linea tratteggiata è il percorso con le ipotesi salvate."))) }
        return parts
    }

    /// Short rule names (`RULE_SHORT_NAMES`).
    public func ruleShortName(_ rule: WithdrawalRule) -> String {
        switch rule {
        case .fissa: tr("spesa fissa")
        case .percentuale: tr("percentuale del patrimonio")
        case .guytonKlinger: "Guyton-Klinger"
        case .vanguard: tr("Vanguard dinamica")
        }
    }

    /// Long rule names (`RULE_LABELS`), as in «Tutte le ipotesi» and the rules table.
    public func ruleLabel(_ rule: WithdrawalRule) -> String { tr(AnalyticsRules.ruleLabel(rule)) }

    /// Question 3 (`lastingAnswer`), from the rules compared retiring today.
    public func lastingAnswer(_ results: [MonteCarloResult], selected: WithdrawalRule, retirementYears: Double) -> AnalyticsLastingAnswer? {
        guard let current = results.first(where: { $0.rule == selected }) ?? results.first else { return nil }
        let rules = results.map { AnalyticsLastingAnswer.Rule(rule: $0.rule, label: ruleShortName($0.rule), success: $0.successRate) }
        // JS sort is stable: the first of the best wins.
        let best = rules.enumerated().max { a, b in a.element.success != b.element.success ? a.element.success < b.element.success : a.offset > b.offset }!.element
        let better = best.rule != current.rule && best.success > current.successRate + 0.005 ? best : nil
        return AnalyticsLastingAnswer(
            headline: tr("Se smettessi oggi, il patrimonio dura {0} anni nel {1} degli scenari simulati (regola: {2}).",
                         ["0": AnalyticsRules.intText(retirementYears), "1": pct(current.successRate, 0), "2": ruleShortName(current.rule)]),
            verdict: successVerdict(current.successRate), success: current.successRate, rules: rules, better: better
        )
    }

    /// Question 4 (`costsSentences`).
    public func costsSentences(_ summary: CostSummary, lostAfterYears: Double?, years: Int, liquidation: FireLiquidationResult, currency: String) -> [String] {
        if summary.totalValue <= 0 { return [tr("Non hai ancora investimenti: quando ne avrai, qui vedrai quanto costano.")] }
        let cost = money(summary.annualCost, currency)
        let share = summary.annualPct.map { pct($0, 2) }
        // ANA-036: the stamp duty is named only where the country charges one (web `summary.stampDuty`, #465).
        var out = [summary.stampDuty
            ? share.map { tr("Costi dei fondi e bollo: {0} l'anno ({1} del portafoglio).", ["0": cost, "1": $0]) } ?? tr("Costi dei fondi e bollo: {0} l'anno.", ["0": cost])
            : share.map { tr("Costi dei fondi: {0} l'anno ({1} del portafoglio).", ["0": cost, "1": $0]) } ?? tr("Costi dei fondi: {0} l'anno.", ["0": cost])]
        if let lost = lostAfterYears, lost > 0 {
            out.append(tr("In {0} anni sono {1} in meno, a parità di rendimento.", ["0": String(years), "1": money(lost, currency)]))
        }
        if summary.missingTerValue > 0 {
            out.append(tr("Per posizioni da {0} manca il costo del fondo: il totale è più basso del reale.", ["0": money(summary.missingTerValue, currency)]))
        }
        if liquidation.latentTax > 0 {
            out.append(tr("Vendendo tutto oggi pagheresti circa {0} di imposte sulle plusvalenze.", ["0": money(liquidation.latentTax, currency)]))
        }
        return out
    }

    // MARK: Sources of the figures (`return-source.ts`, `cashflow-source-note.tsx`)

    /// Short label under the return slider.
    public func returnSourceLabel(_ info: FireExpectedReturnInfo) -> String {
        switch info.source {
        case .manuale: tr("Scritto a mano")
        case .prudente: tr("Valore prudente")
        case .storico: tr("Dai tuoi dati")
        }
    }

    private func missingReturnText(_ reason: String, currency: String) -> String {
        switch reason {
        case "storico-breve": tr("per partire dal tuo rendimento servono almeno 12 mesi di investimenti nel periodo scelto")
        case "periodo-breve": tr("per calcolare un rendimento annuo serve un periodo di almeno 12 mesi")
        case "patrimonio-basso": tr("con meno di {0} investiti il tuo rendimento dice poco", ["0": money(AnalyticsRules.minInvestedForEstimate, currency)])
        case "prezzi-mancanti": tr("alcuni titoli non hanno un prezzo e il tuo rendimento non sarebbe affidabile")
        default: tr("senza investimenti registrati non c'è un tuo rendimento da cui partire")
        }
    }

    /// Where the return in use comes from (info hint under the slider and in «Tutte le ipotesi»).
    public func returnSourceText(_ info: FireExpectedReturnInfo, currency: String, period: DataPeriod) -> String {
        switch info.source {
        case .manuale:
            return tr("Inserito a mano.")
        case .prudente:
            var reason = ""
            if case .manca(let r) = info.history { reason = missingReturnText(r, currency: currency) }
            return tr("Uso un {0} prudente: {1}.", ["0": pct(FireAssumptions.defaults.expectedReturn, 0), "1": reason])
        case .storico:
            guard case let .ok(months, shorter, fromKey, toKey, nominal, _) = info.history, let real = info.historyReal else { return "" }
            let clamped = info.clamped ? tr(" Uso {0}, il limite del cursore.", ["0": pct(info.value)]) : ""
            let when: String
            if shorter {
                when = tr("negli ultimi {0} mesi (da quando investi)", ["0": String(months)])
            } else if case .ultimi(let m) = period {
                when = tr("negli ultimi {0} mesi", ["0": String(m)])
            } else {
                when = tr("da {0} a {1}", ["0": monthText(fromKey), "1": monthText(toKey)])
            }
            return tr("Il tuo portafoglio {0} ha reso {1} l'anno, {2} tolta l'inflazione.{3}",
                      ["0": when, "1": pct(nominal), "2": pct(real), "3": clamped])
        }
    }

    /// Warning text above 8% (`HIGH_RETURN_TEXT`).
    public var highReturnText: String {
        tr("Sopra {0} reale le proiezioni diventano ottimistiche: nel lungo periodo le borse mondiali hanno reso in media intorno al 5% reale.",
           ["0": pct(FirePlanning.highReturnWarning, 0)])
    }

    /// Info hint of «Dai tuoi dati» under savings / spending.
    public func cashflowAverageText(periodPhrase: String, coveredMonths: Int, periodMonths: Int) -> String {
        let average = coveredMonths < periodMonths
            ? tr("dei {0} mesi da quando registri i movimenti", ["0": String(coveredMonths)])
            : tr("dei movimenti {0}", ["0": periodPhrase])
        return tr("Media mensile") + " " + average + tr(", moltiplicata per 12. I giroconti tra i tuoi conti non contano.")
    }

    /// ANA-018: «Non nota» hint.
    public var notKnownHint: String {
        tr("Per calcolarla") + " " + tr("servono almeno 3 mesi di movimenti nel periodo scelto") + tr(". Puoi scriverla in «Tutte le ipotesi».")
    }

    /// «Altre ipotesi: volatilità 12%, inflazione 2%, imposte contate».
    /// «Altre ipotesi: volatilità 12%, inflazione 2%, imposte contate»; without the taxes where the country has none (ANA-036).
    public func otherAssumptions(_ a: FireAssumptions, taxes: Bool = true) -> String {
        guard taxes else {
            return tr("Altre ipotesi: volatilità {0}, inflazione {1}", ["0": pct(a.volatility, 0), "1": pct(a.inflation, 0)])
        }
        return tr("Altre ipotesi: volatilità") + " " + pct(a.volatility, 0) + tr(", inflazione") + " " + pct(a.inflation, 0) + tr(", imposte") + " "
            + (a.includeLatentTax ? tr("contate") : tr("non contate"))
    }

    // MARK: Glossary (ANA-032)

    /// `GlossedText`: the first occurrence of each glossary phrase becomes a term (case-insensitive, whole words).
    public func glossed(_ text: String) -> [AnalyticsTextPart] { AnalyticsRules.glossed(text) }
}

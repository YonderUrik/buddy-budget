import Foundation

// Debiti screens state and rules (spec: features/10-debts.md). The server computes plans, totals and the overview
// readings (`GET /api/debts?include=insights`); the per-loan «E se…» simulators run on the device with the ported
// `DebtCalc`. Same names on Android (`DebtsUiState.kt`).

/// What the overview and the detail show (shared "view gate", DEBT-008). Same cases as `DebtsGate` on Android.
public enum DebtsGate: Equatable, Sendable {
    case loading, failed, empty, content

    public static func of(loaded: Bool, failed: Bool, count: Int) -> DebtsGate {
        if !loaded { return failed ? .failed : .loading }
        return count == 0 ? .empty : .content
    }
}

/// Simulation hypotheses of «E se…» (DEBT-030/031, the one-off opens the early-repayment dialog).
public enum DebtSimulationKind: String, Sendable, CaseIterable {
    case extra, estinzione, surroga

    public var label: String {
        switch self {
        case .extra: "Più ogni mese"
        case .estinzione: "Una tantum"
        case .surroga: "Surroga"
        }
    }
}

/// Simple event dialogs (DEBT-025/026).
public enum DebtEventDialogKind: String, Sendable, CaseIterable {
    case rateChange = "rate_change"
    case balanceCorrection = "balance_correction"

    public var title: String { self == .rateChange ? "Cambio di tasso" : "Correggi il residuo" }
    public var description: String {
        self == .rateChange
            ? "Dalla data indicata le rate si ricalcolano al nuovo tasso, con lo stesso numero di rate."
            : "Se il residuo reale è diverso da quello del piano (rate saltate, sospensioni, estinzioni parziali), indicalo: il piano riparte da lì."
    }
    public var label: String { self == .rateChange ? "Nuovo tasso annuo (TAN, %)" : "Capitale residuo reale" }
    public var hint: String { self == .rateChange ? "Quello scritto dalla banca" : "Lo trovi sull'estratto o nell'area clienti della banca" }
    public var submit: String { self == .rateChange ? "Registra cambio tasso" : "Correggi il residuo" }

    /// `parseAmount` then: rate ≥ 0; residual > 0 («Inserisci un valore valido»).
    public func input(date: String, value text: String) -> Result<DebtEventInput, DebtsMessage> {
        guard let value = BBFormat.parseAmount(text), value >= 0, value > 0 || self == .rateChange else {
            return .failure(DebtsMessage("Inserisci un valore valido"))
        }
        return .success(self == .rateChange ? .rateChange(date: date, rate: value) : .balanceCorrection(date: date, amount: value))
    }
}

/// An Italian catalog key (translate in the UI).
public struct DebtsMessage: Error, Equatable, Sendable {
    public let source: String
    public init(_ source: String) { self.source = source }
}

/// Labels of the add-debt fields by start mode (`FIELD_COPY`).
public struct DebtFieldCopy: Equatable, Sendable {
    public let principal: String
    public let installments: String
    public let firstDate: String

    public static func of(_ mode: DebtStartMode) -> DebtFieldCopy {
        switch mode {
        case .nuovo: DebtFieldCopy(principal: "Capitale", installments: "Numero di rate", firstDate: "Prima rata")
        case .origine: DebtFieldCopy(principal: "Capitale erogato", installments: "Numero di rate totali", firstDate: "Data della prima rata")
        case .fotografia: DebtFieldCopy(principal: "Residuo di oggi", installments: "Rate rimanenti", firstDate: "Prossima rata")
        }
    }
}

/// The three start modes of the add flow (DEBT-009, `START_OPTIONS`).
public struct DebtStartOption: Equatable, Sendable {
    public let mode: DebtStartMode
    public let title: String
    public let description: String

    public static let all: [DebtStartOption] = [
        DebtStartOption(mode: .nuovo, title: "Inizia da oggi",
                        description: "Il finanziamento parte adesso o l'hai appena firmato. Il piano è tutto da pagare."),
        DebtStartOption(mode: .origine, title: "Già in corso: ho i dati del contratto",
                        description: "Inserisci capitale, tasso e rate di quando l'hai preso. Ricostruiamo il piano e vedi quante rate sono già passate: poi confermi quelle che hai pagato. Adatto se hai il contratto sotto mano."),
        DebtStartOption(mode: .fotografia, title: "Già in corso: parto da com'è oggi",
                        description: "Inserisci quanto devi ancora restituire, la rata e le rate rimaste. Il piano parte da oggi, senza storico. Adatto se non hai più il contratto o è stato rinegoziato."),
    ]
}

/// Pure rules of the Debiti screens. Same names on Android (`DebtsRules`).
public enum DebtsRules {
    /// Exit plan and per-loan extra slider (DEBT-006, DEBT-030).
    public static let extraDefault = 200.0
    public static let extraMax = 1000.0
    public static let extraStep = 50.0
    /// Amortization plan rows shown before «Mostra tutte» (DEBT-021).
    public static let planVisiblePast = 2
    public static let planVisibleFuture = 8
    /// DEBT-024: days before and after the due date where the linked transaction is searched.
    public static let candidateWindowDays = 20
    /// DEBT-014.
    public static let maxCosts = 10
    public static let nameMaxLength = 80
    /// Add flow: start mode + three detail steps.
    public static let addSteps = 4

    /// Days from `today` to `date` (negative when past).
    public static func daysBetween(_ today: String, _ date: String) -> Int {
        guard let a = CalendarDate(iso: today), let b = CalendarDate(iso: date) else { return 0 }
        return b.epochDay - a.epochDay
    }

    /// DEBT-003 relative text: (catalog key, values).
    public static func dueText(_ days: Int) -> (source: String, values: [String: String]) {
        if days == 0 { return ("oggi", [:]) }
        if days == 1 { return ("domani", [:]) }
        if days > 1 { return ("tra {0} giorni", ["0": String(days)]) }
        return days == -1 ? ("scaduta ieri", [:]) : ("scaduta da {0} giorni", ["0": String(-days)])
    }

    /// Share of the principal already repaid (0-1, `repaidShare`): the server's reading when present.
    public static func repaidShare(_ debt: DebtView, insights: DebtsInsights?) -> Double {
        if let share = insights?.repaid.first(where: { $0.debtId == debt.id })?.share { return min(1, max(0, share)) }
        guard let first = debt.plan.rows.first else { return 0 }
        let total = first.residual + first.capital
        return total > 0 ? min(1, max(0, 1 - debt.plan.totals.residual / total)) : 0
    }

    /// DEBT-002: latest end date among open loans.
    public static func freeDate(_ debts: [DebtView]) -> String? {
        debts.filter { !$0.finished }.map(\.plan.totals.endDate).max()
    }

    public static func openCount(_ debts: [DebtView]) -> Int { debts.filter { !$0.finished }.count }

    /// DEBT-004: the plan row of an overview due (by date, unsettled).
    public static func dueRow(_ debt: DebtView?, date: String) -> DebtPlanRow? {
        debt?.plan.rows.first { $0.dueDate == date && $0.status != .pagata }
    }

    /// DEBT-020: past installments not yet settled (overdue or to confirm).
    public static func unsettled(_ debt: DebtView) -> [DebtPlanRow] {
        debt.plan.rows.filter { $0.status == .daConfermare || $0.status == .scaduta }
    }

    /// DEBT-021: indices of the rows shown by default (last 2 past, next 8).
    public static func visibleRange(_ rows: [DebtPlanRow], today: String) -> Range<Int> {
        let firstFuture = rows.firstIndex { $0.dueDate >= today } ?? rows.count
        return max(0, firstFuture - planVisiblePast)..<min(rows.count, firstFuture + planVisibleFuture)
    }

    /// DEBT-027: newest first.
    public static func orderedEvents(_ debt: DebtView) -> [DebtEventView] {
        debt.events.enumerated().sorted { a, b in
            a.element.date != b.element.date ? a.element.date > b.element.date : a.offset < b.offset
        }.map(\.element)
    }

    /// DEBT-023: a past due date is paid on its date; a future one today.
    public static func defaultPaymentDate(_ row: DebtPlanRow, today: String) -> String { row.dueDate < today ? row.dueDate : today }

    /// DEBT-023: the paid amount must be > 0 («Inserisci l'importo pagato»).
    public static func paymentInput(_ row: DebtPlanRow, date: String, amount text: String, transactionId: String?) -> Result<DebtEventInput, DebtsMessage> {
        guard let value = BBFormat.parseAmount(text), value > 0 else { return .failure(DebtsMessage("Inserisci l'importo pagato")) }
        return .success(.payment(installmentNumber: row.number, date: date, amount: value, transactionId: transactionId))
    }

    // MARK: Plan terms for the on-device simulators

    /// `toPlanTerms`.
    public static func terms(_ debt: DebtView) -> DebtTerms? {
        guard let first = CalendarDate(iso: debt.firstInstallmentDate) else { return nil }
        return DebtTerms(startMode: debt.startMode, principal: debt.principal, annualRate: debt.annualRate,
                         installments: debt.installments, firstInstallmentDate: first, installment: debt.declaredInstallment)
    }

    /// `toPlanEvent` (events missing their figures are skipped, as on the web).
    public static func planEvents(_ debt: DebtView) -> [DebtPlanEvent] {
        debt.events.compactMap { e in
            guard let date = CalendarDate(iso: e.date) else { return nil }
            switch e.type {
            case "payment":
                guard let n = e.installmentNumber, let amount = e.amount else { return nil }
                return .payment(installmentNumber: n, date: date, amount: amount, transactionId: e.transactionId)
            case "rate_change":
                return e.rate.map { .rateChange(date: date, rate: $0) }
            case "balance_correction":
                return e.amount.map { .balanceCorrection(date: date, amount: $0) }
            case "early_repayment":
                guard let amount = e.amount, let effect = e.effect.flatMap(DebtEarlyRepaymentEffect.init(rawValue:)) else { return nil }
                return .earlyRepayment(date: date, amount: amount, penalty: e.penalty ?? 0, effect: effect)
            default:
                return nil
            }
        }
    }

    // MARK: Simulations

    /// DEBT-006: index of the server's exit plan for a slider value (nearest step).
    public static func exitPlan(_ insights: DebtsInsights?, extra: Double) -> DebtsInsights.ExitPlan? {
        guard let exit = insights?.exit, !exit.extras.isEmpty else { return nil }
        let index = exit.extras.indices.min { abs(exit.extras[$0] - extra) < abs(exit.extras[$1] - extra) } ?? 0
        return index < exit.plans.count ? exit.plans[index] : nil
    }

    /// DEBT-030: one loan, with and without `extra` per month (`simulatePayoff`).
    public static func extraSimulation(_ debt: DebtView, extra: Double, today: String) -> DebtExtraSimulation? {
        guard let day = CalendarDate(iso: today) else { return nil }
        let loan = [DebtPayoffLoan(id: debt.id, name: debt.name, residual: debt.totals.residual, annualRate: debt.annualRate,
                                   installment: debt.totals.currentInstallment)]
        let base = DebtCalc.simulatePayoff(loan, monthlyExtra: 0, strategy: .none, today: day)
        let faster = DebtCalc.simulatePayoff(loan, monthlyExtra: extra, strategy: .avalanche, today: day)
        return DebtExtraSimulation(monthsSaved: base.months - faster.months, interestSaved: base.totalInterest - faster.totalInterest,
                                   endDate: faster.endDate.iso, baselineEndDate: base.endDate.iso)
    }

    /// DEBT-031: nil until a valid rate (≥ 0) and a whole number of installments (≥ 1) are typed.
    public static func refinance(_ debt: DebtView, rate: String, installments: String, costs: String, penalty: String,
                                 today: String) -> DebtRefinanceResult? {
        let annualRate = JSNumber.trim(rate).isEmpty ? nil : BBFormat.parseAmount(rate)
        guard let annualRate, annualRate >= 0, let count = BBFormat.parseAmount(installments), count >= 1,
              count.rounded(.towardZero) == count, let day = CalendarDate(iso: today),
              let end = CalendarDate(iso: debt.totals.endDate) else { return nil }
        let current = DebtRefinanceCurrent(residual: debt.totals.residual, currentInstallment: debt.totals.currentInstallment,
                                           interestRemaining: debt.totals.interestRemaining, endDate: end)
        let offer = DebtRefinanceOffer(annualRate: annualRate, installments: Int(count),
                                       upfrontCosts: BBFormat.parseAmount(costs) ?? 0, penalty: BBFormat.parseAmount(penalty) ?? 0)
        return try? DebtCalc.compareRefinance(current, today: day, offer: offer)
    }

    /// DEBT-032…035: preview of the early-repayment dialog with the debt's terms and events.
    public static func earlyRepayment(_ debt: DebtView, today: String, values: DebtEarlyRepaymentFormValues) -> DebtEarlyRepaymentPreview {
        guard let terms = terms(debt), let day = CalendarDate(iso: today) else { return .empty }
        let events = planEvents(debt)
        do {
            let plan = try DebtCalc.buildLoanPlan(terms, events, today: day)
            return try DebtCalc.previewEarlyRepayment(terms: terms, events: events, plan: plan, today: day, values: values)
        } catch let error as DebtAmortizationError {
            return .error(message: error.message)
        } catch {
            return .error(message: "Qualcosa è andato storto. Riprova.")
        }
    }
}

/// Result of the per-loan extra slider (DEBT-030).
public struct DebtExtraSimulation: Equatable, Sendable {
    public let monthsSaved: Int
    public let interestSaved: Double
    public let endDate: String
    public let baselineEndDate: String

    /// `extra > 0 && monthsSaved > 0` shows the gain sentence, otherwise the hint.
    public func showsGain(extra: Double) -> Bool { extra > 0 && monthsSaved > 0 }
}

/// The three lines of a simulator answer (`SimulationResult`): label, big figure, caption; `positive` picks the tone.
public struct SimulationText: Equatable, Sendable {
    public let label: String
    public let value: String
    public let caption: String
    public let positive: Bool
}

/// Everything the Debiti screens render, derived from the last response. Same fields as `DebtsUiState` on Android.
public struct DebtsUiState: Equatable, Sendable {
    public var data: DebtsViewData?
    public var failed = false
    /// Loan open in the detail (DEBT-019); nil = first loan.
    public var selectedId: String?
    /// «Come uscirne prima» slider (overview).
    public var exitExtra = DebtsRules.extraDefault
    public var today: String

    public init(today: String) { self.today = today }

    public var gate: DebtsGate { DebtsGate.of(loaded: data != nil, failed: failed, count: data?.debts.count ?? 0) }
    public var debts: [DebtView] { data?.debts ?? [] }

    /// The loan of the detail: the selected one, or the first.
    public var selected: DebtView? { debts.first { $0.id == selectedId } ?? debts.first }

    /// DEBT-006: plan for the current slider value (nil hides the card).
    public var exitPlan: DebtsInsights.ExitPlan? { DebtsRules.exitPlan(data?.insights, extra: exitExtra) }

    /// DEBT-007: hidden when no interest is paid.
    public var interest: DebtsInsights.InterestShares? {
        guard let shares = data?.insights?.interestShares, !shares.items.isEmpty else { return nil }
        return shares
    }
}

/// Debiti phrasing (web components under `components/domain/debts`), bound to one language. `translate` maps an
/// Italian catalog key to its template in the app language (identity in tests). Same API on Android.
public struct DebtsText {
    public let locale: BBLocale
    private let translate: (String) -> String

    public init(locale: BBLocale, translate: @escaping (String) -> String) {
        self.locale = locale
        self.translate = translate
    }

    public func tr(_ key: String, _ values: [String: String] = [:]) -> String {
        let template = translate(key)
        return values.isEmpty ? template : BBFormat.interpolate(template, values)
    }

    public func money(_ value: Double, _ currency: String, digits: Int = 2, masked: Bool = false) -> String {
        BBFormat.formatCurrency(value, currency: currency, locale: locale, maximumFractionDigits: digits, masked: masked)
    }

    /// "febbraio 2027".
    public func monthYear(_ iso: String) -> String {
        CalendarDate(iso: iso).map { BBFormat.formatMonthYear($0, locale: locale) } ?? "—"
    }

    /// "4 anni e 5 mesi".
    public func duration(_ months: Int) -> String {
        BBFormat.formatDuration(months, language: locale.language, translate: { translate($0) })
    }

    /// "2,90%" (two decimals, the web's `toFixed(2)` with the locale separator).
    public func percent(_ value: Double) -> String {
        BBFormat.formatNumber(value, minimumFractionDigits: 2, maximumFractionDigits: 2, locale: locale) + "%"
    }

    /// DEBT-002: «{n} finanziamenti · liberi da debiti a {mese anno}» or «Nessun finanziamento aperto».
    public func heroSubtitle(openCount: Int, freeDate: String?) -> String {
        if openCount == 0 { return tr("Nessun finanziamento aperto") }
        let count = openCount == 1 ? tr("un finanziamento") : tr("{0} finanziamenti", ["0": String(openCount)])
        return tr("{0} · liberi da debiti a {1}", ["0": count, "1": freeDate.map(monthYear) ?? "—"])
    }

    public func dueText(_ days: Int) -> String {
        let text = DebtsRules.dueText(days)
        return tr(text.source, text.values)
    }

    /// DEBT-005 row detail: «finisce a {mese anno} · 2,94% TAEG» or «Estinto».
    public func listDetail(_ debt: DebtView) -> String {
        if debt.finished { return tr("Estinto") }
        let apr = debt.apr.map { " · \(BBFormat.formatPct($0 / 100, digits: 2, locale: locale)) \(tr("TAEG"))" } ?? ""
        return tr("finisce a {0}{1}", ["0": monthYear(debt.totals.endDate), "1": apr])
    }

    public func startMode(_ mode: DebtStartMode) -> String {
        switch mode {
        case .nuovo: tr("Nuovo")
        case .origine: tr("In corso · dall'origine")
        case .fotografia: tr("In corso · fotografia di oggi")
        }
    }

    public func status(_ status: DebtInstallmentStatus) -> String {
        switch status {
        case .pagata: tr("Pagata")
        case .daPagare: tr("Da pagare")
        case .scaduta: tr("Scaduta")
        case .daConfermare: tr("Da confermare")
        }
    }

    /// DEBT-018 fact: «2,90% · 2,94%».
    public func rates(_ debt: DebtView) -> String {
        "\(percent(debt.annualRate)) · \(debt.apr.map(percent) ?? "—")"
    }

    /// DEBT-018: «ancora da restituire · finisce a {mese anno}» or «Estinto».
    public func residualCaption(_ debt: DebtView) -> String {
        debt.finished ? tr("Estinto") : tr("ancora da restituire · finisce a {0}", ["0": monthYear(debt.totals.endDate)])
    }

    /// DEBT-020 banner text.
    public func pending(_ debt: DebtView) -> String? {
        let unsettled = DebtsRules.unsettled(debt)
        guard !unsettled.isEmpty else { return nil }
        let overdue = debt.totals.overdueCount
        if overdue > 0 {
            let head = overdue == 1 ? tr("Una rata è scaduta") : tr("{0} rate sono scadute", ["0": String(overdue)])
            return tr("{0} e non l'hai segnata come pagata.", ["0": head])
        }
        let count = unsettled.count == 1 ? tr("una rata già passata") : tr("{0} rate già passate", ["0": String(unsettled.count)])
        return tr("Il piano conta {0}: se le hai pagate, confermale.", ["0": count])
    }

    /// DEBT-020 toast.
    public func bulkDone(_ count: Int) -> String {
        count == 1 ? tr("Una rata segnata come pagata") : tr("{0} rate segnate come pagate", ["0": String(count)])
    }

    /// DEBT-027 event line.
    public func event(_ event: DebtEventView, currency: String, masked: Bool = false) -> String {
        switch event.type {
        case "payment":
            let amount = (event.amount ?? 0) != 0 ? " · \(money(event.amount ?? 0, currency, masked: masked))" : ""
            return tr("Rata {0} pagata{1}", ["0": event.installmentNumber.map(String.init) ?? "", "1": amount])
        case "rate_change":
            return tr("Tasso portato al {0}%", ["0": BBFormat.formatNumber(event.rate ?? 0, maximumFractionDigits: 4, locale: locale)])
        case "early_repayment":
            let how = event.effect == DebtEarlyRepaymentEffect.reduceInstallment.rawValue ? tr("rata ridotta") : tr("durata ridotta")
            let penalty = (event.penalty ?? 0) != 0 ? tr(" · penale {0}", ["0": money(event.penalty ?? 0, currency, masked: masked)]) : ""
            return tr("Estinzione anticipata di {0} · {1}{2}", ["0": money(event.amount ?? 0, currency, masked: masked), "1": how, "2": penalty])
        default:
            return tr("Residuo corretto a {0}", ["0": money(event.amount ?? 0, currency, masked: masked)])
        }
    }

    /// DEBT-021 toggle.
    public func planToggle(showAll: Bool, total: Int, hidden: Int) -> String {
        showAll ? tr("Mostra meno") : tr("Mostra tutte le {0} rate (altre {1})", ["0": String(total), "1": String(hidden)])
    }

    /// DEBT-022 phone row: «Capitale 273,35 € · interessi 91,83 € · residuo 37.726,65 €».
    public func rowBreakdown(_ row: DebtPlanRow, currency: String, masked: Bool = false) -> String {
        "\(tr("Capitale")) \(money(row.capital, currency, masked: masked)) \(tr("· interessi")) \(money(row.interest, currency, masked: masked)) \(tr("· residuo")) \(money(row.residual, currency, masked: masked))"
    }

    /// DEBT-006 step line: «Chiuso a {mese anno} invece di {mese anno}».
    public func exitStep(_ step: DebtsInsights.ExitStep) -> String {
        "\(tr("Chiuso a")) \(monthYear(step.endDate))" + (step.monthsSaved > 0 ? tr(" invece di {0}", ["0": monthYear(step.baselineEndDate)]) : "")
    }

    /// DEBT-030 result sentence (runs) or the hint.
    public func extraSentence(_ sim: DebtExtraSimulation, extra: Double, currency: String, masked: Bool = false) -> [InvestmentsTextRun] {
        guard sim.showsGain(extra: extra) else {
            return [InvestmentsTextRun(tr("Muovi lo slider per vedere quanto anticipi la fine e quanto risparmi."), .muted)]
        }
        return [
            InvestmentsTextRun("\(tr("Finisci")) "),
            InvestmentsTextRun("\(duration(sim.monthsSaved)) \(tr("prima"))", .strong),
            InvestmentsTextRun(" (\(monthYear(sim.endDate)) \(tr("invece di")) \(monthYear(sim.baselineEndDate))\(tr(") e risparmi")) "),
            InvestmentsTextRun(money(sim.interestSaved, currency, digits: 0, masked: masked), .pos),
            InvestmentsTextRun(" \(tr("di interessi."))"),
        ]
    }

    /// DEBT-031 verdict and whether it is a saving.
    public func refinanceVerdict(_ result: DebtRefinanceResult, currency: String, masked: Bool = false) -> (text: String, positive: Bool) {
        let saving = result.netSaving
        if saving > 0 {
            let breakEven = result.breakEvenMonths.map { ", " + tr("e le spese rientrano in {0} mesi", ["0": String($0)]) } ?? ""
            return (tr("Conviene: risparmi {0} al netto delle spese{1}.", ["0": money(saving, currency, masked: masked), "1": breakEven]), true)
        }
        return (tr("Non conviene: spenderesti {0} in più tra interessi e spese.", ["0": money(abs(saving), currency, masked: masked)]), false)
    }

    /// DEBT-030 as a `SimulationResult` (#411): «Finisci prima di» + the duration + «{fine} invece di {base}, e risparmi
    /// {interessi} di interessi.»; nil shows the slider hint instead.
    public func extraResult(_ sim: DebtExtraSimulation, extra: Double, currency: String, masked: Bool = false) -> SimulationText? {
        guard sim.showsGain(extra: extra) else { return nil }
        return SimulationText(label: tr("Finisci prima di"), value: duration(sim.monthsSaved),
                              caption: tr("{0} invece di {1}, e risparmi {2} di interessi.", ["0": monthYear(sim.endDate), "1": monthYear(sim.baselineEndDate),
                                                                                              "2": money(sim.interestSaved, currency, digits: 0, masked: masked)]),
                              positive: true)
    }

    /// DEBT-031 as a `SimulationResult` (#411): the net saving (pos) or extra cost (neg) as the figure.
    public func refinanceResult(_ result: DebtRefinanceResult, currency: String, masked: Bool = false) -> SimulationText {
        let saving = result.netSaving
        if saving > 0 {
            let caption = result.breakEvenMonths.map { tr("Al netto delle spese, che rientrano in {0} mesi.", ["0": String($0)]) } ?? tr("Al netto delle spese.")
            return SimulationText(label: tr("Conviene: risparmi"), value: money(saving, currency, digits: 0, masked: masked), caption: caption, positive: true)
        }
        return SimulationText(label: tr("Non conviene: spenderesti in più"), value: money(abs(saving), currency, digits: 0, masked: masked),
                              caption: tr("Tra interessi e spese."), positive: false)
    }

    /// DEBT-011 notice: «Abbiamo calcolato la rata: 365,18 €. Può differire…».
    public func calculated(_ key: DebtLoanInputKey, value: Double, currency: String) -> [InvestmentsTextRun] {
        let label: String
        let formatted: String
        switch key {
        case .principal: label = "il capitale"; formatted = money(value, currency)
        case .installment: label = "la rata"; formatted = money(value, currency)
        case .installments: label = "il numero di rate"; formatted = String(Int(value))
        case .annualRate: label = "il tasso"; formatted = percent(value)
        }
        return [
            InvestmentsTextRun("\(tr("Abbiamo calcolato")) \(tr(label)): "),
            InvestmentsTextRun(formatted, .strong),
            InvestmentsTextRun(tr(". Può differire di poco da quello della banca, per gli arrotondamenti.")),
        ]
    }

    /// Placeholder of the computed field (no grouping, up to 2 decimals).
    public func calculatedPlaceholder(_ key: DebtLoanInputKey, resolved: DebtResolvedAddForm?) -> String {
        guard let resolved, resolved.calculated == key else { return "" }
        let value: Double
        switch key {
        case .principal: value = resolved.inputs.principal
        case .installment: value = resolved.inputs.installment
        case .installments: value = resolved.inputs.installments
        case .annualRate: value = resolved.inputs.annualRate
        }
        return AmountInputText.input(value, locale: locale)
    }

    /// DEBT-032 baseline sentence.
    public func baseline(_ comparison: DebtEarlyRepaymentComparison, currency: String, masked: Bool = false) -> String {
        "\(tr("Senza estinzione: rata")) \(money(comparison.baselineInstallment, currency, masked: masked))\(tr(", fine")) \(BBFormat.formatMonthYear(comparison.baselineEndDate, locale: locale))\(tr(", ancora")) \(money(comparison.baselineInterest, currency, masked: masked)) \(tr("di interessi."))"
    }

    /// «stessa scadenza» / «1 mese prima» / «{n} mesi prima».
    public func monthsEarlier(_ months: Int) -> String {
        if months <= 0 { return tr("stessa scadenza") }
        return months == 1 ? tr("1 mese prima") : tr("{0} mesi prima", ["0": String(months)])
    }

    /// «{mese anno} · N mesi prima».
    public func finish(_ date: CalendarDate, monthsSaved: Int) -> String {
        "\(BBFormat.formatMonthYear(date, locale: locale)) · \(monthsEarlier(monthsSaved))"
    }
}

/// Deep links into Debiti (DEBT-038). Same names on Android.
public enum DebtsRoutes {
    /// `/debiti/finanziamenti?id=X` → "X"; without id (or the legacy `/debiti/simulatore`) → "" (first loan);
    /// `/debiti` → nil (overview).
    public static func detailId(path: String) -> String? {
        let parts = path.split(separator: "?", maxSplits: 1)
        let clean = String(parts.first ?? "")
        guard clean == "/debiti/finanziamenti" || clean == "/debiti/simulatore" else { return nil }
        guard parts.count > 1 else { return "" }
        for pair in parts[1].split(separator: "&") {
            let kv = pair.split(separator: "=", maxSplits: 1)
            if kv.count == 2, kv[0] == "id" { return String(kv[1]) }
        }
        return ""
    }
}

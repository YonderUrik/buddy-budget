import Foundation

// Ports of the web's `lib/debts/add-form.ts` and `lib/debts/early-repayment-form.ts`: pure state and rules of the
// "Aggiungi debito" form and the "Estinzione anticipata" dialog. Messages are Italian source strings (catalog keys).

/// Kind of an extra cost of the add form.
public enum DebtCostKind: String, Sendable, CaseIterable {
    case unaTantum = "una_tantum"
    case perRata = "per_rata"
}

/// `AddDebtCostField` (text as typed).
public struct DebtAddCostField: Hashable, Sendable {
    public var label: String
    public var amount: String
    public var kind: DebtCostKind
    public init(label: String, amount: String, kind: DebtCostKind) {
        self.label = label
        self.amount = amount
        self.kind = kind
    }
}

/// `AddDebtFormState`: every field as typed text.
public struct DebtAddFormState: Hashable, Sendable {
    public var name: String
    public var startMode: DebtStartMode
    public var principal: String
    public var installment: String
    public var installments: String
    public var annualRate: String
    /// `YYYY-MM-DD` or empty.
    public var firstInstallmentDate: String
    public var costs: [DebtAddCostField]

    public init(name: String = "", startMode: DebtStartMode, principal: String = "", installment: String = "", installments: String = "",
                annualRate: String = "", firstInstallmentDate: String = "", costs: [DebtAddCostField] = []) {
        self.name = name
        self.startMode = startMode
        self.principal = principal
        self.installment = installment
        self.installments = installments
        self.annualRate = annualRate
        self.firstInstallmentDate = firstInstallmentDate
        self.costs = costs
    }
}

/// `ResolvedAddForm`.
public struct DebtResolvedAddForm: Hashable, Sendable {
    public var inputs: DebtLoanInputs
    public var calculated: DebtLoanInputKey?
    /// TAEG in % (nuovo/origine), nil otherwise or when not computable.
    public var apr: Double?
}

/// `AddFormResolution`: `failure(nil)` = still typing (fewer than three figures), not an error.
public enum DebtAddFormResolution: Hashable, Sendable {
    case ok(DebtResolvedAddForm)
    case failure(message: String?)
}

/// `AddFormPreview`.
public struct DebtAddFormPreview: Hashable, Sendable {
    public var installment: Double
    public var totalInterest: Double
    public var endDate: CalendarDate
}

/// One cost of the create payload.
public struct DebtCreateCost: Hashable, Sendable {
    public var label: String
    public var amount: Double
    public var kind: DebtCostKind
}

/// Body of `POST /api/debts` built by `buildCreateDebtInput` (nil fields are omitted).
public struct DebtCreateInput: Hashable, Sendable {
    public var name: String
    public var startMode: DebtStartMode
    public var principal: Double
    public var annualRate: Double
    public var installments: Int
    public var firstInstallmentDate: String
    public var installment: Double?
    public var anchorDate: String?
    public var costs: [DebtCreateCost]
}

/// `PenaltyUnit`.
public enum DebtPenaltyUnit: String, Sendable, CaseIterable {
    case eur, percent
}

/// `EarlyRepaymentMode`.
public enum DebtEarlyRepaymentMode: String, Sendable, CaseIterable {
    case once, monthly
}

/// `EarlyRepaymentFormValues`.
public struct DebtEarlyRepaymentFormValues: Hashable, Sendable {
    public var mode: DebtEarlyRepaymentMode
    /// `YYYY-MM-DD` or empty.
    public var date: String
    public var amount: String
    public var penalty: String
    public var penaltyUnit: DebtPenaltyUnit
    public init(mode: DebtEarlyRepaymentMode, date: String, amount: String, penalty: String, penaltyUnit: DebtPenaltyUnit) {
        self.mode = mode
        self.date = date
        self.amount = amount
        self.penalty = penalty
        self.penaltyUnit = penaltyUnit
    }
}

/// `EarlyRepaymentPreview`.
public enum DebtEarlyRepaymentPreview: Hashable, Sendable {
    case empty
    case error(message: String)
    case once(amount: Double, penalty: Double, date: CalendarDate, comparison: DebtEarlyRepaymentComparison)
    case monthly(amount: Double, result: DebtRecurringExtraResult)
}

extension DebtCalc {
    static let minFilledFields = 3

    /// `emptyAddDebtForm`.
    public static func emptyAddDebtForm(_ startMode: DebtStartMode) -> DebtAddFormState { DebtAddFormState(startMode: startMode) }

    /// Italian-style number ("1.250,50", "6,9"); empty or invalid → nil. Same as `BBFormat.parseAmount`.
    public static func parseAmount(_ text: String) -> Double? { BBFormat.parseAmount(text) }

    static func isIsoDateText(_ s: String) -> Bool {
        let u = Array(s.utf8)
        guard u.count == 10, u[4] == 45, u[7] == 45 else { return false }
        return [0, 1, 2, 3, 5, 6, 8, 9].allSatisfy { u[$0] >= 48 && u[$0] <= 57 }
    }

    /// Resolves the four loan figures: < 3 → `failure(nil)`; 3 → computes the fourth; 4 → as typed.
    public static func resolveAddForm(_ state: DebtAddFormState) -> DebtAddFormResolution {
        let partial = DebtPartialLoanInputs(principal: parseAmount(state.principal), installment: parseAmount(state.installment),
                                            installments: parseAmount(state.installments), annualRate: parseAmount(state.annualRate))
        let filled = [partial.principal, partial.installment, partial.installments, partial.annualRate].filter { $0 != nil }.count
        if filled < minFilledFields { return .failure(message: nil) }
        if let n = partial.installments, n.rounded(.towardZero) != n {
            return .failure(message: "Il numero di rate deve essere intero")
        }
        do {
            let resolved = try resolveMissingLoanInput(partial)
            return .ok(DebtResolvedAddForm(inputs: resolved.inputs, calculated: resolved.calculated, apr: computeFormApr(state, resolved.inputs)))
        } catch let error as DebtAmortizationError {
            return .failure(message: error.message)
        } catch {
            return .failure(message: String(describing: error))
        }
    }

    static func sumCosts(_ costs: [DebtAddCostField], _ kind: DebtCostKind) -> Double {
        round2(costs.filter { $0.kind == kind }.reduce(0) { $0 + (parseAmount($1.amount) ?? 0) })
    }

    static func computeFormApr(_ state: DebtAddFormState, _ inputs: DebtLoanInputs) -> Double? {
        if state.startMode == .fotografia { return nil }
        return try? computeApr(DebtAprInput(principal: inputs.principal, upfrontCosts: sumCosts(state.costs, .unaTantum),
                                            installment: inputs.installment, recurringCosts: sumCosts(state.costs, .perRata),
                                            installments: inputs.installments))
    }

    /// Input for `POST /api/debts`; the installment is declared only if the user typed it. `today` is the UTC date.
    public static func buildCreateDebtInput(_ state: DebtAddFormState, _ resolved: DebtResolvedAddForm, today: String) -> DebtCreateInput {
        let inputs = resolved.inputs
        return DebtCreateInput(
            name: JSNumber.trim(state.name),
            startMode: state.startMode,
            principal: round2(inputs.principal),
            annualRate: JSNumber.round(inputs.annualRate * 10000) / 10000,
            installments: Int(inputs.installments),
            firstInstallmentDate: state.firstInstallmentDate,
            installment: resolved.calculated == .installment ? nil : round2(inputs.installment),
            anchorDate: state.startMode == .fotografia ? today : nil,
            costs: state.costs
                .filter { JSNumber.trim($0.label) != "" && parseAmount($0.amount) != nil }
                .map { DebtCreateCost(label: JSNumber.trim($0.label), amount: parseAmount($0.amount)!, kind: $0.kind) })
    }

    /// Checks independent of the calculation (name, date): first message or nil.
    public static func validateAddFormBasics(_ state: DebtAddFormState) -> String? {
        if JSNumber.trim(state.name) == "" { return "Dai un nome al debito" }
        if !isIsoDateText(state.firstInstallmentDate) { return "Indica la data della prima rata" }
        return nil
    }

    /// Plan preview (installment, total interest, last due date); nil without a valid date.
    public static func previewAddForm(_ state: DebtAddFormState, _ resolved: DebtResolvedAddForm) throws -> DebtAddFormPreview? {
        guard isIsoDateText(state.firstInstallmentDate), let first = CalendarDate(iso: state.firstInstallmentDate) else { return nil }
        let inputs = resolved.inputs
        let rows = try buildSegmentSchedule(DebtSegmentScheduleInput(
            firstDueDate: first, principal: inputs.principal, annualRate: inputs.annualRate, installments: Int(inputs.installments),
            installment: resolved.calculated == .installment ? nil : inputs.installment))
        return DebtAddFormPreview(installment: rows[0].installment, totalInterest: round2(rows.reduce(0) { $0 + $1.interest }),
                                  endDate: rows[rows.count - 1].dueDate)
    }

    /// Penalty in euro: a fixed amount or a percentage of the repaid sum; empty → 0; invalid or negative → nil.
    public static func resolvePenalty(_ amount: Double, _ text: String, _ unit: DebtPenaltyUnit) -> Double? {
        if JSNumber.trim(text) == "" { return 0 }
        guard let value = parseAmount(text), !(value < 0) else { return nil }
        return unit == .percent ? round2((amount * value) / 100) : round2(value)
    }

    /// `previewEarlyRepayment`: the web takes a `DebtView`; here its plan terms/events (`toPlanTerms`/`toPlanEvent`) and plan.
    public static func previewEarlyRepayment(terms: DebtTerms, events: [DebtPlanEvent], plan: DebtLoanPlan, today: CalendarDate,
                                             values: DebtEarlyRepaymentFormValues) throws -> DebtEarlyRepaymentPreview {
        let amount = parseAmount(values.amount)
        if JSNumber.trim(values.amount) == "" { return .empty }
        guard let amount, amount > 0 else { return .error(message: "Inserisci un importo valido") }
        if values.mode == .monthly {
            if plan.totals.finished { return .error(message: "Il debito è già concluso") }
            return .monthly(amount: amount, result: try simulateRecurringExtra(terms, events, today: today, monthlyExtra: amount))
        }
        guard !values.date.isEmpty else { return .error(message: "Indica la data") }
        // The web compares ISO strings; an unparsable date has no row after it.
        guard let date = CalendarDate(iso: values.date), plan.rows.contains(where: { $0.dueDate > date }) else {
            return .error(message: "La data è dopo l'ultima rata del piano")
        }
        guard let penalty = resolvePenalty(amount, values.penalty, values.penaltyUnit) else { return .error(message: "La penale non è valida") }
        return .once(amount: amount, penalty: penalty, date: date,
                     comparison: try compareEarlyRepayment(terms, events, today: today,
                                                           input: DebtEarlyRepaymentInput(date: date, amount: amount, penalty: penalty)))
    }
}

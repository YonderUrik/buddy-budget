import Foundation

// Port of the web's `lib/calc/amortization.ts` (domain/debts.md): constant-installment (French) amortization.
// Rate = nominal annual TAN in percent (6.5 = 6.5%), monthly installments in arrears, interest = residual × rate / 1200.
// Plan amounts are rounded to the cent at every installment; the last one closes the residual to zero.

/// Web `AmortizationError`. `message` is the Italian source string (a catalog key).
public struct DebtAmortizationError: Error, Equatable, Sendable, CustomStringConvertible {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var description: String { message }
}

/// One row of an amortization schedule (`ScheduleRow`).
public struct DebtScheduleRow: Hashable, Sendable {
    /// Progressive installment number, from `firstNumber`.
    public var number: Int
    public var dueDate: CalendarDate
    public var installment: Double
    public var interest: Double
    public var capital: Double
    /// Residual principal after this installment.
    public var residual: Double

    public init(number: Int, dueDate: CalendarDate, installment: Double, interest: Double, capital: Double, residual: Double) {
        self.number = number
        self.dueDate = dueDate
        self.installment = installment
        self.interest = interest
        self.capital = capital
        self.residual = residual
    }
}

/// Input of `buildSegmentSchedule` (`SegmentScheduleInput`).
public struct DebtSegmentScheduleInput: Hashable, Sendable {
    public var firstDueDate: CalendarDate
    /// Day of month of the due dates (default: the day of `firstDueDate`).
    public var anchorDay: Int?
    public var principal: Double
    /// Annual TAN in %.
    public var annualRate: Double
    public var installments: Int
    /// Installment to use; computed when nil.
    public var installment: Double?
    /// Number of the first installment (default 1).
    public var firstNumber: Int?

    public init(firstDueDate: CalendarDate, anchorDay: Int? = nil, principal: Double, annualRate: Double, installments: Int,
                installment: Double? = nil, firstNumber: Int? = nil) {
        self.firstDueDate = firstDueDate
        self.anchorDay = anchorDay
        self.principal = principal
        self.annualRate = annualRate
        self.installments = installments
        self.installment = installment
        self.firstNumber = firstNumber
    }
}

/// The four loan figures of the add form (`LoanInputs`). `installments` is a Double as in the web (the form checks it is whole).
public struct DebtLoanInputs: Hashable, Sendable {
    public var principal: Double
    public var installment: Double
    public var installments: Double
    public var annualRate: Double

    public init(principal: Double, installment: Double, installments: Double, annualRate: Double) {
        self.principal = principal
        self.installment = installment
        self.installments = installments
        self.annualRate = annualRate
    }
}

/// `Partial<LoanInputs>`: nil = missing.
public struct DebtPartialLoanInputs: Hashable, Sendable {
    public var principal: Double?
    public var installment: Double?
    public var installments: Double?
    public var annualRate: Double?

    public init(principal: Double? = nil, installment: Double? = nil, installments: Double? = nil, annualRate: Double? = nil) {
        self.principal = principal
        self.installment = installment
        self.installments = installments
        self.annualRate = annualRate
    }
}

/// `LoanInputKey`.
public enum DebtLoanInputKey: String, Sendable, CaseIterable {
    case principal, installment, installments, annualRate
}

/// `ResolvedLoanInputs`: the inputs plus which one was calculated (nil when the user gave all four).
public struct DebtResolvedLoanInputs: Hashable, Sendable {
    public var inputs: DebtLoanInputs
    public var calculated: DebtLoanInputKey?
}

/// `AprInput`.
public struct DebtAprInput: Hashable, Sendable {
    public var principal: Double
    /// One-off costs at disbursement: reduce the net amount received.
    public var upfrontCosts: Double
    public var installment: Double
    /// Costs per installment.
    public var recurringCosts: Double
    public var installments: Double

    public init(principal: Double, upfrontCosts: Double, installment: Double, recurringCosts: Double, installments: Double) {
        self.principal = principal
        self.upfrontCosts = upfrontCosts
        self.installment = installment
        self.recurringCosts = recurringCosts
        self.installments = installments
    }
}

/// Pure debt calculations, ported 1:1 from the web (same function names on Android `DebtCalc`).
public enum DebtCalc {
    /// Upper bound (%) of the annual rate searched by the solvers.
    public static let maxSolverAnnualRate = 100.0
    static let solverTolerance = 1e-12
    static let solverMaxIterations = 200
    /// Margin by which the last installment may exceed the declared one.
    static let lastInstallmentTolerance = 0.01
    /// Beyond 1200 installments (100 years) the solver stops.
    static let maxSolverInstallments = 1200

    /// `round2`: `Math.round((x + Number.EPSILON) * 100) / 100`.
    public static func round2(_ value: Double) -> Double { JSNumber.round2Epsilon(value) }

    static func monthlyRate(_ annualRate: Double) -> Double { annualRate / 1200 }

    static func pmtExact(_ principal: Double, _ annualRate: Double, _ installments: Double) -> Double {
        let i = monthlyRate(annualRate)
        if i == 0 { return principal / installments }
        return (principal * i) / (1 - pow(1 + i, -installments))
    }

    /// Constant installment rounded to the cent; with rate 0 it is principal / installments.
    public static func installmentAmount(_ principal: Double, _ annualRate: Double, _ installments: Double) throws -> Double {
        if !(principal > 0) || !(installments > 0) { throw DebtAmortizationError("Capitale e numero di rate devono essere positivi") }
        return round2(pmtExact(principal, annualRate, installments))
    }

    /// Schedule of one segment; the last installment closes the residual to zero (absorbs rounding).
    public static func buildSegmentSchedule(_ input: DebtSegmentScheduleInput) throws -> [DebtScheduleRow] {
        let installments = input.installments
        if installments < 1 { throw DebtAmortizationError("Il numero di rate deve essere un intero positivo") }
        if !(input.principal > 0) { throw DebtAmortizationError("Il capitale deve essere positivo") }
        let anchorDay = input.anchorDay ?? input.firstDueDate.day
        let firstNumber = input.firstNumber ?? 1
        let installment = try input.installment ?? installmentAmount(input.principal, input.annualRate, Double(installments))
        var rows: [DebtScheduleRow] = []
        rows.reserveCapacity(installments)
        var residual = round2(input.principal)
        for k in 0..<installments {
            let interest = round2((residual * input.annualRate) / 1200)
            let isLast = k == installments - 1
            let capital = isLast ? residual : round2(min(installment - interest, residual))
            let paid = isLast ? round2(residual + interest) : installment
            residual = round2(residual - capital)
            rows.append(DebtScheduleRow(number: firstNumber + k, dueDate: input.firstDueDate.addingMonthsClamped(k, anchorDay: anchorDay),
                                        installment: paid, interest: interest, capital: capital, residual: residual))
        }
        return rows
    }

    /// Bisection on an increasing f in [lo, hi]; nil when the root is outside the interval.
    static func bisect(_ f: (Double) -> Double, _ lo0: Double, _ hi0: Double) -> Double? {
        var lo = lo0, hi = hi0
        if f(lo) > 0 || f(hi) < 0 { return nil }
        var i = 0
        while i < solverMaxIterations && hi - lo > solverTolerance {
            let mid = (lo + hi) / 2
            if f(mid) < 0 { lo = mid } else { hi = mid }
            i += 1
        }
        return (lo + hi) / 2
    }

    /// Annual rate (%) that closes the loan given principal, installment and number of installments.
    public static func solveAnnualRate(principal: Double, installment: Double, installments: Double) throws -> Double {
        if !(principal > 0) || !(installment > 0) || !(installments > 0) {
            throw DebtAmortizationError("Capitale, rata e numero di rate devono essere positivi")
        }
        if installment * installments < principal - 0.005 {
            throw DebtAmortizationError("La rata per il numero di rate non copre nemmeno il capitale: controlla i dati")
        }
        guard let rate = bisect({ pmtExact(principal, $0, installments) - installment }, 0, maxSolverAnnualRate) else {
            throw DebtAmortizationError("Nessun tasso compatibile con questi dati")
        }
        return rate
    }

    /// Number of installments that closes the loan, simulating the cent-rounded plan (1% margin on the last one).
    public static func solveInstallments(principal: Double, annualRate: Double, installment: Double) throws -> Int {
        if !(principal > 0) || !(installment > 0) { throw DebtAmortizationError("Capitale e rata devono essere positivi") }
        if annualRate > 0 && installment <= (principal * annualRate) / 1200 {
            throw DebtAmortizationError("La rata non supera gli interessi del primo mese: il debito non si ridurrebbe mai")
        }
        var residual = round2(principal)
        for n in 1...maxSolverInstallments {
            let interest = round2((residual * annualRate) / 1200)
            if residual + interest <= installment * (1 + lastInstallmentTolerance) { return n }
            residual = round2(residual + interest - installment)
        }
        throw DebtAmortizationError("Con questi dati il debito non si chiude in un tempo ragionevole")
    }

    /// Principal compatible with installment, rate and number of installments.
    public static func solvePrincipal(annualRate: Double, installment: Double, installments: Double) throws -> Double {
        if !(installment > 0) || !(installments > 0) { throw DebtAmortizationError("Rata e numero di rate devono essere positivi") }
        let i = monthlyRate(annualRate)
        if i == 0 { return round2(installment * installments) }
        return round2((installment * (1 - pow(1 + i, -installments))) / i)
    }

    /// TAEG: effective annual rate (%) of the real cash flows, costs included.
    public static func computeApr(_ input: DebtAprInput) throws -> Double {
        let payment = input.installment + input.recurringCosts
        let net = input.principal - input.upfrontCosts
        let n = input.installments
        if !(net > 0) || !(payment > 0) || !(n > 0) { throw DebtAmortizationError("Dati non validi per il calcolo del TAEG") }
        if payment * n < net { throw DebtAmortizationError("I pagamenti totali sono inferiori al netto ricevuto: controlla i dati") }
        func presentValue(_ i: Double) -> Double { i == 0 ? payment * n : (payment * (1 - pow(1 + i, -n))) / i }
        guard let monthly = bisect({ net - presentValue($0) }, 0, 1) else {
            throw DebtAmortizationError("Nessun TAEG compatibile con questi dati")
        }
        return (pow(1 + monthly, 12) - 1) * 100
    }

    /// With exactly one of the four figures missing, computes it from the other three; all four → unchanged.
    public static func resolveMissingLoanInput(_ partial: DebtPartialLoanInputs) throws -> DebtResolvedLoanInputs {
        func missing(_ v: Double?) -> Bool { v == nil || v!.isNaN }
        var keys: [DebtLoanInputKey] = []
        if missing(partial.principal) { keys.append(.principal) }
        if missing(partial.installment) { keys.append(.installment) }
        if missing(partial.installments) { keys.append(.installments) }
        if missing(partial.annualRate) { keys.append(.annualRate) }
        if keys.count > 1 {
            throw DebtAmortizationError("Servono almeno tre dati su quattro tra capitale, rata, numero di rate e tasso")
        }
        var p = DebtLoanInputs(principal: partial.principal ?? .nan, installment: partial.installment ?? .nan,
                               installments: partial.installments ?? .nan, annualRate: partial.annualRate ?? .nan)
        guard let key = keys.first else { return DebtResolvedLoanInputs(inputs: p, calculated: nil) }
        switch key {
        case .annualRate:
            p.annualRate = try solveAnnualRate(principal: p.principal, installment: p.installment, installments: p.installments)
        case .installment:
            p.installment = try installmentAmount(p.principal, p.annualRate, p.installments)
        case .installments:
            p.installments = Double(try solveInstallments(principal: p.principal, annualRate: p.annualRate, installment: p.installment))
        case .principal:
            p.principal = try solvePrincipal(annualRate: p.annualRate, installment: p.installment, installments: p.installments)
        }
        return DebtResolvedLoanInputs(inputs: p, calculated: key)
    }

    /// `monthsBetween` of early-repayment.ts: whole calendar months between two dates (days ignored).
    static func monthsBetween(_ from: CalendarDate, _ to: CalendarDate) -> Int {
        (to.year - from.year) * 12 + (to.month - from.month)
    }

    /// JS stable `Array.prototype.sort` with a numeric comparator (negative = a first).
    static func stableSorted<T>(_ items: [T], by compare: (T, T) -> Double) -> [T] {
        items.enumerated().sorted { a, b in
            let c = compare(a.element, b.element)
            return c < 0 || (c == 0 && a.offset < b.offset)
        }.map(\.element)
    }
}

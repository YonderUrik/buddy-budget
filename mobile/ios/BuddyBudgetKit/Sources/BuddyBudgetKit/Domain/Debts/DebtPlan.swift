import Foundation

// Port of the web's `lib/calc/debt-plan.ts`: loan plan from initial terms + event log (pure).

/// `DebtStartMode`: new from today, rebuilt from origin, or snapshot of today.
public enum DebtStartMode: String, Sendable, CaseIterable {
    case nuovo, origine, fotografia
}

/// `EarlyRepaymentEffect`.
public enum DebtEarlyRepaymentEffect: String, Sendable, CaseIterable {
    case reduceInstallment = "reduce_installment"
    case reduceDuration = "reduce_duration"
}

/// `DebtTerms`.
public struct DebtTerms: Hashable, Sendable {
    public var startMode: DebtStartMode
    /// Disbursed principal (nuovo/origine) or today's residual (fotografia).
    public var principal: Double
    /// Annual TAN in %.
    public var annualRate: Double
    /// Total (nuovo/origine) or remaining (fotografia) installments.
    public var installments: Int
    /// First (nuovo/origine) or next (fotografia) due date.
    public var firstInstallmentDate: CalendarDate
    /// Declared installment; nil → computed.
    public var installment: Double?

    public init(startMode: DebtStartMode, principal: Double, annualRate: Double, installments: Int,
                firstInstallmentDate: CalendarDate, installment: Double? = nil) {
        self.startMode = startMode
        self.principal = principal
        self.annualRate = annualRate
        self.installments = installments
        self.firstInstallmentDate = firstInstallmentDate
        self.installment = installment
    }
}

/// `DebtPlanEvent`.
public enum DebtPlanEvent: Hashable, Sendable {
    case payment(installmentNumber: Int, date: CalendarDate, amount: Double, transactionId: String?)
    case balanceCorrection(date: CalendarDate, amount: Double)
    case rateChange(date: CalendarDate, rate: Double)
    case earlyRepayment(date: CalendarDate, amount: Double, penalty: Double, effect: DebtEarlyRepaymentEffect)

    public var date: CalendarDate {
        switch self {
        case .payment(_, let d, _, _), .balanceCorrection(let d, _), .rateChange(let d, _), .earlyRepayment(let d, _, _, _): return d
        }
    }

    var isAnchor: Bool { if case .payment = self { return false }; return true }
}

/// `AppliedEarlyRepayment`.
public struct DebtAppliedEarlyRepayment: Hashable, Sendable {
    public var date: CalendarDate
    public var amount: Double
    public var penalty: Double
    public var effect: DebtEarlyRepaymentEffect
    /// Residual after the repayment (0 if it closes the debt).
    public var residualAfter: Double
}

/// `InstallmentStatus`.
public enum DebtInstallmentStatus: String, Sendable, CaseIterable {
    case pagata
    case daPagare = "da_pagare"
    case scaduta
    case daConfermare = "da_confermare"
}

/// Payment recorded for an installment.
public struct DebtRowPayment: Hashable, Sendable {
    public var date: CalendarDate
    public var amount: Double
    public var transactionId: String?
}

/// `LoanPlanRow`.
public struct DebtLoanPlanRow: Hashable, Sendable {
    public var number: Int
    public var dueDate: CalendarDate
    public var installment: Double
    public var interest: Double
    public var capital: Double
    public var residual: Double
    public var status: DebtInstallmentStatus
    public var payment: DebtRowPayment?
}

/// `LoanPlanTotals`.
public struct DebtLoanPlanTotals: Hashable, Sendable {
    public var residual: Double
    public var currentInstallment: Double
    public var interestToDate: Double
    public var interestRemaining: Double
    public var paidTotal: Double
    public var remainingInstallments: Int
    public var endDate: CalendarDate
    public var nextDueDate: CalendarDate?
    public var overdueCount: Int
    public var unconfirmedCount: Int
    public var finished: Bool
    public var penaltiesPaid: Double
    public var closedOn: CalendarDate?
}

/// One point of the residual chart.
public struct DebtResidualPoint: Hashable, Sendable {
    public var date: CalendarDate
    public var residual: Double
}

/// `LoanPlan`.
public struct DebtLoanPlan: Hashable, Sendable {
    public var rows: [DebtLoanPlanRow]
    public var totals: DebtLoanPlanTotals
    public var residualSeries: [DebtResidualPoint]
    public var earlyRepayments: [DebtAppliedEarlyRepayment]
    /// Italian messages (catalog keys) for events that could not be applied.
    public var warnings: [String]
}

extension DebtCalc {
    private struct TheoreticalPlan {
        var rows: [DebtScheduleRow]
        var closedOn: CalendarDate?
        var repayments: [DebtAppliedEarlyRepayment]
    }

    private static func buildTheoreticalRows(_ terms: DebtTerms, _ anchors: [DebtPlanEvent], _ warnings: inout [String]) throws -> TheoreticalPlan {
        let anchorDay = terms.firstInstallmentDate.day
        var rows = try buildSegmentSchedule(DebtSegmentScheduleInput(
            firstDueDate: terms.firstInstallmentDate, principal: terms.principal, annualRate: terms.annualRate,
            installments: terms.installments, installment: terms.installment))
        var currentRate = terms.annualRate
        var closedOn: CalendarDate?
        var repayments: [DebtAppliedEarlyRepayment] = []
        for event in anchors {
            let date = event.date
            let frozen = rows.filter { $0.dueDate <= date }
            let remaining = rows.count - frozen.count
            if remaining == 0 {
                warnings.append("Evento del \(date.iso) oltre l'ultima rata: ignorato")
                continue
            }
            let residualBefore = frozen.isEmpty ? terms.principal : frozen[frozen.count - 1].residual
            if case .rateChange(_, let rate) = event { currentRate = rate }
            if case .earlyRepayment(_, let amount, let penalty, let effect) = event {
                let principal = round2(residualBefore - amount)
                if principal <= 0 {
                    repayments.append(DebtAppliedEarlyRepayment(date: date, amount: round2(residualBefore), penalty: penalty, effect: effect, residualAfter: 0))
                    closedOn = date
                    rows = frozen
                    break
                }
                let current = rows[frozen.count].installment
                var installments = remaining
                var installment: Double?
                if effect == .reduceDuration {
                    installment = current
                    do {
                        installments = min(remaining, try solveInstallments(principal: principal, annualRate: currentRate, installment: current))
                    } catch {
                        installment = nil
                    }
                }
                let tail = try buildSegmentSchedule(DebtSegmentScheduleInput(
                    firstDueDate: rows[frozen.count].dueDate, anchorDay: anchorDay, principal: principal, annualRate: currentRate,
                    installments: installments, installment: installment, firstNumber: frozen.count + 1))
                rows = frozen + tail
                repayments.append(DebtAppliedEarlyRepayment(date: date, amount: amount, penalty: penalty, effect: effect, residualAfter: principal))
                continue
            }
            let principal: Double
            if case .balanceCorrection(_, let amount) = event { principal = amount } else { principal = residualBefore }
            if !(principal > 0) {
                warnings.append("Correzione del \(date.iso) con residuo non positivo: ignorata")
                continue
            }
            let tail = try buildSegmentSchedule(DebtSegmentScheduleInput(
                firstDueDate: rows[frozen.count].dueDate, anchorDay: anchorDay, principal: principal, annualRate: currentRate,
                installments: remaining, firstNumber: frozen.count + 1))
            rows = frozen + tail
        }
        return TheoreticalPlan(rows: rows, closedOn: closedOn, repayments: repayments)
    }

    /// Builds the loan plan at `today` (UTC date) from terms and events.
    public static func buildLoanPlan(_ terms: DebtTerms, _ events: [DebtPlanEvent], today: CalendarDate) throws -> DebtLoanPlan {
        var warnings: [String] = []
        let anchors = stableSorted(events.filter(\.isAnchor)) { a, b in a.date < b.date ? -1 : (a.date == b.date ? 0 : 1) }
        let theoretical = try buildTheoreticalRows(terms, anchors, &warnings)

        // Insertion-ordered map installmentNumber → payment (JS Map).
        var paymentOrder: [Int] = []
        var payments: [Int: (date: CalendarDate, amount: Double, transactionId: String?)] = [:]
        for event in events {
            guard case .payment(let number, let date, let amount, let transactionId) = event else { continue }
            if !theoretical.rows.contains(where: { $0.number == number }) {
                warnings.append("Pagamento della rata \(number), che non esiste: ignorato")
            } else if payments[number] != nil {
                warnings.append("Rata \(number) già pagata: secondo pagamento ignorato")
            } else {
                payments[number] = (date, amount, transactionId)
                paymentOrder.append(number)
            }
        }

        let rows: [DebtLoanPlanRow] = theoretical.rows.map { row in
            let payment = payments[row.number]
            let status: DebtInstallmentStatus
            if payment != nil { status = .pagata }
            else if row.dueDate >= today { status = .daPagare }
            else { status = terms.startMode == .origine ? .daConfermare : .scaduta }
            return DebtLoanPlanRow(number: row.number, dueDate: row.dueDate, installment: row.installment, interest: row.interest,
                                   capital: row.capital, residual: row.residual, status: status,
                                   payment: payment.map { DebtRowPayment(date: $0.date, amount: $0.amount, transactionId: $0.transactionId) })
        }

        let past = rows.filter { $0.dueDate <= today }
        let future = rows.filter { $0.dueDate > today }
        let closedOn = theoretical.closedOn
        let repayments = theoretical.repayments
        let closed = closedOn != nil && closedOn! <= today
        let lastPast = past.last
        let lastRepayment = repayments.filter { $0.date <= today }.last
        let settledResidual: Double
        if closed {
            settledResidual = 0
        } else if let r = lastRepayment, lastPast == nil || r.date >= lastPast!.dueDate {
            settledResidual = r.residualAfter
        } else {
            settledResidual = lastPast?.residual ?? terms.principal
        }
        let nextUnsettled = rows.first { $0.status == .daPagare || $0.status == .scaduta }
        func sum(_ list: [DebtLoanPlanRow], _ pick: (DebtLoanPlanRow) -> Double) -> Double {
            round2(list.reduce(0) { $0 + pick($1) })
        }

        let anchorDay = terms.firstInstallmentDate.day
        let startDate = !rows.isEmpty ? rows[0].dueDate.addingMonthsClamped(-1, anchorDay: anchorDay) : closedOn!
        var series = [DebtResidualPoint(date: startDate, residual: round2(terms.principal))]
        series += rows.map { DebtResidualPoint(date: $0.dueDate, residual: $0.residual) }
        series += repayments.map { DebtResidualPoint(date: $0.date, residual: $0.residualAfter) }
        let residualSeries = stableSorted(series) { x, y in x.date < y.date ? -1 : (x.date == y.date ? 0 : 1) }

        let totals = DebtLoanPlanTotals(
            residual: settledResidual,
            currentInstallment: future.first?.installment ?? 0,
            interestToDate: sum(past) { $0.interest },
            interestRemaining: sum(future) { $0.interest },
            paidTotal: round2(paymentOrder.reduce(0) { $0 + payments[$1]!.amount }),
            remainingInstallments: future.count,
            endDate: closedOn ?? rows[rows.count - 1].dueDate,
            nextDueDate: nextUnsettled?.dueDate,
            overdueCount: rows.filter { $0.status == .scaduta }.count,
            unconfirmedCount: rows.filter { $0.status == .daConfermare }.count,
            finished: future.isEmpty,
            penaltiesPaid: round2(repayments.filter { $0.date <= today }.reduce(0) { $0 + $1.penalty }),
            closedOn: closedOn)
        return DebtLoanPlan(rows: rows, totals: totals, residualSeries: residualSeries, earlyRepayments: repayments, warnings: warnings)
    }

    /// Rows shown by default in the plan table: the last 2 past and the first 8 future (`visibleRowRange`).
    public static let planVisiblePast = 2
    public static let planVisibleFuture = 8

    /// `visibleRowRange`: half-open index range [start, end) of the rows shown before "show all".
    public static func visibleRowRange(_ rows: [DebtLoanPlanRow], today: CalendarDate) -> (start: Int, end: Int) {
        let pivot = rows.firstIndex { $0.dueDate >= today } ?? rows.count
        return (max(0, pivot - planVisiblePast), min(rows.count, pivot + planVisibleFuture))
    }
}

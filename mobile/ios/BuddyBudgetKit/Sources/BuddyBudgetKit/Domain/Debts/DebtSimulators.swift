import Foundation

// Ports of the web's `lib/calc/early-repayment.ts` and `lib/calc/debt-simulator.ts` (interactive "e se" simulators).

/// `EarlyRepaymentInput`.
public struct DebtEarlyRepaymentInput: Hashable, Sendable {
    public var date: CalendarDate
    public var amount: Double
    /// Penalty in euro (a percentage is converted before, see `resolvePenalty`).
    public var penalty: Double
    public init(date: CalendarDate, amount: Double, penalty: Double) {
        self.date = date
        self.amount = amount
        self.penalty = penalty
    }
}

/// `EarlyRepaymentOutcome`.
public struct DebtEarlyRepaymentOutcome: Hashable, Sendable {
    public var effect: DebtEarlyRepaymentEffect
    public var nextInstallment: Double
    public var endDate: CalendarDate
    public var remainingInstallments: Int
    public var interestAfter: Double
    public var interestSaved: Double
    public var netBenefit: Double
    public var monthsSaved: Int
    public var closesDebt: Bool
    public var plan: DebtLoanPlan
}

/// `EarlyRepaymentComparison`.
public struct DebtEarlyRepaymentComparison: Hashable, Sendable {
    public var baselineInterest: Double
    public var baselineEndDate: CalendarDate
    public var baselineInstallment: Double
    public var reduceInstallment: DebtEarlyRepaymentOutcome
    public var reduceDuration: DebtEarlyRepaymentOutcome
}

/// `RecurringExtraResult`.
public struct DebtRecurringExtraResult: Hashable, Sendable {
    public var interestWith: Double
    public var interestWithout: Double
    public var interestSaved: Double
    public var extraPaid: Double
    public var endDate: CalendarDate
    public var baselineEndDate: CalendarDate
    public var monthsSaved: Int
}

/// The current-loan figures `compareRefinance` needs (`Pick<LoanPlanTotals, …>`).
public struct DebtRefinanceCurrent: Hashable, Sendable {
    public var residual: Double
    public var currentInstallment: Double
    public var interestRemaining: Double
    public var endDate: CalendarDate
    public init(residual: Double, currentInstallment: Double, interestRemaining: Double, endDate: CalendarDate) {
        self.residual = residual
        self.currentInstallment = currentInstallment
        self.interestRemaining = interestRemaining
        self.endDate = endDate
    }
}

/// `RefinanceOffer` (surroga).
public struct DebtRefinanceOffer: Hashable, Sendable {
    public var annualRate: Double
    public var installments: Int
    public var upfrontCosts: Double
    public var penalty: Double
    public init(annualRate: Double, installments: Int, upfrontCosts: Double, penalty: Double) {
        self.annualRate = annualRate
        self.installments = installments
        self.upfrontCosts = upfrontCosts
        self.penalty = penalty
    }
}

/// `RefinanceResult`.
public struct DebtRefinanceResult: Hashable, Sendable {
    public var residual: Double
    public var currentInstallment: Double
    public var currentInterestRemaining: Double
    public var currentEndDate: CalendarDate
    public var newInstallment: Double
    public var newInterest: Double
    public var newEndDate: CalendarDate
    public var switchCosts: Double
    public var netSaving: Double
    public var breakEvenMonths: Int?
}

/// `PayoffStrategy | "none"`.
public enum DebtPayoffStrategy: String, Sendable, CaseIterable {
    case none, avalanche, snowball
}

/// `PayoffLoan`.
public struct DebtPayoffLoan: Hashable, Sendable {
    public var id: String
    public var name: String
    public var residual: Double
    public var annualRate: Double
    public var installment: Double
    public init(id: String, name: String, residual: Double, annualRate: Double, installment: Double) {
        self.id = id
        self.name = name
        self.residual = residual
        self.annualRate = annualRate
        self.installment = installment
    }
}

/// `PayoffClosing`.
public struct DebtPayoffClosing: Hashable, Sendable {
    public var id: String
    public var name: String
    public var months: Int
    public var endDate: CalendarDate
}

/// `PayoffResult`.
public struct DebtPayoffResult: Hashable, Sendable {
    public var strategy: DebtPayoffStrategy
    public var months: Int
    public var totalInterest: Double
    public var endDate: CalendarDate
    public var closeOrder: [String]
    public var closings: [DebtPayoffClosing]
}

/// Result of `comparePayoffStrategies`.
public struct DebtPayoffComparison: Hashable, Sendable {
    public var none: DebtPayoffResult
    public var avalanche: DebtPayoffResult
    public var snowball: DebtPayoffResult
}

extension DebtCalc {
    /// Cap of simulated months (`MAX_PAYOFF_MONTHS`).
    public static let maxPayoffMonths = 600

    private static func interestAfter(_ plan: DebtLoanPlan, _ date: CalendarDate) -> Double {
        round2(plan.rows.filter { $0.dueDate > date }.reduce(0) { $0 + $1.interest })
    }

    private static func outcome(_ terms: DebtTerms, _ events: [DebtPlanEvent], _ today: CalendarDate, _ input: DebtEarlyRepaymentInput,
                                _ effect: DebtEarlyRepaymentEffect, _ baseline: DebtLoanPlan, _ baselineInterest: Double) throws -> DebtEarlyRepaymentOutcome {
        let plan = try buildLoanPlan(terms, events + [.earlyRepayment(date: input.date, amount: input.amount, penalty: input.penalty, effect: effect)],
                                     today: today)
        let after = interestAfter(plan, input.date)
        let next = plan.rows.first { $0.dueDate > input.date }
        return DebtEarlyRepaymentOutcome(
            effect: effect,
            nextInstallment: next?.installment ?? 0,
            endDate: plan.totals.endDate,
            remainingInstallments: plan.rows.filter { $0.dueDate > input.date }.count,
            interestAfter: after,
            interestSaved: round2(baselineInterest - after),
            netBenefit: round2(baselineInterest - after - input.penalty),
            monthsSaved: max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)),
            closesDebt: plan.totals.closedOn != nil,
            plan: plan)
    }

    /// The two alternatives of an early repayment side by side, with the interest saved by each.
    public static func compareEarlyRepayment(_ terms: DebtTerms, _ events: [DebtPlanEvent], today: CalendarDate,
                                             input: DebtEarlyRepaymentInput) throws -> DebtEarlyRepaymentComparison {
        let baseline = try buildLoanPlan(terms, events, today: today)
        let baselineInterest = interestAfter(baseline, input.date)
        let next = baseline.rows.first { $0.dueDate > input.date }
        return DebtEarlyRepaymentComparison(
            baselineInterest: baselineInterest,
            baselineEndDate: baseline.totals.endDate,
            baselineInstallment: next?.installment ?? 0,
            reduceInstallment: try outcome(terms, events, today, input, .reduceInstallment, baseline, baselineInterest),
            reduceDuration: try outcome(terms, events, today, input, .reduceDuration, baseline, baselineInterest))
    }

    /// "If I paid an extra every month": a reduce-duration early repayment at every future due date (simulation only).
    public static func simulateRecurringExtra(_ terms: DebtTerms, _ events: [DebtPlanEvent], today: CalendarDate,
                                              monthlyExtra: Double) throws -> DebtRecurringExtraResult {
        let baseline = try buildLoanPlan(terms, events, today: today)
        let extras: [DebtPlanEvent] = baseline.rows.filter { $0.dueDate > today }
            .map { .earlyRepayment(date: $0.dueDate, amount: monthlyExtra, penalty: 0, effect: .reduceDuration) }
        let plan = try buildLoanPlan(terms, events + extras, today: today)
        func future(_ p: DebtLoanPlan) -> Double { round2(p.rows.filter { $0.dueDate > today }.reduce(0) { $0 + $1.interest }) }
        let extraPaid = round2(plan.earlyRepayments.reduce(0) { $0 + $1.amount })
        return DebtRecurringExtraResult(
            interestWith: future(plan),
            interestWithout: future(baseline),
            interestSaved: round2(future(baseline) - future(plan)),
            extraPaid: extraPaid,
            endDate: plan.totals.endDate,
            baselineEndDate: baseline.totals.endDate,
            monthsSaved: max(0, monthsBetween(plan.totals.endDate, baseline.totals.endDate)))
    }

    /// Compares what is left to pay today with a new offer on the same residual (surroga).
    public static func compareRefinance(_ current: DebtRefinanceCurrent, today: CalendarDate, offer: DebtRefinanceOffer) throws -> DebtRefinanceResult {
        let newInstallment = try installmentAmount(current.residual, offer.annualRate, Double(offer.installments))
        let newInterest = round2(newInstallment * Double(offer.installments) - current.residual)
        let switchCosts = round2(offer.upfrontCosts + offer.penalty)
        let monthlySaving = current.currentInstallment - newInstallment
        return DebtRefinanceResult(
            residual: current.residual,
            currentInstallment: current.currentInstallment,
            currentInterestRemaining: current.interestRemaining,
            currentEndDate: current.endDate,
            newInstallment: newInstallment,
            newInterest: newInterest,
            newEndDate: today.addingMonthsClamped(offer.installments),
            switchCosts: switchCosts,
            netSaving: round2(current.interestRemaining - newInterest - switchCosts),
            breakEvenMonths: switchCosts > 0 && monthlySaving > 0 ? Int((switchCosts / monthlySaving).rounded(.up)) : nil)
    }

    /// Whole-month payoff estimate with avalanche (highest rate first) / snowball (smallest balance first) rollover.
    public static func simulatePayoff(_ loans: [DebtPayoffLoan], monthlyExtra: Double, strategy: DebtPayoffStrategy,
                                      today: CalendarDate) -> DebtPayoffResult {
        var state = loans.filter { $0.residual > 0 }.map { (loan: $0, balance: $0.residual) }
        var closeOrder: [String] = []
        var closings: [DebtPayoffClosing] = []
        var totalInterest = 0.0
        var freed = 0.0
        var months = 0
        let rollover = strategy != .none

        while state.contains(where: { $0.balance > 0.005 }) && months < maxPayoffMonths {
            months += 1
            for k in state.indices {
                if state[k].balance <= 0.005 { continue }
                let interest = (state[k].balance * state[k].loan.annualRate) / 1200
                totalInterest += interest
                state[k].balance += interest - min(state[k].loan.installment, state[k].balance + interest)
            }
            var pool = rollover ? monthlyExtra + freed : 0
            let order = stableSorted(state.indices.filter { state[$0].balance > 0.005 }) { a, b in
                strategy == .snowball ? state[a].balance - state[b].balance : state[b].loan.annualRate - state[a].loan.annualRate
            }
            for k in order {
                if pool <= 0 { break }
                let pay = min(pool, state[k].balance)
                state[k].balance -= pay
                pool -= pay
            }
            for k in state.indices where state[k].balance <= 0.005 && !closeOrder.contains(state[k].loan.name) {
                closeOrder.append(state[k].loan.name)
                closings.append(DebtPayoffClosing(id: state[k].loan.id, name: state[k].loan.name, months: months,
                                                  endDate: today.addingMonthsClamped(months)))
                state[k].balance = 0
                freed += state[k].loan.installment
            }
        }
        return DebtPayoffResult(strategy: strategy, months: months, totalInterest: round2(totalInterest),
                                endDate: today.addingMonthsClamped(months), closeOrder: closeOrder, closings: closings)
    }

    /// The three simulations side by side: no extra, avalanche and snowball.
    public static func comparePayoffStrategies(_ loans: [DebtPayoffLoan], monthlyExtra: Double, today: CalendarDate) -> DebtPayoffComparison {
        DebtPayoffComparison(
            none: simulatePayoff(loans, monthlyExtra: 0, strategy: .none, today: today),
            avalanche: simulatePayoff(loans, monthlyExtra: monthlyExtra, strategy: .avalanche, today: today),
            snowball: simulatePayoff(loans, monthlyExtra: monthlyExtra, strategy: .snowball, today: today))
    }
}

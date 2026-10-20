import BuddyBudgetKit
import Foundation

// Adapters for the debts domain ports (DebtCalc). Errors are serialized as the generator does:
// {"error": "AmortizationError", "message": <Italian key>}.

private func d(_ v: Double) -> JSONValue { .number(v) }
private func i(_ v: Int) -> JSONValue { .number(Double(v)) }
private func iso(_ v: CalendarDate) -> JSONValue { .string(v.iso) }
private func optIso(_ v: CalendarDate?) -> JSONValue { v.map(iso) ?? .null }
private func optNum(_ v: JSONValue) -> Double? { v.double }

private func amortizationError(_ body: () throws -> JSONValue) throws -> JSONValue {
    do { return try body() } catch let e as DebtAmortizationError {
        return .object(["error": .string("AmortizationError"), "message": .string(e.message)])
    }
}

private func row(_ r: DebtScheduleRow) -> JSONValue {
    .object(["number": i(r.number), "dueDate": iso(r.dueDate), "installment": d(r.installment), "interest": d(r.interest),
             "capital": d(r.capital), "residual": d(r.residual)])
}

private func segmentInput(_ x: JSONValue) throws -> DebtSegmentScheduleInput {
    DebtSegmentScheduleInput(firstDueDate: try VectorSuite.date(x["firstDueDate"]), anchorDay: x["anchorDay"].int,
                             principal: try VectorSuite.num(x["principal"]), annualRate: try VectorSuite.num(x["annualRate"]),
                             installments: try VectorSuite.int(x["installments"]), installment: x["installment"].double,
                             firstNumber: x["firstNumber"].int)
}

private func terms(_ x: JSONValue) throws -> DebtTerms {
    guard let mode = x["startMode"].string.flatMap(DebtStartMode.init(rawValue:)) else { throw AdapterError("startMode") }
    return DebtTerms(startMode: mode, principal: try VectorSuite.num(x["principal"]), annualRate: try VectorSuite.num(x["annualRate"]),
                     installments: try VectorSuite.int(x["installments"]), firstInstallmentDate: try VectorSuite.date(x["firstInstallmentDate"]),
                     installment: x["installment"].double)
}

private func events(_ x: JSONValue) throws -> [DebtPlanEvent] {
    guard case .array(let items) = x else { return [] }
    return try items.map { e in
        let date = try VectorSuite.date(e["date"])
        switch e["type"].string {
        case "payment":
            return .payment(installmentNumber: try VectorSuite.int(e["installmentNumber"]), date: date, amount: try VectorSuite.num(e["amount"]),
                            transactionId: e["transactionId"].string)
        case "balance_correction": return .balanceCorrection(date: date, amount: try VectorSuite.num(e["amount"]))
        case "rate_change": return .rateChange(date: date, rate: try VectorSuite.num(e["rate"]))
        case "early_repayment":
            guard let effect = e["effect"].string.flatMap(DebtEarlyRepaymentEffect.init(rawValue:)) else { throw AdapterError("effect") }
            return .earlyRepayment(date: date, amount: try VectorSuite.num(e["amount"]), penalty: try VectorSuite.num(e["penalty"]), effect: effect)
        default: throw AdapterError("event type \(e["type"])")
        }
    }
}

private func plan(_ p: DebtLoanPlan) -> JSONValue {
    let t = p.totals
    return .object([
        "rows": .array(p.rows.map { r in
            .object(["n": i(r.number), "d": iso(r.dueDate), "i": d(r.installment), "int": d(r.interest), "c": d(r.capital),
                     "res": d(r.residual), "s": .string(r.status.rawValue), "paid": r.payment.map { d($0.amount) } ?? .null])
        }),
        "totals": .object([
            "residual": d(t.residual), "currentInstallment": d(t.currentInstallment), "interestToDate": d(t.interestToDate),
            "interestRemaining": d(t.interestRemaining), "paidTotal": d(t.paidTotal), "remainingInstallments": i(t.remainingInstallments),
            "endDate": iso(t.endDate), "nextDueDate": optIso(t.nextDueDate), "overdueCount": i(t.overdueCount),
            "unconfirmedCount": i(t.unconfirmedCount), "finished": .bool(t.finished), "penaltiesPaid": d(t.penaltiesPaid),
            "closedOn": optIso(t.closedOn),
        ]),
        "residualSeries": .array(p.residualSeries.map { .object(["date": iso($0.date), "residual": d($0.residual)]) }),
        "earlyRepayments": .array(p.earlyRepayments.map {
            .object(["date": iso($0.date), "amount": d($0.amount), "penalty": d($0.penalty), "effect": .string($0.effect.rawValue),
                     "residualAfter": d($0.residualAfter)])
        }),
        "warnings": .array(p.warnings.map(JSONValue.string)),
    ])
}

private func outcome(_ o: DebtEarlyRepaymentOutcome) -> JSONValue {
    // `plan` is omitted from the vectors (re-derivable via buildLoanPlan).
    .object(["effect": .string(o.effect.rawValue), "nextInstallment": d(o.nextInstallment), "endDate": iso(o.endDate),
             "remainingInstallments": i(o.remainingInstallments), "interestAfter": d(o.interestAfter), "interestSaved": d(o.interestSaved),
             "netBenefit": d(o.netBenefit), "monthsSaved": i(o.monthsSaved), "closesDebt": .bool(o.closesDebt)])
}

private func payoffLoans(_ x: JSONValue) throws -> [DebtPayoffLoan] {
    guard case .array(let items) = x else { return [] }
    return try items.map {
        DebtPayoffLoan(id: try VectorSuite.str($0["id"]), name: try VectorSuite.str($0["name"]), residual: try VectorSuite.num($0["residual"]),
                       annualRate: try VectorSuite.num($0["annualRate"]), installment: try VectorSuite.num($0["installment"]))
    }
}

private func payoff(_ r: DebtPayoffResult) -> JSONValue {
    .object(["strategy": .string(r.strategy.rawValue), "months": i(r.months), "totalInterest": d(r.totalInterest), "endDate": iso(r.endDate),
             "closeOrder": .array(r.closeOrder.map(JSONValue.string)),
             "closings": .array(r.closings.map { .object(["id": .string($0.id), "name": .string($0.name), "months": i($0.months), "endDate": iso($0.endDate)]) })])
}

private func addFormState(_ x: JSONValue) throws -> DebtAddFormState {
    guard let mode = x["startMode"].string.flatMap(DebtStartMode.init(rawValue:)) else { throw AdapterError("startMode") }
    var costs: [DebtAddCostField] = []
    if case .array(let items) = x["costs"] {
        costs = try items.map {
            guard let kind = $0["kind"].string.flatMap(DebtCostKind.init(rawValue:)) else { throw AdapterError("kind") }
            return DebtAddCostField(label: try VectorSuite.str($0["label"]), amount: try VectorSuite.str($0["amount"]), kind: kind)
        }
    }
    return DebtAddFormState(name: try VectorSuite.str(x["name"]), startMode: mode, principal: try VectorSuite.str(x["principal"]),
                            installment: try VectorSuite.str(x["installment"]), installments: try VectorSuite.str(x["installments"]),
                            annualRate: try VectorSuite.str(x["annualRate"]), firstInstallmentDate: try VectorSuite.str(x["firstInstallmentDate"]),
                            costs: costs)
}

private func loanInputs(_ l: DebtLoanInputs) -> [String: JSONValue] {
    ["principal": d(l.principal), "installment": d(l.installment), "installments": d(l.installments), "annualRate": d(l.annualRate)]
}

private func resolution(_ r: DebtAddFormResolution) -> JSONValue {
    switch r {
    case .failure(let message): return .object(["ok": .bool(false), "message": message.map(JSONValue.string) ?? .null])
    case .ok(let v):
        var value: [String: JSONValue] = ["inputs": .object(loanInputs(v.inputs)), "apr": v.apr.map(d) ?? .null]
        if let c = v.calculated { value["calculated"] = .string(c.rawValue) }
        return .object(["ok": .bool(true), "value": .object(value)])
    }
}

private func createInput(_ c: DebtCreateInput) -> JSONValue {
    var o: [String: JSONValue] = [
        "name": .string(c.name), "startMode": .string(c.startMode.rawValue), "principal": d(c.principal), "annualRate": d(c.annualRate),
        "installments": i(c.installments), "firstInstallmentDate": .string(c.firstInstallmentDate),
        "costs": .array(c.costs.map { .object(["label": .string($0.label), "amount": d($0.amount), "kind": .string($0.kind.rawValue)]) }),
    ]
    if let x = c.installment { o["installment"] = d(x) }
    if let a = c.anchorDate { o["anchorDate"] = .string(a) }
    return .object(o)
}

extension VectorSuite {
    static let debtsHandlers: [String: Handler] = [
        "installmentAmount": { x in
            try amortizationError { d(try DebtCalc.installmentAmount(try num(x["principal"]), try num(x["annualRate"]), try num(x["installments"]))) }
        },
        "buildSegmentSchedule": { x in try amortizationError { .array(try DebtCalc.buildSegmentSchedule(try segmentInput(x)).map(row)) } },
        "buildSegmentSchedule(summary)": { x in
            let r = try DebtCalc.buildSegmentSchedule(try segmentInput(x))
            return .object(["first": row(r[0]), "second": row(r[1]), "last": row(r[r.count - 1]),
                            "totalInterest": d(DebtCalc.round2(r.reduce(0) { $0 + $1.interest })), "rows": i(r.count)])
        },
        "solveAnnualRate": { x in
            try amortizationError {
                d(try DebtCalc.solveAnnualRate(principal: try num(x["principal"]), installment: try num(x["installment"]),
                                               installments: try num(x["installments"])))
            }
        },
        "solveInstallments": { x in
            try amortizationError {
                i(try DebtCalc.solveInstallments(principal: try num(x["principal"]), annualRate: try num(x["annualRate"]),
                                                 installment: try num(x["installment"])))
            }
        },
        "solvePrincipal": { x in
            try amortizationError {
                d(try DebtCalc.solvePrincipal(annualRate: try num(x["annualRate"]), installment: try num(x["installment"]),
                                              installments: try num(x["installments"])))
            }
        },
        "computeApr": { x in
            try amortizationError {
                d(try DebtCalc.computeApr(DebtAprInput(principal: try num(x["principal"]), upfrontCosts: try num(x["upfrontCosts"]),
                                                       installment: try num(x["installment"]), recurringCosts: try num(x["recurringCosts"]),
                                                       installments: try num(x["installments"]))))
            }
        },
        "resolveMissingLoanInput": { x in
            try amortizationError {
                let r = try DebtCalc.resolveMissingLoanInput(DebtPartialLoanInputs(
                    principal: optNum(x["principal"]), installment: optNum(x["installment"]),
                    installments: optNum(x["installments"]), annualRate: optNum(x["annualRate"])))
                var o = loanInputs(r.inputs)
                if let c = r.calculated { o["calculated"] = .string(c.rawValue) }
                return .object(o)
            }
        },
        "resolvePenalty": { x in
            guard let unit = x["unit"].string.flatMap(DebtPenaltyUnit.init(rawValue:)) else { throw AdapterError("unit") }
            return DebtCalc.resolvePenalty(try num(x["amount"]), try str(x["text"]), unit).map(d) ?? .null
        },
        "resolveAddForm": { x in resolution(DebtCalc.resolveAddForm(try addFormState(x))) },
        "resolveAddForm+previewAddForm": { x in
            let state = try addFormState(x)
            let r = DebtCalc.resolveAddForm(state)
            guard case .ok(let value) = r else {
                return .object(["resolution": resolution(r), "preview": .null, "createInput": .null])
            }
            let preview = try DebtCalc.previewAddForm(state, value).map {
                JSONValue.object(["installment": d($0.installment), "totalInterest": d($0.totalInterest), "endDate": iso($0.endDate)])
            } ?? .null
            // The vector input has no `today`: the generator used 2025-01-10 for the fotografia case (anchorDate) and
            // 2025-01-01 otherwise, where `today` does not reach the output.
            let today = state.startMode == .fotografia ? "2025-01-10" : "2025-01-01"
            return .object(["resolution": resolution(r), "preview": preview,
                            "createInput": createInput(DebtCalc.buildCreateDebtInput(state, value, today: today))])
        },
        "buildLoanPlan": { x in plan(try DebtCalc.buildLoanPlan(try terms(x["terms"]), try events(x["events"]), today: try date(x["today"]))) },
        "compareEarlyRepayment": { x in
            let inp = x["input"]
            let c = try DebtCalc.compareEarlyRepayment(
                try terms(x["terms"]), try events(x["events"]), today: try date(x["today"]),
                input: DebtEarlyRepaymentInput(date: try date(inp["date"]), amount: try num(inp["amount"]), penalty: try num(inp["penalty"])))
            return .object(["baselineInterest": d(c.baselineInterest), "baselineEndDate": iso(c.baselineEndDate),
                            "baselineInstallment": d(c.baselineInstallment), "reduceInstallment": outcome(c.reduceInstallment),
                            "reduceDuration": outcome(c.reduceDuration)])
        },
        "simulateRecurringExtra": { x in
            let r = try DebtCalc.simulateRecurringExtra(try terms(x["terms"]), try events(x["events"]), today: try date(x["today"]),
                                                        monthlyExtra: try num(x["monthlyExtra"]))
            return .object(["interestWith": d(r.interestWith), "interestWithout": d(r.interestWithout), "interestSaved": d(r.interestSaved),
                            "extraPaid": d(r.extraPaid), "endDate": iso(r.endDate), "baselineEndDate": iso(r.baselineEndDate),
                            "monthsSaved": i(r.monthsSaved)])
        },
        "compareRefinance": { x in
            let c = x["current"], o = x["offer"]
            let r = try DebtCalc.compareRefinance(
                DebtRefinanceCurrent(residual: try num(c["residual"]), currentInstallment: try num(c["currentInstallment"]),
                                     interestRemaining: try num(c["interestRemaining"]), endDate: try date(c["endDate"])),
                today: try date(x["today"]),
                offer: DebtRefinanceOffer(annualRate: try num(o["annualRate"]), installments: try int(o["installments"]),
                                          upfrontCosts: try num(o["upfrontCosts"]), penalty: try num(o["penalty"])))
            return .object(["residual": d(r.residual), "currentInstallment": d(r.currentInstallment),
                            "currentInterestRemaining": d(r.currentInterestRemaining), "currentEndDate": iso(r.currentEndDate),
                            "newInstallment": d(r.newInstallment), "newInterest": d(r.newInterest), "newEndDate": iso(r.newEndDate),
                            "switchCosts": d(r.switchCosts), "netSaving": d(r.netSaving), "breakEvenMonths": r.breakEvenMonths.map(i) ?? .null])
        },
        "simulatePayoff": { x in
            guard let s = x["strategy"].string.flatMap(DebtPayoffStrategy.init(rawValue:)) else { throw AdapterError("strategy") }
            return payoff(DebtCalc.simulatePayoff(try payoffLoans(x["loans"]), monthlyExtra: try num(x["monthlyExtra"]), strategy: s,
                                                  today: try date(x["today"])))
        },
        "comparePayoffStrategies": { x in
            let r = DebtCalc.comparePayoffStrategies(try payoffLoans(x["loans"]), monthlyExtra: try num(x["monthlyExtra"]), today: try date(x["today"]))
            return .object(["none": payoff(r.none), "avalanche": payoff(r.avalanche), "snowball": payoff(r.snowball)])
        },
    ]
}

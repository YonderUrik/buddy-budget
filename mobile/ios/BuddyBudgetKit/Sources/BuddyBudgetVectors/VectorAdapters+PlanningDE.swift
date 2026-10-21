import BuddyBudgetKit
import Foundation

// financial-planning-de.json. Inputs are partial plans: missing fields take the zod defaults (the models' defaults),
// as the generator ran `germanPlanSchema.parse(...)`. "avdP" names the generator's fixture (gen-de-vectors.ts).

extension VectorSuite {
    static let planningDEHandlers: [String: Handler] = [
        "fundTaxableShare": { i in
            guard let kind = i["kind"].string.flatMap(GermanFundKind.init(rawValue:)) else { throw AdapterError("kind") }
            return GermanPlanning.fundTaxableShare(kind).map(JSONValue.number) ?? .null
        },
        "germanCapitalTax": { i in
            let r = try GermanPlanning.germanCapitalTax(try deTaxProfile(i["profile"]), shareGains: try num(i["shareGains"]),
                                                        generalIncome: try num(i["generalIncome"]))
            return .object([
                "taxable": .number(r.taxable), "foreignCredit": .number(r.foreignCredit), "usedAllowance": .number(r.usedAllowance),
                "remainingAllowance": .number(r.remainingAllowance), "capitalTax": .number(r.capitalTax),
                "solidarity": .number(r.solidarity), "church": .number(r.church), "total": .number(r.total),
                "remainingShareLosses": .number(r.remainingShareLosses), "remainingGeneralLosses": .number(r.remainingGeneralLosses),
            ])
        },
        "germanIncomeTax": { i in
            .number(GermanPlanning.germanIncomeTax(try num(i["taxableIncome"]), joint: deBool(i["joint"]) ?? false))
        },
        "germanFundAdvance": { i in
            let r = GermanPlanning.germanFundAdvance(try deFund(i))
            return .object(["gross": .number(r.gross), "taxable": r.taxable.map(JSONValue.number) ?? .null,
                            "receiptYear": .number(Double(r.receiptYear))])
        },
        "germanCrypto": { i in
            let r = GermanPlanning.germanCrypto(try dePlan(i))
            return .object(["shortTerm": .number(r.shortTerm), "exempt": .number(r.exempt), "taxable": .number(r.taxable),
                            "incomeTax": .number(r.incomeTax), "remainingLoss": .number(r.remainingLoss)])
        },
        "germanPensionTaxableShare": { i in .number(GermanPlanning.germanPensionTaxableShare(try int(i["startYear"]))) },
        "germanAnnuityShare": { i in .number(GermanPlanning.germanAnnuityShare(try num(i["age"]))) },
        "germanProgressiveSurcharges": { i in
            let r = GermanPlanning.germanProgressiveSurcharges(try num(i["tax"]), joint: deBool(i["joint"]) ?? false,
                                                              churchRate: try num(i["churchRate"]))
            return .object(["solidarity": .number(r.solidarity), "church": .number(r.church)])
        },
        "germanAvdAllowance": { i in
            let r = GermanPlanning.germanAvdAllowance(try dePensionInput(i["plan"]), contributionYear: i["contributionYear"].int ?? 0)
            return .object(["base": .number(r.base), "children": .number(r.children), "bonus": .number(r.bonus),
                            "total": .number(r.total), "deduction": .number(r.deduction)])
        },
        "germanAvdTaxBenefit": { i in
            let r = GermanPlanning.germanAvdTaxBenefit(try dePensionInput(i["plan"]), joint: deBool(i["joint"]) ?? false)
            return .object(["base": .number(r.base), "children": .number(r.children), "bonus": .number(r.bonus),
                            "total": .number(r.total), "deduction": .number(r.deduction), "extraRefund": .number(r.extraRefund)])
        },
        "projectGermanAvd": { i in
            deProjection(GermanPlanning.projectGermanAvd(try dePensionInput(i["plan"]), referenceYear: try int(i["referenceYear"])))
        },
        "projectGermanPension": { i in
            deProjection(GermanPlanning.projectGermanPension(try dePensionInput(i["plan"]), referenceYear: i["referenceYear"].int ?? 2026))
        },
        "germanRetirement": { i in
            let r = GermanPlanning.germanRetirement(try dePlan(i))
            func row(_ x: GermanRetirementRow) -> JSONValue {
                .object(["year": .number(Double(x.year)), "capital": .number(x.capital), "pension": .number(x.pension),
                         "withdrawal": .number(x.withdrawal)])
            }
            return .object([
                "atRetirement": .number(r.atRetirement), "currentTarget": r.currentTarget.map(JSONValue.number) ?? .null,
                "depletedAfter": r.depletedAfter.map { .number(Double($0)) } ?? .null,
                "issues": .array(r.issues.map(JSONValue.string)),
                "rows0to6": .array(r.rows.prefix(7).map(row)),
                "row49": r.rows.count > 49 ? row(r.rows[49]) : .null,
            ])
        },
        "germanPensionNet": { i in
            let plan = try dePlan(i)
            guard case .array(let raw) = i["payments"] else { throw AdapterError("payments") }
            let payments = try raw.map {
                GermanPensionPayment(plan: try dePension($0["plan"]), annual: try num($0["annual"]), lumpSum: try num($0["lumpSum"]),
                                     occupationalMonthlyEquivalent: $0["occupationalMonthlyEquivalent"].double ?? 0)
            }
            let r = GermanPlanning.germanPensionNet(payments, plan: plan)
            func opt(_ x: Double?) -> JSONValue { x.map(JSONValue.number) ?? .null }
            return .object([
                "gross": .number(r.gross), "taxable": opt(r.taxable), "health": opt(r.health), "care": opt(r.care),
                "incomeTax": opt(r.incomeTax), "solidarity": opt(r.solidarity), "church": opt(r.church), "net": opt(r.net),
                "issues": .array(r.issues.map(JSONValue.string)), "insuranceIssues": .array(r.insuranceIssues.map(JSONValue.string)),
            ])
        },
    ]

    // MARK: Partial-plan parsing (zod defaults)

    static func deBool(_ v: JSONValue) -> Bool? { if case .bool(let b) = v { return b }; return nil }

    static func deTaxProfile(_ v: JSONValue) throws -> GermanTaxProfile {
        var p = GermanTaxProfile()
        if let x = v["year"].int { p.year = x }
        if let x = deBool(v["joint"]) { p.joint = x }
        if let x = v["churchRate"].double { p.churchRate = x }
        if let x = v["allowanceUsedElsewhere"].double { p.allowanceUsedElsewhere = x }
        if let x = v["shareLosses"].double { p.shareLosses = x }
        if let x = v["generalLosses"].double { p.generalLosses = x }
        if let x = v["otherCapitalIncome"].double { p.otherCapitalIncome = x }
        if let x = v["verifiedForeignCredit"].double { p.verifiedForeignCredit = x }
        return p
    }

    static func deFund(_ v: JSONValue) throws -> GermanFundScenario {
        var f = GermanFundScenario()
        if let k = v["kind"].string { guard let kind = GermanFundKind(rawValue: k) else { throw AdapterError("kind \(k)") }; f.kind = kind }
        if let x = v["startValue"].double { f.startValue = x }
        if let x = v["endValue"].double { f.endValue = x }
        if let x = v["distributions"].double { f.distributions = x }
        if let x = v["acquisitionMonth"].int { f.acquisitionMonth = x }
        return f
    }

    static func deAvd(_ v: JSONValue) throws -> GermanAvd {
        var a = GermanAvd()
        if let x = deBool(v["enabled"]) { a.enabled = x }
        if let x = v["contributionStartYear"].int { a.contributionStartYear = x }
        if let x = v["eligibility"].string { guard let e = GermanAvdEligibility(rawValue: x) else { throw AdapterError(x) }; a.eligibility = e }
        if let x = v["spouseAnnualContribution"].double { a.spouseAnnualContribution = x }
        if case .array(let years) = v["childAllowanceYears"] { a.childAllowanceYears = years.compactMap(\.int) }
        if let x = deBool(v["starterBonus"]) { a.starterBonus = x }
        if let x = v["ageAtStart"].int { a.ageAtStart = x }
        if let x = v["taxableIncomeBeforeDeduction"].double { a.taxableIncomeBeforeDeduction = x }
        if let x = v["payout"].string { guard let p = GermanAvdPayout(rawValue: x) else { throw AdapterError(x) }; a.payout = p }
        if let x = v["payoutStartAge"].int { a.payoutStartAge = x }
        if let x = v["payoutEndAge"].int { a.payoutEndAge = x }
        if let x = v["lumpSumRate"].double { a.lumpSumRate = x }
        if let x = v["payoutReturn"].double { a.payoutReturn = x }
        return a
    }

    /// `pp(o)` in the generator: id "p", name "P", kind "private" unless given.
    static func dePension(_ v: JSONValue, defaultKind: GermanPensionKind = .private) throws -> GermanPensionPlan {
        var kind = defaultKind
        if let k = v["kind"].string { guard let x = GermanPensionKind(rawValue: k) else { throw AdapterError("kind \(k)") }; kind = x }
        var p = GermanPensionPlan(kind: kind)
        p.id = v["id"].string ?? "p"
        p.name = v["name"].string ?? "P"
        if let x = v["capital"].double { p.capital = x }
        if let x = v["monthlyContribution"].double { p.monthlyContribution = x }
        if let x = v["monthlyGross"].double { p.monthlyGross = x }
        if let x = v["yearsUntilPayment"].int { p.yearsUntilPayment = x }
        if let x = v["nominalReturn"].double { p.nominalReturn = x }
        if let x = v["points"].double { p.points = x }
        if let x = v["annualPoints"].double { p.annualPoints = x }
        if let x = v["accessFactor"].double { p.accessFactor = x }
        if let x = v["taxTreatment"].string { guard let t = GermanTaxTreatment(rawValue: x) else { throw AdapterError(x) }; p.taxTreatment = t }
        if let x = v["taxableAnnualFromStatement"].double { p.taxableAnnualFromStatement = x }
        if let x = v["pensionStartYear"].int { p.pensionStartYear = x }
        if let x = v["taxFreeAnnualAmount"].double { p.taxFreeAnnualAmount = x }
        if let x = v["ageAtPayment"].int { p.ageAtPayment = x }
        if case .object = v["avd"] { p.avd = try deAvd(v["avd"]) }
        if let x = v["paymentMode"].string { guard let m = GermanPaymentMode(rawValue: x) else { throw AdapterError(x) }; p.paymentMode = m }
        return p
    }

    /// The generator's `avdP` fixture.
    static var deAvdFixture: GermanPensionPlan {
        var p = GermanPensionPlan(kind: .avd)
        p.id = "p"; p.name = "P"
        p.monthlyContribution = 150; p.yearsUntilPayment = 30; p.nominalReturn = 0.05; p.capital = 0
        var a = GermanAvd()
        a.enabled = true; a.contributionStartYear = 2027; a.eligibility = .direct; a.childAllowanceYears = [10, 3]
        a.starterBonus = true; a.ageAtStart = 24; a.taxableIncomeBeforeDeduction = 50000; a.payout = .drawdown
        a.payoutStartAge = 67; a.payoutEndAge = 85; a.lumpSumRate = 0.3; a.payoutReturn = 0.02
        p.avd = a
        return p
    }

    /// Plan argument: the "avdP" fixture name, or a partial plan (default kind "private"; the indirect AVD vector
    /// omits the kind, the generator built it with kind "avd").
    static func dePensionInput(_ v: JSONValue) throws -> GermanPensionPlan {
        if v.string == "avdP" { return deAvdFixture }
        return try dePension(v, defaultKind: v["avd"].isNull ? .private : .avd)
    }

    static func dePlan(_ v: JSONValue) throws -> GermanPlan {
        var plan = GermanPlan()
        if case .object = v["tax"] { plan.tax = try deTaxProfile(v["tax"]) }
        if case .object = v["fund"] { plan.fund = try deFund(v["fund"]) }
        if case .array(let list) = v["pensions"] { plan.pensions = try list.map { try dePension($0) } }
        if case .object = v["pensionTax"] {
            let t = v["pensionTax"]
            var s = GermanPensionTax()
            if let x = t["mode"].string { guard let m = GermanPensionTaxMode(rawValue: x) else { throw AdapterError(x) }; s.mode = m }
            if let x = t["insurance"].string { guard let m = GermanPensionInsurance(rawValue: x) else { throw AdapterError(x) }; s.insurance = m }
            if let x = t["additionalHealthRate"].double { s.additionalHealthRate = x }
            if let x = deBool(t["childless"]) { s.childless = x }
            if let x = t["childrenUnder25"].int { s.childrenUnder25 = x }
            if let x = t["otherInsuranceIncome"].double { s.otherInsuranceIncome = x }
            if let x = deBool(t["voluntarySubsidy"]) { s.voluntarySubsidy = x }
            if let x = t["annualPrivatePremium"].double { s.annualPrivatePremium = x }
            if let x = t["annualDeductiblePremium"].double { s.annualDeductiblePremium = x }
            if let x = t["surchargeChildAllowance"].double { s.surchargeChildAllowance = x }
            if let x = t["otherTaxableIncome"].double { s.otherTaxableIncome = x }
            if let x = t["otherDeductions"].double { s.otherDeductions = x }
            plan.pensionTax = s
        }
        if case .object = v["retirement"] {
            let t = v["retirement"]
            var r = GermanRetirementInput()
            if let x = t["liquidCapital"].double { r.liquidCapital = x }
            if let x = t["annualSaving"].double { r.annualSaving = x }
            if let x = t["annualSpending"].double { r.annualSpending = x }
            if let x = t["yearsUntilRetirement"].int { r.yearsUntilRetirement = x }
            if let x = t["realReturn"].double { r.realReturn = x }
            if let x = t["withdrawalRate"].double { r.withdrawalRate = x }
            if let x = t["inflation"].double { r.inflation = x }
            if let x = t["pensionDeductionRate"].double { r.pensionDeductionRate = x }
            if let x = t["withdrawalTaxShare"].double { r.withdrawalTaxShare = x }
            plan.retirement = r
        }
        if case .array(let list) = v["crypto"] {
            plan.crypto = try list.map {
                GermanCryptoSale(id: try str($0["id"]), name: try str($0["name"]), acquired: try str($0["acquired"]), sold: try str($0["sold"]),
                                 proceeds: try num($0["proceeds"]), cost: try num($0["cost"]), fees: $0["fees"].double ?? 0)
            }
        }
        if let x = v["cryptoOtherGains"].double { plan.cryptoOtherGains = x }
        if let x = v["cryptoLossCarryforward"].double { plan.cryptoLossCarryforward = x }
        if let x = v["otherTaxableIncome"].double { plan.otherTaxableIncome = x }
        return plan
    }

    static func deProjection(_ r: GermanPensionProjection) -> JSONValue {
        .object([
            "currentCapital": .number(r.currentCapital), "projectedCapital": .number(r.projectedCapital),
            "monthlyGross": .number(r.monthlyGross), "lumpSum": .number(r.lumpSum),
            "paymentYears": r.paymentYears.map(JSONValue.number) ?? .null, "grants": .number(r.grants),
        ])
    }
}

import Foundation

/// Validated 2026 German rules (web `DE_2026`, `DE_AVD_2027`, `DE_PENSION_2026`); never reuse for other years.
public enum GermanRules {
    public static let year = 2026
    public static let allowance: Double = 1000
    public static let jointAllowance: Double = 2000
    public static let capitalRate = 0.25
    public static let solidarityRate = 0.055
    public static let advanceBaseRate = 0.032
    public static let advanceFactor = 0.7
    public static let pensionPointValue = 42.52
    public static let pensionPointValueFrom = "2026-07-01"
    public static let privateSaleThreshold: Double = 1000
    public static func exemption(_ kind: GermanFundKind) -> Double {
        switch kind {
        case .equity: 0.3
        case .mixed: 0.15
        case .property: 0.6
        case .foreignProperty: 0.8
        case .other, .unknown: 0
        }
    }

    // AVD reform effective 2027.
    public static let avdEffectiveFrom = 2027
    public static let avdMinimum: Double = 120
    public static let avdContributionCap: Double = 6840
    public static let avdSupportedCap: Double = 1800
    public static let avdFirstBand: Double = 360
    public static let avdFirstRate = 0.5
    public static let avdSecondRate = 0.25
    public static let avdChildCap: Double = 300
    public static let avdIndirectCap: Double = 175
    public static let avdStarterBonus: Double = 200

    // 2026 social-insurance parameters.
    public static let monthlyCeiling = 5812.50
    public static let monthlyMinimum = 1318.33
    public static let reducedHealthRate = 0.14
    public static let occupationalExemption = 3955.0 / 20
    public static let healthRate = 0.146
    public static let careRate = 0.036
    public static let childlessExtra = 0.006
    public static let childDiscount = 0.0025
    public static let solidarityThreshold: Double = 20350
}

public enum GermanPlanningError: Error, Equatable { case unsupportedTaxYear }

/// German planning editors (web `lib/financial-planning/countries/de*.ts`, `projections.ts`), ported literally.
public enum GermanPlanning {
    /// `Math.round((n + Number.EPSILON) * 100) / 100`.
    static func cents(_ n: Double) -> Double { JSNumber.round2Epsilon(n) }

    /// Fail closed for tax years that have not been researched.
    public static func germanRules(_ year: Int) throws {
        if year != GermanRules.year { throw GermanPlanningError.unsupportedTaxYear }
    }

    /// Taxable fraction for a verified fund classification; nil for unknown.
    public static func fundTaxableShare(_ kind: GermanFundKind) -> Double? {
        kind == .unknown ? nil : 1 - GermanRules.exemption(kind)
    }

    public static func germanCapitalTax(_ profile: GermanTaxProfile, shareGains: Double, generalIncome: Double) throws -> GermanCapitalTaxResult {
        try germanRules(profile.year)
        let r = GermanRules.self
        let sharesAfterLoss = shareGains - profile.shareLosses
        let remainingShareLosses = max(0, -sharesAfterLoss)
        let pooled = max(0, sharesAfterLoss) + generalIncome + profile.otherCapitalIncome - profile.generalLosses
        let remainingGeneralLosses = max(0, -pooled)
        let allowance = max(0, (profile.joint ? r.jointAllowance : r.allowance) - profile.allowanceUsedElsewhere)
        let usedAllowance = min(allowance, max(0, pooled))
        let taxable = max(0, pooled - usedAllowance)
        let foreignCredit = min(profile.verifiedForeignCredit, taxable * r.capitalRate)
        let capitalTax = cents((taxable - foreignCredit / r.capitalRate) / (1 / r.capitalRate + profile.churchRate))
        let solidarity = (((capitalTax * r.solidarityRate + 1e-9) * 100).rounded(.down)) / 100
        let church = cents(capitalTax * profile.churchRate)
        return GermanCapitalTaxResult(taxable: taxable, foreignCredit: foreignCredit, usedAllowance: usedAllowance,
                                      remainingAllowance: allowance - usedAllowance, capitalTax: capitalTax, solidarity: solidarity,
                                      church: church, total: cents(capitalTax + solidarity + church),
                                      remainingShareLosses: remainingShareLosses, remainingGeneralLosses: remainingGeneralLosses)
    }

    /// 2026 fund advance (Vorabpauschale), taxable in 2027. Held through year-end.
    public static func germanFundAdvance(_ input: GermanFundScenario) -> GermanFundAdvanceResult {
        let growthCap = max(0, input.endValue - input.startValue + input.distributions)
        let base = min(input.startValue * GermanRules.advanceBaseRate * GermanRules.advanceFactor, growthCap)
        let gross = max(0, base - input.distributions) * Double(13 - input.acquisitionMonth) / 12
        let share = fundTaxableShare(input.kind)
        return GermanFundAdvanceResult(gross: cents(gross), taxable: share.map { cents(gross * $0) }, receiptYear: 2027)
    }

    /// 2026 progressive income tax (§32a) on taxable income, floored to whole euros; splitting when joint.
    public static func germanIncomeTax(_ taxableIncome: Double, joint: Bool = false) -> Double {
        let divisor: Double = joint ? 2 : 1
        let x = (max(0, taxableIncome) / divisor).rounded(.down)
        let y = (x - 12348) / 10000
        let z = (x - 17799) / 10000
        let tax: Double
        if x <= 12348 { tax = 0 }
        else if x <= 17799 { tax = (914.51 * y + 1400) * y }
        else if x <= 69878 { tax = (173.10 * z + 2397) * z + 1034.87 }
        else if x <= 277825 { tax = 0.42 * x - 11135.63 }
        else { tax = 0.45 * x - 19470.38 }
        return tax.rounded(.down) * divisor
    }

    /// Private spot-crypto disposals. The €1,000 limit is a threshold, not a deduction.
    public static func germanCrypto(_ plan: GermanPlan) -> GermanCryptoResult {
        var shortTerm = plan.cryptoOtherGains
        var exempt = 0.0
        for sale in plan.crypto {
            if !sale.sold.hasPrefix(String(plan.tax.year)) { continue }
            let acquired = Array(sale.acquired)
            let acquiredYear = JSNumber.parse(String(acquired.prefix(4))) ?? .nan
            let anniversary = "\(jsNumberString(acquiredYear + 1))\(String(acquired.dropFirst(4)))"
            let gain = sale.proceeds - sale.cost - sale.fees
            if jsLess(anniversary, sale.sold) { exempt += gain } else { shortTerm += gain }
        }
        let threshold = GermanRules.privateSaleThreshold
        let taxable = shortTerm < threshold ? 0 : max(0, shortTerm - plan.cryptoLossCarryforward)
        let incomeTax = germanIncomeTax(plan.otherTaxableIncome + taxable, joint: plan.tax.joint)
            - germanIncomeTax(plan.otherTaxableIncome, joint: plan.tax.joint)
        let remainingLoss = shortTerm < 0 ? plan.cryptoLossCarryforward - shortTerm
            : shortTerm < threshold ? plan.cryptoLossCarryforward : max(0, plan.cryptoLossCarryforward - shortTerm)
        return GermanCryptoResult(shortTerm: shortTerm, exempt: exempt, taxable: taxable, incomeTax: incomeTax, remainingLoss: remainingLoss)
    }

    // MARK: Pensions

    /// Taxable share of a statutory / Rürup pension by start year.
    public static func germanPensionTaxableShare(_ startYear: Int) -> Double {
        let y = Double(startYear)
        if startYear <= 2005 { return 0.5 }
        if startYear <= 2020 { return 0.5 + (y - 2005) * 0.02 }
        if startYear <= 2022 { return 0.8 + (y - 2020) * 0.01 }
        return min(1, 0.82 + (y - 2022) * 0.005)
    }

    static let annuityBands: [(Double, Double)] = [
        (1, 59), (3, 58), (5, 57), (8, 56), (10, 55), (12, 54), (14, 53), (16, 52), (18, 51), (20, 50), (22, 49), (24, 48),
        (26, 47), (27, 46), (29, 45), (31, 44), (32, 43), (34, 42), (35, 41), (37, 40), (38, 39), (40, 38), (41, 37), (42, 36),
        (44, 35), (45, 34), (47, 33), (48, 32), (49, 31), (50, 30), (52, 29), (53, 28), (54, 27), (56, 26), (57, 25), (58, 24),
        (59, 23), (61, 22), (62, 21), (63, 20), (64, 19), (66, 18), (67, 17), (68, 16), (70, 15), (71, 14), (73, 13), (74, 12),
        (75, 11), (77, 10), (79, 9), (80, 8), (82, 7), (84, 6), (87, 5), (91, 4), (93, 3), (96, 2), (120, 1),
    ]

    /// Lifetime private annuity earnings share, EStG §22(1)(a)(bb).
    public static func germanAnnuityShare(_ age: Double) -> Double {
        (annuityBands.first { age <= $0.0 }?.1 ?? 1) / 100
    }

    public static func germanProgressiveSurcharges(_ tax: Double, joint: Bool, churchRate: Double) -> GermanSurcharges {
        let threshold = GermanRules.solidarityThreshold * (joint ? 2 : 1)
        let solidarity = ((max(0, min(tax * 0.055, (tax - threshold) * 0.119)) + 1e-9) * 100).rounded(.down) / 100
        return GermanSurcharges(solidarity: solidarity, church: JSNumber.round(tax * churchRate * 100) / 100)
    }

    public static func germanAvdAllowance(_ plan: GermanPensionPlan, contributionYear: Int = 0) -> GermanAvdAllowanceResult {
        let a = plan.avd, r = GermanRules.self, contribution = plan.monthlyContribution * 12
        let eligible = contribution >= r.avdMinimum && a.eligibility != .none
            && (a.eligibility != .indirect || a.spouseAnnualContribution >= r.avdMinimum)
        let basis = a.eligibility == .indirect ? a.spouseAnnualContribution : contribution
        let basic = eligible
            ? min(basis, r.avdFirstBand) * r.avdFirstRate + max(0, min(basis, r.avdSupportedCap) - r.avdFirstBand) * r.avdSecondRate : 0
        let base = a.eligibility == .indirect ? min(r.avdIndirectCap, basic) : basic
        let children = eligible ? Double(a.childAllowanceYears.filter { $0 > contributionYear }.count) * min(basis, r.avdChildCap) : 0
        let bonus = eligible && a.eligibility == .direct && a.starterBonus && a.ageAtStart < 25 && contributionYear == 0 ? r.avdStarterBonus : 0
        let total = JSNumber.round2(base + children + bonus)
        let deduction = a.eligibility == .direct ? min(contribution, r.avdSupportedCap) + total : 0
        return GermanAvdAllowanceResult(base: JSNumber.round2(base), children: JSNumber.round2(children), bonus: bonus, total: total,
                                        deduction: deduction)
    }

    /// Additional refund beyond the grants (constant-2026-tariff comparison).
    public static func germanAvdTaxBenefit(_ plan: GermanPensionPlan, joint: Bool) -> GermanAvdTaxBenefitResult {
        let grant = germanAvdAllowance(plan)
        let income = plan.avd.taxableIncomeBeforeDeduction
        let saving = germanIncomeTax(income, joint: joint) - germanIncomeTax(max(0, income - grant.deduction), joint: joint)
        return GermanAvdTaxBenefitResult(base: grant.base, children: grant.children, bonus: grant.bonus, total: grant.total,
                                         deduction: grant.deduction, extraRefund: max(0, saving - grant.total))
    }

    /// Contributions monthly in arrears, grants at year end.
    public static func projectGermanAvd(_ plan: GermanPensionPlan, referenceYear: Int) -> GermanPensionProjection {
        let a = plan.avd
        var capital = plan.capital, grants = 0.0
        let monthly = pow(1 + plan.nominalReturn, 1.0 / 12) - 1
        let delay = max(0, a.contributionStartYear - referenceYear)
        for year in 0..<max(0, plan.yearsUntilPayment) {
            let active = year >= delay
            for _ in 0..<12 { capital = capital * (1 + monthly) + (active ? plan.monthlyContribution : 0) }
            let grant = active ? germanAvdAllowance(plan, contributionYear: year - delay).total : 0
            capital += grant
            grants += grant
        }
        let lumpSum = capital * a.lumpSumRate
        let months = Double((a.payoutEndAge - a.payoutStartAge) * 12)
        let payoutRate = pow(1 + a.payoutReturn, 1.0 / 12) - 1
        let monthlyGross = a.payout == .provider ? plan.monthlyGross
            : abs(payoutRate) < 1e-12 ? (capital - lumpSum) / months
            : (capital - lumpSum) * payoutRate / (1 - pow(1 + payoutRate, -months))
        return GermanPensionProjection(currentCapital: plan.capital, projectedCapital: capital, monthlyGross: monthlyGross,
                                       lumpSum: lumpSum, paymentYears: a.payout == .drawdown ? months / 12 : nil, grants: grants)
    }

    /// Pension assets and future income stay separate; no capitalization of statutory entitlements.
    public static func projectGermanPension(_ plan: GermanPensionPlan, referenceYear: Int = 2026) -> GermanPensionProjection {
        if plan.kind == .avd && plan.avd.enabled { return projectGermanAvd(plan, referenceYear: referenceYear) }
        let years = Double(plan.yearsUntilPayment)
        let monthlyRate = pow(1 + plan.nominalReturn, 1.0 / 12) - 1
        let months = years * 12
        let projectedCapital = plan.capital * pow(1 + monthlyRate, months)
            + (abs(monthlyRate) < 1e-12 ? plan.monthlyContribution * months
                : plan.monthlyContribution * (pow(1 + monthlyRate, months) - 1) / monthlyRate)
        let statutory = plan.kind == .statutory
        let monthlyGross = statutory ? (plan.points + years * plan.annualPoints) * GermanRules.pensionPointValue * plan.accessFactor
            : plan.paymentMode == .income ? plan.monthlyGross : 0
        return GermanPensionProjection(currentCapital: statutory ? 0 : plan.capital, projectedCapital: statutory ? 0 : projectedCapital,
                                       monthlyGross: monthlyGross,
                                       lumpSum: !statutory && plan.paymentMode == .capital ? projectedCapital : 0,
                                       paymentYears: nil, grants: 0)
    }

    /// One person's pension receipts with a combined income-tax assessment.
    public static func germanPensionNet(_ payments: [GermanPensionPayment], plan: GermanPlan) -> GermanPensionNetResult {
        let settings = plan.pensionTax, rules = GermanRules.self
        var gross = 0.0, taxable = 0.0, statutory = 0.0, occupational = 0.0, privatePensions = 0.0
        var issues: [String] = []
        var insuranceIssues: [String] = []
        for payment in payments {
            let p = payment.plan, total = payment.annual + payment.lumpSum
            gross += total
            if p.kind == .statutory { statutory += payment.annual / 12 }
            if p.kind == .occupational { occupational += payment.annual / 12 + payment.occupationalMonthlyEquivalent }
            if p.kind != .statutory && p.kind != .occupational {
                privatePensions += payment.annual / 12
                if settings.insurance == .voluntary && payment.lumpSum > 0 { issues.append(p.id); insuranceIssues.append(p.id) }
            }
            if total == 0 { continue }
            if p.taxTreatment == .statement {
                taxable += min(total, p.taxableAnnualFromStatement)
            } else if p.kind == .statutory || p.kind == .ruerup {
                let exempt = p.taxFreeAnnualAmount
                    ?? payment.annual * (1 - germanPensionTaxableShare(p.pensionStartYear ?? plan.tax.year + p.yearsUntilPayment))
                taxable += max(0, total - exempt)
            } else if p.taxTreatment == .funded && [.avd, .riester, .occupational].contains(p.kind) {
                if p.kind == .avd && p.avd.enabled && (p.monthlyContribution * 12 > 1800 || p.avd.eligibility == .none) { issues.append(p.id) }
                else { taxable += total }
            } else if p.taxTreatment == .privateAnnuity && p.kind == .private && payment.lumpSum == 0 {
                taxable += payment.annual * germanAnnuityShare(Double(p.ageAtPayment))
            } else {
                issues.append(p.id)
            }
        }
        if !issues.isEmpty {
            return GermanPensionNetResult(gross: gross, taxable: nil, health: nil, care: nil, incomeTax: nil, solidarity: nil, church: nil,
                                          net: nil, issues: issues, insuranceIssues: insuranceIssues)
        }
        var health = 0.0, care = 0.0
        let careRate = rules.careRate + (settings.childless ? rules.childlessExtra : 0)
            - Double(min(4, max(0, settings.childrenUnder25 - 1))) * rules.childDiscount
        switch settings.insurance {
        case .kvdr:
            let statutoryBase = min(statutory, rules.monthlyCeiling)
            let remaining = max(0, rules.monthlyCeiling - statutoryBase)
            let occupationalHealth = min(remaining, max(0, occupational - rules.occupationalExemption))
            let occupationalCare = occupational > rules.occupationalExemption ? min(remaining, occupational) : 0
            health = 12 * (statutoryBase * (rules.healthRate + settings.additionalHealthRate) / 2
                + occupationalHealth * (rules.healthRate + settings.additionalHealthRate))
            care = 12 * (statutoryBase + occupationalCare) * careRate
        case .voluntary:
            let general = statutory + occupational
            let reduced = privatePensions + settings.otherInsuranceIncome / 12
            let assessed = min(rules.monthlyCeiling, max(rules.monthlyMinimum, general + reduced))
            let generalBase = min(assessed, general)
            let reducedBase = max(0, assessed - generalBase)
            let subsidy = settings.voluntarySubsidy
                ? min(statutory, rules.monthlyCeiling) * (rules.healthRate + settings.additionalHealthRate) / 2 : 0
            health = 12 * (generalBase * (rules.healthRate + settings.additionalHealthRate)
                + reducedBase * (rules.reducedHealthRate + settings.additionalHealthRate) - subsidy)
            care = 12 * assessed * careRate
        case .private:
            health = settings.annualPrivatePremium
        }
        let deductible = settings.insurance != .private ? health + care : min(health, settings.annualDeductiblePremium)
        let base = max(0, settings.otherTaxableIncome - settings.otherDeductions)
        let joint = plan.tax.joint
        let allowance: Double = taxable > 0 ? 102 : 0
        let incomeTax = germanIncomeTax(max(0, base + taxable - deductible - allowance), joint: joint)
        let baseTax = germanIncomeTax(base, joint: joint)
        let charges = germanProgressiveSurcharges(
            germanIncomeTax(max(0, base + taxable - deductible - allowance - settings.surchargeChildAllowance), joint: joint),
            joint: joint, churchRate: plan.tax.churchRate)
        let before = germanProgressiveSurcharges(germanIncomeTax(max(0, base - settings.surchargeChildAllowance), joint: joint),
                                                 joint: joint, churchRate: plan.tax.churchRate)
        let incrementalTax = incomeTax - baseTax, solidarity = charges.solidarity - before.solidarity, church = charges.church - before.church
        return GermanPensionNetResult(gross: gross, taxable: taxable, health: health, care: care, incomeTax: incrementalTax,
                                      solidarity: solidarity, church: church,
                                      net: gross - health - care - incrementalTax - solidarity - church,
                                      issues: issues, insuranceIssues: insuranceIssues)
    }

    /// Retirement bridge in today's euros (50 yearly rows).
    public static func germanRetirement(_ plan: GermanPlan) -> GermanRetirementResult {
        let r = plan.retirement
        let pensions = plan.pensions.map { (plan: $0, result: projectGermanPension($0, referenceYear: plan.tax.year)) }
        let ytr = r.yearsUntilRetirement
        var atRetirement = wealthAfterYears(current: r.liquidCapital, annualSaving: r.annualSaving, realReturn: r.realReturn, years: Double(ytr))
        func paying(_ entry: (plan: GermanPensionPlan, result: GermanPensionProjection), _ year: Int) -> Bool {
            entry.plan.yearsUntilPayment <= year
                && (entry.result.paymentYears.map { Double(year) < Double(entry.plan.yearsUntilPayment) + $0 } ?? true)
        }
        func payments(_ year: Int) -> [GermanPensionPayment] {
            pensions.map { entry in
                GermanPensionPayment(
                    plan: entry.plan,
                    annual: paying(entry, year) ? entry.result.monthlyGross * 12 : 0,
                    lumpSum: entry.plan.yearsUntilPayment == year ? entry.result.lumpSum : 0,
                    occupationalMonthlyEquivalent: entry.plan.yearsUntilPayment <= year && year < entry.plan.yearsUntilPayment + 10
                        ? entry.result.lumpSum / 120 : 0)
            }
        }
        // Distinct lump-sum years in first-seen order (JS `new Set`).
        var lumpYears: [Int] = []
        for p in pensions where p.result.lumpSum > 0 && p.plan.yearsUntilPayment < ytr {
            if !lumpYears.contains(p.plan.yearsUntilPayment) { lumpYears.append(p.plan.yearsUntilPayment) }
        }
        for year in lumpYears {
            let list = payments(year)
            let grossLump = list.reduce(0.0) { $0 + $1.lumpSum }
            var netLump = grossLump * (1 - r.pensionDeductionRate)
            if plan.pensionTax.mode == .rules {
                let withLump = germanPensionNet(list, plan: plan)
                let withoutLump = germanPensionNet(list.map { var e = $0; e.lumpSum = 0; return e }, plan: plan)
                guard let a = withLump.net, let b = withoutLump.net else {
                    return GermanRetirementResult(atRetirement: atRetirement, currentTarget: nil, rows: [], depletedAfter: nil,
                                                  issues: withLump.issues + withoutLump.issues)
                }
                netLump = a - b
            }
            atRetirement += netLump / pow(1 + r.inflation, Double(year)) * pow(1 + r.realReturn, Double(ytr - year))
        }
        var rows: [GermanRetirementRow] = []
        var issues: [String] = []
        var capital = atRetirement
        var depletedAfter: Int? = nil
        for y in 0..<50 {
            let fromToday = ytr + y
            let deflator = pow(1 + r.inflation, Double(fromToday))
            var pension = 0.0
            for p in pensions {
                if paying(p, fromToday) { pension += p.result.monthlyGross * 12 * (1 - r.pensionDeductionRate) / deflator }
                if p.plan.yearsUntilPayment == fromToday { capital += p.result.lumpSum * (1 - r.pensionDeductionRate) / deflator }
            }
            if plan.pensionTax.mode == .rules {
                let list = payments(fromToday)
                for p in pensions where p.plan.yearsUntilPayment == fromToday {
                    capital -= p.result.lumpSum * (1 - r.pensionDeductionRate) / deflator
                }
                let net = germanPensionNet(list, plan: plan)
                for id in net.issues where !issues.contains(id) { issues.append(id) }
                guard let netValue = net.net else {
                    return GermanRetirementResult(atRetirement: atRetirement, currentTarget: nil, rows: [], depletedAfter: nil, issues: issues)
                }
                let lumpGross = list.reduce(0.0) { $0 + $1.lumpSum }
                capital += lumpGross / deflator
                pension = (netValue - lumpGross) / deflator
            }
            let withdrawal = max(0, r.annualSpending - pension) / (1 - r.withdrawalTaxShare)
            capital = (capital - withdrawal) * (1 + r.realReturn)
            if capital < 0 && depletedAfter == nil { depletedAfter = y }
            capital = max(0, capital)
            rows.append(GermanRetirementRow(year: y, capital: capital, pension: pension, withdrawal: withdrawal))
        }
        let currentTarget = r.annualSpending / (1 - r.withdrawalTaxShare) / r.withdrawalRate
        return GermanRetirementResult(atRetirement: atRetirement, currentTarget: currentTarget, rows: rows, depletedAfter: depletedAfter,
                                      issues: issues)
    }

    // MARK: Helpers

    /// Web `wealthAfterYears` (lib/calc/fire.ts), used by the retirement bridge.
    static func wealthAfterYears(current: Double, annualSaving: Double, realReturn: Double, years: Double) -> Double {
        if years <= 0 { return current }
        if abs(realReturn) < 1e-12 { return current + annualSaving * years }
        let growth = pow(1 + realReturn, years)
        return current * growth + (annualSaving * (growth - 1)) / realReturn
    }

    /// JS `String(number)` for the integer years used in crypto anniversaries.
    static func jsNumberString(_ n: Double) -> String {
        n.isNaN ? "NaN" : (n == n.rounded() && abs(n) < 1e21 ? String(Int64(n)) : String(n))
    }

    /// JS `<` on strings (UTF-16 code-unit order).
    static func jsLess(_ a: String, _ b: String) -> Bool { a.utf16.lexicographicallyPrecedes(b.utf16) }
}

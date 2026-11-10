import Foundation

// German financial-planning document (web `lib/financial-planning/schema.ts`). Every default equals the zod default,
// so a partially filled plan behaves as `germanPlanSchema.parse(...)` on the web.

public enum GermanFundKind: String, CaseIterable, Sendable {
    case unknown, equity, mixed, property
    case foreignProperty = "foreign-property"
    case other
}

public enum GermanPensionKind: String, CaseIterable, Sendable {
    case statutory, occupational, riester, ruerup
    case `private`
    case avd
}

public struct GermanTaxProfile: Hashable, Sendable {
    public var year: Int = 2026
    public var joint: Bool = false
    /// 0, 0.08 or 0.09.
    public var churchRate: Double = 0
    public var allowanceUsedElsewhere: Double = 0
    public var shareLosses: Double = 0
    public var generalLosses: Double = 0
    public var otherCapitalIncome: Double = 0
    public var verifiedForeignCredit: Double = 0
    public init() {}
}

public struct GermanFundScenario: Hashable, Sendable {
    public var kind: GermanFundKind = .unknown
    public var startValue: Double = 0
    public var endValue: Double = 0
    public var distributions: Double = 0
    /// 1…12.
    public var acquisitionMonth: Int = 1
    public init() {}
}

public enum GermanAvdEligibility: String, Sendable { case none, direct, indirect }
public enum GermanAvdPayout: String, Sendable { case provider, drawdown }

public struct GermanAvd: Hashable, Sendable {
    public var enabled = false
    public var contributionStartYear = 2027
    public var eligibility: GermanAvdEligibility = .none
    public var spouseAnnualContribution: Double = 0
    public var childAllowanceYears: [Int] = []
    public var starterBonus = false
    public var ageAtStart = 40
    public var taxableIncomeBeforeDeduction: Double = 0
    public var payout: GermanAvdPayout = .provider
    public var payoutStartAge = 67
    public var payoutEndAge = 85
    public var lumpSumRate: Double = 0
    public var payoutReturn: Double = 0
    public init() {}
}

public enum GermanPensionTaxMode: String, Sendable { case manual, rules }
public enum GermanPensionInsurance: String, Sendable { case kvdr, voluntary, `private` }

public struct GermanPensionTax: Hashable, Sendable {
    public var mode: GermanPensionTaxMode = .manual
    public var insurance: GermanPensionInsurance = .kvdr
    public var additionalHealthRate: Double = 0.029
    public var childless = false
    public var childrenUnder25 = 0
    public var otherInsuranceIncome: Double = 0
    public var voluntarySubsidy = false
    public var annualPrivatePremium: Double = 0
    public var annualDeductiblePremium: Double = 0
    public var surchargeChildAllowance: Double = 0
    public var otherTaxableIncome: Double = 0
    public var otherDeductions: Double = 0
    public init() {}
}

public enum GermanTaxTreatment: String, Sendable {
    case unknown, funded
    case privateAnnuity = "private-annuity"
    case statement
}

public enum GermanPaymentMode: String, Sendable { case income, capital }

public struct GermanPensionPlan: Hashable, Sendable {
    public var id: String = ""
    public var name: String = ""
    public var kind: GermanPensionKind
    public var capital: Double = 0
    public var monthlyContribution: Double = 0
    public var monthlyGross: Double = 0
    public var yearsUntilPayment = 0
    public var nominalReturn: Double = 0
    public var points: Double = 0
    public var annualPoints: Double = 0
    public var accessFactor: Double = 1
    public var taxTreatment: GermanTaxTreatment = .unknown
    public var taxableAnnualFromStatement: Double = 0
    public var pensionStartYear: Int? = nil
    public var taxFreeAnnualAmount: Double? = nil
    public var ageAtPayment = 67
    public var avd = GermanAvd()
    public var paymentMode: GermanPaymentMode = .income
    public init(kind: GermanPensionKind) { self.kind = kind }
}

public struct GermanRetirementInput: Hashable, Sendable {
    public var liquidCapital: Double = 0
    public var annualSaving: Double = 0
    public var annualSpending: Double = 0
    public var yearsUntilRetirement = 0
    public var realReturn: Double = 0.02
    public var withdrawalRate: Double = 0.035
    public var inflation: Double = 0.02
    public var pensionDeductionRate: Double = 0.25
    public var withdrawalTaxShare: Double = 0
    public init() {}
}

public struct GermanCryptoSale: Hashable, Sendable {
    public var id: String
    public var name: String
    /// `YYYY-MM-DD`.
    public var acquired: String
    public var sold: String
    public var proceeds: Double
    public var cost: Double
    public var fees: Double
    public init(id: String, name: String, acquired: String, sold: String, proceeds: Double, cost: Double, fees: Double = 0) {
        self.id = id; self.name = name; self.acquired = acquired; self.sold = sold
        self.proceeds = proceeds; self.cost = cost; self.fees = fees
    }
}

public struct GermanPlan: Hashable, Sendable {
    public var tax = GermanTaxProfile()
    public var fund = GermanFundScenario()
    public var pensions: [GermanPensionPlan] = []
    public var pensionTax = GermanPensionTax()
    public var retirement = GermanRetirementInput()
    public var crypto: [GermanCryptoSale] = []
    public var cryptoOtherGains: Double = 0
    public var cryptoLossCarryforward: Double = 0
    public var otherTaxableIncome: Double = 0
    public init() {}
}

// MARK: Results

public struct GermanCapitalTaxResult: Hashable, Sendable {
    public let taxable, foreignCredit, usedAllowance, remainingAllowance, capitalTax, solidarity, church, total: Double
    public let remainingShareLosses, remainingGeneralLosses: Double
}

public struct GermanFundAdvanceResult: Hashable, Sendable {
    public let gross: Double
    /// nil when the fund kind is unknown (no partial exemption is assumed).
    public let taxable: Double?
    public let receiptYear: Int
}

public struct GermanCryptoResult: Hashable, Sendable {
    public let shortTerm, exempt, taxable, incomeTax, remainingLoss: Double
}

public struct GermanSurcharges: Hashable, Sendable {
    public let solidarity, church: Double
}

public struct GermanAvdAllowanceResult: Hashable, Sendable {
    public let base, children, bonus, total, deduction: Double
}

public struct GermanAvdTaxBenefitResult: Hashable, Sendable {
    public let base, children, bonus, total, deduction, extraRefund: Double
}

public struct GermanPensionProjection: Hashable, Sendable {
    public let currentCapital, projectedCapital, monthlyGross, lumpSum: Double
    public let paymentYears: Double?
    public let grants: Double
}

public struct GermanPensionPayment: Hashable, Sendable {
    public var plan: GermanPensionPlan
    public var annual: Double
    public var lumpSum: Double
    public var occupationalMonthlyEquivalent: Double
    public init(plan: GermanPensionPlan, annual: Double, lumpSum: Double, occupationalMonthlyEquivalent: Double = 0) {
        self.plan = plan; self.annual = annual; self.lumpSum = lumpSum; self.occupationalMonthlyEquivalent = occupationalMonthlyEquivalent
    }
}

public struct GermanPensionNetResult: Hashable, Sendable {
    public let gross: Double
    /// All nil when `issues` is not empty.
    public let taxable, health, care, incomeTax, solidarity, church, net: Double?
    public let issues: [String]
    public let insuranceIssues: [String]
}

public struct GermanRetirementRow: Hashable, Sendable {
    public let year: Int
    public let capital, pension, withdrawal: Double
}

public struct GermanRetirementResult: Hashable, Sendable {
    public let atRetirement: Double
    public let currentTarget: Double?
    public let rows: [GermanRetirementRow]
    public let depletedAfter: Int?
    public let issues: [String]
}

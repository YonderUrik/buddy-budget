package io.buddybudget.core.domain.planningde

// German financial-planning document (web `lib/financial-planning/schema.ts`). Every default equals the zod default,
// so a partially filled plan behaves as `germanPlanSchema.parse(...)` on the web. Same names as the Swift models.

enum class GermanFundKind(val key: String) {
    UNKNOWN("unknown"), EQUITY("equity"), MIXED("mixed"), PROPERTY("property"), FOREIGN_PROPERTY("foreign-property"), OTHER("other");

    companion object { fun fromKey(key: String): GermanFundKind? = entries.firstOrNull { it.key == key } }
}

enum class GermanPensionKind(val key: String) {
    STATUTORY("statutory"), OCCUPATIONAL("occupational"), RIESTER("riester"), RUERUP("ruerup"), PRIVATE("private"), AVD("avd");

    companion object { fun fromKey(key: String): GermanPensionKind? = entries.firstOrNull { it.key == key } }
}

data class GermanTaxProfile(
    val year: Int = 2026,
    val joint: Boolean = false,
    /** 0, 0.08 or 0.09. */
    val churchRate: Double = 0.0,
    val allowanceUsedElsewhere: Double = 0.0,
    val shareLosses: Double = 0.0,
    val generalLosses: Double = 0.0,
    val otherCapitalIncome: Double = 0.0,
    val verifiedForeignCredit: Double = 0.0,
)

data class GermanFundScenario(
    val kind: GermanFundKind = GermanFundKind.UNKNOWN,
    val startValue: Double = 0.0,
    val endValue: Double = 0.0,
    val distributions: Double = 0.0,
    /** 1…12. */
    val acquisitionMonth: Int = 1,
)

enum class GermanAvdEligibility(val key: String) {
    NONE("none"), DIRECT("direct"), INDIRECT("indirect");

    companion object { fun fromKey(key: String): GermanAvdEligibility? = entries.firstOrNull { it.key == key } }
}

enum class GermanAvdPayout(val key: String) {
    PROVIDER("provider"), DRAWDOWN("drawdown");

    companion object { fun fromKey(key: String): GermanAvdPayout? = entries.firstOrNull { it.key == key } }
}

data class GermanAvd(
    val enabled: Boolean = false,
    val contributionStartYear: Int = 2027,
    val eligibility: GermanAvdEligibility = GermanAvdEligibility.NONE,
    val spouseAnnualContribution: Double = 0.0,
    val childAllowanceYears: List<Int> = emptyList(),
    val starterBonus: Boolean = false,
    val ageAtStart: Int = 40,
    val taxableIncomeBeforeDeduction: Double = 0.0,
    val payout: GermanAvdPayout = GermanAvdPayout.PROVIDER,
    val payoutStartAge: Int = 67,
    val payoutEndAge: Int = 85,
    val lumpSumRate: Double = 0.0,
    val payoutReturn: Double = 0.0,
)

enum class GermanPensionTaxMode(val key: String) {
    MANUAL("manual"), RULES("rules");

    companion object { fun fromKey(key: String): GermanPensionTaxMode? = entries.firstOrNull { it.key == key } }
}

enum class GermanPensionInsurance(val key: String) {
    KVDR("kvdr"), VOLUNTARY("voluntary"), PRIVATE("private");

    companion object { fun fromKey(key: String): GermanPensionInsurance? = entries.firstOrNull { it.key == key } }
}

data class GermanPensionTax(
    val mode: GermanPensionTaxMode = GermanPensionTaxMode.MANUAL,
    val insurance: GermanPensionInsurance = GermanPensionInsurance.KVDR,
    val additionalHealthRate: Double = 0.029,
    val childless: Boolean = false,
    val childrenUnder25: Int = 0,
    val otherInsuranceIncome: Double = 0.0,
    val voluntarySubsidy: Boolean = false,
    val annualPrivatePremium: Double = 0.0,
    val annualDeductiblePremium: Double = 0.0,
    val surchargeChildAllowance: Double = 0.0,
    val otherTaxableIncome: Double = 0.0,
    val otherDeductions: Double = 0.0,
)

enum class GermanTaxTreatment(val key: String) {
    UNKNOWN("unknown"), FUNDED("funded"), PRIVATE_ANNUITY("private-annuity"), STATEMENT("statement");

    companion object { fun fromKey(key: String): GermanTaxTreatment? = entries.firstOrNull { it.key == key } }
}

enum class GermanPaymentMode(val key: String) {
    INCOME("income"), CAPITAL("capital");

    companion object { fun fromKey(key: String): GermanPaymentMode? = entries.firstOrNull { it.key == key } }
}

data class GermanPensionPlan(
    val kind: GermanPensionKind,
    val id: String = "",
    val name: String = "",
    val capital: Double = 0.0,
    val monthlyContribution: Double = 0.0,
    val monthlyGross: Double = 0.0,
    val yearsUntilPayment: Int = 0,
    val nominalReturn: Double = 0.0,
    val points: Double = 0.0,
    val annualPoints: Double = 0.0,
    val accessFactor: Double = 1.0,
    val taxTreatment: GermanTaxTreatment = GermanTaxTreatment.UNKNOWN,
    val taxableAnnualFromStatement: Double = 0.0,
    val pensionStartYear: Int? = null,
    val taxFreeAnnualAmount: Double? = null,
    val ageAtPayment: Int = 67,
    val avd: GermanAvd = GermanAvd(),
    val paymentMode: GermanPaymentMode = GermanPaymentMode.INCOME,
)

data class GermanRetirementInput(
    val liquidCapital: Double = 0.0,
    val annualSaving: Double = 0.0,
    val annualSpending: Double = 0.0,
    val yearsUntilRetirement: Int = 0,
    val realReturn: Double = 0.02,
    val withdrawalRate: Double = 0.035,
    val inflation: Double = 0.02,
    val pensionDeductionRate: Double = 0.25,
    val withdrawalTaxShare: Double = 0.0,
)

data class GermanCryptoSale(
    val id: String,
    val name: String,
    /** `YYYY-MM-DD`. */
    val acquired: String,
    val sold: String,
    val proceeds: Double,
    val cost: Double,
    val fees: Double = 0.0,
)

data class GermanPlan(
    val tax: GermanTaxProfile = GermanTaxProfile(),
    val fund: GermanFundScenario = GermanFundScenario(),
    val pensions: List<GermanPensionPlan> = emptyList(),
    val pensionTax: GermanPensionTax = GermanPensionTax(),
    val retirement: GermanRetirementInput = GermanRetirementInput(),
    val crypto: List<GermanCryptoSale> = emptyList(),
    val cryptoOtherGains: Double = 0.0,
    val cryptoLossCarryforward: Double = 0.0,
    val otherTaxableIncome: Double = 0.0,
)

// region Results

data class GermanCapitalTaxResult(
    val taxable: Double, val foreignCredit: Double, val usedAllowance: Double, val remainingAllowance: Double,
    val capitalTax: Double, val solidarity: Double, val church: Double, val total: Double,
    val remainingShareLosses: Double, val remainingGeneralLosses: Double,
)

/** [taxable] is null when the fund kind is unknown. */
data class GermanFundAdvanceResult(val gross: Double, val taxable: Double?, val receiptYear: Int)

data class GermanCryptoResult(val shortTerm: Double, val exempt: Double, val taxable: Double, val incomeTax: Double, val remainingLoss: Double)

data class GermanSurcharges(val solidarity: Double, val church: Double)

data class GermanAvdAllowanceResult(val base: Double, val children: Double, val bonus: Double, val total: Double, val deduction: Double)

data class GermanAvdTaxBenefitResult(
    val base: Double, val children: Double, val bonus: Double, val total: Double, val deduction: Double, val extraRefund: Double,
)

data class GermanPensionProjection(
    val currentCapital: Double, val projectedCapital: Double, val monthlyGross: Double, val lumpSum: Double,
    val paymentYears: Double?, val grants: Double,
)

data class GermanPensionPayment(
    val plan: GermanPensionPlan,
    val annual: Double,
    val lumpSum: Double,
    val occupationalMonthlyEquivalent: Double = 0.0,
)

/** All nullable fields are null when [issues] is not empty. */
data class GermanPensionNetResult(
    val gross: Double, val taxable: Double?, val health: Double?, val care: Double?, val incomeTax: Double?,
    val solidarity: Double?, val church: Double?, val net: Double?, val issues: List<String>, val insuranceIssues: List<String>,
)

data class GermanRetirementRow(val year: Int, val capital: Double, val pension: Double, val withdrawal: Double)

data class GermanRetirementResult(
    val atRetirement: Double, val currentTarget: Double?, val rows: List<GermanRetirementRow>, val depletedAfter: Int?, val issues: List<String>,
)

// endregion

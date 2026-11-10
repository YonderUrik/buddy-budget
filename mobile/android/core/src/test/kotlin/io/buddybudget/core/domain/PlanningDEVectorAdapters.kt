package io.buddybudget.core.domain

import io.buddybudget.core.domain.planningde.GermanAvd
import io.buddybudget.core.domain.planningde.GermanAvdEligibility
import io.buddybudget.core.domain.planningde.GermanAvdPayout
import io.buddybudget.core.domain.planningde.GermanCryptoSale
import io.buddybudget.core.domain.planningde.GermanFundKind
import io.buddybudget.core.domain.planningde.GermanFundScenario
import io.buddybudget.core.domain.planningde.GermanPaymentMode
import io.buddybudget.core.domain.planningde.GermanPensionInsurance
import io.buddybudget.core.domain.planningde.GermanPensionKind
import io.buddybudget.core.domain.planningde.GermanPensionPayment
import io.buddybudget.core.domain.planningde.GermanPensionPlan
import io.buddybudget.core.domain.planningde.GermanPensionProjection
import io.buddybudget.core.domain.planningde.GermanPensionTax
import io.buddybudget.core.domain.planningde.GermanPensionTaxMode
import io.buddybudget.core.domain.planningde.GermanPlan
import io.buddybudget.core.domain.planningde.GermanPlanning
import io.buddybudget.core.domain.planningde.GermanRetirementInput
import io.buddybudget.core.domain.planningde.GermanRetirementRow
import io.buddybudget.core.domain.planningde.GermanTaxProfile
import io.buddybudget.core.domain.planningde.GermanTaxTreatment
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull

/**
 * financial-planning-de.json. Inputs are partial plans: missing fields take the zod defaults (the models' defaults),
 * as the generator ran `germanPlanSchema.parse(...)`. "avdP" names the generator's fixture (gen-de-vectors.ts).
 * Mirrors the Swift `VectorAdapters+PlanningDE.swift`.
 */
internal object PlanningDEVectorAdapters {
    /** Field lookup that stays on the JsonElement extension (a smart-cast JsonObject would use Map.get). */
    private fun JsonElement.field(key: String): JsonElement = this[key]

    private fun opt(x: Double?): JsonElement = x?.let { n(it) } ?: JsonNull
    private val JsonElement.optBool: Boolean? get() = (this as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
    private val JsonElement.optInt: Int? get() = optNum?.toInt()
    private fun <T> key(v: JsonElement, parse: (String) -> T?): T? = v.optStr?.let { parse(it) ?: throw AdapterError("bad key $it") }

    private fun taxProfile(v: JsonElement): GermanTaxProfile {
        val d = GermanTaxProfile()
        return GermanTaxProfile(
            year = v["year"].optInt ?: d.year,
            joint = v["joint"].optBool ?: d.joint,
            churchRate = v["churchRate"].optNum ?: d.churchRate,
            allowanceUsedElsewhere = v["allowanceUsedElsewhere"].optNum ?: d.allowanceUsedElsewhere,
            shareLosses = v["shareLosses"].optNum ?: d.shareLosses,
            generalLosses = v["generalLosses"].optNum ?: d.generalLosses,
            otherCapitalIncome = v["otherCapitalIncome"].optNum ?: d.otherCapitalIncome,
            verifiedForeignCredit = v["verifiedForeignCredit"].optNum ?: d.verifiedForeignCredit,
        )
    }

    private fun fund(v: JsonElement): GermanFundScenario {
        val d = GermanFundScenario()
        return GermanFundScenario(
            kind = key(v["kind"], GermanFundKind::fromKey) ?: d.kind,
            startValue = v["startValue"].optNum ?: d.startValue,
            endValue = v["endValue"].optNum ?: d.endValue,
            distributions = v["distributions"].optNum ?: d.distributions,
            acquisitionMonth = v["acquisitionMonth"].optInt ?: d.acquisitionMonth,
        )
    }

    private fun avd(v: JsonElement): GermanAvd {
        val d = GermanAvd()
        return GermanAvd(
            enabled = v["enabled"].optBool ?: d.enabled,
            contributionStartYear = v["contributionStartYear"].optInt ?: d.contributionStartYear,
            eligibility = key(v["eligibility"], GermanAvdEligibility::fromKey) ?: d.eligibility,
            spouseAnnualContribution = v["spouseAnnualContribution"].optNum ?: d.spouseAnnualContribution,
            childAllowanceYears = if (v["childAllowanceYears"].isNull) d.childAllowanceYears else v["childAllowanceYears"].list.map { it.int },
            starterBonus = v["starterBonus"].optBool ?: d.starterBonus,
            ageAtStart = v["ageAtStart"].optInt ?: d.ageAtStart,
            taxableIncomeBeforeDeduction = v["taxableIncomeBeforeDeduction"].optNum ?: d.taxableIncomeBeforeDeduction,
            payout = key(v["payout"], GermanAvdPayout::fromKey) ?: d.payout,
            payoutStartAge = v["payoutStartAge"].optInt ?: d.payoutStartAge,
            payoutEndAge = v["payoutEndAge"].optInt ?: d.payoutEndAge,
            lumpSumRate = v["lumpSumRate"].optNum ?: d.lumpSumRate,
            payoutReturn = v["payoutReturn"].optNum ?: d.payoutReturn,
        )
    }

    /** `pp(o)` in the generator: id "p", name "P", kind "private" unless given. */
    private fun pension(v: JsonElement, defaultKind: GermanPensionKind = GermanPensionKind.PRIVATE): GermanPensionPlan {
        val d = GermanPensionPlan(kind = defaultKind)
        return GermanPensionPlan(
            kind = key(v["kind"], GermanPensionKind::fromKey) ?: defaultKind,
            id = v["id"].optStr ?: "p",
            name = v["name"].optStr ?: "P",
            capital = v["capital"].optNum ?: d.capital,
            monthlyContribution = v["monthlyContribution"].optNum ?: d.monthlyContribution,
            monthlyGross = v["monthlyGross"].optNum ?: d.monthlyGross,
            yearsUntilPayment = v["yearsUntilPayment"].optInt ?: d.yearsUntilPayment,
            nominalReturn = v["nominalReturn"].optNum ?: d.nominalReturn,
            points = v["points"].optNum ?: d.points,
            annualPoints = v["annualPoints"].optNum ?: d.annualPoints,
            accessFactor = v["accessFactor"].optNum ?: d.accessFactor,
            taxTreatment = key(v["taxTreatment"], GermanTaxTreatment::fromKey) ?: d.taxTreatment,
            taxableAnnualFromStatement = v["taxableAnnualFromStatement"].optNum ?: d.taxableAnnualFromStatement,
            pensionStartYear = v["pensionStartYear"].optInt,
            taxFreeAnnualAmount = v["taxFreeAnnualAmount"].optNum,
            ageAtPayment = v["ageAtPayment"].optInt ?: d.ageAtPayment,
            avd = if (v["avd"] is JsonObject) avd(v["avd"]) else d.avd,
            paymentMode = key(v["paymentMode"], GermanPaymentMode::fromKey) ?: d.paymentMode,
        )
    }

    /** The generator's `avdP` fixture. */
    private val avdFixture = GermanPensionPlan(
        kind = GermanPensionKind.AVD, id = "p", name = "P", monthlyContribution = 150.0, yearsUntilPayment = 30, nominalReturn = 0.05,
        capital = 0.0,
        avd = GermanAvd(
            enabled = true, contributionStartYear = 2027, eligibility = GermanAvdEligibility.DIRECT, childAllowanceYears = listOf(10, 3),
            starterBonus = true, ageAtStart = 24, taxableIncomeBeforeDeduction = 50000.0, payout = GermanAvdPayout.DRAWDOWN,
            payoutStartAge = 67, payoutEndAge = 85, lumpSumRate = 0.3, payoutReturn = 0.02,
        ),
    )

    /** "avdP" or a partial plan (the indirect AVD vector omits the kind; the generator built it with kind "avd"). */
    private fun pensionInput(v: JsonElement): GermanPensionPlan =
        if (v.optStr == "avdP") avdFixture else pension(v, if (v["avd"].isNull) GermanPensionKind.PRIVATE else GermanPensionKind.AVD)

    private fun plan(v: JsonElement): GermanPlan {
        val d = GermanPlan()
        val t = v["pensionTax"]
        val dt = GermanPensionTax()
        val pensionTax = if (t !is JsonObject) dt else GermanPensionTax(
            mode = key(t.field("mode"), GermanPensionTaxMode::fromKey) ?: dt.mode,
            insurance = key(t.field("insurance"), GermanPensionInsurance::fromKey) ?: dt.insurance,
            additionalHealthRate = t.field("additionalHealthRate").optNum ?: dt.additionalHealthRate,
            childless = t.field("childless").optBool ?: dt.childless,
            childrenUnder25 = t.field("childrenUnder25").optInt ?: dt.childrenUnder25,
            otherInsuranceIncome = t.field("otherInsuranceIncome").optNum ?: dt.otherInsuranceIncome,
            voluntarySubsidy = t.field("voluntarySubsidy").optBool ?: dt.voluntarySubsidy,
            annualPrivatePremium = t.field("annualPrivatePremium").optNum ?: dt.annualPrivatePremium,
            annualDeductiblePremium = t.field("annualDeductiblePremium").optNum ?: dt.annualDeductiblePremium,
            surchargeChildAllowance = t.field("surchargeChildAllowance").optNum ?: dt.surchargeChildAllowance,
            otherTaxableIncome = t.field("otherTaxableIncome").optNum ?: dt.otherTaxableIncome,
            otherDeductions = t.field("otherDeductions").optNum ?: dt.otherDeductions,
        )
        val rr = v["retirement"]
        val dr = GermanRetirementInput()
        val retirement = if (rr !is JsonObject) dr else GermanRetirementInput(
            liquidCapital = rr.field("liquidCapital").optNum ?: dr.liquidCapital,
            annualSaving = rr.field("annualSaving").optNum ?: dr.annualSaving,
            annualSpending = rr.field("annualSpending").optNum ?: dr.annualSpending,
            yearsUntilRetirement = rr.field("yearsUntilRetirement").optInt ?: dr.yearsUntilRetirement,
            realReturn = rr.field("realReturn").optNum ?: dr.realReturn,
            withdrawalRate = rr.field("withdrawalRate").optNum ?: dr.withdrawalRate,
            inflation = rr.field("inflation").optNum ?: dr.inflation,
            pensionDeductionRate = rr.field("pensionDeductionRate").optNum ?: dr.pensionDeductionRate,
            withdrawalTaxShare = rr.field("withdrawalTaxShare").optNum ?: dr.withdrawalTaxShare,
        )
        return GermanPlan(
            tax = if (v["tax"] is JsonObject) taxProfile(v["tax"]) else d.tax,
            fund = if (v["fund"] is JsonObject) fund(v["fund"]) else d.fund,
            pensions = v["pensions"].list.map { pension(it) },
            pensionTax = pensionTax,
            retirement = retirement,
            crypto = v["crypto"].list.map {
                GermanCryptoSale(it["id"].str, it["name"].str, it["acquired"].str, it["sold"].str, it["proceeds"].num, it["cost"].num,
                    it["fees"].optNum ?: 0.0)
            },
            cryptoOtherGains = v["cryptoOtherGains"].optNum ?: d.cryptoOtherGains,
            cryptoLossCarryforward = v["cryptoLossCarryforward"].optNum ?: d.cryptoLossCarryforward,
            otherTaxableIncome = v["otherTaxableIncome"].optNum ?: d.otherTaxableIncome,
        )
    }

    private fun projection(r: GermanPensionProjection) = obj(
        "currentCapital" to n(r.currentCapital), "projectedCapital" to n(r.projectedCapital), "monthlyGross" to n(r.monthlyGross),
        "lumpSum" to n(r.lumpSum), "paymentYears" to opt(r.paymentYears), "grants" to n(r.grants),
    )

    private fun row(x: GermanRetirementRow) =
        obj("year" to n(x.year), "capital" to n(x.capital), "pension" to n(x.pension), "withdrawal" to n(x.withdrawal))

    val handlers: Map<String, Handler> = mapOf(
        "fundTaxableShare" to { i -> opt(GermanPlanning.fundTaxableShare(GermanFundKind.fromKey(i["kind"].str) ?: error("kind"))) },
        "germanCapitalTax" to { i ->
            val r = GermanPlanning.germanCapitalTax(taxProfile(i["profile"]), i["shareGains"].num, i["generalIncome"].num)
            obj(
                "taxable" to n(r.taxable), "foreignCredit" to n(r.foreignCredit), "usedAllowance" to n(r.usedAllowance),
                "remainingAllowance" to n(r.remainingAllowance), "capitalTax" to n(r.capitalTax), "solidarity" to n(r.solidarity),
                "church" to n(r.church), "total" to n(r.total), "remainingShareLosses" to n(r.remainingShareLosses),
                "remainingGeneralLosses" to n(r.remainingGeneralLosses),
            )
        },
        "germanIncomeTax" to { i -> n(GermanPlanning.germanIncomeTax(i["taxableIncome"].num, i["joint"].optBool ?: false)) },
        "germanFundAdvance" to { i ->
            val r = GermanPlanning.germanFundAdvance(fund(i))
            obj("gross" to n(r.gross), "taxable" to opt(r.taxable), "receiptYear" to n(r.receiptYear))
        },
        "germanCrypto" to { i ->
            val r = GermanPlanning.germanCrypto(plan(i))
            obj(
                "shortTerm" to n(r.shortTerm), "exempt" to n(r.exempt), "taxable" to n(r.taxable), "incomeTax" to n(r.incomeTax),
                "remainingLoss" to n(r.remainingLoss),
            )
        },
        "germanPensionTaxableShare" to { i -> n(GermanPlanning.germanPensionTaxableShare(i["startYear"].int)) },
        "germanAnnuityShare" to { i -> n(GermanPlanning.germanAnnuityShare(i["age"].num)) },
        "germanProgressiveSurcharges" to { i ->
            val r = GermanPlanning.germanProgressiveSurcharges(i["tax"].num, i["joint"].optBool ?: false, i["churchRate"].num)
            obj("solidarity" to n(r.solidarity), "church" to n(r.church))
        },
        "germanAvdAllowance" to { i ->
            val r = GermanPlanning.germanAvdAllowance(pensionInput(i["plan"]), i["contributionYear"].optInt ?: 0)
            obj("base" to n(r.base), "children" to n(r.children), "bonus" to n(r.bonus), "total" to n(r.total), "deduction" to n(r.deduction))
        },
        "germanAvdTaxBenefit" to { i ->
            val r = GermanPlanning.germanAvdTaxBenefit(pensionInput(i["plan"]), i["joint"].optBool ?: false)
            obj(
                "base" to n(r.base), "children" to n(r.children), "bonus" to n(r.bonus), "total" to n(r.total),
                "deduction" to n(r.deduction), "extraRefund" to n(r.extraRefund),
            )
        },
        "projectGermanAvd" to { i -> projection(GermanPlanning.projectGermanAvd(pensionInput(i["plan"]), i["referenceYear"].int)) },
        "projectGermanPension" to { i ->
            projection(GermanPlanning.projectGermanPension(pensionInput(i["plan"]), i["referenceYear"].optInt ?: 2026))
        },
        "germanRetirement" to { i ->
            val r = GermanPlanning.germanRetirement(plan(i))
            obj(
                "atRetirement" to n(r.atRetirement), "currentTarget" to opt(r.currentTarget),
                "depletedAfter" to (r.depletedAfter?.let { n(it) } ?: JsonNull),
                "issues" to arr(r.issues.map { s(it) }),
                "rows0to6" to arr(r.rows.take(7).map { row(it) }),
                "row49" to (r.rows.getOrNull(49)?.let { row(it) } ?: JsonNull),
            )
        },
        "germanPensionNet" to { i ->
            val payments = i["payments"].list.map {
                GermanPensionPayment(pension(it["plan"]), it["annual"].num, it["lumpSum"].num, it["occupationalMonthlyEquivalent"].optNum ?: 0.0)
            }
            val r = GermanPlanning.germanPensionNet(payments, plan(i))
            obj(
                "gross" to n(r.gross), "taxable" to opt(r.taxable), "health" to opt(r.health), "care" to opt(r.care),
                "incomeTax" to opt(r.incomeTax), "solidarity" to opt(r.solidarity), "church" to opt(r.church), "net" to opt(r.net),
                "issues" to arr(r.issues.map { s(it) }), "insuranceIssues" to arr(r.insuranceIssues.map { s(it) }),
            )
        },
    )
}

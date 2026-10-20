package io.buddybudget.core.domain.planningde

import io.buddybudget.core.domain.format.JSNumber

/** Validated 2026 German rules (web `DE_2026`, `DE_AVD_2027`, `DE_PENSION_2026`); never reuse for other years. */
object GermanRules {
    const val YEAR = 2026
    const val ALLOWANCE = 1000.0
    const val JOINT_ALLOWANCE = 2000.0
    const val CAPITAL_RATE = 0.25
    const val SOLIDARITY_RATE = 0.055
    const val ADVANCE_BASE_RATE = 0.032
    const val ADVANCE_FACTOR = 0.7
    const val PENSION_POINT_VALUE = 42.52
    const val PENSION_POINT_VALUE_FROM = "2026-07-01"
    const val PRIVATE_SALE_THRESHOLD = 1000.0
    fun exemption(kind: GermanFundKind): Double = when (kind) {
        GermanFundKind.EQUITY -> 0.3
        GermanFundKind.MIXED -> 0.15
        GermanFundKind.PROPERTY -> 0.6
        GermanFundKind.FOREIGN_PROPERTY -> 0.8
        GermanFundKind.OTHER, GermanFundKind.UNKNOWN -> 0.0
    }

    // AVD reform effective 2027.
    const val AVD_EFFECTIVE_FROM = 2027
    const val AVD_MINIMUM = 120.0
    const val AVD_CONTRIBUTION_CAP = 6840.0
    const val AVD_SUPPORTED_CAP = 1800.0
    const val AVD_FIRST_BAND = 360.0
    const val AVD_FIRST_RATE = 0.5
    const val AVD_SECOND_RATE = 0.25
    const val AVD_CHILD_CAP = 300.0
    const val AVD_INDIRECT_CAP = 175.0
    const val AVD_STARTER_BONUS = 200.0

    // 2026 social-insurance parameters.
    const val MONTHLY_CEILING = 5812.50
    const val MONTHLY_MINIMUM = 1318.33
    const val REDUCED_HEALTH_RATE = 0.14
    const val OCCUPATIONAL_EXEMPTION = 3955.0 / 20
    const val HEALTH_RATE = 0.146
    const val CARE_RATE = 0.036
    const val CHILDLESS_EXTRA = 0.006
    const val CHILD_DISCOUNT = 0.0025
    const val SOLIDARITY_THRESHOLD = 20350.0
}

class UnsupportedGermanTaxYear : IllegalArgumentException("Unsupported German tax year")

/** German planning editors (web `lib/financial-planning/countries/de*.ts`, `projections.ts`), ported literally. */
object GermanPlanning {
    /** `Math.round((n + Number.EPSILON) * 100) / 100`. */
    private fun cents(n: Double): Double = JSNumber.round2Epsilon(n)

    private fun pow(a: Double, b: Double): Double = StrictMath.pow(a, b)

    /** Fail closed for tax years that have not been researched. */
    fun germanRules(year: Int) {
        if (year != GermanRules.YEAR) throw UnsupportedGermanTaxYear()
    }

    /** Taxable fraction for a verified fund classification; null for unknown. */
    fun fundTaxableShare(kind: GermanFundKind): Double? = if (kind == GermanFundKind.UNKNOWN) null else 1 - GermanRules.exemption(kind)

    fun germanCapitalTax(profile: GermanTaxProfile, shareGains: Double, generalIncome: Double): GermanCapitalTaxResult {
        germanRules(profile.year)
        val r = GermanRules
        val sharesAfterLoss = shareGains - profile.shareLosses
        val remainingShareLosses = maxOf(0.0, -sharesAfterLoss)
        val pooled = maxOf(0.0, sharesAfterLoss) + generalIncome + profile.otherCapitalIncome - profile.generalLosses
        val remainingGeneralLosses = maxOf(0.0, -pooled)
        val allowance = maxOf(0.0, (if (profile.joint) r.JOINT_ALLOWANCE else r.ALLOWANCE) - profile.allowanceUsedElsewhere)
        val usedAllowance = minOf(allowance, maxOf(0.0, pooled))
        val taxable = maxOf(0.0, pooled - usedAllowance)
        val foreignCredit = minOf(profile.verifiedForeignCredit, taxable * r.CAPITAL_RATE)
        val capitalTax = cents((taxable - foreignCredit / r.CAPITAL_RATE) / (1 / r.CAPITAL_RATE + profile.churchRate))
        val solidarity = Math.floor((capitalTax * r.SOLIDARITY_RATE + 1e-9) * 100) / 100
        val church = cents(capitalTax * profile.churchRate)
        return GermanCapitalTaxResult(
            taxable, foreignCredit, usedAllowance, allowance - usedAllowance, capitalTax, solidarity, church,
            cents(capitalTax + solidarity + church), remainingShareLosses, remainingGeneralLosses,
        )
    }

    /** 2026 fund advance (Vorabpauschale), taxable in 2027. Held through year-end. */
    fun germanFundAdvance(input: GermanFundScenario): GermanFundAdvanceResult {
        val growthCap = maxOf(0.0, input.endValue - input.startValue + input.distributions)
        val base = minOf(input.startValue * GermanRules.ADVANCE_BASE_RATE * GermanRules.ADVANCE_FACTOR, growthCap)
        val gross = maxOf(0.0, base - input.distributions) * (13 - input.acquisitionMonth).toDouble() / 12
        val share = fundTaxableShare(input.kind)
        return GermanFundAdvanceResult(cents(gross), share?.let { cents(gross * it) }, 2027)
    }

    /** 2026 progressive income tax (§32a) on taxable income, floored to whole euros; splitting when joint. */
    fun germanIncomeTax(taxableIncome: Double, joint: Boolean = false): Double {
        val divisor = if (joint) 2.0 else 1.0
        val x = Math.floor(maxOf(0.0, taxableIncome) / divisor)
        val y = (x - 12348) / 10000
        val z = (x - 17799) / 10000
        val tax = when {
            x <= 12348 -> 0.0
            x <= 17799 -> (914.51 * y + 1400) * y
            x <= 69878 -> (173.10 * z + 2397) * z + 1034.87
            x <= 277825 -> 0.42 * x - 11135.63
            else -> 0.45 * x - 19470.38
        }
        return Math.floor(tax) * divisor
    }

    /** Private spot-crypto disposals. The €1,000 limit is a threshold, not a deduction. */
    fun germanCrypto(plan: GermanPlan): GermanCryptoResult {
        var shortTerm = plan.cryptoOtherGains
        var exempt = 0.0
        for (sale in plan.crypto) {
            if (!sale.sold.startsWith(plan.tax.year.toString())) continue
            val acquiredYear = JSNumber.parse(sale.acquired.take(4)) ?: Double.NaN
            val anniversary = "${jsNumberString(acquiredYear + 1)}${sale.acquired.drop(4)}"
            val gain = sale.proceeds - sale.cost - sale.fees
            // JS string `>` compares UTF-16 code units, like Kotlin's String.compareTo.
            if (sale.sold > anniversary) exempt += gain else shortTerm += gain
        }
        val threshold = GermanRules.PRIVATE_SALE_THRESHOLD
        val taxable = if (shortTerm < threshold) 0.0 else maxOf(0.0, shortTerm - plan.cryptoLossCarryforward)
        val incomeTax = germanIncomeTax(plan.otherTaxableIncome + taxable, plan.tax.joint) - germanIncomeTax(plan.otherTaxableIncome, plan.tax.joint)
        val remainingLoss = when {
            shortTerm < 0 -> plan.cryptoLossCarryforward - shortTerm
            shortTerm < threshold -> plan.cryptoLossCarryforward
            else -> maxOf(0.0, plan.cryptoLossCarryforward - shortTerm)
        }
        return GermanCryptoResult(shortTerm, exempt, taxable, incomeTax, remainingLoss)
    }

    // region Pensions

    /** Taxable share of a statutory / Rürup pension by start year. */
    fun germanPensionTaxableShare(startYear: Int): Double = when {
        startYear <= 2005 -> 0.5
        startYear <= 2020 -> 0.5 + (startYear - 2005) * 0.02
        startYear <= 2022 -> 0.8 + (startYear - 2020) * 0.01
        else -> minOf(1.0, 0.82 + (startYear - 2022) * 0.005)
    }

    private val annuityBands: List<Pair<Double, Double>> = listOf(
        1 to 59, 3 to 58, 5 to 57, 8 to 56, 10 to 55, 12 to 54, 14 to 53, 16 to 52, 18 to 51, 20 to 50, 22 to 49, 24 to 48,
        26 to 47, 27 to 46, 29 to 45, 31 to 44, 32 to 43, 34 to 42, 35 to 41, 37 to 40, 38 to 39, 40 to 38, 41 to 37, 42 to 36,
        44 to 35, 45 to 34, 47 to 33, 48 to 32, 49 to 31, 50 to 30, 52 to 29, 53 to 28, 54 to 27, 56 to 26, 57 to 25, 58 to 24,
        59 to 23, 61 to 22, 62 to 21, 63 to 20, 64 to 19, 66 to 18, 67 to 17, 68 to 16, 70 to 15, 71 to 14, 73 to 13, 74 to 12,
        75 to 11, 77 to 10, 79 to 9, 80 to 8, 82 to 7, 84 to 6, 87 to 5, 91 to 4, 93 to 3, 96 to 2, 120 to 1,
    ).map { (a, b) -> a.toDouble() to b.toDouble() }

    /** Lifetime private annuity earnings share, EStG §22(1)(a)(bb). */
    fun germanAnnuityShare(age: Double): Double = (annuityBands.firstOrNull { age <= it.first }?.second ?: 1.0) / 100

    fun germanProgressiveSurcharges(tax: Double, joint: Boolean, churchRate: Double): GermanSurcharges {
        val threshold = GermanRules.SOLIDARITY_THRESHOLD * (if (joint) 2 else 1)
        val solidarity = Math.floor((maxOf(0.0, minOf(tax * 0.055, (tax - threshold) * 0.119)) + 1e-9) * 100) / 100
        return GermanSurcharges(solidarity, JSNumber.round(tax * churchRate * 100) / 100)
    }

    fun germanAvdAllowance(plan: GermanPensionPlan, contributionYear: Int = 0): GermanAvdAllowanceResult {
        val a = plan.avd
        val r = GermanRules
        val contribution = plan.monthlyContribution * 12
        val eligible = contribution >= r.AVD_MINIMUM && a.eligibility != GermanAvdEligibility.NONE &&
            (a.eligibility != GermanAvdEligibility.INDIRECT || a.spouseAnnualContribution >= r.AVD_MINIMUM)
        val basis = if (a.eligibility == GermanAvdEligibility.INDIRECT) a.spouseAnnualContribution else contribution
        val basic = if (eligible) {
            minOf(basis, r.AVD_FIRST_BAND) * r.AVD_FIRST_RATE + maxOf(0.0, minOf(basis, r.AVD_SUPPORTED_CAP) - r.AVD_FIRST_BAND) * r.AVD_SECOND_RATE
        } else 0.0
        val base = if (a.eligibility == GermanAvdEligibility.INDIRECT) minOf(r.AVD_INDIRECT_CAP, basic) else basic
        val children = if (eligible) a.childAllowanceYears.count { it > contributionYear } * minOf(basis, r.AVD_CHILD_CAP) else 0.0
        val bonus = if (eligible && a.eligibility == GermanAvdEligibility.DIRECT && a.starterBonus && a.ageAtStart < 25 && contributionYear == 0) {
            r.AVD_STARTER_BONUS
        } else 0.0
        val total = JSNumber.round2(base + children + bonus)
        val deduction = if (a.eligibility == GermanAvdEligibility.DIRECT) minOf(contribution, r.AVD_SUPPORTED_CAP) + total else 0.0
        return GermanAvdAllowanceResult(JSNumber.round2(base), JSNumber.round2(children), bonus, total, deduction)
    }

    /** Additional refund beyond the grants (constant-2026-tariff comparison). */
    fun germanAvdTaxBenefit(plan: GermanPensionPlan, joint: Boolean): GermanAvdTaxBenefitResult {
        val grant = germanAvdAllowance(plan)
        val income = plan.avd.taxableIncomeBeforeDeduction
        val saving = germanIncomeTax(income, joint) - germanIncomeTax(maxOf(0.0, income - grant.deduction), joint)
        return GermanAvdTaxBenefitResult(grant.base, grant.children, grant.bonus, grant.total, grant.deduction, maxOf(0.0, saving - grant.total))
    }

    /** Contributions monthly in arrears, grants at year end. */
    fun projectGermanAvd(plan: GermanPensionPlan, referenceYear: Int): GermanPensionProjection {
        val a = plan.avd
        var capital = plan.capital
        var grants = 0.0
        val monthly = pow(1 + plan.nominalReturn, 1.0 / 12) - 1
        val delay = maxOf(0, a.contributionStartYear - referenceYear)
        for (year in 0 until plan.yearsUntilPayment) {
            val active = year >= delay
            repeat(12) { capital = capital * (1 + monthly) + (if (active) plan.monthlyContribution else 0.0) }
            val grant = if (active) germanAvdAllowance(plan, year - delay).total else 0.0
            capital += grant
            grants += grant
        }
        val lumpSum = capital * a.lumpSumRate
        val months = ((a.payoutEndAge - a.payoutStartAge) * 12).toDouble()
        val payoutRate = pow(1 + a.payoutReturn, 1.0 / 12) - 1
        val monthlyGross = when {
            a.payout == GermanAvdPayout.PROVIDER -> plan.monthlyGross
            Math.abs(payoutRate) < 1e-12 -> (capital - lumpSum) / months
            else -> (capital - lumpSum) * payoutRate / (1 - pow(1 + payoutRate, -months))
        }
        return GermanPensionProjection(
            plan.capital, capital, monthlyGross, lumpSum, if (a.payout == GermanAvdPayout.DRAWDOWN) months / 12 else null, grants,
        )
    }

    /** Pension assets and future income stay separate; no capitalization of statutory entitlements. */
    fun projectGermanPension(plan: GermanPensionPlan, referenceYear: Int = 2026): GermanPensionProjection {
        if (plan.kind == GermanPensionKind.AVD && plan.avd.enabled) return projectGermanAvd(plan, referenceYear)
        val years = plan.yearsUntilPayment.toDouble()
        val monthlyRate = pow(1 + plan.nominalReturn, 1.0 / 12) - 1
        val months = years * 12
        val projectedCapital = plan.capital * pow(1 + monthlyRate, months) +
            (if (Math.abs(monthlyRate) < 1e-12) plan.monthlyContribution * months
            else plan.monthlyContribution * (pow(1 + monthlyRate, months) - 1) / monthlyRate)
        val statutory = plan.kind == GermanPensionKind.STATUTORY
        val monthlyGross = when {
            statutory -> (plan.points + years * plan.annualPoints) * GermanRules.PENSION_POINT_VALUE * plan.accessFactor
            plan.paymentMode == GermanPaymentMode.INCOME -> plan.monthlyGross
            else -> 0.0
        }
        return GermanPensionProjection(
            currentCapital = if (statutory) 0.0 else plan.capital,
            projectedCapital = if (statutory) 0.0 else projectedCapital,
            monthlyGross = monthlyGross,
            lumpSum = if (!statutory && plan.paymentMode == GermanPaymentMode.CAPITAL) projectedCapital else 0.0,
            paymentYears = null,
            grants = 0.0,
        )
    }

    /** One person's pension receipts with a combined income-tax assessment. */
    fun germanPensionNet(payments: List<GermanPensionPayment>, plan: GermanPlan): GermanPensionNetResult {
        val settings = plan.pensionTax
        val rules = GermanRules
        var gross = 0.0
        var taxable = 0.0
        var statutory = 0.0
        var occupational = 0.0
        var privatePensions = 0.0
        val issues = mutableListOf<String>()
        val insuranceIssues = mutableListOf<String>()
        for (payment in payments) {
            val p = payment.plan
            val total = payment.annual + payment.lumpSum
            gross += total
            if (p.kind == GermanPensionKind.STATUTORY) statutory += payment.annual / 12
            if (p.kind == GermanPensionKind.OCCUPATIONAL) occupational += payment.annual / 12 + payment.occupationalMonthlyEquivalent
            if (p.kind != GermanPensionKind.STATUTORY && p.kind != GermanPensionKind.OCCUPATIONAL) {
                privatePensions += payment.annual / 12
                if (settings.insurance == GermanPensionInsurance.VOLUNTARY && payment.lumpSum > 0) { issues += p.id; insuranceIssues += p.id }
            }
            if (total == 0.0) continue
            if (p.taxTreatment == GermanTaxTreatment.STATEMENT) {
                taxable += minOf(total, p.taxableAnnualFromStatement)
            } else if (p.kind == GermanPensionKind.STATUTORY || p.kind == GermanPensionKind.RUERUP) {
                val exempt = p.taxFreeAnnualAmount
                    ?: (payment.annual * (1 - germanPensionTaxableShare(p.pensionStartYear ?: (plan.tax.year + p.yearsUntilPayment))))
                taxable += maxOf(0.0, total - exempt)
            } else if (p.taxTreatment == GermanTaxTreatment.FUNDED &&
                p.kind in listOf(GermanPensionKind.AVD, GermanPensionKind.RIESTER, GermanPensionKind.OCCUPATIONAL)
            ) {
                if (p.kind == GermanPensionKind.AVD && p.avd.enabled &&
                    (p.monthlyContribution * 12 > 1800 || p.avd.eligibility == GermanAvdEligibility.NONE)
                ) issues += p.id else taxable += total
            } else if (p.taxTreatment == GermanTaxTreatment.PRIVATE_ANNUITY && p.kind == GermanPensionKind.PRIVATE && payment.lumpSum == 0.0) {
                taxable += payment.annual * germanAnnuityShare(p.ageAtPayment.toDouble())
            } else {
                issues += p.id
            }
        }
        if (issues.isNotEmpty()) return GermanPensionNetResult(gross, null, null, null, null, null, null, null, issues, insuranceIssues)
        var health = 0.0
        var care = 0.0
        val careRate = rules.CARE_RATE + (if (settings.childless) rules.CHILDLESS_EXTRA else 0.0) -
            minOf(4, maxOf(0, settings.childrenUnder25 - 1)) * rules.CHILD_DISCOUNT
        when (settings.insurance) {
            GermanPensionInsurance.KVDR -> {
                val statutoryBase = minOf(statutory, rules.MONTHLY_CEILING)
                val remaining = maxOf(0.0, rules.MONTHLY_CEILING - statutoryBase)
                val occupationalHealth = minOf(remaining, maxOf(0.0, occupational - rules.OCCUPATIONAL_EXEMPTION))
                val occupationalCare = if (occupational > rules.OCCUPATIONAL_EXEMPTION) minOf(remaining, occupational) else 0.0
                health = 12 * (statutoryBase * (rules.HEALTH_RATE + settings.additionalHealthRate) / 2 +
                    occupationalHealth * (rules.HEALTH_RATE + settings.additionalHealthRate))
                care = 12 * (statutoryBase + occupationalCare) * careRate
            }
            GermanPensionInsurance.VOLUNTARY -> {
                val general = statutory + occupational
                val reduced = privatePensions + settings.otherInsuranceIncome / 12
                val assessed = minOf(rules.MONTHLY_CEILING, maxOf(rules.MONTHLY_MINIMUM, general + reduced))
                val generalBase = minOf(assessed, general)
                val reducedBase = maxOf(0.0, assessed - generalBase)
                val subsidy = if (settings.voluntarySubsidy) {
                    minOf(statutory, rules.MONTHLY_CEILING) * (rules.HEALTH_RATE + settings.additionalHealthRate) / 2
                } else 0.0
                health = 12 * (generalBase * (rules.HEALTH_RATE + settings.additionalHealthRate) +
                    reducedBase * (rules.REDUCED_HEALTH_RATE + settings.additionalHealthRate) - subsidy)
                care = 12 * assessed * careRate
            }
            GermanPensionInsurance.PRIVATE -> health = settings.annualPrivatePremium
        }
        val deductible = if (settings.insurance != GermanPensionInsurance.PRIVATE) health + care else minOf(health, settings.annualDeductiblePremium)
        val base = maxOf(0.0, settings.otherTaxableIncome - settings.otherDeductions)
        val joint = plan.tax.joint
        val allowance = if (taxable > 0) 102.0 else 0.0
        val incomeTax = germanIncomeTax(maxOf(0.0, base + taxable - deductible - allowance), joint)
        val baseTax = germanIncomeTax(base, joint)
        val charges = germanProgressiveSurcharges(
            germanIncomeTax(maxOf(0.0, base + taxable - deductible - allowance - settings.surchargeChildAllowance), joint), joint, plan.tax.churchRate,
        )
        val before = germanProgressiveSurcharges(germanIncomeTax(maxOf(0.0, base - settings.surchargeChildAllowance), joint), joint, plan.tax.churchRate)
        val incrementalTax = incomeTax - baseTax
        val solidarity = charges.solidarity - before.solidarity
        val church = charges.church - before.church
        return GermanPensionNetResult(
            gross, taxable, health, care, incrementalTax, solidarity, church,
            gross - health - care - incrementalTax - solidarity - church, issues, insuranceIssues,
        )
    }

    private class PensionEntry(val plan: GermanPensionPlan, val result: GermanPensionProjection)

    /** Retirement bridge in today's euros (50 yearly rows). */
    fun germanRetirement(plan: GermanPlan): GermanRetirementResult {
        val r = plan.retirement
        val pensions = plan.pensions.map { PensionEntry(it, projectGermanPension(it, plan.tax.year)) }
        val ytr = r.yearsUntilRetirement
        var atRetirement = wealthAfterYears(r.liquidCapital, r.annualSaving, r.realReturn, ytr.toDouble())
        fun paying(e: PensionEntry, year: Int): Boolean =
            e.plan.yearsUntilPayment <= year && (e.result.paymentYears == null || year < e.plan.yearsUntilPayment + e.result.paymentYears)
        fun payments(year: Int): List<GermanPensionPayment> = pensions.map { e ->
            GermanPensionPayment(
                plan = e.plan,
                annual = if (paying(e, year)) e.result.monthlyGross * 12 else 0.0,
                lumpSum = if (e.plan.yearsUntilPayment == year) e.result.lumpSum else 0.0,
                occupationalMonthlyEquivalent = if (e.plan.yearsUntilPayment <= year && year < e.plan.yearsUntilPayment + 10) e.result.lumpSum / 120 else 0.0,
            )
        }
        // Distinct lump-sum years in first-seen order (JS `new Set`).
        val lumpYears = pensions.filter { it.result.lumpSum > 0 && it.plan.yearsUntilPayment < ytr }.map { it.plan.yearsUntilPayment }.distinct()
        for (year in lumpYears) {
            val list = payments(year)
            val grossLump = list.fold(0.0) { sum, p -> sum + p.lumpSum }
            var netLump = grossLump * (1 - r.pensionDeductionRate)
            if (plan.pensionTax.mode == GermanPensionTaxMode.RULES) {
                val withLump = germanPensionNet(list, plan)
                val withoutLump = germanPensionNet(list.map { it.copy(lumpSum = 0.0) }, plan)
                if (withLump.net == null || withoutLump.net == null) {
                    return GermanRetirementResult(atRetirement, null, emptyList(), null, withLump.issues + withoutLump.issues)
                }
                netLump = withLump.net - withoutLump.net
            }
            atRetirement += netLump / pow(1 + r.inflation, year.toDouble()) * pow(1 + r.realReturn, (ytr - year).toDouble())
        }
        val rows = mutableListOf<GermanRetirementRow>()
        val issues = LinkedHashSet<String>()
        var capital = atRetirement
        var depletedAfter: Int? = null
        for (y in 0 until 50) {
            val fromToday = ytr + y
            val deflator = pow(1 + r.inflation, fromToday.toDouble())
            var pension = 0.0
            for (p in pensions) {
                if (paying(p, fromToday)) pension += p.result.monthlyGross * 12 * (1 - r.pensionDeductionRate) / deflator
                if (p.plan.yearsUntilPayment == fromToday) capital += p.result.lumpSum * (1 - r.pensionDeductionRate) / deflator
            }
            if (plan.pensionTax.mode == GermanPensionTaxMode.RULES) {
                val list = payments(fromToday)
                for (p in pensions) if (p.plan.yearsUntilPayment == fromToday) capital -= p.result.lumpSum * (1 - r.pensionDeductionRate) / deflator
                val net = germanPensionNet(list, plan)
                issues += net.issues
                val netValue = net.net ?: return GermanRetirementResult(atRetirement, null, emptyList(), null, issues.toList())
                val lumpGross = list.fold(0.0) { sum, p -> sum + p.lumpSum }
                capital += lumpGross / deflator
                pension = (netValue - lumpGross) / deflator
            }
            val withdrawal = maxOf(0.0, r.annualSpending - pension) / (1 - r.withdrawalTaxShare)
            capital = (capital - withdrawal) * (1 + r.realReturn)
            if (capital < 0 && depletedAfter == null) depletedAfter = y
            capital = maxOf(0.0, capital)
            rows += GermanRetirementRow(y, capital, pension, withdrawal)
        }
        val currentTarget = r.annualSpending / (1 - r.withdrawalTaxShare) / r.withdrawalRate
        return GermanRetirementResult(atRetirement, currentTarget, rows, depletedAfter, issues.toList())
    }

    // endregion

    /** Web `wealthAfterYears` (lib/calc/fire.ts), used by the retirement bridge. */
    internal fun wealthAfterYears(current: Double, annualSaving: Double, realReturn: Double, years: Double): Double {
        if (years <= 0) return current
        if (Math.abs(realReturn) < 1e-12) return current + annualSaving * years
        val growth = pow(1 + realReturn, years)
        return current * growth + (annualSaving * (growth - 1)) / realReturn
    }

    /** JS `String(number)` for the integer years used in crypto anniversaries. */
    private fun jsNumberString(n: Double): String =
        if (n.isNaN()) "NaN" else if (n == Math.floor(n) && Math.abs(n) < 1e21) n.toLong().toString() else n.toString()
}

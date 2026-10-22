package io.buddybudget.core.domain.planningde

import io.buddybudget.core.domain.format.BBFormat
import io.buddybudget.core.domain.format.BBLocale
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlin.math.abs
import kotlin.math.floor

// The German plan document as the app edits it (13-planning-de §2, PLAN-007…017): typed access to the tax profile on
// top of the verbatim JSON tree, the full client-side validation (port of zod `germanPlanSchema`), numeric input
// clamping and the save-bar state machine. Results come from the server (ADR 0002). Same names on iOS.

/** Fund tax classes in the order of the web select (`FUND_OPTIONS`). */
object GermanFundKinds {
    val all = listOf("unknown", "equity", "mixed", "property", "foreign-property", "other")
}

/** JSON helpers shared by the document, the validation and the tests. */
object PlanJson {
    operator fun JsonElement?.get(key: String): JsonElement? = (this as? JsonObject)?.get(key)

    fun JsonElement?.obj(): JsonObject? = this as? JsonObject
    fun JsonElement?.arr(): JsonArray? = this as? JsonArray
    fun JsonElement?.num(): Double? = (this as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
    fun JsonElement?.bool(): Boolean? = (this as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
    fun JsonElement?.str(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content

    /** Integral values without a fraction (2026, not 2026.0), like `JSON.stringify`. */
    fun number(value: Double): JsonPrimitive =
        if (value == floor(value) && abs(value) < 1e15) JsonPrimitive(value.toLong()) else JsonPrimitive(value)

    /** Structural equality with numbers compared by value (`2026` = `2026.0`), like comparing `JSON.stringify`. */
    fun same(a: JsonElement?, b: JsonElement?): Boolean = when {
        a is JsonObject && b is JsonObject -> a.keys == b.keys && a.keys.all { same(a[it], b[it]) }
        a is JsonArray && b is JsonArray -> a.size == b.size && a.indices.all { same(a[it], b[it]) }
        a is JsonPrimitive && b is JsonPrimitive && !a.isString && !b.isString && a.doubleOrNull != null && b.doubleOrNull != null ->
            a.doubleOrNull == b.doubleOrNull
        else -> a == b
    }
}

/**
 * The visible tax inputs (`plan.tax`, PLAN-018, PLAN-019, PLAN-025, PLAN-026). `year` and `futureForecast` are not
 * edited on mobile and stay as saved (PLAN-031).
 */
data class GermanTaxSettings(
    val joint: Boolean = false,
    /** 0, 0.08 or 0.09. */
    val churchRate: Double = 0.0,
    val allowanceUsedElsewhere: Double = 0.0,
    val verifiedForeignCredit: Double = 0.0,
    val shareLosses: Double = 0.0,
    val generalLosses: Double = 0.0,
    val otherCapitalIncome: Double = 0.0,
    val historyConfirmed: Boolean = false,
    /** Instrument id → fund kind (missing = `unknown`). */
    val fundKinds: Map<String, String> = emptyMap(),
    /** Sale transaction id → gross prior advances (EUR). */
    val priorAdvancesBySale: Map<String, Double> = emptyMap(),
    val fundHistoryConfirmed: Boolean = false,
) {
    fun fundKind(instrumentId: String): String = fundKinds[instrumentId] ?: "unknown"
    fun priorAdvances(saleId: String): Double = priorAdvancesBySale[saleId] ?: 0.0

    /**
     * [plan] with these settings written into `plan.tax`; every other key of the document (hidden sections, `year`,
     * `futureForecast`, unknown future keys) is kept as it was (PLAN-014, PLAN-031).
     */
    fun applied(plan: JsonElement): JsonElement {
        val root = (plan as? JsonObject)?.toMutableMap() ?: mutableMapOf()
        val tax = (root["tax"] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
        tax["joint"] = JsonPrimitive(joint)
        tax["churchRate"] = PlanJson.number(churchRate)
        tax["allowanceUsedElsewhere"] = PlanJson.number(allowanceUsedElsewhere)
        tax["verifiedForeignCredit"] = PlanJson.number(verifiedForeignCredit)
        tax["shareLosses"] = PlanJson.number(shareLosses)
        tax["generalLosses"] = PlanJson.number(generalLosses)
        tax["otherCapitalIncome"] = PlanJson.number(otherCapitalIncome)
        tax["historyConfirmed"] = JsonPrimitive(historyConfirmed)
        tax["fundKinds"] = JsonObject(fundKinds.mapValues { JsonPrimitive(it.value) })
        tax["priorAdvancesBySale"] = JsonObject(priorAdvancesBySale.mapValues { PlanJson.number(it.value) })
        tax["fundHistoryConfirmed"] = JsonPrimitive(fundHistoryConfirmed)
        root["tax"] = JsonObject(tax)
        return JsonObject(root)
    }

    companion object {
        /** Reads `plan.tax`, with the schema defaults for missing keys. */
        fun of(plan: JsonElement): GermanTaxSettings = with(PlanJson) {
            val tax = plan["tax"]
            GermanTaxSettings(
                joint = tax["joint"].bool() ?: false,
                churchRate = tax["churchRate"].num() ?: 0.0,
                allowanceUsedElsewhere = tax["allowanceUsedElsewhere"].num() ?: 0.0,
                verifiedForeignCredit = tax["verifiedForeignCredit"].num() ?: 0.0,
                shareLosses = tax["shareLosses"].num() ?: 0.0,
                generalLosses = tax["generalLosses"].num() ?: 0.0,
                otherCapitalIncome = tax["otherCapitalIncome"].num() ?: 0.0,
                historyConfirmed = tax["historyConfirmed"].bool() ?: false,
                fundKinds = tax["fundKinds"].obj()?.mapNotNull { (k, v) -> v.str()?.let { k to it } }?.toMap() ?: emptyMap(),
                priorAdvancesBySale = tax["priorAdvancesBySale"].obj()?.mapNotNull { (k, v) -> v.num()?.let { k to it } }?.toMap() ?: emptyMap(),
                fundHistoryConfirmed = tax["fundHistoryConfirmed"].bool() ?: false,
            )
        }
    }
}

// ---------------------------------------------------------------- Numeric inputs (PLAN-015)

/**
 * Web `NumberField`: min (default 0), max (default 1e12), empty or invalid text → 0, values clamped as typed; percent
 * fields are typed in % and stored as fractions.
 */
object PlanningNumberInput {
    const val DEFAULT_MAX = 1e12

    /** The stored value for the typed text. */
    fun value(text: String, min: Double = 0.0, max: Double = DEFAULT_MAX, percent: Boolean = false): Double {
        val typed = BBFormat.parseAmount(text) ?: 0.0
        val clamped = maxOf(min, minOf(max, if (typed.isFinite()) typed else 0.0))
        return if (percent) clamped / 100 else clamped
    }

    /** Text shown for a stored value (web `Number(value.toFixed(8))`), with the locale decimal separator, no grouping. */
    fun text(value: Double, locale: BBLocale, percent: Boolean = false): String {
        val shown = if (percent) value * 100 else value
        var s = String.format(java.util.Locale.ROOT, "%.8f", shown)
        s = s.trimEnd('0').trimEnd('.')
        if (s == "-0") s = "0"
        return if (locale == BBLocale.EN_GB) s else s.replace('.', ',')
    }

    /** True when the typed text is outside the limits, i.e. the field must show the clamped value instead. */
    fun needsClamp(text: String, min: Double = 0.0, max: Double = DEFAULT_MAX): Boolean {
        val typed = BBFormat.parseAmount(text) ?: return false
        return typed < min || typed > max
    }
}

// ---------------------------------------------------------------- Validation (PLAN-011)

/**
 * Port of zod `germanPlanSchema` (`lib/financial-planning/schema.ts`): strict objects (unknown keys rejected), every field
 * optional with its default, ranges, integers, enums, and the plan-level refinements. `true` = the server accepts the
 * document.
 */
object GermanPlanValidation {
    fun isValid(plan: JsonElement): Boolean = with(PlanJson) {
        val root = plan as? JsonObject ?: return false
        val v = Validator()
        v.obj(plan, mapOf(
            "version" to { n -> v.literal(n, 1.0) },
            "country" to { n -> v.stringLiteral(n, "DE") },
            "tax" to { n -> v.taxProfile(n) },
            "fund" to { n -> v.fundScenario(n) },
            "pensions" to { n -> v.array(n, 100) { v.pension(it) } },
            "pensionTax" to { n -> v.pensionTax(n) },
            "retirement" to { n -> v.retirement(n) },
            "crypto" to { n -> v.array(n, 1000) { v.cryptoSale(it) } },
            "cryptoOtherGains" to { n -> v.number(n, -1e12, 1e12) },
            "cryptoLossCarryforward" to { n -> v.money(n) },
            "otherTaxableIncome" to { n -> v.money(n) },
        ))
        if (!v.ok) return false
        // superRefine, on the values with defaults applied.
        val year = root["tax"]["year"].num() ?: 2026.0
        val pensions = root["pensions"].arr() ?: JsonArray(emptyList())
        val activeAvd = pensions.filter { it["kind"].str() == "avd" && (it["avd"]["enabled"].bool() ?: false) }
        if (activeAvd.size > 1) return false
        for (p in activeAvd) {
            val years = p["yearsUntilPayment"].num() ?: 0.0
            val avd = p["avd"]
            val start = avd["payoutStartAge"].num() ?: 67.0
            val age = avd["ageAtStart"].num() ?: 40.0
            val contributionStart = avd["contributionStartYear"].num() ?: 2027.0
            if (years != start - age + contributionStart - year) return false
            if (year + years <= contributionStart) return false
        }
        val pensionTax = root["pensionTax"]
        if ((pensionTax["childless"].bool() ?: false) && (pensionTax["childrenUnder25"].num() ?: 0.0) > 0) return false
        for (key in listOf("pensions", "crypto")) {
            val ids = mutableSetOf<String>()
            for (item in root[key].arr() ?: JsonArray(emptyList())) {
                if (!ids.add(item["id"].str() ?: "")) return false
            }
        }
        true
    }

    private class Validator {
        var ok = true

        fun fail() { ok = false }

        /** Strict object: unknown keys fail, missing keys take their default (not checked). */
        fun obj(node: JsonElement, fields: Map<String, (JsonElement) -> Unit>) {
            val o = node as? JsonObject ?: return fail()
            for ((key, value) in o) {
                val check = fields[key] ?: return fail()
                check(value)
            }
        }

        fun requiredKeys(node: JsonElement, keys: List<String>) {
            val o = node as? JsonObject ?: return fail()
            if (keys.any { it !in o }) fail()
        }

        fun number(node: JsonElement, min: Double, max: Double, int: Boolean = false) {
            val n = with(PlanJson) { node.num() }
            if (n == null || !n.isFinite() || n < min || n > max) return fail()
            if (int && n != floor(n)) fail()
        }

        fun nullableNumber(node: JsonElement, min: Double, max: Double, int: Boolean = false) {
            if (node is JsonNull) return
            number(node, min, max, int)
        }

        fun money(node: JsonElement, max: Double = 1e12) = number(node, 0.0, max)
        fun rate(node: JsonElement, max: Double = 1.0) = number(node, 0.0, max)
        fun int(node: JsonElement, min: Double, max: Double) = number(node, min, max, int = true)
        fun bool(node: JsonElement) { if (with(PlanJson) { node.bool() } == null) fail() }
        fun literal(node: JsonElement, value: Double) { if (with(PlanJson) { node.num() } != value) fail() }
        fun stringLiteral(node: JsonElement, value: String) { if (with(PlanJson) { node.str() } != value) fail() }
        fun oneOf(node: JsonElement, values: List<String>) { if (with(PlanJson) { node.str() } !in values) fail() }

        /** `z.string().trim().min(1).max(100)` (lengths in UTF-16 units, as in JavaScript). */
        fun name(node: JsonElement) {
            val s = with(PlanJson) { node.str() } ?: return fail()
            val n = s.trim().length
            if (n < 1 || n > 100) fail()
        }

        fun id(node: JsonElement) {
            val s = with(PlanJson) { node.str() } ?: return fail()
            if (s.length !in 1..100) fail()
        }

        /** `z.iso.date()`: `YYYY-MM-DD`, a real calendar day. */
        fun date(node: JsonElement) {
            val s = with(PlanJson) { node.str() } ?: return fail()
            if (!isIsoDate(s)) fail()
        }

        fun array(node: JsonElement, max: Int, each: (JsonElement) -> Unit) {
            val a = node as? JsonArray ?: return fail()
            if (a.size > max) return fail()
            a.forEach(each)
        }

        fun record(node: JsonElement, value: (JsonElement) -> Unit) {
            val o = node as? JsonObject ?: return fail()
            for ((key, v) in o) {
                if (key.length > 100) fail()
                value(v)
            }
        }

        fun taxProfile(node: JsonElement) = obj(node, mapOf(
            "year" to { n -> literal(n, 2026.0) },
            "futureForecast" to { n -> oneOf(n, listOf("verified", "constant-2026")) },
            "joint" to { n -> bool(n) },
            "churchRate" to { n -> if (with(PlanJson) { n.num() } !in listOf(0.0, 0.08, 0.09)) fail() },
            "allowanceUsedElsewhere" to { n -> money(n) },
            "shareLosses" to { n -> money(n) },
            "generalLosses" to { n -> money(n) },
            "otherCapitalIncome" to { n -> money(n) },
            "verifiedForeignCredit" to { n -> money(n) },
            "historyConfirmed" to { n -> bool(n) },
            "fundKinds" to { n -> record(n) { oneOf(it, GermanFundKinds.all) } },
            "priorAdvancesBySale" to { n -> record(n) { money(it) } },
            "fundHistoryConfirmed" to { n -> bool(n) },
        ))

        fun fundScenario(node: JsonElement) = obj(node, mapOf(
            "kind" to { n -> oneOf(n, GermanFundKinds.all) },
            "startValue" to { n -> money(n) },
            "endValue" to { n -> money(n) },
            "distributions" to { n -> money(n) },
            "acquisitionMonth" to { n -> int(n, 1.0, 12.0) },
        ))

        fun avd(node: JsonElement) {
            obj(node, mapOf(
                "enabled" to { n -> bool(n) },
                "contributionStartYear" to { n -> int(n, 2027.0, 2100.0) },
                "eligibility" to { n -> oneOf(n, listOf("none", "direct", "indirect")) },
                "spouseAnnualContribution" to { n -> money(n, 6840.0) },
                "childAllowanceYears" to { n -> array(n, 20) { int(it, 0.0, 30.0) } },
                "starterBonus" to { n -> bool(n) },
                "ageAtStart" to { n -> int(n, 18.0, 100.0) },
                "taxableIncomeBeforeDeduction" to { n -> money(n) },
                "payout" to { n -> oneOf(n, listOf("provider", "drawdown")) },
                "payoutStartAge" to { n -> int(n, 65.0, 70.0) },
                "payoutEndAge" to { n -> int(n, 85.0, 120.0) },
                "lumpSumRate" to { n -> rate(n, 0.3) },
                "payoutReturn" to { n -> number(n, -0.5, 0.3) },
            ))
            if (!ok || node !is JsonObject) return
            with(PlanJson) {
                if (node["payout"].str() == "drawdown" && (node["payoutEndAge"].num() ?: 85.0) <= (node["payoutStartAge"].num() ?: 67.0)) fail()
            }
        }

        fun pension(node: JsonElement) {
            requiredKeys(node, listOf("id", "name", "kind"))
            obj(node, mapOf(
                "id" to { n -> id(n) },
                "name" to { n -> name(n) },
                "kind" to { n -> oneOf(n, listOf("statutory", "occupational", "riester", "ruerup", "private", "avd")) },
                "capital" to { n -> money(n) },
                "monthlyContribution" to { n -> money(n) },
                "monthlyGross" to { n -> money(n) },
                "yearsUntilPayment" to { n -> int(n, 0.0, 80.0) },
                "nominalReturn" to { n -> number(n, -0.5, 0.3) },
                "points" to { n -> money(n, 1000.0) },
                "annualPoints" to { n -> money(n, 10.0) },
                "accessFactor" to { n -> number(n, 0.0, 2.0) },
                "taxTreatment" to { n -> oneOf(n, listOf("unknown", "funded", "private-annuity", "statement")) },
                "taxableAnnualFromStatement" to { n -> money(n) },
                "pensionStartYear" to { n -> nullableNumber(n, 1900.0, 2200.0, int = true) },
                "taxFreeAnnualAmount" to { n -> nullableNumber(n, 0.0, 1e12) },
                "ageAtPayment" to { n -> int(n, 0.0, 120.0) },
                "avd" to { n -> avd(n) },
                "paymentMode" to { n -> oneOf(n, listOf("income", "capital")) },
            ))
            if (!ok) return
            with(PlanJson) {
                val kind = node["kind"].str() ?: ""
                if (kind == "avd" && (node["avd"]["enabled"].bool() ?: false) && (node["monthlyContribution"].num() ?: 0.0) * 12 > 6840) fail()
                if (kind in listOf("statutory", "ruerup", "riester", "avd") && (node["paymentMode"].str() ?: "income") != "income") fail()
            }
        }

        fun pensionTax(node: JsonElement) = obj(node, mapOf(
            "mode" to { n -> oneOf(n, listOf("manual", "rules")) },
            "insurance" to { n -> oneOf(n, listOf("kvdr", "voluntary", "private")) },
            "additionalHealthRate" to { n -> rate(n, 0.1) },
            "childless" to { n -> bool(n) },
            "childrenUnder25" to { n -> int(n, 0.0, 20.0) },
            "otherInsuranceIncome" to { n -> money(n) },
            "voluntarySubsidy" to { n -> bool(n) },
            "annualPrivatePremium" to { n -> money(n) },
            "annualDeductiblePremium" to { n -> money(n) },
            "surchargeChildAllowance" to { n -> money(n) },
            "otherTaxableIncome" to { n -> money(n) },
            "otherDeductions" to { n -> money(n) },
        ))

        fun retirement(node: JsonElement) = obj(node, mapOf(
            "liquidCapital" to { n -> money(n) },
            "annualSaving" to { n -> money(n) },
            "annualSpending" to { n -> money(n) },
            "yearsUntilRetirement" to { n -> int(n, 0.0, 80.0) },
            "realReturn" to { n -> number(n, -0.5, 0.3) },
            "withdrawalRate" to { n -> number(n, 0.005, 0.2) },
            "inflation" to { n -> number(n, 0.0, 0.2) },
            "pensionDeductionRate" to { n -> rate(n) },
            "withdrawalTaxShare" to { n -> rate(n, 0.9) },
        ))

        fun cryptoSale(node: JsonElement) {
            requiredKeys(node, listOf("id", "name", "acquired", "sold", "proceeds", "cost"))
            obj(node, mapOf(
                "id" to { n -> id(n) },
                "name" to { n -> name(n) },
                "acquired" to { n -> date(n) },
                "sold" to { n -> date(n) },
                "proceeds" to { n -> money(n) },
                "cost" to { n -> money(n) },
                "fees" to { n -> money(n) },
            ))
            if (!ok) return
            with(PlanJson) {
                val acquired = node["acquired"].str() ?: ""
                val sold = node["sold"].str() ?: ""
                if (sold < acquired || !sold.startsWith("2026-")) fail()
            }
        }
    }

    internal fun isIsoDate(s: String): Boolean {
        if (!Regex("""\d{4}-\d{2}-\d{2}""").matches(s)) return false
        val y = s.substring(0, 4).toInt()
        val m = s.substring(5, 7).toInt()
        val d = s.substring(8, 10).toInt()
        if (m !in 1..12 || d < 1) return false
        val leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
        val days = intArrayOf(31, if (leap) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[m - 1]
        return d <= days
    }
}

// ---------------------------------------------------------------- Save bar (PLAN-010…014)

/** Messages of the save bar (web `role="alert"` lines). */
enum class GermanPlanMessage(val key: String) {
    /** 409 `plan_changed` (PLAN-013). */
    CONFLICT("This plan changed in another tab. Reload before saving."),
    /** Any other failure; edits are kept. */
    FAILED("Could not save. Your changes are still here."),
}

/**
 * The editor of the plan document: the saved plan and revision, the edited draft and the save state. One per signed-in
 * DE user, shared by the Tax and Income tabs; Income always shows the saved plan's results.
 */
data class GermanPlanEditor(
    val saved: JsonElement,
    val revision: Int,
    val draft: JsonElement = saved,
    val saving: Boolean = false,
    val message: GermanPlanMessage? = null,
) {
    val tax: GermanTaxSettings get() = GermanTaxSettings.of(draft)
    val isDirty: Boolean get() = !PlanJson.same(draft, saved)
    val isValid: Boolean get() = GermanPlanValidation.isValid(draft)
    /** PLAN-010: enabled only when changed, valid and not saving. */
    val canSave: Boolean get() = !saving && isDirty && isValid
    /** `Unsaved changes` / `Plan saved`. */
    val statusKey: String get() = if (isDirty) "Unsaved changes" else "Plan saved"
    /** `Save plan` / `Saving…`. */
    val buttonKey: String get() = if (saving) "Saving…" else "Save plan"
    /** PLAN-011. */
    val validationKey: String? get() = if (isValid) null else "Check the entered names, dates and numeric limits before saving."

    fun updateTax(change: (GermanTaxSettings) -> GermanTaxSettings): GermanPlanEditor = copy(draft = change(tax).applied(draft))

    /** Starts a save: the editor in the saving state, or null when saving is not allowed. Send `draft` and `revision`. */
    fun beginSave(): GermanPlanEditor? = if (canSave) copy(saving = true, message = null) else null

    /** PLAN-012: adopt the server's plan and revision; the editor resets to the saved state. */
    fun saveSucceeded(plan: JsonElement, revision: Int): GermanPlanEditor = GermanPlanEditor(plan, revision)

    /** PLAN-013: keep the edits, show why. */
    fun saveFailed(conflict: Boolean): GermanPlanEditor =
        copy(saving = false, message = if (conflict) GermanPlanMessage.CONFLICT else GermanPlanMessage.FAILED)

    /** Unsaved-changes sheet «Discard»: back to the saved plan. */
    fun discard(): GermanPlanEditor = copy(draft = saved, message = null)

    /** A fresh load (first load, pull to refresh, 409 «Reload»): replaces saved, revision and draft. */
    fun reload(plan: JsonElement, revision: Int): GermanPlanEditor = GermanPlanEditor(plan, revision)
}

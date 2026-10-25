package io.buddybudget.core.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// German financial planning (13-planning-de): the plan document with its revision (`GET/PUT /api/financial-planning`),
// the server-computed results (`?include=results`, `POST /api/financial-planning/results`) and the instrument names /
// fund sales the screens label them with (`GET /api/investments/overview`). Spec: api/endpoints/financial-planning.md.
// Same names on iOS (`FinancialPlanningAPI.swift`). The plan stays a verbatim `JsonElement` tree, so fields the app
// does not edit (hidden sections, future keys) survive a save (PLAN-014).

/** `GET /api/financial-planning[?include=results]` and `PUT` responses. */
@Serializable
data class PlanningEnvelope(
    val plan: JsonElement,
    val revision: Int,
    /** Only with `?include=results`. */
    val results: PlanningResults? = null,
)

/**
 * `PlanningResults` (`lib/views/financial-planning.ts`): what the Tax and Income sections compute from the plan and all
 * investment data, for the sections the rollout switches enable.
 */
@Serializable
data class PlanningResults(
    val currency: String = "EUR",
    /** false when the account currency is not EUR (PLAN-009): [tax] and [income] are null. */
    val supported: Boolean = true,
    val sections: Sections = Sections(),
    val tax: Tax? = null,
    val income: Income? = null,
) {
    @Serializable
    data class Sections(
        val tax: Boolean = true,
        val income: Boolean = true,
        val pension: Boolean = false,
        val retirement: Boolean = false,
        val simulations: Boolean = false,
    )

    @Serializable
    data class TaxEvent(
        val id: String,
        val instrumentId: String,
        val date: String,
        val gain: FlexDouble,
        val taxable: FlexDouble,
        /** `shares` | `general`. */
        val basket: String = "general",
    )

    @Serializable
    data class TaxIssue(
        /** "" for portfolio-wide issues (currency, history). */
        val instrumentId: String = "",
        /** `currency` | `history` | `classification` | `fund-history` | `legacy` | `unsupported` | `missing-lots` | `invalid`. */
        val reason: String,
    )

    @Serializable
    data class TaxEstimate(
        val taxable: FlexDouble,
        val foreignCredit: FlexDouble,
        val usedAllowance: FlexDouble,
        val remainingAllowance: FlexDouble,
        val capitalTax: FlexDouble,
        val solidarity: FlexDouble,
        val church: FlexDouble,
        val total: FlexDouble,
        val remainingShareLosses: FlexDouble,
        val remainingGeneralLosses: FlexDouble,
    )

    @Serializable
    data class TaxReport(
        val events: List<TaxEvent> = emptyList(),
        val issues: List<TaxIssue> = emptyList(),
        val recordedTaxes: FlexDouble = 0.0,
        val shareGains: FlexDouble = 0.0,
        val generalIncome: FlexDouble = 0.0,
        /** null while any issue exists (PLAN-016, PLAN-022). */
        val estimate: TaxEstimate? = null,
    )

    @Serializable
    data class Tax(
        val report: TaxReport,
        /** Funds / ETFs with operations to classify (`plan.tax.fundKinds`). */
        val fundInstrumentIds: List<String> = emptyList(),
        /** 2026 fund sales that take prior advances (`plan.tax.priorAdvancesBySale`). */
        val fundSaleIds: List<String> = emptyList(),
    )

    @Serializable
    data class IncomeEvent(
        val instrumentId: String,
        /** `dividendo` | `cedola`. */
        val kind: String = "dividendo",
        val date: String,
        val gross: FlexDouble,
        /** null = «More information needed» (PLAN-029). */
        val net: FlexDouble? = null,
        /** Row computed with unchanged 2026 rules (only with simulations). */
        val benchmark: Boolean = false,
    )

    @Serializable
    data class IncomeYear(val year: Int, val gross: FlexDouble, val withheld: FlexDouble, val net: FlexDouble)

    @Serializable
    data class Income(
        val events: List<IncomeEvent> = emptyList(),
        val totalGross: FlexDouble = 0.0,
        val bondsWithoutTerms: List<String> = emptyList(),
        val history: List<IncomeYear> = emptyList(),
    )
}

/**
 * The parts of `GET /api/investments/overview` the planning screens label results with (PLAN-008): instrument names and
 * the operations behind fund rows. Prices are not needed (the server computes), so the app asks for the shortest price
 * window; instruments and operations are always complete.
 */
@Serializable
data class PlanningPortfolio(
    val currency: String = "EUR",
    val instruments: List<InstrumentRef> = emptyList(),
    val transactions: List<Operation> = emptyList(),
) {
    @Serializable
    data class InstrumentRef(val id: String, val name: String, val type: String)

    @Serializable
    data class Operation(val id: String, val instrumentId: String, val type: String, val date: String)

    fun name(instrumentId: String): String? = instruments.firstOrNull { it.id == instrumentId }?.name
    fun operation(id: String): Operation? = transactions.firstOrNull { it.id == id }
}

class FinancialPlanningApi(private val client: ApiClient) {
    /** PLAN-007: the saved plan (defaults with revision 0 when nothing is saved) and the results of the saved plan. */
    suspend fun load(): PlanningEnvelope =
        client.get("api/financial-planning", PlanningEnvelope.serializer(), mapOf("include" to "results"))

    /** PLAN-012: saves the whole document with the revision last loaded. 409 `plan_changed` when stale (PLAN-013). */
    suspend fun save(plan: JsonElement, revision: Int): PlanningEnvelope {
        val body = buildJsonObject {
            put("plan", plan)
            put("revision", revision)
        }
        return client.put("api/financial-planning", body.toString(), PlanningEnvelope.serializer())
    }

    /** Results of an unsaved plan (pure, nothing saved): called debounced while the user edits the tax profile. */
    suspend fun preview(plan: JsonElement): PlanningResults =
        client.post("api/financial-planning/results", JsonObject(mapOf("plan" to plan)).toString(), PlanningResults.serializer())

    /** PLAN-008: instruments and operations (`period=1mese` keeps the price arrays short; operations are all of them). */
    suspend fun portfolio(): PlanningPortfolio =
        client.get("api/investments/overview", PlanningPortfolio.serializer(), mapOf("period" to "1mese"))
}

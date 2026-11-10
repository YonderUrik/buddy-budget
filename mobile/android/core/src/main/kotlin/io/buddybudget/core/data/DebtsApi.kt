package io.buddybudget.core.data

import io.buddybudget.core.domain.debts.DebtCreateInput
import io.buddybudget.core.domain.debts.DebtEarlyRepaymentEffect
import io.buddybudget.core.domain.debts.DebtInstallmentStatus
import io.buddybudget.core.domain.debts.DebtStartMode
import io.buddybudget.core.domain.debts.DebtsRules
import io.buddybudget.core.domain.periods.CalendarDate
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Debiti (spec: api/endpoints/debts.md, features/10-debts.md). Amounts are JSON numbers.
// Same names on iOS (`DebtsAPI` and the models in `BuddyBudgetKit/Data/DebtsAPI.swift`).

/** `DebtsViewData`: every loan with its server-computed plan, the totals and the overview readings (DEBT-001). */
@Serializable
data class DebtsViewData(
    val debts: List<DebtView> = emptyList(),
    val overview: DebtsOverview,
    /** `?include=insights` (gaps.md G12). */
    val insights: DebtsInsights? = null,
) {
    fun debt(id: String): DebtView? = debts.firstOrNull { it.id == id }
}

@Serializable
data class DebtCostData(val label: String, val amount: Double, val kind: String)

@Serializable
data class DebtView(
    val id: String,
    val name: String,
    @SerialName("startMode") val startModeRaw: String,
    val principal: Double,
    val annualRate: Double,
    val installments: Int,
    val firstInstallmentDate: String,
    val declaredInstallment: Double? = null,
    val anchorDate: String? = null,
    val costs: List<DebtCostData> = emptyList(),
    val plan: DebtPlanData,
    /** TAEG %, null when not computable. */
    val apr: Double? = null,
    /** Sorted by date ascending. */
    val events: List<DebtEventView> = emptyList(),
) {
    val startMode: DebtStartMode get() = DebtStartMode.fromKey(startModeRaw) ?: DebtStartMode.NUOVO
    val totals: DebtPlanTotals get() = plan.totals
    val finished: Boolean get() = plan.totals.finished
}

@Serializable
data class DebtPlanData(val rows: List<DebtPlanRow> = emptyList(), val totals: DebtPlanTotals)

@Serializable
data class DebtPlanRow(
    val number: Int,
    val dueDate: String,
    val installment: Double,
    val interest: Double,
    val capital: Double,
    /** Residual after this installment. */
    val residual: Double,
    @SerialName("status") val statusRaw: String,
    val payment: Payment? = null,
) {
    @Serializable
    data class Payment(val date: String, val amount: Double, val transactionId: String? = null)

    /** Unknown future values read as «Da pagare». */
    val status: DebtInstallmentStatus get() = DebtInstallmentStatus.entries.firstOrNull { it.key == statusRaw } ?: DebtInstallmentStatus.DA_PAGARE

    constructor(number: Int, dueDate: String, installment: Double, interest: Double, capital: Double, residual: Double, status: DebtInstallmentStatus) :
        this(number, dueDate, installment, interest, capital, residual, status.key, null)
}

@Serializable
data class DebtPlanTotals(
    val residual: Double,
    val currentInstallment: Double,
    val interestToDate: Double = 0.0,
    val interestRemaining: Double,
    val paidTotal: Double = 0.0,
    val remainingInstallments: Int,
    val endDate: String,
    val nextDueDate: String? = null,
    val overdueCount: Int = 0,
    val unconfirmedCount: Int = 0,
    val finished: Boolean = false,
    val closedOn: String? = null,
)

@Serializable
data class DebtEventView(
    val id: String,
    /** `payment` | `rate_change` | `balance_correction` | `early_repayment`. */
    val type: String,
    val date: String,
    val amount: Double? = null,
    val installmentNumber: Int? = null,
    val rate: Double? = null,
    val penalty: Double? = null,
    val effect: String? = null,
    val transactionId: String? = null,
)

@Serializable
data class DebtsOverview(
    val totalResidual: Double,
    val totalDebt: Double,
    val monthlyPayment: Double = 0.0,
    val debtFreeDate: String? = null,
    val openCount: Int = 0,
    /** Max 5, by date ascending (DEBT-003). */
    val nextDue: List<Due> = emptyList(),
) {
    @Serializable
    data class Due(val debtId: String, val name: String, val date: String, val amount: Double, val overdue: Boolean)
}

@Serializable
data class DebtsInsights(val interestShares: InterestShares, val repaid: List<Repaid> = emptyList(), val exit: Exit) {
    @Serializable data class InterestShare(val id: String, val name: String, val yearly: Double, val share: Double)
    @Serializable data class InterestShares(val items: List<InterestShare> = emptyList(), val total: Double = 0.0)
    @Serializable data class Repaid(val debtId: String, val share: Double)
    @Serializable data class Slider(val min: Double, val max: Double, val step: Double, val default: Double)
    @Serializable data class ExitStep(val id: String, val name: String, val endDate: String, val baselineEndDate: String, val monthsSaved: Int)
    @Serializable data class ExitPlan(val steps: List<ExitStep> = emptyList(), val endDate: String, val baselineEndDate: String, val interestSaved: Double)

    /** `plans[i]` = plan with `extras[i]` per month (null without open loans). */
    @Serializable data class Exit(val slider: Slider, val extras: List<Double> = emptyList(), val plans: List<ExitPlan?> = emptyList())
}

/** `POST /api/debts/{id}/events` body (discriminated on `type`). */
sealed interface DebtEventInput {
    data class Payment(val installmentNumber: Int, val date: String, val amount: Double, val transactionId: String?) : DebtEventInput
    data class RateChange(val date: String, val rate: Double) : DebtEventInput
    data class BalanceCorrection(val date: String, val amount: Double) : DebtEventInput
    data class EarlyRepayment(val date: String, val amount: Double, val penalty: Double, val effect: DebtEarlyRepaymentEffect) : DebtEventInput

    fun toJson(): JsonObject = when (this) {
        is Payment -> buildJsonObject {
            put("type", "payment"); put("installmentNumber", installmentNumber); put("date", date); put("amount", amount)
            transactionId?.let { put("transactionId", it) }
        }
        is RateChange -> buildJsonObject { put("type", "rate_change"); put("date", date); put("rate", rate) }
        is BalanceCorrection -> buildJsonObject { put("type", "balance_correction"); put("date", date); put("amount", amount) }
        is EarlyRepayment -> buildJsonObject {
            put("type", "early_repayment"); put("date", date); put("amount", amount); put("penalty", penalty); put("effect", effect.key)
        }
    }
}

/** DEBT-017: `installment` only when typed, `anchorDate` only for `fotografia`. */
fun DebtCreateInput.toJson(): JsonObject = buildJsonObject {
    put("name", name); put("startMode", startMode.key); put("principal", principal); put("annualRate", annualRate)
    put("installments", installments); put("firstInstallmentDate", firstInstallmentDate)
    put("costs", buildJsonArray {
        costs.forEach { c -> add(buildJsonObject { put("label", c.label); put("amount", c.amount); put("kind", c.kind.key) }) }
    })
    installment?.let { put("installment", it) }
    anchorDate?.let { put("anchorDate", it) }
}

class DebtsApi(private val client: ApiClient) {
    /** DEBT-001: one request for every Debiti screen (`?include=insights`). */
    suspend fun view(): DebtsViewData = client.get("api/debts", DebtsViewData.serializer(), mapOf("include" to "insights"))

    /** DEBT-016 (201 `{ id }`). */
    suspend fun create(input: DebtCreateInput): String = idOf(client.send("api/debts", "POST", body = input.toJson().toString()).text)

    /** DEBT-028 (204). */
    suspend fun delete(id: String) = client.sendNoContent("api/debts/$id", "DELETE")

    /** DEBT-023/025/026/034 (201). */
    suspend fun addEvent(debtId: String, input: DebtEventInput) {
        client.send("api/debts/$debtId/events", "POST", body = input.toJson().toString())
    }

    /** DEBT-027 (204). */
    suspend fun deleteEvent(debtId: String, eventId: String) = client.sendNoContent("api/debts/$debtId/events/$eventId", "DELETE")

    /** DEBT-020: marks every past unsettled installment up to `upTo` (201 `{ count }`). */
    suspend fun bulkPay(debtId: String, upTo: Int): Int {
        val response = client.send("api/debts/$debtId/payments/bulk", "POST", body = buildJsonObject { put("upToInstallment", upTo) }.toString())
        return client.json.parseToJsonElement(response.text).jsonObject["count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
    }

    /** DEBT-024: expenses within ±20 days of the due date (paged endpoint, one page of 200). */
    suspend fun candidates(dueDate: String): List<Movement> {
        val due = CalendarDate.parse(dueDate) ?: return emptyList()
        val query = mapOf(
            "from" to due.plusDays(-DebtsRules.CANDIDATE_WINDOW_DAYS).iso, "to" to due.plusDays(DebtsRules.CANDIDATE_WINDOW_DAYS).iso,
            "type" to MovementType.uscita.name, "limit" to "200",
        )
        return client.get("api/transactions", MovementPage.serializer(), query).items
    }

    companion object {
        internal fun idOf(text: String): String = runCatching {
            ApiClient.DefaultJson.parseToJsonElement(text).jsonObject["id"]?.jsonPrimitive?.content
        }.getOrNull() ?: ""
    }
}
